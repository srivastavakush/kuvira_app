import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { api } from '@/src/api';
import { useCapabilities } from '@/src/hooks/use-capabilities';

export default function ClubWorkspace() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();
  const { capabilities, loading: capsLoading, roleForOrg, canForOrg } = useCapabilities();
  const [org, setOrg] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const currentOrgId = String(orgId);
  const role = roleForOrg(currentOrgId);
  const canView = canForOrg(currentOrgId, 'club.view');
  const canAnalytics = canForOrg(currentOrgId, 'club.analytics.view');
  const canBookings = canForOrg(currentOrgId, 'club.bookings.manage');
  const canMembers = canForOrg(currentOrgId, 'club.members.manage');

  useEffect(() => {
    if (capsLoading) return;
    if (!canView) {
      setErr('You do not have access to this club workspace.');
      return;
    }
    (async () => {
      try {
        const o = await api.org(currentOrgId);
        setOrg(o);
        if (canAnalytics) setAnalytics(await api.orgAnalytics(currentOrgId));
        if (canBookings) setBookings(await api.orgBookings(currentOrgId).catch(() => []));
        if (canMembers) setMembers(await api.orgMembers(currentOrgId).catch(() => []));
      } catch (e: any) { setErr(e.message || 'Access denied'); }
    })();
  }, [currentOrgId, capsLoading, canView, canAnalytics, canBookings, canMembers]);

  if (capsLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;
  if (err) return (
    <SafeAreaView style={styles.wrap}><View style={styles.header}><Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable><Text style={styles.title}>Club</Text><View style={{ width: 26 }} /></View><Text style={{ color: colors.error, padding: spacing.lg }}>{err}</Text></SafeAreaView>
  );
  if (!org) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <SafeAreaView style={styles.wrap} testID="club-workspace-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="club-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title} numberOfLines={1}>{org.name}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.workspaceBadge}><Ionicons name="business" size={14} color={colors.brandPrimary} /><Text style={styles.workspaceText}>CLUB WORKSPACE · {org.city} · {role || 'MEMBER'}</Text></View>

        {canAnalytics && analytics && <View style={styles.grid}>
          <Metric label="Revenue" value={`₹${analytics.revenue.toLocaleString('en-IN')}`} icon="cash" />
          <Metric label="Bookings" value={analytics.bookings_count} icon="calendar" />
          <Metric label="Games" value={analytics.games_count} icon="tennisball" />
          <Metric label="Members" value={analytics.members_count} icon="people" />
          <Metric label="Courts" value={analytics.facilities_count} icon="grid" />
        </View>}

        {canBookings && <><Text style={styles.sectionH}>Recent Bookings</Text>
        {bookings.length === 0 ? <Text style={styles.empty}>No bookings yet for this club.</Text> : bookings.slice(0, 8).map((b) => (
          <View key={b.id} style={styles.row} testID={`club-booking-${b.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{b.facility_name} · Court {b.court_number}</Text>
              <Text style={styles.rowMeta}>{b.date} · {b.slot}</Text>
            </View>
            <Text style={styles.rowPrice}>₹{b.price}</Text>
          </View>
        ))}</>}

        {canMembers && <><Text style={styles.sectionH}>Team</Text>
        {members.map((m) => (
          <View key={m.id} style={styles.row} testID={`club-member-${m.user_id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{m.user?.name || m.user?.mobile}</Text>
              <Text style={styles.rowMeta}>{m.role}</Text>
            </View>
          </View>
        ))}</>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, icon }: { label: string; value: any; icon: any }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.metricVal}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { flex: 1, color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', textAlign: 'center', marginHorizontal: spacing.sm },
  workspaceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginBottom: spacing.lg },
  workspaceText: { color: colors.brandPrimary, fontSize: font.sizes.xs, fontWeight: '700', letterSpacing: 0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { width: '30%', flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  metricVal: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' },
  metricLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionH: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: colors.onSurfaceMuted, fontSize: font.sizes.base },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowTitle: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  rowMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  rowPrice: { color: colors.brandPrimary, fontWeight: '800' },
});
