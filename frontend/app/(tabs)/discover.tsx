import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { ChipRow, Loader, EmptyState, Badge, Avatar } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'facilities', label: 'Courts' },
  { key: 'events', label: 'Events' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'coaches', label: 'Coaches' },
];

export default function Discover() {
  const router = useRouter();
  const { register: pendingTournament } = useLocalSearchParams<{ register?: string }>();
  const { user } = useSession();
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
        const [f, e, t, co] = await Promise.all([api.facilities(), api.events(), api.tournaments(), api.coaches()]);
        setFacilities(f); setEvents(e); setTournaments(t); setCoaches(co);
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (user && pendingTournament) {
      api.registerTournament(String(pendingTournament)).catch(() => {}).finally(() => router.setParams({ register: undefined }));
    }
  }, [pendingTournament, router, user]);

  const byQ = <T extends { name: string }>(arr: T[]) =>
    q ? arr.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())) : arr;
  const showFac = cat === 'all' || cat === 'facilities';
  const showEv = cat === 'all' || cat === 'events';
  const showTr = cat === 'all' || cat === 'tournaments';
  const showCo = cat === 'all' || cat === 'coaches';

  function register(tournamentId: string) {
    if (!requireAuth(user, router, `/(tabs)/discover?register=${tournamentId}`)) return;
    api.registerTournament(tournamentId).catch(() => {});
  }

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="discover-screen">
      <View style={styles.header}>
        <View style={styles.titleRow}><View><Text style={styles.kicker}>FIND YOUR SQUAD</Text><Text style={styles.title}>Explore the game.</Text></View><View style={styles.titleSticker}><Text style={styles.titleStickerText}>GO!</Text></View></View>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={c.textMuted} />
          <TextInput
            testID="discover-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search courts, players, events..."
            placeholderTextColor={c.textFaint}
            style={styles.search}
          />
        </View>
      </View>
      <ChipRow items={CATEGORIES} active={cat} onChange={setCat} testIDPrefix="discover-cat" />

      {loading ? (
        <Loader />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {showFac && byQ(facilities).length > 0 && (
            <>
              <Text style={styles.sectionH}>Popular Near You</Text>
              {byQ(facilities).map((f) => (
                <Pressable
                  key={f.id}
                  testID={`discover-facility-${f.id}`}
                  style={styles.facCard}
                  onPress={() => router.push(`/facility/${f.id}`)}
                >
                  {f.image ? (
                    <Image source={{ uri: f.image }} style={styles.facImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.facImage, { backgroundColor: c.bgRaised, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="tennisball-outline" size={48} color={c.textMuted} />
                    </View>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(10,10,11,0.95)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.facOverlay}>
                    {f.is_experience_center && <Badge label="Experience Center" variant="accent" />}
                    <Text style={styles.facTitle}>{f.name}</Text>
                    <View style={styles.facMetaRow}>
                      <Ionicons name="location-outline" size={12} color={c.textSecondary} />
                      <Text style={styles.facSub}>{f.area || f.city}</Text>
                      {f.rating ? (
                        <>
                          <Text style={styles.dot}>·</Text>
                          <Ionicons name="star" size={11} color={c.textSecondary} />
                          <Text style={styles.facSub}>{f.rating}</Text>
                        </>
                      ) : null}
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.facSub}>{f.courts_count || 1} court(s)</Text>
                    </View>
                    <Text style={styles.facPrice}>from ₹{f.price_per_hour}<Text style={styles.facPriceUnit}>/hr</Text></Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {showEv && byQ(events).length > 0 && (
            <>
              <Text style={styles.sectionH}>What’s Happening</Text>
              {byQ(events).map((e) => (
                <Pressable key={e.id} style={styles.evCard} testID={`discover-event-${e.id}`}>
                  {e.image ? (
                    <Image source={{ uri: e.image }} style={styles.evImg} />
                  ) : (
                    <View style={[styles.evImg, { backgroundColor: c.bgRaised, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="calendar-outline" size={32} color={c.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, padding: spacing.md, justifyContent: 'space-between' }}>
                    <View>
                      <Text style={styles.evType}>{e.type}</Text>
                      <Text style={styles.evName} numberOfLines={2}>{e.name}</Text>
                    </View>
                    <View style={styles.evFooter}>
                      <Text style={styles.evMeta}>{new Date(e.date).toDateString()} · {e.city}</Text>
                      <Text style={styles.evPrice}>₹{e.price}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {showTr && byQ(tournaments).length > 0 && (
            <>
              <Text style={styles.sectionH}>Tournament season is here</Text>
              {byQ(tournaments).map((t) => (
                <Pressable
                  key={t.id}
                  style={styles.trCard}
                  testID={`discover-tournament-${t.id}`}
                  onPress={() => register(t.id)}
                >
                  {t.image ? (
                    <Image source={{ uri: t.image }} style={styles.trImg} />
                  ) : (
                    <View style={[styles.trImg, { backgroundColor: c.bgRaised, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="trophy-outline" size={48} color={c.textMuted} />
                    </View>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(10,10,11,0.95)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.trOverlay}>
                    <Text style={styles.trPrize}>₹{t.prize_pool.toLocaleString('en-IN')} prize pool</Text>
                    <Text style={styles.trName}>{t.name}</Text>
                    <Text style={styles.trMeta}>{new Date(t.date).toDateString()} · {t.city} · {t.format}</Text>
                    <View style={styles.trFooter}>
                      <Text style={styles.trFee}>Entry ₹{t.entry_fee}</Text>
                      <View style={styles.trBtn}>
                        <Text style={styles.trBtnText}>Register</Text>
                        <Ionicons name="arrow-forward" size={14} color={c.onAccent} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {showCo && byQ(coaches).length > 0 && (
            <>
              <Text style={styles.sectionH}>Meet the game changers</Text>
              {byQ(coaches).map((co) => (
                <Pressable
                  key={co.id}
                  style={styles.coachCard}
                  testID={`discover-coach-${co.id}`}
                  onPress={() => router.push(`/coach/${co.id}`)}
                >
                  <Avatar uri={co.avatar} name={co.name} size={60} style={{ marginRight: spacing.md }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coachName}>{co.name}</Text>
                    <View style={styles.coachMetaRow}>
                      <Text style={styles.coachMeta}>{co.experience_years} yrs</Text>
                      <Text style={styles.dot}>·</Text>
                      <Ionicons name="star" size={11} color={c.textSecondary} />
                      <Text style={styles.coachMeta}>{co.rating}</Text>
                    </View>
                    <Text style={styles.coachBio} numberOfLines={2}>{co.bio}</Text>
                    <Text style={styles.coachPrice}>₹{co.price_per_session}<Text style={styles.coachPriceUnit}>/session</Text></Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                </Pressable>
              ))}
            </>
          )}

          {!byQ(facilities).length && !byQ(events).length && !byQ(tournaments).length && !byQ(coaches).length && (
            <EmptyState
              title="Nothing matches your search"
              subtitle="Try clearing filters or expanding your area."
              icon="search-outline"
              testID="discover-empty"
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  kicker: { color: c.accent, fontSize: 10, fontWeight: font.weights.black, letterSpacing: 1.2 },
  title: { color: c.text, fontSize: font.sizes.xxxl, fontWeight: font.weights.black, letterSpacing: -0.9 },
  titleSticker: { backgroundColor: c.lime, width: 43, height: 37, borderRadius: radius.sm, borderWidth: 2, borderColor: c.text, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] },
  titleStickerText: { color: c.text, fontSize: 17, fontWeight: font.weights.black, fontStyle: 'italic' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.bgElevated, borderRadius: radius.md,
    paddingHorizontal: spacing.md, minHeight: 44,
  },
  search: { flex: 1, color: c.text, fontSize: font.sizes.base, paddingVertical: spacing.md },
  sectionH: { color: c.text, fontSize: font.sizes.lg, fontWeight: font.weights.bold, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  facCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, height: 200, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.bgElevated },
  facImage: { width: '100%', height: '100%' },
  facOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, gap: 6 },
  facTitle: { color: '#FFFFFF', fontSize: font.sizes.xxl, fontWeight: font.weights.heavy, letterSpacing: -0.3 },
  facMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  facSub: { color: '#F4F3F0', fontSize: font.sizes.sm },
  dot: { color: c.textFaint, marginHorizontal: 2 },
  facPrice: { color: '#FFFFFF', fontSize: font.sizes.base, fontWeight: font.weights.bold, marginTop: 4 },
  facPriceUnit: { color: '#F4F3F0', fontWeight: font.weights.regular, fontSize: font.sizes.sm },
  evCard: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: c.bgElevated, borderRadius: radius.md, overflow: 'hidden', minHeight: 108 },
  evImg: { width: 108, height: 108 },
  evType: { color: c.textMuted, fontSize: font.sizes.xs, fontWeight: font.weights.semibold, letterSpacing: 1, textTransform: 'uppercase' },
  evName: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.bold, marginTop: 2, lineHeight: 20 },
  evFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  evMeta: { color: c.textMuted, fontSize: font.sizes.sm, flex: 1 },
  evPrice: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.bold },
  trCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, height: 200, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.bgElevated },
  trImg: { width: '100%', height: '100%' },
  trOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, gap: 4 },
  trPrize: { color: c.lime, fontSize: font.sizes.xs, fontWeight: font.weights.bold, textTransform: 'uppercase', letterSpacing: 1.2 },
  trName: { color: '#FFFFFF', fontSize: font.sizes.xxl, fontWeight: font.weights.heavy, letterSpacing: -0.3, marginTop: 4 },
  trMeta: { color: '#F4F3F0', fontSize: font.sizes.sm, marginTop: 2 },
  trFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  trFee: { color: '#FFFFFF', fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  trBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accent, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  trBtnText: { color: c.onAccent, fontWeight: font.weights.bold, fontSize: font.sizes.sm },
  coachCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: c.bgElevated, padding: spacing.md, borderRadius: radius.md },
  coachAvatar: { width: 60, height: 60, borderRadius: 30 },
  coachName: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  coachMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  coachMeta: { color: c.textMuted, fontSize: font.sizes.sm },
  coachBio: { color: c.textSecondary, fontSize: font.sizes.sm, marginTop: 4, lineHeight: 18 },
  coachPrice: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.bold, marginTop: 4 },
  coachPriceUnit: { color: c.textMuted, fontWeight: font.weights.regular },
});
