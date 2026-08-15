import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { ChipRow, Loader } from '@/src/components/ui';
import { api } from '@/src/api';

const SCOPES = [{ key: 'city', label: 'My City' }, { key: 'global', label: 'Global' }];

export default function Rankings() {
  const router = useRouter();
  const [scope, setScope] = useState<'city' | 'global'>('city');
  const [board, setBoard] = useState<any[]>([]);
  const [ach, setAch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [r, a] = await Promise.all([api.rankings(scope), api.achievements()]);
      setBoard(r.leaderboard); setAch(a); setLoading(false);
    })();
  }, [scope]);

  return (
    <SafeAreaView style={styles.wrap} testID="rankings-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="rankings-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Rankings</Text>
        <View style={{ width: 26 }} />
      </View>
      <ChipRow items={SCOPES} active={scope} onChange={(k) => setScope(k as any)} testIDPrefix="rankings-scope" />

      {loading ? <Loader /> : (
        <FlatList
          data={board}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm }}
          ListHeaderComponent={ach ? (
            <View style={styles.achCard} testID="rankings-achievements">
              <Text style={styles.achTitle}>Achievements · {ach.earned_count}/{ach.total}</Text>
              <View style={styles.badges}>
                {ach.achievements.map((a: any) => (
                  <View key={a.id} style={[styles.badge, !a.earned && { opacity: 0.35 }]} testID={`badge-${a.id}`}>
                    <View style={[styles.badgeIcon, a.earned && { backgroundColor: colors.brandPrimary }]}>
                      <Ionicons name={a.icon} size={20} color={a.earned ? colors.onBrandPrimary : colors.onSurfaceMuted} />
                    </View>
                    <Text style={styles.badgeLabel} numberOfLines={1}>{a.title}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          renderItem={({ item }) => (
            <View style={[styles.row, item.is_me && styles.rowMe]} testID={`rank-row-${item.rank}`}>
              <Text style={[styles.rank, item.rank <= 3 && { color: colors.brandPrimary }]}>{item.rank}</Text>
              <Image source={{ uri: item.avatar || 'https://i.pravatar.cc/100' }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.meta}>{item.skill_level} · {item.city || '—'}</Text>
              </View>
              <Text style={styles.points}>{item.points}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' },
  achCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  achTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', marginBottom: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  badge: { width: 68, alignItems: 'center' },
  badgeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badgeLabel: { color: colors.onSurfaceSecondary, fontSize: 10, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  rowMe: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  rank: { width: 28, textAlign: 'center', color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '900' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary },
  name: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  meta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  points: { color: colors.brandPrimary, fontSize: font.sizes.lg, fontWeight: '900' },
});
