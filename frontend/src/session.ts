// Auth session helper hooks.
import { useEffect, useState, useCallback } from 'react';
import { api, getToken, clearToken } from '@/src/api';

export type User = {
  id: string;
  mobile: string;
  name?: string | null;
  avatar?: string | null;
  city?: string | null;
  area?: string | null;
  primary_sport?: string | null;
  sports?: string[];
  skill_level?: string | null;
  onboarded?: boolean;
} | null;

export function useSession() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) { setUser(null); setLoading(false); return null; }
    try {
      const u = await api.me();
      setUser(u); setLoading(false); return u;
    } catch {
      await clearToken();
      setUser(null); setLoading(false); return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { user, setUser, loading, refresh };
}
