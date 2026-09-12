import { useEffect, useState } from 'react';
import { Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';
import { c } from '@/src/theme';
import { getToken } from '@/src/api';
export function FavoriteButton({ id }: { id: string }) {
  const { user } = useSession(); const router = useRouter(); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; setSaved(false); if (user) AsyncStorage.getItem(`matchdrome:favourite:${user.id}:${id}`).then(v => { if (active) setSaved(v === '1'); }).catch(() => {}); return () => { active = false; }; }, [user?.id, id]);
  async function save(userId?: string) {
    // Re-read identity after login; local favourites are scoped to this account/device.
    const account = userId || user?.id;
    if (!account) return;
    setBusy(true);
    try { await AsyncStorage.setItem(`matchdrome:favourite:${account}:${id}`, saved ? '0' : '1'); setSaved(!saved); }
    catch { Alert.alert('Could not save court', 'Please try again.'); } finally { setBusy(false); }
  }
  return <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={saved ? 'Remove court from favourites on this device' : 'Save court on this device'} accessibilityState={{ selected: saved, busy }} onPress={() => { if (requireAuth(user, router, undefined, async () => { const { api } = await import('@/src/api'); const me = await api.me(); await save(me.id); })) save(); }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' }}><Ionicons name={saved ? 'heart' : 'heart-outline'} size={24} color={saved ? c.accent : c.text} /></Pressable>;
}
