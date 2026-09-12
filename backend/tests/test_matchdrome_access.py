"""Exercise the new read endpoints with real FastAPI dependencies and an in-memory DB double."""
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import deps
import org_admin


@pytest.fixture
def app_client(monkeypatch):
    app = FastAPI()
    app.include_router(org_admin.router)
    state = {"user": {"id": "player", "is_platform_admin": False}}

    async def current():
        return state["user"]

    app.dependency_overrides[deps.current_user] = current
    db = MagicMock()
    db.organization_memberships.find_one = AsyncMock(return_value={"role": "CLUB_MANAGER", "org_id": "club-a"})
    monkeypatch.setattr(deps, "db", db)
    monkeypatch.setattr(org_admin, "db", db)
    return TestClient(app), state, db


@pytest.mark.parametrize("endpoint", ["overview", "users", "transactions", "system-health"])
def test_player_cannot_read_platform_data(app_client, endpoint):
    client, _, db = app_client
    assert client.get(f"/api/admin/{endpoint}").status_code == 403
    db.payment_transactions.find.assert_not_called()


def test_transaction_projection_excludes_payment_secrets(app_client):
    client, state, db = app_client
    state["user"] = {"id": "admin", "is_platform_admin": True}
    cursor = MagicMock()
    cursor.sort.return_value = cursor
    cursor.to_list = AsyncMock(return_value=[])
    db.payment_transactions.find.return_value = cursor
    assert client.get('/api/admin/transactions').status_code == 200
    projection = db.payment_transactions.find.call_args.args[1]
    assert projection.get('id') == 1
    assert 'checkout_token' not in projection
    assert 'payu_response' not in projection
    assert 'hash' not in projection


def test_manager_analytics_excludes_finance(app_client, monkeypatch):
    client, _, db = app_client
    monkeypatch.setattr(org_admin, '_org_facility_ids', AsyncMock(return_value=['court-a']))
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=[{'price': 600, 'status': 'confirmed'}, {'price': 800, 'status': 'pending_payment'}])
    db.bookings.find.return_value = cursor
    db.games.count_documents = AsyncMock(return_value=0)
    db.organization_memberships.count_documents = AsyncMock(return_value=1)
    response = client.get('/api/orgs/club-a/analytics')
    assert response.status_code == 200
    assert response.json()['revenue'] is None
    assert response.json()['bookings_count'] == 2


def test_owner_booking_value_excludes_pending_payments(app_client, monkeypatch):
    client, _, db = app_client
    db.organization_memberships.find_one = AsyncMock(return_value={'role': 'CLUB_OWNER'})
    monkeypatch.setattr(org_admin, '_org_facility_ids', AsyncMock(return_value=['court-a']))
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=[{'price': 600, 'status': 'confirmed'}, {'price': 800, 'status': 'pending_payment'}])
    db.bookings.find.return_value = cursor
    db.games.count_documents = AsyncMock(return_value=0)
    db.organization_memberships.count_documents = AsyncMock(return_value=1)
    response = client.get('/api/orgs/club-a/analytics')
    assert response.status_code == 200
    assert response.json()['revenue'] == 600


def test_other_club_access_is_denied(app_client):
    client, _, db = app_client
    db.organization_memberships.find_one = AsyncMock(return_value=None)
    assert client.get('/api/orgs/club-b/analytics').status_code == 403


def test_public_profiles_never_include_private_account_data():
    from public_profiles import public_player
    profile = public_player({'id': 'player', 'name': 'Player', 'mobile': '+919999999999', 'email': 'private@example.test', 'lat': 1.0, 'lng': 2.0, 'location': {'coordinates': [1, 2]}, 'is_platform_admin': True, 'capabilities': {'roles': ['PLATFORM_ADMIN']}, 'sports': ['sport-tennis']})
    assert profile == {'id': 'player', 'name': 'Player', 'sports': ['sport-tennis']}
    assert public_player(None) is None

@pytest.mark.parametrize('endpoint', ['issues', 'audit-log'])
def test_player_cannot_read_workspace_platform_data(app_client, endpoint):
    client, _, _ = app_client
    assert client.get(f'/api/admin/{endpoint}').status_code == 403

@pytest.mark.parametrize('role', ['CLUB_MANAGER', 'CLUB_STAFF'])
def test_operations_cannot_edit_team(app_client, role):
    client, _, db = app_client
    db.organization_memberships.find_one = AsyncMock(return_value={'role': role})
    assert client.post('/api/orgs/club-a/staff', json={'mobile': '+919999999999', 'role': 'CLUB_ADMIN'}).status_code == 403


def test_staff_check_in_is_scoped_and_paid(app_client, monkeypatch):
    client, _, db = app_client
    db.organization_memberships.find_one = AsyncMock(return_value={'role': 'CLUB_STAFF'})
    monkeypatch.setattr(org_admin, '_org_facility_ids', AsyncMock(return_value=['court-a']))
    db.bookings.find_one = AsyncMock(return_value={'id': 'b', 'status': 'pending_payment'})
    assert client.post('/api/orgs/club-a/bookings/b/check-in').status_code == 409
    db.bookings.update_one.assert_not_called()
    assert db.bookings.find_one.call_args.args[0]['facility_id'] == {'$in': ['court-a']}
    assert client.post('/api/orgs/club-a/bookings/b/confirm').status_code == 409


def test_check_in_records_audit_and_is_idempotent(app_client, monkeypatch):
    client, _, db = app_client
    monkeypatch.setattr(org_admin, '_org_facility_ids', AsyncMock(return_value=['court-a']))
    audit = AsyncMock()
    monkeypatch.setattr(org_admin, '_write_audit_log', audit)
    db.bookings.find_one = AsyncMock(return_value={'id': 'b', 'status': 'confirmed'})
    db.bookings.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    assert client.post('/api/orgs/club-a/bookings/b/check-in').status_code == 200
    assert db.bookings.update_one.call_args.args[0]['status'] == 'confirmed'
    audit.assert_awaited_once()
    db.bookings.find_one.return_value['checked_in_at'] = '2026-09-12T10:00:00Z'
    assert client.post('/api/orgs/club-a/bookings/b/check-in').status_code == 200
    assert db.bookings.update_one.await_count == 1


def test_add_staff_cannot_overwrite_owner(app_client, monkeypatch):
    client, _, db = app_client
    db.organization_memberships.find_one = AsyncMock(side_effect=[{'role':'CLUB_ADMIN'}, {'role':'CLUB_OWNER'}])
    monkeypatch.setattr(org_admin, '_get_or_invite_user', AsyncMock(return_value={'id':'owner'}))
    assert client.post('/api/orgs/club-a/staff', json={'mobile': '+919999999999', 'role':'CLUB_STAFF'}).status_code == 409
    db.organization_memberships.update_one.assert_not_called()


def test_issue_resolution_never_crosses_clubs(app_client, monkeypatch):
    client, _, db = app_client
    db.venue_issues.update_one = AsyncMock(return_value=MagicMock(matched_count=0))
    assert client.post('/api/orgs/club-a/issues/other-club-issue/resolve').status_code == 404
    assert db.venue_issues.update_one.call_args.args[0] == {'id':'other-club-issue', 'org_id':'club-a'}
