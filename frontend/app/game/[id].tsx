import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [g, setG] = useState<any>(null);
  const [joining, setJoining] = useState(false);

  async function load() { setG(await api.game(String(id))); }
  useEffect(() => { load(); }, [id]);

  async function join() {
    setJoining(true);
    try { const res = await api.joinGame(String(id)); setG(res); } finally { setJoining(false); }
  }

  if (!g) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;
  const joined = user && g.current_players?.includes(user.id);
  const full = g.slots_remaining <= 0;

  return (
    <View style={styles.wrap} testID="game-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: g.facility?.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={['rgba(10,10,10,0.5)', 'transparent', 'rgba(10,10,10,0.95)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={['top']}>
            <Pressable testID="game-back" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </Pressable>
          </SafeAreaView>
          <View style={styles.heroBottom}>
            <View style={styles.badge}><Text style={styles.badgeText}>{g.format} · {g.skill_level}</Text></View>
            <Text style={styles.title}>{g.facility?.name}</Text>
            <Text style={styles.meta}>{new Date(g.date).toDateString()} · {new Date(g.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.infoRow}>
            <Info icon="time" label="Duration" value={`${g.duration_min} min`} />
            <Info icon="cash" label="Per person" value={`₹${g.price_per_person}`} />
            <Info icon="people" label="Slots left" value={`${g.slots_remaining}`} />
          </View>

          {g.notes ? <Text style={styles.notes}>{'\u201C'}{g.notes}{'\u201D'}</Text> : null}

          <Text style={styles.sectionH}>Host</Text>
          <View style={styles.hostRow}>
            <Image source={{ uri: g.host?.avatar }} style={styles.avatar} />
            <View>
              <Text style={styles.hostName}>{g.host?.name || 'Host'}</Text>
              <Text style={styles.hostMeta}>{g.host?.skill_level || ''} {g.host?.area ? `· ${g.host.area}` : ''}</Text>
            </View>
          </View>

          <Text style={styles.sectionH}>Players ({g.current_players?.length}/{g.max_players})</Text>
          <View style={styles.playerDots}>
            {Array.from({ length: g.max_players }).map((_, i) => (
              <View key={i} style={[styles.dot, i < g.current_players.length ? styles.dotFilled : styles.dotEmpty]}>
                <Ionicons name={i < g.current_players.length ? 'person' : 'add'} size={18} color={i < g.current_players.length ? colors.onSurface : colors.onSurfaceMuted} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="game-join-btn"
          disabled={joined || full || joining}
          style={[styles.joinBtn, (joined || full) && { backgroundColor: colors.surfaceTertiary }]}
          onPress={join}
        >
          <Text style={[styles.joinBtnText, (joined || full) && { color: colors.onSurfaceSecondary }]}>
            {joined ? 'You\'re in' : full ? 'Game full' : joining ? 'Joining…' : `Join · ₹${g.price_per_person}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Info({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceSecondary} />
      <Text style={styles.infoVal}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 280, backgroundColor: colors.surfaceSecondary },
  backBtn: { margin: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginBottom: 6 },
  badgeText: { color: colors.brandPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '800', letterSpacing: -0.3 },
  meta: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, marginTop: 4 },
  body: { padding: spacing.lg },
  infoRow: { flexDirection: 'row', gap: spacing.md },
  infoBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 4 },
  infoVal: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  infoLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  notes: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, fontStyle: 'italic', marginTop: spacing.lg },
  sectionH: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceTertiary },
  hostName: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700' },
  hostMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  playerDots: { flexDirection: 'row', gap: spacing.md },
  dot: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  dotFilled: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  dotEmpty: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong, borderStyle: 'dashed' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  joinBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  joinBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
});
