import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { SectionHeader, Loader, MatchScoreBadge } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';

const QUICK_ACTIONS = [
  { key: 'book', label: 'Book Court', icon: 'calendar-outline' as const, to: '/(tabs)/discover', protected: true },
  { key: 'coach', label: 'AI Coach', icon: 'compass-outline' as const, to: '/ai-coach', protected: false },
  { key: 'shop', label: 'Shop', icon: 'bag-outline' as const, to: '/marketplace', protected: false },
  { key: 'events', label: 'Events', icon: 'trophy-outline' as const, to: '/(tabs)/discover', protected: false },
] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [rec, players, facilities, events] = await Promise.all([
      api.aiRecommendations().catch(() => ({ insight: 'Play more. Improve every match.', products: [] })),
      api.players().catch(() => []),
      api.facilities().catch(() => []),
      api.events().catch(() => []),
    ]);
    setData({
      rec,
      players: players.slice(0, 3),
      facilities: facilities.slice(0, 5),
      events: events.slice(0, 4),
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (!data) return <SafeAreaView style={styles.wrap}><Loader /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="home-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textFaint} />}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              <Ionicons name="location-outline" size={11} color={c.textMuted} /> {user?.city || 'Bangalore'}
            </Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting()}, {user?.name?.split(' ')[0] || 'athlete'}
            </Text>
          </View>
          <Pressable
            testID="home-search-btn"
            onPress={() => router.push('/(tabs)/discover')}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Ionicons name="search-outline" size={20} color={c.text} />
          </Pressable>
        </View>

        {/* Insight strip — quiet, no big gold tint */}
        <Pressable
          testID="home-ai-insight"
          onPress={() => router.push('/ai-coach')}
          style={({ pressed }) => [styles.insight, pressed && { opacity: 0.75 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.insightLabel}>Today{"\u2019"}s coaching note</Text>
            <Text style={styles.insightText} numberOfLines={2}>{data.rec.insight}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
        </Pressable>

        {/* Quick actions — thin outlined tiles, no gold circle */}
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              testID={`home-quick-${a.key}`}
              style={({ pressed }) => [styles.quickItem, pressed && { backgroundColor: c.bgRaised }]}
              onPress={() => {
                if (a.protected && !requireAuth(user, router)) return;
                router.push(a.to as any);
              }}
            >
              <Ionicons name={a.icon} size={20} color={c.text} />
              <Text style={styles.quickLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Nearby courts */}
        <SectionHeader title="Nearby courts" action="See all" onAction={() => router.push('/(tabs)/discover')} testID="home-nearby-header" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
          {data.facilities.map((f: any) => (
            <Pressable
              key={f.id}
              testID={`home-facility-${f.id}`}
              style={styles.facCard}
              onPress={() => router.push(`/facility/${f.id}`)}
            >
              <Image source={{ uri: f.image }} style={styles.facImage} contentFit="cover" />
              <View style={styles.facBody}>
                <Text style={styles.facName} numberOfLines={1}>{f.name}</Text>
                <View style={styles.facMetaRow}>
                  <Ionicons name="location-outline" size={12} color={c.textMuted} />
                  <Text style={styles.facMeta}>{f.area}</Text>
                  <Text style={styles.dot}>·</Text>
                  <Ionicons name="star" size={11} color={c.textSecondary} />
                  <Text style={styles.facMeta}>{f.rating}</Text>
                </View>
                <Text style={styles.facPrice}>₹{f.price_per_hour}<Text style={styles.facPriceUnit}>/hr</Text></Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Players */}
        <SectionHeader title="Players near you" action="See all" onAction={() => router.push('/(tabs)/play')} testID="home-players-header" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {data.players.map((p: any) => (
            <Pressable
              key={p.id}
              testID={`home-player-${p.id}`}
              onPress={() => router.push(`/player/${p.id}`)}
              style={({ pressed }) => [styles.playerRow, pressed && { backgroundColor: c.bgRaised }]}
            >
              <Image source={{ uri: p.avatar }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerMeta}>{p.skill_level} · {p.area}</Text>
              </View>
              <MatchScoreBadge score={p.match_score} testID={`home-player-${p.id}-score`} />
            </Pressable>
          ))}
        </View>

        {/* Events */}
        <SectionHeader title="Upcoming events" action="See all" onAction={() => router.push('/(tabs)/discover')} testID="home-events-header" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
          {data.events.map((e: any) => (
            <Pressable key={e.id} style={styles.eventCard} testID={`home-event-${e.id}`}>
              <Image source={{ uri: e.image }} style={styles.eventImage} contentFit="cover" />
              <View style={styles.eventBody}>
                <Text style={styles.eventType}>{e.type}</Text>
                <Text style={styles.eventName} numberOfLines={2}>{e.name}</Text>
                <Text style={styles.eventMeta}>
                  {new Date(e.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })} · {e.city}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Gear */}
        <SectionHeader title="Gear picked for you" action="Shop" onAction={() => router.push('/marketplace')} testID="home-gear-header" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
          {(data.rec.products || []).map((p: any) => (
            <Pressable
              key={p.id}
              style={styles.productCard}
              onPress={() => router.push(`/product/${p.id}`)}
              testID={`home-product-${p.id}`}
            >
              <Image source={{ uri: p.image }} style={styles.productImage} contentFit="cover" />
              <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.productPrice}>₹{p.price.toLocaleString('en-IN')}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  eyebrow: {
    color: c.textMuted,
    fontSize: font.sizes.xs,
    letterSpacing: 0.8,
    fontWeight: font.weights.semibold,
  },
  greeting: {
    color: c.text,
    fontSize: font.sizes.xxl,
    fontWeight: font.weights.heavy,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  insightLabel: {
    color: c.textMuted,
    fontSize: font.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: font.weights.semibold,
    marginBottom: 4,
  },
  insightText: {
    color: c.text,
    fontSize: font.sizes.base,
    fontWeight: font.weights.semibold,
    lineHeight: 20,
  },
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.bgElevated,
  },
  quickLabel: {
    color: c.text,
    fontSize: font.sizes.xs,
    fontWeight: font.weights.semibold,
  },
  railContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  facCard: {
    width: 240,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  facImage: { width: '100%', height: 128 },
  facBody: { padding: spacing.md },
  facName: {
    color: c.text,
    fontSize: font.sizes.base,
    fontWeight: font.weights.bold,
  },
  facMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  facMeta: { color: c.textMuted, fontSize: font.sizes.sm },
  dot: { color: c.textFaint, marginHorizontal: 2 },
  facPrice: {
    color: c.text,
    fontSize: font.sizes.base,
    fontWeight: font.weights.bold,
    marginTop: 8,
  },
  facPriceUnit: {
    color: c.textMuted,
    fontWeight: font.weights.regular,
    fontSize: font.sizes.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.bgElevated,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.bgRaised,
  },
  playerName: {
    color: c.text,
    fontSize: font.sizes.base,
    fontWeight: font.weights.semibold,
  },
  playerMeta: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 2 },
  eventCard: {
    width: 240,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  eventImage: { width: '100%', height: 128 },
  eventBody: { padding: spacing.md },
  eventType: {
    color: c.textMuted,
    fontSize: font.sizes.xs,
    textTransform: 'uppercase',
    fontWeight: font.weights.semibold,
    letterSpacing: 1,
  },
  eventName: {
    color: c.text,
    fontSize: font.sizes.base,
    fontWeight: font.weights.bold,
    marginTop: 4,
    lineHeight: 20,
  },
  eventMeta: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 4 },
  productCard: { width: 148 },
  productImage: {
    width: 148,
    height: 148,
    borderRadius: radius.md,
    backgroundColor: c.bgElevated,
  },
  productName: {
    color: c.text,
    fontSize: font.sizes.sm,
    fontWeight: font.weights.semibold,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  productPrice: {
    color: c.text,
    fontSize: font.sizes.base,
    fontWeight: font.weights.bold,
    marginTop: 4,
  },
});
