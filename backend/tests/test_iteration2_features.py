"""Iteration 2 tests: RBAC/orgs, coach booking, training plans, rankings,
referrals, error envelope, concurrency."""
import time
import uuid
import pytest
import requests


ADMIN_MOBILE = "9000000001"
OTP = "123456"


def _login(api_client, base_url, mobile):
    api_client.post(f"{base_url}/api/auth/otp/start", json={"mobile": mobile})
    r = api_client.post(f"{base_url}/api/auth/otp/verify", json={"mobile": mobile, "otp": OTP})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ============= Error envelope =============
def test_error_envelope_unauthenticated(api_client, base_url):
    r = api_client.get(f"{base_url}/api/me")
    assert r.status_code == 401
    body = r.json()
    assert "error" in body and "code" in body["error"] and "message" in body["error"]
    assert "request_id" in body
    assert body["error"]["code"] in ("UNAUTHENTICATED", "TOKEN_INVALID")


# ============= AUTH / RBAC =============
def test_admin_bootstrap_capabilities(api_client, base_url):
    token, user = _login(api_client, base_url, ADMIN_MOBILE)
    r = api_client.get(f"{base_url}/api/me", headers=_h(token))
    assert r.status_code == 200
    caps = r.json().get("capabilities", {})
    assert caps.get("is_platform_admin") is True
    assert "PLATFORM_ADMIN" in caps.get("roles", [])
    r2 = api_client.get(f"{base_url}/api/capabilities", headers=_h(token))
    assert r2.status_code == 200
    assert "PLATFORM_ADMIN" in r2.json().get("roles", [])


def test_normal_user_no_org_no_admin(api_client, base_url):
    mobile = f"9555{int(time.time())%1000000:06d}"
    token, _ = _login(api_client, base_url, mobile)
    r = api_client.get(f"{base_url}/api/capabilities", headers=_h(token))
    assert r.status_code == 200
    caps = r.json()
    assert caps["roles"] == ["PLAYER"]
    assert caps["is_platform_admin"] is False
    assert caps["organizations"] == []


def test_self_promotion_blocked(api_client, base_url):
    mobile = f"9556{int(time.time())%1000000:06d}"
    token, _ = _login(api_client, base_url, mobile)
    r = api_client.post(f"{base_url}/api/admin/clubs",
                       json={"name": "Hack Club", "city": "Bangalore"},
                       headers=_h(token))
    assert r.status_code == 403
    body = r.json()
    assert body["error"]["code"] in ("FORBIDDEN", "PERMISSION_DENIED")


# ============= PROVISIONING =============
@pytest.fixture(scope="module")
def admin_ctx(api_client, base_url):
    t, u = _login(api_client, base_url, ADMIN_MOBILE)
    return {"token": t, "user": u, "headers": _h(t)}


@pytest.fixture(scope="module")
def two_clubs(api_client, base_url, admin_ctx):
    facs = api_client.get(f"{base_url}/api/facilities").json()
    fid_a = facs[0]["id"]
    fid_b = facs[1]["id"] if len(facs) > 1 else facs[0]["id"]
    unique = uuid.uuid4().hex[:6]

    r1 = api_client.post(f"{base_url}/api/admin/clubs",
                        json={"name": f"TEST_ClubA_{unique}", "city": "Bangalore", "facility_ids": [fid_a]},
                        headers=admin_ctx["headers"])
    assert r1.status_code == 200, r1.text
    club_a = r1.json()

    r2 = api_client.post(f"{base_url}/api/admin/clubs",
                        json={"name": f"TEST_ClubB_{unique}", "city": "Bangalore", "facility_ids": [fid_b]},
                        headers=admin_ctx["headers"])
    assert r2.status_code == 200
    club_b = r2.json()

    owner_a_mobile = f"9111{int(time.time())%1000000:06d}"
    owner_b_mobile = f"9112{int(time.time()+1)%1000000:06d}"

    ra = api_client.post(f"{base_url}/api/admin/clubs/{club_a['id']}/owner",
                        json={"mobile": owner_a_mobile, "name": "OwnerA"},
                        headers=admin_ctx["headers"])
    assert ra.status_code == 200, ra.text
    assert ra.json()["assigned"] is True

    rb = api_client.post(f"{base_url}/api/admin/clubs/{club_b['id']}/owner",
                        json={"mobile": owner_b_mobile, "name": "OwnerB"},
                        headers=admin_ctx["headers"])
    assert rb.status_code == 200

    # idempotent (no duplicate)
    ra2 = api_client.post(f"{base_url}/api/admin/clubs/{club_a['id']}/owner",
                         json={"mobile": owner_a_mobile, "name": "OwnerA"},
                         headers=admin_ctx["headers"])
    assert ra2.status_code == 200

    return {"club_a": club_a, "club_b": club_b,
            "owner_a_mobile": owner_a_mobile, "owner_b_mobile": owner_b_mobile}


def test_owner_login_shows_capabilities(api_client, base_url, two_clubs):
    t, _ = _login(api_client, base_url, two_clubs["owner_a_mobile"])
    r = api_client.get(f"{base_url}/api/capabilities", headers=_h(t))
    assert r.status_code == 200
    caps = r.json()
    assert "CLUB_OWNER" in caps["roles"]
    orgs = [o["org_id"] for o in caps["organizations"]]
    assert two_clubs["club_a"]["id"] in orgs


def test_org_isolation_non_member_403(api_client, base_url, two_clubs):
    mobile = f"9557{int(time.time())%1000000:06d}"
    t, _ = _login(api_client, base_url, mobile)
    for path in ["analytics", "bookings", "members"]:
        r = api_client.get(f"{base_url}/api/orgs/{two_clubs['club_a']['id']}/{path}", headers=_h(t))
        assert r.status_code == 403, f"{path} => {r.status_code}"
        assert r.json()["error"]["code"] in ("ORG_ACCESS_DENIED", "PERMISSION_DENIED")


def test_owner_can_read_own_org_not_other(api_client, base_url, two_clubs):
    ta, _ = _login(api_client, base_url, two_clubs["owner_a_mobile"])
    r_own = api_client.get(f"{base_url}/api/orgs/{two_clubs['club_a']['id']}/analytics", headers=_h(ta))
    assert r_own.status_code == 200
    data = r_own.json()
    assert "revenue" in data and "bookings_count" in data
    r_other = api_client.get(f"{base_url}/api/orgs/{two_clubs['club_b']['id']}/analytics", headers=_h(ta))
    assert r_other.status_code == 403


# ============= BOOKING CONCURRENCY =============
def test_booking_slot_conflict_409(api_client, base_url):
    mobile1 = f"9558{int(time.time())%1000000:06d}"
    mobile2 = f"9559{int(time.time()+2)%1000000:06d}"
    t1, _ = _login(api_client, base_url, mobile1)
    t2, _ = _login(api_client, base_url, mobile2)
    fid = api_client.get(f"{base_url}/api/facilities").json()[0]["id"]
    date = f"2026-05-{(int(time.time())%25)+1:02d}"
    payload = {"facility_id": fid, "court_number": 1, "date": date, "slot": "10:00-11:00", "duration_min": 60}
    r1 = api_client.post(f"{base_url}/api/bookings", json=payload, headers=_h(t1))
    assert r1.status_code == 200
    r2 = api_client.post(f"{base_url}/api/bookings", json=payload, headers=_h(t2))
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "BOOKING_SLOT_UNAVAILABLE"
    # availability reflects
    av = api_client.get(f"{base_url}/api/facilities/{fid}/availability?date={date}").json()
    court1 = next(c for c in av["courts"] if c["court_number"] == 1)
    slot = next(s for s in court1["slots"] if s["slot"] == "10:00-11:00")
    assert slot["available"] is False


# ============= GAME JOIN =============
def test_game_full_and_idempotent_join(api_client, base_url):
    # Host creates a small game (max 2), one player joins to fill, third gets 409
    host_m = f"9560{int(time.time())%1000000:06d}"
    p2_m = f"9561{int(time.time()+1)%1000000:06d}"
    p3_m = f"9562{int(time.time()+2)%1000000:06d}"
    th, _ = _login(api_client, base_url, host_m)
    t2, _ = _login(api_client, base_url, p2_m)
    t3, _ = _login(api_client, base_url, p3_m)
    fid = api_client.get(f"{base_url}/api/facilities").json()[0]["id"]
    r = api_client.post(f"{base_url}/api/games", json={
        "sport": "sport-pickleball", "facility_id": fid, "date": "2026-06-10",
        "duration_min": 60, "skill_level": "Intermediate", "format": "Singles",
        "max_players": 2, "price_per_person": 100, "notes": "TEST_full",
    }, headers=_h(th))
    assert r.status_code == 200
    gid = r.json()["id"]
    # host joins again (idempotent)
    r_dup = api_client.post(f"{base_url}/api/games/{gid}/join", headers=_h(th))
    assert r_dup.status_code == 200
    # p2 fills to capacity
    rj2 = api_client.post(f"{base_url}/api/games/{gid}/join", headers=_h(t2))
    assert rj2.status_code == 200
    # p2 duplicate is idempotent
    rj2b = api_client.post(f"{base_url}/api/games/{gid}/join", headers=_h(t2))
    assert rj2b.status_code == 200
    # p3 -> full
    rj3 = api_client.post(f"{base_url}/api/games/{gid}/join", headers=_h(t3))
    assert rj3.status_code == 409
    assert rj3.json()["error"]["code"] == "GAME_FULL"


# ============= COACH BOOKING =============
def test_coach_booking_flow_and_conflict(api_client, base_url):
    m1 = f"9563{int(time.time())%1000000:06d}"
    m2 = f"9564{int(time.time()+1)%1000000:06d}"
    t1, _ = _login(api_client, base_url, m1)
    t2, _ = _login(api_client, base_url, m2)
    coaches = api_client.get(f"{base_url}/api/coaches").json()
    assert coaches
    coach_id = coaches[0]["id"]
    date = f"2026-07-{(int(time.time())%25)+1:02d}"
    av = api_client.get(f"{base_url}/api/coaches/{coach_id}/availability?date={date}")
    assert av.status_code == 200
    avd = av.json()
    assert avd["coach_id"] == coach_id and avd["slots"]
    slot = next(s["slot"] for s in avd["slots"] if s["available"])
    r = api_client.post(f"{base_url}/api/coach-sessions",
                       json={"coach_id": coach_id, "date": date, "slot": slot},
                       headers=_h(t1))
    assert r.status_code == 200, r.text
    sess = r.json()
    assert sess["status"] == "confirmed"
    assert sess["payment"]["status"] == "paid"
    assert sess["price"] > 0
    # double-book with user2 → 409
    r2 = api_client.post(f"{base_url}/api/coach-sessions",
                        json={"coach_id": coach_id, "date": date, "slot": slot},
                        headers=_h(t2))
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "SLOT_UNAVAILABLE"
    # mine lists it
    mine = api_client.get(f"{base_url}/api/coach-sessions/mine", headers=_h(t1)).json()
    assert any(s["id"] == sess["id"] for s in mine)


# ============= TRAINING PLANS =============
def test_training_plan_and_streak(api_client, base_url):
    mobile = f"9565{int(time.time())%1000000:06d}"
    t, _ = _login(api_client, base_url, mobile)
    r = api_client.post(f"{base_url}/api/training/plans",
                       json={"goal": "backhand", "weeks": 4}, headers=_h(t))
    assert r.status_code == 200
    plan = r.json()
    assert len(plan["weeks"]) == 4
    drill = plan["weeks"][0]["drills"][0]
    r2 = api_client.post(f"{base_url}/api/training/plans/{plan['id']}/drills/{drill['id']}/toggle",
                        headers=_h(t))
    assert r2.status_code == 200
    # streak >= 1
    s = api_client.get(f"{base_url}/api/training/streak", headers=_h(t)).json()
    assert s["streak_days"] >= 1
    # list
    lst = api_client.get(f"{base_url}/api/training/plans", headers=_h(t)).json()
    assert any(p["id"] == plan["id"] for p in lst)


# ============= RANKINGS / ACHIEVEMENTS =============
def test_rankings_and_achievements(api_client, base_url):
    mobile = f"9566{int(time.time())%1000000:06d}"
    t, _ = _login(api_client, base_url, mobile)
    r = api_client.get(f"{base_url}/api/rankings?scope=city", headers=_h(t))
    assert r.status_code == 200
    board = r.json()["leaderboard"]
    assert any(row["is_me"] for row in board)
    assert all("rank" in row for row in board)
    a = api_client.get(f"{base_url}/api/achievements", headers=_h(t)).json()
    assert "earned_count" in a and "total" in a and isinstance(a["achievements"], list)
    assert all("earned" in x for x in a["achievements"])


# ============= REFERRALS =============
def test_referrals_end_to_end(api_client, base_url):
    ma = f"9567{int(time.time())%1000000:06d}"
    mb = f"9568{int(time.time()+1)%1000000:06d}"
    ta, _ = _login(api_client, base_url, ma)
    tb, _ = _login(api_client, base_url, mb)
    ra = api_client.get(f"{base_url}/api/referrals/me", headers=_h(ta)).json()
    assert "code" in ra and "share_message" in ra
    code = ra["code"]
    # B applies A's code
    r = api_client.post(f"{base_url}/api/referrals/apply", json={"code": code}, headers=_h(tb))
    assert r.status_code == 200
    # 2nd apply → 400
    r2 = api_client.post(f"{base_url}/api/referrals/apply", json={"code": code}, headers=_h(tb))
    assert r2.status_code == 400
    assert r2.json()["error"]["code"] == "REFERRAL_ALREADY_APPLIED"
    # self-code → 400
    rs = api_client.post(f"{base_url}/api/referrals/apply", json={"code": code}, headers=_h(ta))
    assert rs.status_code == 400
    # B joins first game -> A gets reward
    fid = api_client.get(f"{base_url}/api/facilities").json()[0]["id"]
    gc = api_client.post(f"{base_url}/api/games", json={
        "sport": "sport-pickleball", "facility_id": fid, "date": "2026-08-15",
        "duration_min": 60, "skill_level": "Beginner", "format": "Doubles",
        "max_players": 4, "price_per_person": 100, "notes": "TEST_ref",
    }, headers=_h(ta))
    assert gc.status_code == 200
    gid = gc.json()["id"]
    jr = api_client.post(f"{base_url}/api/games/{gid}/join", headers=_h(tb))
    assert jr.status_code == 200
    # verify A's referral stats
    ra2 = api_client.get(f"{base_url}/api/referrals/me", headers=_h(ta)).json()
    assert ra2["referrals"] >= 1
    assert ra2["rewards_earned"] > 0
