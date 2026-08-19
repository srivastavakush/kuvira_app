import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://video-first-analysis.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    mobile = "9998887777"
    r = api_client.post(f"{BASE_URL}/api/auth/otp/start", json={"mobile": mobile})
    assert r.status_code == 200, r.text
    r = api_client.post(f"{BASE_URL}/api/auth/otp/verify", json={"mobile": mobile, "otp": "123456"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "is_new": data["is_new"]}


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token['token']}", "Content-Type": "application/json"}
