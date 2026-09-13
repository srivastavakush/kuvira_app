import { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';
import { c } from '@/src/theme';
import { ScreenHeader, Card, Button, EmptyState } from '@/src/components/ui';
import { ErrorBanner, SkeletonCards } from '@/src/components/states';
import { FavoriteButton } from '@/src/components/favorite';
import { sportsLabel } from '@/src/sports';
export default function Favourites() {
  const { user, loading: sessionLoading } = useSession(); const router = useRouter();
  const [courts, setCourts] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<unknown>();
  const load = useCallback(async () => {
    if (!user) { setLoading(false); setCourts([]); return; }
    setLoading(true); setError(null);
    try {
      const prefix = `matchdrome:favourite:${user.id}:`;
      const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
      const saved = await AsyncStorage.multiGet(keys);
      const results = await Promise.allSettled(saved.filter(([,value]) => value === '1').map(([key]) => api.facility(key.slice(prefix.length))));
      setCourts(results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []));
      if (results.some(r => r.status === 'rejected')) setError('Some saved courts are unavailable. Please try again.');
    } catch(e) { setError(e); } finally { setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}><ScreenHeader title="Your saved courts" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 1000, width: '100%', alignSelf: 'center' }}><Text style={{ color: c.textSecondary }}>Saved for your account on this device.</Text><ErrorBanner error={error} retry={load} />{sessionLoading || loading ? <SkeletonCards /> : !user ? <EmptyState title="Keep your next game close" subtitle="Sign in to save and revisit courts." cta="Sign in" onCta={() => requireAuth(user, router, '/favourites')} /> : !courts.length ? <EmptyState title="No saved courts yet" subtitle="Tap a heart on Home to save a venue." cta="Find courts" onCta={() => router.push('/(tabs)/home')} /> : courts.map(court => <Card key={court.id}><View style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ fontSize: 20, fontWeight: '800', flex: 1, color: c.text }}>{court.name}</Text><FavoriteButton id={court.id} /></View><Text style={{ color: c.textSecondary }}>{sportsLabel(court)} · {court.area || court.city}</Text><Button label="View slots" onPress={() => router.push(`/facility/${court.id}`)} /></View></Card>)}</ScrollView></SafeAreaView>;
}
