from deps import (
    ROLE_PLAYER,
    ROLE_PLATFORM_ADMIN,
    ROLE_CLUB_OWNER,
    ROLE_CLUB_MANAGER,
    ROLE_CLUB_STAFF,
    ROLE_PERMISSIONS,
    PERM,
)


def test_role_permission_matrix_is_explicit():
    assert ROLE_PERMISSIONS.get(ROLE_PLAYER, []) == []
    assert 'club.staff.manage' in ROLE_PERMISSIONS[ROLE_CLUB_OWNER]
    assert 'club.ownership.transfer' in ROLE_PERMISSIONS[ROLE_CLUB_OWNER]
    assert 'club.staff.manage' not in ROLE_PERMISSIONS[ROLE_CLUB_MANAGER]
    assert 'club.staff.manage' not in ROLE_PERMISSIONS[ROLE_CLUB_STAFF]
    assert 'club.ownership.transfer' not in ROLE_PERMISSIONS[ROLE_CLUB_MANAGER]
    assert 'club.ownership.transfer' not in ROLE_PERMISSIONS[ROLE_CLUB_STAFF]


def test_manager_and_staff_cannot_escalate_privileges():
    privileged = {'platform.clubs.manage', 'platform.users.manage', 'club.staff.manage', 'club.ownership.transfer'}
    assert privileged.isdisjoint(set(ROLE_PERMISSIONS[ROLE_CLUB_MANAGER]))
    assert privileged.isdisjoint(set(ROLE_PERMISSIONS[ROLE_CLUB_STAFF]))


def test_platform_admin_has_all_catalog_permissions():
    assert set(ROLE_PERMISSIONS[ROLE_PLATFORM_ADMIN]) == set(PERM.keys())
