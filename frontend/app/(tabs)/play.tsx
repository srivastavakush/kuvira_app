import { ErrorBanner } from '@/src/components/states';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { ChipRow, Loader, EmptyState, MatchScoreBadge, Badge, Avatar } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';

const TABS = [
  { key: 'games', label: 'Open games' },
  { key: 'players', label: 'Players' },
  { key: 'my', label: 'My bookings' },
];
const SKILL_FILTERS = [
  { key: 'all', label: 'All levels' },
  { key: 'Beginner', label: 'Beginner' },
  { key: 'Intermediate', label: 'Intermediate' },
  { key: 'Advanced', label: 'Advanced' },
  { key: 'Pro', label: 'Pro' },
];

export default function Play() {
  const router = useRouter();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const { user } = useSession();
  const [tab, setTab] = useState(requestedTab || 'games');
  useEffect(() => { if (requestedTab) setTab(requestedTab); }, [requestedTab]);
  const [skill, setSkill] = useState('all');
  const [loadError, setLoadError] = useState<unknown>();
  const [games, setGames] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const results = await Promise.allSettled([api.games(skill !== 'all' ? { skill } : {}), api.players(), user ? api.myBookings() : Promise.resolve([])]);
    const setters = [setGames, setPlayers, setBookings];
    results.forEach((r, i) => { if (r.status === 'fulfilled' && Array.isArray(r.value)) setters[i](r.value); });
    if (results.some(r => r.status === 'rejected')) setLoadError('Some games or players couldn’t load. Try again.');
    setLoading(false);
  }, [skill, user]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }
  function createGame() { if (requireAuth(user, router, '/create-game')) router.push('/create-game'); }

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="play-screen">
      <ErrorBanner error={loadError} retry={load} /><View style={styles.header}>
        <Text style={styles.title}>Play</Text>
        <Pressable
          testID="play-create-game"
          onPress={createGame}
          style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add" size={16} color={c.onAccent} />
          <Text style={styles.createBtnText}>New game</Text>
        </Pressable>
      </View>
      <ChipRow items={TABS} active={tab} onChange={setTab} testIDPrefix="play-tab" />
      {tab === 'games' && <ChipRow items={SKILL_FILTERS} active={skill} onChange={setSkill} testIDPrefix="play-skill" />}
      {loading ? (
        <Loader />
      ) : (
        <>
          {tab === 'games' && (
            <FlatList
              data={games}
              keyExtractor={(g) => g.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textFaint} />}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm }}
              ListEmptyComponent={
                <EmptyState
                  title="No open games nearby"
                  subtitle="Start one and invite players from your area."
                  cta="Create a game"
                  onCta={createGame}
                  icon="tennisball-outline"
                  testID="play-empty"
                />
              }
              renderItem={({ item }) => (
                <Pressable
                  testID={`play-game-${item.id}`}
                  style={({ pressed }) => [styles.gameCard, pressed && { backgroundColor: c.bgRaised }]}
                  onPress={() => router.push(`/game/${item.id}`)}
                >
                  <View style={styles.dateChip}>
                    <Text style={styles.dateDay}>{new Date(item.date).getDate()}</Text>
                    <Text style={styles.dateMo}>{new Date(item.date).toLocaleString('en', { month: 'short' })}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.gameHeadRow}>
                      <Text style={styles.gameFormat}>{item.format} · {item.skill_level}</Text>
                      <Text style={styles.gamePrice}>₹{item.price_per_person}</Text>
                    </View>
                    <Text style={styles.gameFacility} numberOfLines={1}>{item.facility?.name}</Text>
                    <View style={styles.gameFootRow}>
                      <Text style={styles.gameMeta}>
                        {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.duration_min} min
                      </Text>
                      <Text style={styles.gameSlots}>
                        {item.slots_remaining} slot{item.slots_remaining !== 1 ? 's' : ''} left
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}
            />
          )}
          {tab === 'players' && (
            <FlatList
              data={players}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm }}
              ListEmptyComponent={<EmptyState title="No players yet" testID="players-empty" />}
              renderItem={({ item }) => (
                <Pressable
                  testID={`play-player-${item.id}`}
                  style={({ pressed }) => [styles.playerCard, pressed && { backgroundColor: c.bgRaised }]}
                  onPress={() => router.push(`/player/${item.id}`)}
                >
                  <Avatar uri={item.avatar} name={item.name} size={52} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.pName}>{item.name}</Text>
                    <Text style={styles.pMeta}>{item.skill_level || 'Beginner'} · {item.area || item.city || 'India'}</Text>
                    <Text style={styles.pStats}>
                      {item.matches_played || 0} matches · {Math.round(((item.wins || 0) / Math.max(1, item.matches_played || 0)) * 100)}% win
                    </Text>
                  </View>
                  <MatchScoreBadge score={item.match_score} testID={`play-player-${item.id}-score`} />
                </Pressable>
              )}
            />
          )}
          {tab === 'my' && (user ? (
            <FlatList
              data={bookings}
              keyExtractor={(b) => b.id}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm }}
              ListEmptyComponent={
                <EmptyState
                  title="No bookings yet"
                  subtitle="Book a court and it'll appear here."
                  cta="Discover courts"
                  onCta={() => router.push('/(tabs)/discover')}
                  icon="calendar-outline"
                  testID="bookings-empty"
                />
              }
              renderItem={({ item }) => (
                <View style={styles.bkCard} testID={`play-booking-${item.id}`}>
                  <Image source={{ uri: item.facility_image }} style={styles.bkImg} />
                  <View style={{ flex: 1, padding: spacing.md, gap: 4 }}>
                    <Text style={styles.bkName} numberOfLines={1}>{item.facility_name}</Text>
                    <Text style={styles.bkMeta}>{item.date} · {item.slot}</Text>
                    <Text style={styles.bkMeta}>Court {item.court_number}</Text>
                    <View style={styles.bkFoot}>
                      <Badge label={item.status} variant="success" size="sm" />
                      <Text style={styles.bkPrice}>₹{item.price}</Text>
                    </View>
                  </View>
                </View>
              )}
            />
          ) : (
            <EmptyState
              title="Sign in to see your bookings"
              subtitle="Your reserved courts will appear here."
              cta="Sign in"
              onCta={() => router.push('/(auth)/login')}
              icon="calendar-outline"
              testID="bookings-login"
            />
          ))}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { color: c.text, fontSize: font.sizes.xxxl, fontWeight: font.weights.heavy, letterSpacing: -0.5 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accent, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill },
  createBtnText: { color: c.onAccent, fontWeight: font.weights.bold, fontSize: font.sizes.sm },
  gameCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: c.bgElevated, padding: spacing.md, borderRadius: radius.md },
  dateChip: { width: 52, height: 60, borderRadius: radius.sm, backgroundColor: c.bgRaised, alignItems: 'center', justifyContent: 'center' },
  dateDay: { color: c.text, fontSize: font.sizes.xl, fontWeight: font.weights.heavy, letterSpacing: -0.5 },
  dateMo: { color: c.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  gameHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gameFormat: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, fontWeight: font.weights.semibold },
  gamePrice: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.bold },
  gameFacility: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold, marginTop: 4 },
  gameFootRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  gameMeta: { color: c.textMuted, fontSize: font.sizes.sm },
  gameSlots: { color: c.textSecondary, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.bgElevated, padding: spacing.md, borderRadius: radius.md },
  pAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.bgRaised },
  pName: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  pMeta: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 2 },
  pStats: { color: c.textSecondary, fontSize: font.sizes.xs, marginTop: 2 },
  bkCard: { flexDirection: 'row', backgroundColor: c.bgElevated, borderRadius: radius.md, overflow: 'hidden' },
  bkImg: { width: 100, height: 108 },
  bkName: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  bkMeta: { color: c.textMuted, fontSize: font.sizes.sm },
  bkFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  bkPrice: { color: c.text, fontWeight: font.weights.bold, fontSize: font.sizes.base },
});
