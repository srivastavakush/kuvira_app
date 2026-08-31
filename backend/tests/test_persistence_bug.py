"""Iteration 2 — regression tests for the reported persistence bug.

Covers:
- Fresh number => is_new=true, onboarded=false
- After onboarding, second /auth/otp/verify => is_new=false, onboarded=true and
  name/city/skill_level are persisted (fetched from DB)
- Mobile normalization: 10-digit vs +91 prefixed = SAME user id
- No stock avatar on new users (avatar is None)
- /api/ai/insights returns real values, not hardcoded 74/62/chart
- Consumer regression: facilities list, availability, bookings 409 on dup,
  games 409 when full, posts+like toggle, cart/order, ai/coach/chat
- RBAC: admin creates club + assigns owner, owner login gets CLUB_OWNER,
  non-member gets 403 on /orgs/{id}/*
"""
import os
import random
import time
import pytest
import requests

from conftest import BASE_URL


def _rand_mobile() -> str:
    # 10-digit indian-looking numbers; avoid rate-limit collisions across runs
    return "7" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _verify(api_client, mobile: str):
    r = api_client.post(
        f"{BASE_URL}/api/auth/otp/verify",
        json={"mobile": mobile, "otp": "123456"},
    )
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- persistence + normalization -----------------
class TestPersistenceAndNormalization:
    def test_fresh_number_is_new_true_and_no_avatar(self, api_client):
        mobile = _rand_mobile()
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": mobile})
        data = _verify(api_client, mobile)
        assert data["is_new"] is True
        u = data["user"]
        assert u["mobile"].endswith(mobile), u["mobile"]
        assert u["mobile"].startswith("+91")
        assert u.get("onboarded") in (False, None)
        # NO STOCK AVATAR
        assert u.get("avatar") in (None, ""), f"unexpected avatar assigned: {u.get('avatar')}"

    def test_onboarding_persists_and_second_login_skips(self, api_client):
        mobile = _rand_mobile()
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": mobile})
        first = _verify(api_client, mobile)
        assert first["is_new"] is True
        token = first["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        payload = {
            "name": "TEST_Persist User",
            "city": "Mumbai",
            "primary_sport": "sport-pickleball",
            "sports": ["sport-pickleball"],
            "skill_level": "Intermediate",
        }
        r = api_client.post(f"{BASE_URL}/api/onboarding", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["onboarded"] is True
        assert body["name"] == "TEST_Persist User"
        assert body["city"] == "Mumbai"
        assert body["skill_level"] == "Intermediate"
        # onboarding must not inject a stock avatar
        assert body.get("avatar") in (None, "")

        # Second login with SAME number: should fetch from DB, onboarded=true
        second = _verify(api_client, mobile)
        assert second["is_new"] is False, "returning user should not be is_new"
        u2 = second["user"]
        assert u2["onboarded"] is True
        assert u2["name"] == "TEST_Persist User"
        assert u2["city"] == "Mumbai"
        assert u2["skill_level"] == "Intermediate"
        assert u2.get("avatar") in (None, "")

    def test_mobile_normalization_same_user(self, api_client):
        digits = _rand_mobile()
        plain = digits
        prefixed = "+91" + digits
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": plain})
        a = _verify(api_client, plain)
        b = _verify(api_client, prefixed)
        assert a["user"]["id"] == b["user"]["id"], (
            f"Mobile normalization broke: {a['user']['id']} vs {b['user']['id']}"
        )
        assert a["user"]["mobile"] == b["user"]["mobile"] == "+91" + digits


# ---------------- ai/insights real data -----------------
class TestAiInsightsNoFabricatedStats:
    def test_insights_returns_real_zero_stats_for_new_user(self, api_client):
        mobile = _rand_mobile()
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": mobile})
        v = _verify(api_client, mobile)
        headers = {"Authorization": f"Bearer {v['token']}"}
        r = api_client.get(f"{BASE_URL}/api/ai/insights", headers=headers)
        assert r.status_code == 200, r.text
        d = r.json()
        # NOT the old hardcoded shape
        assert d["performance_score"] is None
        assert d["strongest"] is None
        assert d["needs_improvement"] is None
        assert d["has_analysis"] is False
        assert d["chart"] == []
        stats = d["stats"]
        assert stats["matches_played"] == 0
        assert stats["bookings"] == 0
        assert stats["coach_sessions"] == 0
        # streak_days always int
        assert isinstance(stats["training_streak_days"], int)


# ---------------- regression: consumer flows -----------------
@pytest.fixture(scope="module")
def consumer_headers(api_client):
    mobile = _rand_mobile()
    api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": mobile})
    v = _verify(api_client, mobile)
    token = v["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # onboard so protected flows behave normally
    api_client.post(
        f"{BASE_URL}/api/onboarding",
        json={"name": "TEST_Consumer", "city": "Bangalore", "skill_level": "Beginner"},
        headers=headers,
    )
    return headers


class TestConsumerRegression:
    def test_facilities_list(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/facilities")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_booking_dedup_409(self, api_client, consumer_headers):
        facilities = api_client.get(f"{BASE_URL}/api/facilities").json()
        fid = facilities[0]["id"]
        # unique date to avoid collisions across test runs
        date = f"2030-01-{random.randint(1, 28):02d}"
        slot = "20:00-21:00"
        body = {"facility_id": fid, "court_number": 1, "date": date, "slot": slot, "duration_min": 60}
        r1 = api_client.post(f"{BASE_URL}/api/bookings", json=body, headers=consumer_headers)
        assert r1.status_code == 200, r1.text
        r2 = api_client.post(f"{BASE_URL}/api/bookings", json=body, headers=consumer_headers)
        assert r2.status_code == 409, r2.text

    def test_games_full_409(self, api_client, consumer_headers):
        facilities = api_client.get(f"{BASE_URL}/api/facilities").json()
        fid = facilities[0]["id"]
        body = {
            "sport": "sport-pickleball", "facility_id": fid, "date": "2030-02-15",
            "duration_min": 60, "skill_level": "Beginner", "format": "Singles",
            "max_players": 1, "price_per_person": 100,
        }
        r = api_client.post(f"{BASE_URL}/api/games", json=body, headers=consumer_headers)
        assert r.status_code == 200
        gid = r.json()["id"]
        # New user tries to join full game
        other = _rand_mobile()
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": other})
        v = _verify(api_client, other)
        h2 = {"Authorization": f"Bearer {v['token']}"}
        r2 = api_client.post(f"{BASE_URL}/api/games/{gid}/join", headers=h2)
        assert r2.status_code == 409, r2.text

    def test_posts_and_like_toggle(self, api_client, consumer_headers):
        r = api_client.post(
            f"{BASE_URL}/api/posts",
            json={"content": "TEST_post hello"},
            headers=consumer_headers,
        )
        assert r.status_code == 200
        pid = r.json()["id"]
        r1 = api_client.post(f"{BASE_URL}/api/posts/{pid}/like", headers=consumer_headers)
        assert r1.status_code == 200 and r1.json()["liked"] is True
        r2 = api_client.post(f"{BASE_URL}/api/posts/{pid}/like", headers=consumer_headers)
        assert r2.status_code == 200 and r2.json()["liked"] is False

    def test_cart_and_order(self, api_client, consumer_headers):
        products = api_client.get(f"{BASE_URL}/api/products").json()
        assert products
        pid = products[0]["id"]
        r = api_client.post(
            f"{BASE_URL}/api/cart/add", json={"product_id": pid, "qty": 1}, headers=consumer_headers
        )
        assert r.status_code == 200 and r.json()["count"] >= 1
        r = api_client.post(
            f"{BASE_URL}/api/orders",
            json={"address": {"line1": "TEST 1", "city": "Bangalore"}},
            headers=consumer_headers,
        )
        assert r.status_code == 200 and r.json()["status"] == "confirmed"

    def test_ai_coach_chat_reply(self, api_client, consumer_headers):
        r = api_client.post(
            f"{BASE_URL}/api/ai/coach/chat",
            json={"text": "Give me one quick backhand drill."},
            headers=consumer_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        reply = r.json().get("reply", "")
        assert isinstance(reply, str) and len(reply.strip()) > 0


# ---------------- RBAC -----------------
class TestRBAC:
    def test_admin_can_create_club_and_owner_gets_workspace(self, api_client):
        # admin login (10 digits — server should normalize to +91)
        admin_mobile = "9999999999"
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": admin_mobile})
        av = _verify(api_client, admin_mobile)
        assert av["user"].get("is_platform_admin") is True, av["user"]
        admin_h = {"Authorization": f"Bearer {av['token']}", "Content-Type": "application/json"}

        owner_mobile = _rand_mobile()
        owner_mobile_e164 = "+91" + owner_mobile
        payload = {
            "name": f"TEST Club {random.randint(1000, 9999)}",
            "city": "Bangalore",
        }
        r = api_client.post(f"{BASE_URL}/api/admin/clubs", json=payload, headers=admin_h)
        assert r.status_code in (200, 201), r.text
        org = r.json()
        org_id = org.get("id") or org.get("org_id") or (org.get("organization") or {}).get("id")
        assert org_id, org
        # Assign owner as a second call — send +91 form so owner login (normalized) matches.
        r = api_client.post(
            f"{BASE_URL}/api/admin/clubs/{org_id}/owner",
            json={"mobile": owner_mobile_e164},
            headers=admin_h,
        )
        assert r.status_code in (200, 201), r.text

        # owner login
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": owner_mobile})
        ov = _verify(api_client, owner_mobile)
        owner_h = {"Authorization": f"Bearer {ov['token']}"}
        caps = api_client.get(f"{BASE_URL}/api/capabilities", headers=owner_h).json()
        roles = caps.get("roles", [])
        assert "CLUB_OWNER" in roles, caps
        org_ids = [o["org_id"] for o in caps.get("organizations", [])]
        assert org_id in org_ids

    def test_non_member_403_on_org_endpoints(self, api_client):
        # A random player
        mobile = _rand_mobile()
        api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": mobile})
        v = _verify(api_client, mobile)
        h = {"Authorization": f"Bearer {v['token']}"}
        r = api_client.get(f"{BASE_URL}/api/orgs/nonexistent-org-id/analytics", headers=h)
        assert r.status_code == 403, r.text
