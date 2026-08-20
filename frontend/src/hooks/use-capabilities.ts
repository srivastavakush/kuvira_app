import { useSession } from '@/src/session';
import { can, canAny, hasAnyRole, hasRole, roleForOrg, canForOrg } from '@/src/capabilities';
import type { Role } from '@/src/capabilities';

export function useCapabilities() {
  const { capabilities, loading } = useSession();
  return {
    capabilities,
    loading,
    can: (permission: string) => can(capabilities, permission),
    canAny: (permissions: string[]) => canAny(capabilities, permissions),
    hasRole: (role: Role) => hasRole(capabilities, role),
    hasAnyRole: (roles: Role[]) => hasAnyRole(capabilities, roles),
    roleForOrg: (orgId: string) => roleForOrg(capabilities, orgId),
    canForOrg: (orgId: string, permission: string) => canForOrg(capabilities, orgId, permission),
  };
}
