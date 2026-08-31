"""Kuvira Sports backend regression tests."""
import time
import requests

# ============= Health =============
def test_health(api_client, base_url):
    r = api_client.get(f"{base_url}/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ============= Auth =============
def test_otp_start(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/otp/start", json={"mobile": "9876543210"})
    assert r.status_code == 200
    data = r.json()
    assert data["sent"] is True
    assert data["demo_otp"] == "123456"


def test_otp_verify_invalid(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/otp/verify", json={"mobile": "9876543210", "otp": "000000"})
    assert r.status_code == 400


def test_otp_verify_new_user(api_client, base_url):
    mobile = f"9{int(time.time())%1000000000:09d}"
    r = api_client.post(f"{base_url}/api/auth/otp/verify", json={"mobile": mobile, "otp": "123456"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data and "user" in data
    assert data["is_new"] is True
    assert data["user"]["mobile"] == "+91" + mobile
    assert data["user"]["onboarded"] is False


def test_me_endpoint(api_client, base_url, auth_headers, auth_token):
    r = api_client.get(f"{base_url}/api/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == auth_token["user"]["id"]


def test_me_unauthorized(api_client, base_url):
    r = api_client.get(f"{base_url}/api/me")
    assert r.status_code == 401


# ============= Onboarding =============
def test_onboarding(api_client, base_url, auth_headers, auth_token):
    payload = {
        "name": "TEST_Player",
        "city": "Bangalore",
        "area": "Indiranagar",
        "primary_sport": "sport-pickleball",
        "sports": ["sport-pickleball"],
        "skill_level": "Intermediate",
        "playing_frequency": "3-4x per week",
        "goals": ["Improve backhand", "Win first tournament"],
    }
    r = api_client.post(f"{base_url}/api/onboarding", json=payload, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["onboarded"] is True
    assert data["name"] == "TEST_Player"
    assert data["skill_level"] == "Intermediate"
    # verify persisted
    r2 = api_client.get(f"{base_url}/api/me", headers=auth_headers)
    assert r2.json()["onboarded"] is True


# ============= Catalog =============
def test_sports_list(api_client, base_url):
    r = api_client.get(f"{base_url}/api/sports")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0


def test_facilities_list(api_client, base_url):
    r = api_client.get(f"{base_url}/api/facilities")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0
    assert "id" in items[0] and "courts_count" in items[0]


def test_facility_detail(api_client, base_url):
    facilities = api_client.get(f"{base_url}/api/facilities").json()
    fid = facilities[0]["id"]
    r = api_client.get(f"{base_url}/api/facilities/{fid}")
    assert r.status_code == 200
    assert r.json()["id"] == fid


def test_facility_availability(api_client, base_url):
    facilities = api_client.get(f"{base_url}/api/facilities").json()
    fid = facilities[0]["id"]
    r = api_client.get(f"{base_url}/api/facilities/{fid}/availability?date=2026-01-20")
    assert r.status_code == 200
    data = r.json()
    assert data["facility_id"] == fid
    assert "courts" in data and len(data["courts"]) > 0
    assert "slots" in data["courts"][0]


# ============= Bookings =============
def test_create_booking_and_verify(api_client, base_url, auth_headers):
    facilities = api_client.get(f"{base_url}/api/facilities").json()
    fid = facilities[0]["id"]
    # Use unique date to avoid unique-slot collisions across reruns
    unique_date = f"2027-{(int(time.time())%12)+1:02d}-{(int(time.time())%25)+1:02d}"
    payload = {"facility_id": fid, "court_number": 1, "date": unique_date, "slot": "18:00-19:00", "duration_min": 60}
    r = api_client.post(f"{base_url}/api/bookings", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "confirmed"
    assert data["payment"]["status"] == "paid"
    # verify in mine
    r2 = api_client.get(f"{base_url}/api/bookings/mine", headers=auth_headers)
    assert r2.status_code == 200
    ids = [b["id"] for b in r2.json()]
    assert data["id"] in ids


# ============= Games =============
def test_games_list(api_client, base_url):
    r = api_client.get(f"{base_url}/api/games")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    if items:
        assert "facility" in items[0]
        assert "slots_remaining" in items[0]


def test_games_create_and_join(api_client, base_url, auth_headers):
    facilities = api_client.get(f"{base_url}/api/facilities").json()
    fid = facilities[0]["id"]
    payload = {
        "sport": "sport-pickleball", "facility_id": fid, "date": "2026-02-20",
        "duration_min": 60, "skill_level": "Intermediate", "format": "Doubles",
        "max_players": 4, "price_per_person": 200, "notes": "TEST_game"
    }
    r = api_client.post(f"{base_url}/api/games", json=payload, headers=auth_headers)
    assert r.status_code == 200
    game = r.json()
    gid = game["id"]
    # get
    r2 = api_client.get(f"{base_url}/api/games/{gid}")
    assert r2.status_code == 200
    # join (already host, should return without error)
    r3 = api_client.post(f"{base_url}/api/games/{gid}/join", headers=auth_headers)
    assert r3.status_code == 200


# ============= Players =============
def test_players_list_match_score(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/players", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    assert all("match_score" in p for p in items)
    # sorted desc
    scores = [p["match_score"] for p in items]
    assert scores == sorted(scores, reverse=True)


def test_player_detail(api_client, base_url, auth_headers):
    players = api_client.get(f"{base_url}/api/players", headers=auth_headers).json()
    pid = players[0]["id"]
    r = api_client.get(f"{base_url}/api/players/{pid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == pid


# ============= Coaches / Events / Tournaments =============
def test_coaches_list(api_client, base_url):
    r = api_client.get(f"{base_url}/api/coaches")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_events_list(api_client, base_url):
    r = api_client.get(f"{base_url}/api/events")
    assert r.status_code == 200


def test_tournaments_list_and_register(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/tournaments")
    assert r.status_code == 200
    tournaments = r.json()
    assert len(tournaments) > 0
    tid = tournaments[0]["id"]
    r2 = api_client.post(f"{base_url}/api/tournaments/{tid}/register", headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["payment"]["status"] == "paid"


# ============= Community =============
def test_posts_list(api_client, base_url):
    r = api_client.get(f"{base_url}/api/posts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_post_and_like_toggle(api_client, base_url, auth_headers):
    r = api_client.post(f"{base_url}/api/posts", json={"content": "TEST_post from regression"}, headers=auth_headers)
    assert r.status_code == 200
    pid = r.json()["id"]
    # like
    r2 = api_client.post(f"{base_url}/api/posts/{pid}/like", headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["liked"] is True
    # unlike
    r3 = api_client.post(f"{base_url}/api/posts/{pid}/like", headers=auth_headers)
    assert r3.json()["liked"] is False


# ============= Marketplace =============
def test_products_list(api_client, base_url):
    r = api_client.get(f"{base_url}/api/products")
    assert r.status_code == 200
    assert len(r.json()) > 0


def test_product_recommend_for_me(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/products/recommend/for-me", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) <= 6
    assert all("reco_score" in p for p in items)


def test_cart_and_order_flow(api_client, base_url, auth_headers):
    products = api_client.get(f"{base_url}/api/products").json()
    pid = products[0]["id"]
    # add
    r = api_client.post(f"{base_url}/api/cart/add", json={"product_id": pid, "qty": 2}, headers=auth_headers)
    assert r.status_code == 200
    cart = r.json()
    assert cart["count"] == 2
    # get cart
    r2 = api_client.get(f"{base_url}/api/cart", headers=auth_headers)
    assert r2.status_code == 200
    # order
    r3 = api_client.post(f"{base_url}/api/orders", json={"address": {"line1": "123 TEST_Street", "city": "Bangalore", "pincode": "560001"}}, headers=auth_headers)
    assert r3.status_code == 200
    order = r3.json()
    assert order["status"] == "confirmed"
    assert order["payment"]["status"] == "paid"
    # my orders
    r4 = api_client.get(f"{base_url}/api/orders/mine", headers=auth_headers)
    assert order["id"] in [o["id"] for o in r4.json()]
    # cart cleared
    r5 = api_client.get(f"{base_url}/api/cart", headers=auth_headers)
    assert r5.json()["count"] == 0


def test_cart_remove(api_client, base_url, auth_headers):
    products = api_client.get(f"{base_url}/api/products").json()
    pid = products[0]["id"]
    api_client.post(f"{base_url}/api/cart/add", json={"product_id": pid, "qty": 1}, headers=auth_headers)
    r = api_client.post(f"{base_url}/api/cart/remove", json={"product_id": pid, "qty": 1}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["count"] == 0


# ============= AI Coach =============
def test_ai_coach_chat(api_client, base_url, auth_headers):
    r = api_client.post(f"{base_url}/api/ai/coach/chat", json={"text": "Give me one quick tip to improve my backhand."}, headers=auth_headers, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "reply" in data and len(data["reply"]) > 20
    assert "session_id" in data


def test_ai_coach_history(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/ai/coach/history", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "messages" in data
    assert len(data["messages"]) >= 2  # at least the msg + reply from prior test


def test_ai_insights(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/ai/insights", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert "performance_score" in d and "stats" in d


def test_ai_recommendations(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/ai/recommendations", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert "products" in d and "games" in d


# ============= Search =============
def test_search(api_client, base_url):
    r = api_client.get(f"{base_url}/api/search?q=pickle")
    assert r.status_code == 200
    d = r.json()
    assert all(k in d for k in ["facilities", "players", "products", "events"])
