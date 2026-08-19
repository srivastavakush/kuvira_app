import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { Button, Divider } from '@/src/components/ui';
import { api, clearToken } from '@/src/api';
import { useSession } from '@/src/session';

export default function Profile() {
  const router = useRouter();
  const { user, refresh } = useSession();
  const [insights, setInsights] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [caps, setCaps] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [ins, o, b, capabilities] = await Promise.all([
          api.aiInsights().catch(() => null),
          api.myOrders().catch(() => []),
          api.myBookings().catch(() => []),
          api.capabilities().catch(() => null),
        ]);
        setInsights(ins); setOrders(o); setBookings(b); setCaps(capabilities);
        if (capabilities?.organizations) setOrgs(capabilities.organizations);
      } catch {}
    })();
  }, [user]);

  async function signOut() { await clearToken(); await refresh(); }

  if (!user) {
    return (
      <SafeAreaView style={styles.guestWrap} testID="profile-login-screen">
        <View style={styles.guestIcon}>
          <Ionicons name="person-outline" size={28} color={c.textSecondary} />
        </View>
        <Text style={styles.guestTitle}>Your Kuvira profile</Text>
        <Text style={styles.guestSubtitle}>Sign in to manage your games, bookings and personalized experience.</Text>
        <View style={{ alignSelf: 'stretch', maxWidth: 320, marginTop: spacing.xl }}>
          <Button label="Sign in" onPress={() => router.push('/(auth)/login')} testID="profile-login-btn" />
        </View>
      </SafeAreaView>
    );
  }

  const winRate = insights?.stats?.win_rate || 0;
  const isAdmin = Boolean(caps?.is_platform_admin);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={{ uri: user.avatar || 'https://i.pravatar.cc/300' }} style={styles.avatar} />
          <Text style={styles.name}>{user.name || 'Athlete'}</Text>
          <Text style={styles.meta}>{user.city} · {user.skill_level} · Pickleball</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat val={insights?.stats?.matches_played ?? 0} label="Matches" />
          <View style={styles.statDivider} />
          <Stat val={`${winRate}%`} label="Win rate" />
          <View style={styles.statDivider} />
          <Stat val={insights?.performance_score ?? '—'} label="Score" />
        </View>

        {isAdmin && (
          <Pressable
            testID="profile-admin-dashboard"
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [styles.adminBanner, pressed && { backgroundColor: c.bgRaised }]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={c.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.adminTitle}>Platform admin</Text>
              <Text style={styles.adminSubtitle}>Manage clubs, courts and operations</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
          </Pressable>
        )}

        {insights && (
          <View style={styles.perfSection} testID="profile-performance">
            <Text style={styles.sectionLabel}>Performance</Text>
            <View style={styles.chartRow}>
              {insights.chart.map((v: number, i: number) => (
                <View key={i} style={[styles.chartBar, { height: 6 + v }]} />
              ))}
            </View>
            <View style={{ marginTop: spacing.md, gap: 8 }}>
              <PerfLine kind="up" text={insights.strongest} label="Strongest" />
              <PerfLine kind="down" text={insights.needs_improvement} label="Work on" />
            </View>
            <Pressable onPress={() => router.push('/ai-coach')} style={styles.aiLink} testID="profile-open-ai">
              <Text style={styles.aiLinkText}>Talk to AI Coach</Text>
              <Ionicons name="arrow-forward" size={14} color={c.accent} />
            </Pressable>
          </View>
        )}

        {orgs.length > 0 && (
          <View style={styles.menuBlock}>
            <Text style={styles.sectionLabel}>Workspaces</Text>
            <View style={styles.menuGroup}>
              {orgs.map((o: any, i: number) => (
                <View key={o.org_id}>
                  {i > 0 ? <Divider inset={spacing.md} /> : null}
                  <Pressable
                    testID={`profile-club-${o.org_id}`}
                    onPress={() => router.push(`/club/${o.org_id}`)}
                    style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: c.bgRaised }]}
                  >
                    <Ionicons name="business-outline" size={18} color={c.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuLabel}>{o.name}</Text>
                      <Text style={styles.menuMeta}>{o.role.replace('CLUB_', '').replace('_', ' ')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.menuBlock}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <View style={styles.menuGroup}>
            {[
              { key: 'training', label: 'Training plans', icon: 'barbell-outline', to: '/training' },
              { key: 'rankings', label: 'Rankings & badges', icon: 'trophy-outline', to: '/rankings' },
              { key: 'bookings', label: 'My bookings', icon: 'calendar-outline', to: '/(tabs)/play', badge: bookings.length },
              { key: 'orders', label: 'My orders', icon: 'bag-outline', to: '/marketplace', badge: orders.length },
              { key: 'refer', label: 'Refer & earn', icon: 'gift-outline', to: '/refer' },
            ].map((it, i) => (
              <View key={it.key}>
                {i > 0 ? <Divider inset={spacing.md} /> : null}
                <Pressable
                  testID={`profile-menu-${it.key}`}
                  onPress={() => router.push(it.to as any)}
                  style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: c.bgRaised }]}
                >
                  <Ionicons name={it.icon as any} size={18} color={c.text} />
                  <Text style={[styles.menuLabel, { flex: 1 }]}>{it.label}</Text>
                  {it.badge != null && it.badge > 0 ? (
                    <Text style={styles.menuBadge}>{it.badge}</Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <Pressable testID="profile-signout" onPress={signOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ val, label }: { val: any; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{val}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PerfLine({ kind, text, label }: { kind: 'up' | 'down'; text: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
      <View style={[styles.perfDot, kind === 'up' ? styles.perfDotUp : styles.perfDotDown]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.perfLabel}>{label}</Text>
        <Text style={styles.perfText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  guestWrap: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  guestIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: c.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  guestTitle: {
    color: c.text, fontSize: font.sizes.xxl,
    fontWeight: font.weights.heavy, textAlign: 'center',
    letterSpacing: -0.3,
  },
  guestSubtitle: {
    color: c.textMuted, fontSize: font.sizes.base, lineHeight: 22,
    textAlign: 'center', marginTop: spacing.sm, maxWidth: 340,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: c.bgElevated,
    marginBottom: spacing.md,
  },
  name: {
    color: c.text, fontSize: font.sizes.xxl,
    fontWeight: font.weights.heavy, letterSpacing: -0.3,
  },
  meta: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: c.text, fontSize: font.sizes.xxl, fontWeight: font.weights.heavy, letterSpacing: -0.3 },
  statLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, fontWeight: font.weights.semibold },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 6 },
  adminBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  adminTitle: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  adminSubtitle: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 2 },
  perfSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  sectionLabel: {
    color: c.textMuted,
    fontSize: font.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: font.weights.semibold,
    marginBottom: spacing.md,
    marginLeft: spacing.lg,
  },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  chartBar: { flex: 1, backgroundColor: c.borderStrong, borderRadius: 3 },
  perfDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  perfDotUp: { backgroundColor: c.positive },
  perfDotDown: { backgroundColor: c.warning },
  perfLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: font.weights.semibold },
  perfText: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.semibold, marginTop: 2 },
  aiLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  aiLinkText: { color: c.accent, fontSize: font.sizes.sm, fontWeight: font.weights.bold },
  menuBlock: { marginTop: spacing.xl },
  menuGroup: {
    marginHorizontal: spacing.lg,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  menuLabel: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  menuMeta: { color: c.textMuted, fontSize: font.sizes.xs, marginTop: 2 },
  menuBadge: { color: c.textMuted, fontSize: font.sizes.sm, fontWeight: font.weights.semibold, marginRight: 4 },
  signOut: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg },
  signOutText: { color: c.textMuted, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
});
