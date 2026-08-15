import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Card, Loader } from '@/src/components/ui';
import { api, clearToken } from '@/src/api';
import { useSession } from '@/src/session';

export default function Profile() {
  const router = useRouter();
  const { user, refresh } = useSession();
  const [insights, setInsights] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [ins, o, b, caps] = await Promise.all([
          api.aiInsights().catch(() => null),
          api.myOrders().catch(() => []),
          api.myBookings().catch(() => []),
          api.capabilities().catch(() => null),
        ]);
        setInsights(ins); setOrders(o); setBookings(b);
        if (caps?.organizations) setOrgs(caps.organizations);
      } catch {}
    })();
  }, []);

  async function signOut() { await clearToken(); await refresh(); router.replace('/(auth)/login'); }

  if (!user) return <Loader />;

  const winRate = insights?.stats?.win_rate || 0;

  return (
    <View style={styles.wrap} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={{ uri: user.avatar || 'https://i.pravatar.cc/300' }} style={StyleSheet.absoluteFillObject} contentFit="cover" blurRadius={40} />
          <LinearGradient colors={['rgba(10,10,10,0.6)', colors.surface]} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={['top']} style={{ alignItems: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.lg }}>
            <Image source={{ uri: user.avatar || 'https://i.pravatar.cc/300' }} style={styles.avatar} />
            <Text style={styles.name}>{user.name || 'Athlete'}</Text>
            <Text style={styles.meta}>{user.city} · {user.skill_level} · Pickleball</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{insights?.stats?.matches_played ?? 0}</Text>
                <Text style={styles.statLabel}>Matches</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{winRate}%</Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{insights?.performance_score ?? '—'}</Text>
                <Text style={styles.statLabel}>Score</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Performance card */}
        {insights && (
          <Card style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }} testID="profile-performance">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
              <Ionicons name="stats-chart" size={16} color={colors.brandPrimary} />
              <Text style={styles.cardLabel}>PERFORMANCE</Text>
            </View>
            <View style={styles.chartRow}>
              {insights.chart.map((v: number, i: number) => (
                <View key={i} style={[styles.chartBar, { height: 6 + v }]} />
              ))}
            </View>
            <View style={{ marginTop: spacing.md, gap: 6 }}>
              <Text style={styles.perfLine}><Text style={{ color: colors.brandPrimary }}>▲</Text> Strongest: <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{insights.strongest}</Text></Text>
              <Text style={styles.perfLine}><Text style={{ color: colors.warning }}>△</Text> Improve: <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{insights.needs_improvement}</Text></Text>
              <Text style={styles.perfLine}><Text style={{ color: colors.brandPrimary }}>✱</Text> AI: {insights.recommendation}</Text>
            </View>
          </Card>
        )}

        <Card style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={22} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700' }}>Talk to AI Coach</Text>
            <Text style={{ color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 }}>Personalized training & insights</Text>
          </View>
          <Pressable testID="profile-open-ai" onPress={() => router.push('/ai-coach')} style={styles.miniBtn}>
            <Text style={styles.miniBtnText}>Open</Text>
          </Pressable>
        </Card>

        {/* Manage Club (only if user has an org membership — backend-determined) */}
        {orgs.length > 0 && (
          <View style={{ marginTop: spacing.md, paddingHorizontal: spacing.lg }}>
            <Text style={{ color: colors.onSurfaceMuted, fontSize: font.sizes.sm, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginBottom: spacing.sm }}>Workspaces</Text>
            {orgs.map((o: any) => (
              <Pressable key={o.org_id} testID={`profile-club-${o.org_id}`} style={styles.menuRow} onPress={() => router.push(`/club/${o.org_id}`)}>
                <Ionicons name="business" size={20} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{o.name}</Text>
                  <Text style={{ color: colors.onSurfaceMuted, fontSize: font.sizes.xs }}>{o.role.replace('CLUB_', '').replace('_', ' ')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Menu */}
        <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
          {[
            { key: 'training', label: 'Training Plans', icon: 'barbell', to: '/training' },
            { key: 'rankings', label: 'Rankings & Badges', icon: 'trophy', to: '/rankings' },
            { key: 'refer', label: 'Refer & Earn', icon: 'gift', to: '/refer' },
            { key: 'bookings', label: `My Bookings (${bookings.length})`, icon: 'calendar', to: '/(tabs)/play' },
            { key: 'orders', label: `My Orders (${orders.length})`, icon: 'bag', to: '/marketplace' },
          ].map((it) => (
            <Pressable key={it.key} testID={`profile-menu-${it.key}`} style={styles.menuRow} onPress={() => router.push(it.to as any)}>
              <Ionicons name={it.icon as any} size={20} color={colors.onSurfaceSecondary} />
              <Text style={styles.menuLabel}>{it.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable testID="profile-signout" onPress={signOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { height: 300, backgroundColor: colors.surfaceSecondary },
  avatar: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary, marginBottom: spacing.md },
  name: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' },
  meta: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
  statBox: { alignItems: 'center', minWidth: 74 },
  statVal: { color: colors.brandPrimary, fontSize: font.sizes.xxl, fontWeight: '900' },
  statLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  cardLabel: { color: colors.brandPrimary, fontSize: font.sizes.xs, letterSpacing: 1.2, fontWeight: '700' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 },
  chartBar: { flex: 1, backgroundColor: colors.brandPrimary, borderRadius: 4, opacity: 0.85 },
  perfLine: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, lineHeight: 20 },
  miniBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  miniBtnText: { color: colors.onBrandPrimary, fontWeight: '800' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  menuLabel: { flex: 1, color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '600' },
  signOut: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  signOutText: { color: colors.error, fontSize: font.sizes.base, fontWeight: '700' },
});
