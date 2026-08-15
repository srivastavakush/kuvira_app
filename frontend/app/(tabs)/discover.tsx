import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { ChipRow, Loader, EmptyState } from '@/src/components/ui';
import { api } from '@/src/api';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'facilities', label: 'Courts' },
  { key: 'events', label: 'Events' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'coaches', label: 'Coaches' },
];

export default function Discover() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [f, e, t, c] = await Promise.all([api.facilities(), api.events(), api.tournaments(), api.coaches()]);
        setFacilities(f); setEvents(e); setTournaments(t); setCoaches(c);
      } finally { setLoading(false); }
    })();
  }, []);

  const filterByQ = <T extends { name: string }>(arr: T[]) => q ? arr.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())) : arr;

  const showFac = cat === 'all' || cat === 'facilities';
  const showEv = cat === 'all' || cat === 'events';
  const showTr = cat === 'all' || cat === 'tournaments';
  const showCo = cat === 'all' || cat === 'coaches';

  return (
    <SafeAreaView style={styles.wrap} testID="discover-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.onSurfaceMuted} />
          <TextInput
            testID="discover-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Courts, players, coaches, events…"
            placeholderTextColor={colors.onSurfaceMuted}
            style={styles.search}
          />
        </View>
      </View>
      <ChipRow items={CATEGORIES} active={cat} onChange={setCat} testIDPrefix="discover-cat" />

      {loading ? <Loader /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {showFac && filterByQ(facilities).length > 0 && (
            <>
              <Text style={styles.sectionH}>Courts & Facilities</Text>
              {filterByQ(facilities).map((f) => (
                <Pressable key={f.id} testID={`discover-facility-${f.id}`} style={styles.facCard} onPress={() => router.push(`/facility/${f.id}`)}>
                  <Image source={{ uri: f.image }} style={styles.facImage} contentFit="cover" />
                  <LinearGradient colors={['transparent', 'rgba(10,10,10,0.95)']} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.facOverlay}>
                    {f.is_experience_center && <View style={styles.badge}><Text style={styles.badgeText}>EXPERIENCE CENTER</Text></View>}
                    <Text style={styles.facTitle}>{f.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <Text style={styles.facSub}>📍 {f.area}</Text>
                      <Text style={styles.facSub}>⭐ {f.rating}</Text>
                      <Text style={styles.facSub}>🎾 {f.courts_count} courts</Text>
                    </View>
                    <Text style={styles.facPrice}>from ₹{f.price_per_hour}/hr</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {showEv && filterByQ(events).length > 0 && (
            <>
              <Text style={styles.sectionH}>Events</Text>
              {filterByQ(events).map((e) => (
                <Pressable key={e.id} style={styles.evCard} testID={`discover-event-${e.id}`}>
                  <Image source={{ uri: e.image }} style={styles.evImg} />
                  <View style={{ flex: 1, padding: spacing.md }}>
                    <Text style={styles.evType}>{e.type}</Text>
                    <Text style={styles.evName} numberOfLines={2}>{e.name}</Text>
                    <Text style={styles.evMeta}>{new Date(e.date).toDateString()} · {e.city}</Text>
                    <Text style={styles.evPrice}>₹{e.price}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {showTr && filterByQ(tournaments).length > 0 && (
            <>
              <Text style={styles.sectionH}>Tournaments</Text>
              {filterByQ(tournaments).map((t) => (
                <Pressable key={t.id} style={styles.trCard} testID={`discover-tournament-${t.id}`} onPress={async () => {
                  try { await api.registerTournament(t.id); } catch {}
                }}>
                  <Image source={{ uri: t.image }} style={styles.trImg} />
                  <LinearGradient colors={['transparent', 'rgba(10,10,10,0.9)']} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.trOverlay}>
                    <Text style={styles.trPrize}>₹{t.prize_pool.toLocaleString('en-IN')} prize pool</Text>
                    <Text style={styles.trName}>{t.name}</Text>
                    <Text style={styles.trMeta}>{new Date(t.date).toDateString()} · {t.city} · {t.format}</Text>
                    <View style={styles.trFooter}>
                      <Text style={styles.trFee}>Entry ₹{t.entry_fee}</Text>
                      <View style={styles.trBtn}><Text style={styles.trBtnText}>Register →</Text></View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {showCo && filterByQ(coaches).length > 0 && (
            <>
              <Text style={styles.sectionH}>Coaches</Text>
              {filterByQ(coaches).map((c) => (
                <View key={c.id} style={styles.coachCard} testID={`discover-coach-${c.id}`}>
                  <Image source={{ uri: c.avatar }} style={styles.coachAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coachName}>{c.name}</Text>
                    <Text style={styles.coachMeta}>{c.experience_years} yrs · ⭐ {c.rating}</Text>
                    <Text style={styles.coachBio} numberOfLines={2}>{c.bio}</Text>
                    <Text style={styles.coachPrice}>₹{c.price_per_session}/session</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {!filterByQ(facilities).length && !filterByQ(events).length && !filterByQ(tournaments).length && !filterByQ(coaches).length && (
            <EmptyState title="Nothing matches your search" subtitle="Try clearing filters or expanding your area." testID="discover-empty" />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900', marginBottom: spacing.md },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  search: { flex: 1, color: colors.onSurface, fontSize: font.sizes.base, paddingVertical: spacing.md },
  sectionH: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800', paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  facCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSecondary },
  facImage: { width: '100%', height: '100%' },
  facOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginBottom: 6 },
  badgeText: { color: colors.brandPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  facTitle: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900' },
  facSub: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm },
  facPrice: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: '800', marginTop: 6 },
  evCard: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  evImg: { width: 100, height: 100 },
  evType: { color: colors.brandPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  evName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700', marginTop: 2 },
  evMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 4 },
  evPrice: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: '800', marginTop: 4 },
  trCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSecondary },
  trImg: { width: '100%', height: '100%' },
  trOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg },
  trPrize: { color: colors.brandPrimary, fontSize: font.sizes.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  trName: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900', marginTop: 4 },
  trMeta: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, marginTop: 4 },
  trFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  trFee: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  trBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  trBtnText: { color: colors.onBrandPrimary, fontWeight: '800' },
  coachCard: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  coachAvatar: { width: 72, height: 72, borderRadius: 36 },
  coachName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  coachMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  coachBio: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, marginTop: 4 },
  coachPrice: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: '800', marginTop: 6 },
});
