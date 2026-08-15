import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius, HERO_IMAGES } from '@/src/theme';
import { SectionHeader, Card, MatchScoreBadge, Loader } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rec, players, facilities, events] = await Promise.all([
        api.aiRecommendations(),
        api.players(),
        api.facilities(),
        api.events(),
      ]);
      setData({ rec, players: players.slice(0, 5), facilities: facilities.slice(0, 5), events: events.slice(0, 3) });
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true); await load(); setRefreshing(false);
  }

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <View style={styles.wrap} testID="home-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: HERO_IMAGES.home }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={['rgba(10,10,10,0.4)', 'rgba(10,10,10,0.95)']} locations={[0, 1]} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLocation}><Ionicons name="location" size={12} color={colors.brandPrimary} /> {user?.city || 'Bangalore'}</Text>
                <Text style={styles.heroHi}>Hey {user?.name?.split(' ')[0] || 'Athlete'} 👋</Text>
              </View>
              <Pressable testID="home-search-btn" onPress={() => router.push('/discover')} style={styles.iconBtn}>
                <Ionicons name="search" size={20} color={colors.onSurface} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.heroBottom}>
              <Text style={styles.heroTitle}>Find your game.{"\n"}Own the court.</Text>
              <Pressable testID="home-find-game-cta" onPress={() => router.push('/(tabs)/play')} style={styles.ctaBtn}>
                <Text style={styles.ctaText}>Find a Game →</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {[
            { key: 'book', label: 'Book Court', icon: 'calendar', to: '/(tabs)/discover' },
            { key: 'coach', label: 'AI Coach', icon: 'sparkles', to: '/ai-coach' },
            { key: 'shop', label: 'Shop', icon: 'bag', to: '/marketplace' },
            { key: 'events', label: 'Events', icon: 'trophy', to: '/(tabs)/discover' },
          ].map((a) => (
            <Pressable key={a.key} testID={`home-quick-${a.key}`} style={styles.quickItem} onPress={() => router.push(a.to as any)}>
              <View style={styles.quickIcon}><Ionicons name={a.icon as any} size={22} color={colors.brandPrimary} /></View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* AI insight */}
        <Card style={styles.insightCard} testID="home-ai-insight">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="sparkles" size={14} color={colors.brandPrimary} />
            <Text style={styles.insightLabel}>AI COACH INSIGHT</Text>
          </View>
          <Text style={styles.insightText}>{data.rec.insight}</Text>
          <Pressable onPress={() => router.push('/ai-coach')} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
            <Text style={{ color: colors.brandPrimary, fontWeight: '700' }}>Talk to AI Coach →</Text>
          </Pressable>
        </Card>

        {/* Nearby facilities */}
        <SectionHeader title="Nearby Courts" action="See all" onAction={() => router.push('/(tabs)/discover')} testID="home-nearby-header" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
          {data.facilities.map((f: any) => (
            <Pressable key={f.id} testID={`home-facility-${f.id}`} style={styles.facCard} onPress={() => router.push(`/facility/${f.id}`)}>
              <Image source={{ uri: f.image }} style={styles.facImage} contentFit="cover" />
              <View style={styles.facBody}>
                <Text style={styles.facName} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.facMeta}>{f.area} · ⭐ {f.rating}</Text>
                <Text style={styles.facPrice}>₹{f.price_per_hour}/hr</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Recommended players */}
        <SectionHeader title="Players Near You" action="See all" onAction={() => router.push('/(tabs)/play')} testID="home-players-header" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {data.players.slice(0, 3).map((p: any) => (
            <Pressable key={p.id} testID={`home-player-${p.id}`} onPress={() => router.push(`/player/${p.id}`)} style={styles.playerRow}>
              <Image source={{ uri: p.avatar }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerMeta}>{p.skill_level} · {p.area}</Text>
                <Text style={styles.playerBio} numberOfLines={1}>{p.playing_style}</Text>
              </View>
              <MatchScoreBadge score={p.match_score} testID={`home-player-${p.id}-score`} />
            </Pressable>
          ))}
        </View>

        {/* Upcoming events */}
        <SectionHeader title="Upcoming Events" action="See all" onAction={() => router.push('/(tabs)/discover')} testID="home-events-header" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
          {data.events.map((e: any) => (
            <Pressable key={e.id} style={styles.eventCard} testID={`home-event-${e.id}`}>
              <Image source={{ uri: e.image }} style={styles.eventImage} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(10,10,10,0.95)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.eventOverlay}>
                <Text style={styles.eventType}>{e.type}</Text>
                <Text style={styles.eventName} numberOfLines={2}>{e.name}</Text>
                <Text style={styles.eventMeta}>{new Date(e.date).toDateString()}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Recommended equipment */}
        <SectionHeader title="Gear Picked For You" action="Shop" onAction={() => router.push('/marketplace')} testID="home-gear-header" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
          {(data.rec.products || []).map((p: any) => (
            <Pressable key={p.id} style={styles.productCard} onPress={() => router.push(`/product/${p.id}`)} testID={`home-product-${p.id}`}>
              <Image source={{ uri: p.image }} style={styles.productImage} contentFit="cover" />
              <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.productPrice}>₹{p.price.toLocaleString('en-IN')}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 380, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.md },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.lg },
  heroLocation: { color: colors.onSurfaceSecondary, fontSize: font.sizes.xs, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  heroHi: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '700', marginTop: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroBottom: { padding: spacing.lg, paddingBottom: spacing.xl },
  heroTitle: { color: colors.onSurface, fontSize: 34, fontWeight: '900', lineHeight: 38, letterSpacing: -0.5, marginBottom: spacing.lg },
  ctaBtn: { alignSelf: 'flex-start', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  ctaText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
  quickRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: -spacing.md },
  quickItem: { flex: 1, alignItems: 'center', backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '600' },
  insightCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  insightLabel: { color: colors.brandPrimary, fontSize: font.sizes.xs, letterSpacing: 1.2, fontWeight: '700' },
  insightText: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '600', lineHeight: 22 },
  railContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  facCard: { width: 260, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  facImage: { width: '100%', height: 140 },
  facBody: { padding: spacing.md },
  facName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700' },
  facMeta: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, marginTop: 2 },
  facPrice: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: '700', marginTop: 6 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceTertiary },
  playerName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700' },
  playerMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  playerBio: { color: colors.brandPrimary, fontSize: font.sizes.xs, marginTop: 2 },
  eventCard: { width: 260, height: 180, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSecondary },
  eventImage: { width: '100%', height: '100%' },
  eventOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md },
  eventType: { color: colors.brandPrimary, fontSize: font.sizes.xs, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  eventName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', marginTop: 4 },
  eventMeta: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, marginTop: 4 },
  productCard: { width: 160 },
  productImage: { width: 160, height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  productName: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '600', marginTop: spacing.sm },
  productPrice: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: '800', marginTop: 4 },
});
