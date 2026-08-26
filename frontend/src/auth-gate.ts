export function requireAuth(user: unknown, router: any, destination = '/(auth)/login') {
  if (user) return true;
  router.push(destination);
  return false;
}
