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

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);

  useEffect(() => { (async () => setP(await api.player(String(id))))(); }, [id]);
  if (!p) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  const winRate = Math.round((p.wins / Math.max(1, p.matches_played)) * 100);

  return (
    <View style={styles.wrap} testID="player-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: p.avatar }} style={StyleSheet.absoluteFillObject} contentFit="cover" blurRadius={30} />
          <LinearGradient colors={['rgba(10,10,10,0.4)', colors.surface]} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={['top']}>
            <Pressable testID="player-back" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </Pressable>
          </SafeAreaView>
          <View style={styles.heroCenter}>
            <Image source={{ uri: p.avatar }} style={styles.avatar} />
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.meta}>{p.skill_level} · {p.area}, {p.city}</Text>
            {p.match_score != null && (
              <View style={styles.matchPill}>
                <Text style={styles.matchPillText}>{p.match_score}% Match</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <Stat val={p.matches_played} label="Matches" />
            <Stat val={`${winRate}%`} label="Win Rate" />
            <Stat val={p.rating} label="Rating" />
          </View>

          <Text style={styles.sectionH}>About</Text>
          <Text style={styles.bio}>{p.bio}</Text>

          <View style={styles.tags}>
            <Tag icon="tennisball" text={p.playing_style} />
            <Tag icon="time" text={p.availability} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="player-invite-btn" style={styles.ghostBtn} onPress={() => router.push('/create-game')}>
          <Text style={styles.ghostBtnText}>Invite to Game</Text>
        </Pressable>
        <Pressable testID="player-challenge-btn" style={styles.primaryBtn} onPress={() => router.push('/create-game')}>
          <Text style={styles.primaryBtnText}>Challenge</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ val, label }: { val: any; label: string }) {
  return <View style={styles.statBox}><Text style={styles.statVal}>{val}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function Tag({ icon, text }: { icon: any; text: string }) {
  return <View style={styles.tag}><Ionicons name={icon} size={14} color={colors.brandPrimary} /><Text style={styles.tagText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 340, backgroundColor: colors.surfaceSecondary },
  backBtn: { margin: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  heroCenter: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: spacing.lg },
  avatar: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: colors.brandPrimary, marginBottom: spacing.md },
  name: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' },
  meta: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, marginTop: 4 },
  matchPill: { marginTop: spacing.md, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radius.pill },
  matchPillText: { color: colors.brandPrimary, fontWeight: '900', fontSize: font.sizes.base },
  body: { padding: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statVal: { color: colors.brandPrimary, fontSize: font.sizes.xxl, fontWeight: '900' },
  statLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  sectionH: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md },
  bio: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  tagText: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  ghostBtn: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  ghostBtnText: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  primaryBtn: { flex: 1, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  primaryBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.base, fontWeight: '800' },
});
