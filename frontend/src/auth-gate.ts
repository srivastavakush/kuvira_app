export function requireAuth(user: unknown, router: any, next?: string) {
  if (user) return true;
  router.push({ pathname: '/(auth)/login', params: next ? { next } : {} });
  return false;
}
