// Auth session helper hooks.
import { useEffect, useState, useCallback } from 'react';
import { api, getToken, clearToken } from '@/src/api';
import type { Capabilities } from '@/src/capabilities';
import { EMPTY_CAPABILITIES } from '@/src/capabilities';

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
  is_platform_admin?: boolean;
  capabilities?: Capabilities;
} | null;

export function useSession() {
  const [user, setUser] = useState<User>(null);
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPABILITIES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setCapabilities(EMPTY_CAPABILITIES);
      setLoading(false);
      return null;
    }
    try {
      const u = await api.me();
      const caps = u?.capabilities ?? EMPTY_CAPABILITIES;
      setUser(u);
      setCapabilities(caps);
      setLoading(false);
      return u;
    } catch {
      await clearToken();
      setUser(null);
      setCapabilities(EMPTY_CAPABILITIES);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { user, setUser, capabilities, loading, refresh };
}
