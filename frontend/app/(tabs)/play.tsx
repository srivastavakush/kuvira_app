import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { ChipRow, Loader, EmptyState, MatchScoreBadge } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';

const TABS = [{ key: 'games', label: 'Open Games' }, { key: 'players', label: 'Players' }, { key: 'my', label: 'My Bookings' }];
const SKILL_FILTERS = [{ key: 'all', label: 'All levels' }, { key: 'Beginner', label: 'Beginner' }, { key: 'Intermediate', label: 'Intermediate' }, { key: 'Advanced', label: 'Advanced' }, { key: 'Pro', label: 'Pro' }];

export default function Play() {
  const router = useRouter();
  const { user } = useSession();
  const [tab, setTab] = useState('games');
  const [skill, setSkill] = useState('all');
  const [games, setGames] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, p, b] = await Promise.all([api.games(skill !== 'all' ? { skill } : {}), api.players(), user ? api.myBookings().catch(() => []) : Promise.resolve([])]);
      setGames(g); setPlayers(p); setBookings(b);
    } finally { setLoading(false); }
  }, [skill, user]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }
  function createGame() { if (requireAuth(user, router)) router.push('/create-game'); }

  return (
    <SafeAreaView style={styles.wrap} testID="play-screen">
      <View style={styles.header}><Text style={styles.title}>Play</Text><Pressable testID="play-create-game" onPress={createGame} style={styles.createBtn}><Ionicons name="add" size={18} color={colors.onBrandPrimary} /><Text style={styles.createBtnText}>Create Game</Text></Pressable></View>
      <ChipRow items={TABS} active={tab} onChange={setTab} testIDPrefix="play-tab" />
      {tab === 'games' && <ChipRow items={SKILL_FILTERS} active={skill} onChange={setSkill} testIDPrefix="play-skill" />}
      {loading ? <Loader /> : <>
        {tab === 'games' && <FlatList data={games} keyExtractor={(g) => g.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }} ListEmptyComponent={<EmptyState title="No open games nearby" subtitle="Create a game and invite players." cta="Create Game" onCta={createGame} testID="play-empty" />} renderItem={({ item }) => <Pressable testID={`play-game-${item.id}`} style={styles.gameCard} onPress={() => router.push(`/game/${item.id}`)}><View style={{ flexDirection: 'row', gap: spacing.md }}><View style={styles.dateChip}><Text style={styles.dateDay}>{new Date(item.date).getDate()}</Text><Text style={styles.dateMo}>{new Date(item.date).toLocaleString('en', { month: 'short' })}</Text></View><View style={{ flex: 1 }}><Text style={styles.gameFormat}>{item.format} · {item.skill_level}</Text><Text style={styles.gameFacility} numberOfLines={1}>{item.facility?.name}</Text><Text style={styles.gameMeta}>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.duration_min}min · ₹{item.price_per_person}/person</Text><View style={styles.gameFooter}><Text style={styles.gameSlots}>{item.slots_remaining} slot{item.slots_remaining !== 1 ? 's' : ''} left</Text><View style={styles.joinBtn}><Text style={styles.joinBtnText}>View →</Text></View></View></View></View></Pressable>} />}
        {tab === 'players' && <FlatList data={players} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }} ListEmptyComponent={<EmptyState title="No players yet" testID="players-empty" />} renderItem={({ item }) => <Pressable testID={`play-player-${item.id}`} style={styles.playerCard} onPress={() => router.push(`/player/${item.id}`)}><Image source={{ uri: item.avatar }} style={styles.pAvatar} /><View style={{ flex: 1 }}><Text style={styles.pName}>{item.name}</Text><Text style={styles.pMeta}>{item.skill_level} · {item.area}</Text><Text style={styles.pStyle} numberOfLines={1}>{item.playing_style}</Text><Text style={styles.pStats}>{item.matches_played} matches · {Math.round((item.wins / Math.max(1, item.matches_played)) * 100)}% win</Text></View><MatchScoreBadge score={item.match_score} testID={`play-player-${item.id}-score`} /></Pressable>} />}
        {tab === 'my' && (user ? <FlatList data={bookings} keyExtractor={(b) => b.id} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }} ListEmptyComponent={<EmptyState title="No bookings yet" subtitle="Book a court to see it here." cta="Discover courts" onCta={() => router.push('/(tabs)/discover')} testID="bookings-empty" />} renderItem={({ item }) => <View style={styles.bkCard} testID={`play-booking-${item.id}`}><Image source={{ uri: item.facility_image }} style={styles.bkImg} /><View style={{ flex: 1, padding: spacing.md }}><Text style={styles.bkName}>{item.facility_name}</Text><Text style={styles.bkMeta}>{item.date} · {item.slot} · Court {item.court_number}</Text><View style={styles.bkStatusRow}><View style={styles.bkStatus}><Text style={styles.bkStatusText}>{item.status.toUpperCase()}</Text></View><Text style={styles.bkPrice}>₹{item.price}</Text></View></View></View>} /> : <EmptyState title="Login to see your bookings" subtitle="Your bookings will appear here after you sign in." cta="Login / Sign up" onCta={() => router.push('/(auth)/login')} testID="bookings-login" />)}
      </>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }, title: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' }, createBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill }, createBtnText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.sm }, gameCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }, dateChip: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' }, dateDay: { color: colors.brandPrimary, fontSize: font.sizes.xxl, fontWeight: '900' }, dateMo: { color: colors.brandPrimary, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1 }, gameFormat: { color: colors.brandPrimary, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }, gameFacility: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700', marginTop: 2 }, gameMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 4 }, gameFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }, gameSlots: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm }, joinBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill }, joinBtnText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.sm }, playerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }, pAvatar: { width: 60, height: 60, borderRadius: 30 }, pName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700' }, pMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 }, pStyle: { color: colors.brandPrimary, fontSize: font.sizes.xs, marginTop: 4 }, pStats: { color: colors.onSurfaceSecondary, fontSize: font.sizes.xs, marginTop: 2 }, bkCard: { flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }, bkImg: { width: 110, height: 110 }, bkName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700' }, bkMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 4 }, bkStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }, bkStatus: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm }, bkStatusText: { color: colors.brandPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }, bkPrice: { color: colors.brandPrimary, fontWeight: '800' },
});
