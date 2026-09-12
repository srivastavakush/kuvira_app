export const ROLES = {
  PLAYER: 'PLAYER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  CLUB_OWNER: 'CLUB_OWNER',
  CLUB_ADMIN: 'CLUB_ADMIN',
  CLUB_MANAGER: 'CLUB_MANAGER',
  CLUB_STAFF: 'CLUB_STAFF',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type OrganizationCapability = {
  org_id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  logo?: string | null;
  cover_image?: string | null;
  status?: string | null;
  role: Role;
};

export type Capabilities = {
  roles: Role[];
  is_platform_admin: boolean;
  organizations: OrganizationCapability[];
  permissions: string[];
};

/**
 * Permission matrix per role.
 *
 * Court/Slot/Booking access:
 *   Add/edit/delete courts  : Owner + Admin only
 *   Slot availability mgmt  : Owner + Admin + Manager
 *   View bookings            : All 4 roles
 *   Confirm booking          : All 4 roles (walk-in/front desk)
 *   Cancel booking           : Owner + Admin + Manager (Staff cannot)
 *   Manage pricing           : Owner + Admin only
 *   Manage staff             : Owner + Admin only
 *   Transfer ownership       : Owner only
 *   Events/Tournaments CRUD  : Owner + Admin + Manager
 *   Settings / Club manage   : Owner + Admin
 */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  PLAYER: [],
  PLATFORM_ADMIN: [
    'club.view', 'club.manage',
    'club.courts.create', 'club.courts.edit', 'club.courts.delete',
    'club.slots.manage', 'club.pricing.manage',
    'club.bookings.manage', 'club.bookings.confirm', 'club.bookings.cancel',
    'club.games.manage', 'club.events.manage',
    'club.members.manage', 'club.staff.manage', 'club.ownership.transfer',
    'club.analytics.view', 'club.reports.export',
    'platform.clubs.manage', 'platform.users.manage', 'platform.analytics.view',
  ],
  CLUB_OWNER: [
    'club.view', 'club.manage',
    'club.courts.create', 'club.courts.edit', 'club.courts.delete',
    'club.slots.manage', 'club.pricing.manage',
    'club.bookings.manage', 'club.bookings.confirm', 'club.bookings.cancel',
    'club.games.manage', 'club.events.manage',
    'club.members.manage', 'club.staff.manage', 'club.ownership.transfer',
    'club.analytics.view', 'club.reports.export',
  ],
  CLUB_ADMIN: [
    'club.view', 'club.manage',
    'club.courts.create', 'club.courts.edit', 'club.courts.delete',
    'club.slots.manage', 'club.pricing.manage',
    'club.bookings.manage', 'club.bookings.confirm', 'club.bookings.cancel',
    'club.games.manage', 'club.events.manage',
    'club.members.manage', 'club.staff.manage',
    'club.analytics.view', 'club.reports.export',
    // No club.ownership.transfer
  ],
  CLUB_MANAGER: [
    'club.view',
    // No court create/edit/delete (courts.* requires Owner+Admin)
    'club.slots.manage',  // Can manage slot availability
    'club.bookings.manage', 'club.bookings.confirm', 'club.bookings.cancel',
    'club.games.manage', 'club.events.manage',
    'club.analytics.view',
    // No club.manage (settings), no staff.manage, no pricing.manage, no reports.export
  ],
  CLUB_STAFF: [
    'club.view',
    'club.bookings.manage', 'club.bookings.confirm',
    // No bookings.cancel — Staff cannot cancel
    'club.games.manage',
    // No courts, slots, events, staff, analytics
  ],
};

export const EMPTY_CAPABILITIES: Capabilities = {
  roles: [ROLES.PLAYER],
  is_platform_admin: false,
  organizations: [],
  permissions: [],
};

export function hasRole(caps: Capabilities | null | undefined, role: Role): boolean {
  return !!caps?.roles?.includes(role);
}

export function hasAnyRole(caps: Capabilities | null | undefined, roles: Role[]): boolean {
  return !!caps?.roles?.some((role) => roles.includes(role));
}

export function can(caps: Capabilities | null | undefined, permission: string): boolean {
  return !!caps?.permissions?.includes(permission);
}

export function canAny(caps: Capabilities | null | undefined, permissions: string[]): boolean {
  return !!caps?.permissions?.some((permission) => permissions.includes(permission));
}

export function roleForOrg(caps: Capabilities | null | undefined, orgId: string): Role | null {
  return caps?.organizations?.find((org) => org.org_id === orgId)?.role ?? null;
}

/**
 * Check if current user has a given permission for a specific org.
 * Platform admins have all permissions.
 * Org-level permissions are derived from the role in ROLE_PERMISSIONS.
 */
export function canForOrg(
  caps: Capabilities | null | undefined,
  orgId: string,
  permission: string,
): boolean {
  if (!caps) return false;
  if (caps.is_platform_admin) return true;
  const membership = caps.organizations?.find((org) => org.org_id === orgId);
  if (!membership) return false;
  return ROLE_PERMISSIONS[membership.role]?.includes(permission) ?? false;
}

/**
 * Check if user has any workspace (org-level) role — i.e., is a club team member.
 */
export function hasAnyOrgRole(caps: Capabilities | null | undefined): boolean {
  return !!caps && (caps.is_platform_admin || (caps.organizations?.length ?? 0) > 0);
}

/**
 * Human-readable role label.
 */
export function roleLabel(role: Role): string {
  switch (role) {
    case ROLES.CLUB_OWNER: return '👑 Owner';
    case ROLES.CLUB_ADMIN: return '🛡️ Admin';
    case ROLES.CLUB_MANAGER: return '🏷️ Manager';
    case ROLES.CLUB_STAFF: return '👤 Staff';
    case ROLES.PLATFORM_ADMIN: return '⚡ Platform Admin';
    default: return 'Player';
  }
}

