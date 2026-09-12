type PendingAction = () => void | Promise<void>;
let origin = '/(tabs)/home';
export function trackAuthOrigin(path: string) { if (path && !['/login','/otp','/onboarding','/'].includes(path) && !path.includes('(auth)')) origin = path; }
export function dismissAuth(router: any) { cancelPendingAuth(); router.dismissTo(origin); }
let pendingAction: PendingAction | undefined;
export function cancelPendingAuth() { pendingAction = undefined; }
export function requireAuth(user: unknown, router: any, next?: string, action?: PendingAction) {
  if (user) return true;
  pendingAction = action;
  router.push({ pathname: '/(auth)/login', params: next ? { next } : {} });
  return false;
}
export async function completeAuth(router: any, next?: string) {
  const action = pendingAction;
  pendingAction = undefined;
  const destination = next && next.startsWith('/') && !next.startsWith('//') && !next.includes('(auth)') ? next : origin;
  router.dismissTo(action ? origin : destination);
  if (action) await action();
}
