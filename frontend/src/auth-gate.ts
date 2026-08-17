import { Router } from 'expo-router';

export function requireAuth(user: unknown, router: Router, destination = '/(auth)/login') {
  if (user) return true;
  router.push(destination as any);
  return false;
}
