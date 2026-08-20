export const ROLES = {
  PLAYER: 'PLAYER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  CLUB_OWNER: 'CLUB_OWNER',
  CLUB_MANAGER: 'CLUB_MANAGER',
  CLUB_STAFF: 'CLUB_STAFF',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type OrganizationCapability = {
  org_id: string;
  name: string;
  city?: string | null;
  logo?: string | null;
  role: Role;
};

export type Capabilities = {
  roles: Role[];
  is_platform_admin: boolean;
  organizations: OrganizationCapability[];
  permissions: string[];
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  PLAYER: [],
  PLATFORM_ADMIN: [
    'club.view', 'club.manage', 'club.courts.manage', 'club.bookings.manage',
    'club.games.manage', 'club.events.manage', 'club.members.manage',
    'club.staff.manage', 'club.ownership.transfer', 'club.analytics.view',
    'platform.clubs.manage', 'platform.users.manage', 'platform.analytics.view',
  ],
  CLUB_OWNER: [
    'club.view', 'club.manage', 'club.courts.manage', 'club.bookings.manage',
    'club.games.manage', 'club.events.manage', 'club.members.manage',
    'club.staff.manage', 'club.ownership.transfer', 'club.analytics.view',
  ],
  CLUB_MANAGER: [
    'club.view', 'club.manage', 'club.courts.manage', 'club.bookings.manage',
    'club.games.manage', 'club.events.manage', 'club.members.manage', 'club.analytics.view',
  ],
  CLUB_STAFF: ['club.view', 'club.bookings.manage', 'club.games.manage'],
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

export function canForOrg(
  caps: Capabilities | null | undefined,
  orgId: string,
  permission: string,
): boolean {
  if (!caps) return false;
  if (caps.is_platform_admin) return true;
  const membership = caps.organizations?.find((org) => org.org_id === orgId);
  return !!membership && ROLE_PERMISSIONS[membership.role]?.includes(permission);
}
