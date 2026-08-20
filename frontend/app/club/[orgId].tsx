import { useEffect, useState } from 'react';
import { Alert, TextInput, View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
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
  const [staffMobile, setStaffMobile] = useState('');
  const [transferMobile, setTransferMobile] = useState('');
  const [staffRole, setStaffRole] = useState<'CLUB_MANAGER' | 'CLUB_STAFF'>('CLUB_STAFF');
  const [busy, setBusy] = useState(false);

  const currentOrgId = String(orgId);
  const role = roleForOrg(currentOrgId);
  const canView = canForOrg(currentOrgId, 'club.view');
  const canAnalytics = canForOrg(currentOrgId, 'club.analytics.view');
  const canBookings = canForOrg(currentOrgId, 'club.bookings.manage');
  const canMembers = canForOrg(currentOrgId, 'club.members.manage');
  const canStaff = canForOrg(currentOrgId, 'club.staff.manage');
  const canTransfer = canForOrg(currentOrgId, 'club.ownership.transfer');

  const reloadMembers = async () => {
    if (canMembers) setMembers(await api.orgMembers(currentOrgId).catch(() => []));
  };

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
        if (canMembers) await reloadMembers();
      } catch (e: any) { setErr(e.message || 'Access denied'); }
    })();
  }, [currentOrgId, capsLoading, canView, canAnalytics, canBookings, canMembers]);

  async function addStaff() {
    if (!canStaff || !staffMobile.trim()) return;
    setBusy(true);
    try {
      await api.orgAddStaff(currentOrgId, { mobile: staffMobile.trim(), role: staffRole });
      setStaffMobile('');
      await reloadMembers();
      Alert.alert('Staff added', `${staffRole.replace('CLUB_', '')} access has been assigned.`);
    } catch (e: any) { Alert.alert('Unable to add staff', e.message); }
    finally { setBusy(false); }
  }

  async function changeRole(userId: string, nextRole: 'CLUB_MANAGER' | 'CLUB_STAFF') {
    if (!canStaff) return;
    try {
      await api.orgUpdateMemberRole(currentOrgId, userId, nextRole);
      await reloadMembers();
    } catch (e: any) { Alert.alert('Unable to change role', e.message); }
  }

  async function removeMember(userId: string) {
    if (!canStaff) return;
    Alert.alert('Remove member?', 'The member will lose active club access.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { try { await api.orgRemoveMember(currentOrgId, userId); await reloadMembers(); } catch (e: any) { Alert.alert('Unable to remove member', e.message); } } },
    ]);
  }

  async function transferOwnership() {
    if (!canTransfer || !transferMobile.trim()) return;
    Alert.alert('Transfer ownership?', 'Your current owner account will become a club manager after the transfer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Transfer', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await api.orgTransferOwnership(currentOrgId, { mobile: transferMobile.trim() });
          setTransferMobile('');
          Alert.alert('Ownership transferred', 'Your capabilities will refresh on the next session refresh.');
          router.back();
        } catch (e: any) { Alert.alert('Transfer failed', e.message); }
        finally { setBusy(false); }
      } },
    ]);
  }

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
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{b.facility_name} · Court {b.court_number}</Text><Text style={styles.rowMeta}>{b.date} · {b.slot}</Text></View>
            <Text style={styles.rowPrice}>₹{b.price}</Text>
          </View>
        ))}</>}

        {canMembers && <>
          <View style={styles.sectionHeader}><Text style={styles.sectionH}>Team</Text></View>
          {members.length === 0 && <Text style={styles.empty}>No active team members.</Text>}
          {members.map((m) => (
            <View key={m.id} style={styles.row} testID={`club-member-${m.user_id}`}>
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{m.user?.name || m.user?.mobile}</Text><Text style={styles.rowMeta}>{m.role}</Text></View>
              {canStaff && m.role !== 'CLUB_OWNER' && <View style={styles.memberActions}>
                <Pressable onPress={() => changeRole(m.user_id, m.role === 'CLUB_MANAGER' ? 'CLUB_STAFF' : 'CLUB_MANAGER')} style={styles.smallAction}><Text style={styles.smallActionText}>{m.role === 'CLUB_MANAGER' ? 'Make staff' : 'Make manager'}</Text></Pressable>
                <Pressable onPress={() => removeMember(m.user_id)} style={styles.removeAction}><Ionicons name="person-remove-outline" size={16} color={colors.error} /></Pressable>
              </View>}
            </View>
          ))}

          {canStaff && <View style={styles.manageCard}>
            <Text style={styles.manageTitle}>Add manager or staff</Text>
            <TextInput placeholder="Mobile number" placeholderTextColor={colors.onSurfaceMuted} value={staffMobile} onChangeText={setStaffMobile} keyboardType="phone-pad" style={styles.input} />
            <View style={styles.roleToggle}><Pressable onPress={() => setStaffRole('CLUB_STAFF')} style={[styles.toggle, staffRole === 'CLUB_STAFF' && styles.toggleActive]}><Text style={[styles.toggleText, staffRole === 'CLUB_STAFF' && styles.toggleTextActive]}>Staff</Text></Pressable><Pressable onPress={() => setStaffRole('CLUB_MANAGER')} style={[styles.toggle, staffRole === 'CLUB_MANAGER' && styles.toggleActive]}><Text style={[styles.toggleText, staffRole === 'CLUB_MANAGER' && styles.toggleTextActive]}>Manager</Text></Pressable></View>
            <Pressable disabled={busy || !staffMobile.trim()} onPress={addStaff} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Saving…' : 'Add member'}</Text></Pressable>
          </View>}
        </>}

        {canTransfer && <View style={styles.manageCard}>
          <Text style={styles.manageTitle}>Transfer club ownership</Text>
          <Text style={styles.muted}>The new owner becomes CLUB_OWNER and your account becomes CLUB_MANAGER.</Text>
          <TextInput placeholder="New owner's mobile" placeholderTextColor={colors.onSurfaceMuted} value={transferMobile} onChangeText={setTransferMobile} keyboardType="phone-pad" style={styles.input} />
          <Pressable disabled={busy || !transferMobile.trim()} onPress={transferOwnership} style={styles.dangerButton}><Text style={styles.dangerText}>Transfer ownership</Text></Pressable>
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, icon }: { label: string; value: any; icon: any }) {
  return <View style={styles.metric}><Ionicons name={icon} size={18} color={colors.brandPrimary} /><Text style={styles.metricVal}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, title: { flex: 1, color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', textAlign: 'center', marginHorizontal: spacing.sm }, workspaceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginBottom: spacing.lg }, workspaceText: { color: colors.brandPrimary, fontSize: font.sizes.xs, fontWeight: '700', letterSpacing: 0.6 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, metric: { width: '30%', flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 }, metricVal: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' }, metricLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 }, sectionHeader: { marginTop: spacing.xl }, sectionH: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md }, empty: { color: colors.onSurfaceMuted, fontSize: font.sizes.base }, row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm }, rowTitle: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' }, rowMeta: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 }, rowPrice: { color: colors.brandPrimary, fontWeight: '800' }, memberActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, smallAction: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.pill }, smallActionText: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '700' }, removeAction: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: 'rgba(255,0,0,0.08)' }, manageCard: { marginTop: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, manageTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', marginBottom: spacing.sm }, muted: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, lineHeight: 20 }, input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, marginTop: spacing.sm }, roleToggle: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, toggle: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }, toggleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }, toggleText: { color: colors.onSurfaceMuted, fontWeight: '800' }, toggleTextActive: { color: colors.onBrandPrimary }, primary: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md }, primaryText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.base }, dangerButton: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md, borderWidth: 1, borderColor: colors.error }, dangerText: { color: colors.error, fontWeight: '800' },
});
