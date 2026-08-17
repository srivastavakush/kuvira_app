import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Card } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useSession();
  const [caps, setCaps] = useState<any>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [showClubForm, setShowClubForm] = useState(false);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [facilityArea, setFacilityArea] = useState('');
  const [facilityCity, setFacilityCity] = useState('');
  const [courts, setCourts] = useState('1');
  const [price, setPrice] = useState('500');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const c = await api.capabilities().catch(() => null);
    setCaps(c);
    if (!c?.is_platform_admin) return;
    const data = await api.adminClubs();
    setClubs(data || []);
    if (selectedClub) {
      const refreshed = (data || []).find((x: any) => x.id === selectedClub.id);
      if (refreshed) setSelectedClub(refreshed);
      setFacilities(await api.adminFacilities(selectedClub.id));
    }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  if (!caps?.is_platform_admin) {
    return <SafeAreaView style={styles.center}><Ionicons name="lock-closed" size={40} color={colors.error} /><Text style={styles.title}>Admin access required</Text><Text style={styles.muted}>This area is only available to platform administrators.</Text><Pressable onPress={() => router.back()} style={styles.primary}><Text style={styles.primaryText}>Go back</Text></Pressable></SafeAreaView>;
  }

  async function createClub() {
    if (!clubName.trim() || !clubCity.trim()) return Alert.alert('Missing details', 'Enter club name and city.');
    setBusy(true);
    try {
      const club = await api.adminCreateClub({ name: clubName.trim(), city: clubCity.trim() });
      if (ownerMobile.trim()) await api.adminAssignOwner(club.id, { mobile: ownerMobile.trim() });
      setClubName(''); setClubCity(''); setOwnerMobile(''); setShowClubForm(false); await load();
      Alert.alert('Club created', ownerMobile.trim() ? 'Club created and owner assigned.' : 'Club created. You can assign an owner later.');
    } catch (e: any) { Alert.alert('Unable to create club', e.message); } finally { setBusy(false); }
  }

  async function createFacility() {
    if (!selectedClub || !facilityName.trim() || !facilityArea.trim() || !facilityCity.trim()) return Alert.alert('Missing details', 'Enter facility name, area and city.');
    setBusy(true);
    try {
      await api.adminCreateFacility(selectedClub.id, { name: facilityName.trim(), city: facilityCity.trim(), area: facilityArea.trim(), courts_count: Number(courts) || 1, price_per_hour: Number(price) || 500, sports: ['sport-pickleball'], amenities: [], description: '' });
      setFacilityName(''); setFacilityArea(''); setFacilityCity(''); setCourts('1'); setPrice('500'); setShowFacilityForm(false);
      setFacilities(await api.adminFacilities(selectedClub.id));
      Alert.alert('Facility added', 'The court/facility is now part of this club and will be returned by the public facilities API.');
    } catch (e: any) { Alert.alert('Unable to add facility', e.message); } finally { setBusy(false); }
  }

  async function deactivateFacility(id: string) {
    Alert.alert('Deactivate facility?', 'It will no longer appear as an active public facility.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => { try { await api.adminDeleteFacility(selectedClub.id, id); setFacilities(await api.adminFacilities(selectedClub.id)); } catch (e: any) { Alert.alert('Failed', e.message); } } },
    ]);
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}><Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>KUVIRA</Text><Text style={styles.heading}>Platform Admin</Text></View><Ionicons name="shield-checkmark" size={26} color={colors.brandPrimary} /></View>

        <Card style={styles.adminCard}><Text style={styles.cardTitle}>Administrator controls</Text><Text style={styles.muted}>Logged in as {user?.mobile || user?.name || 'administrator'}. Roles are determined by the backend; there is no role selector.</Text></Card>

        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Clubs</Text><Pressable onPress={() => setShowClubForm(!showClubForm)} style={styles.smallPrimary}><Ionicons name="add" size={18} color={colors.onBrandPrimary} /><Text style={styles.smallPrimaryText}>Add club</Text></Pressable></View>
        {showClubForm && <Card style={styles.form}><TextInput placeholder="Club name" placeholderTextColor={colors.onSurfaceMuted} value={clubName} onChangeText={setClubName} style={styles.input} /><TextInput placeholder="City" placeholderTextColor={colors.onSurfaceMuted} value={clubCity} onChangeText={setClubCity} style={styles.input} /><TextInput placeholder="Owner mobile (optional)" placeholderTextColor={colors.onSurfaceMuted} value={ownerMobile} onChangeText={setOwnerMobile} keyboardType="phone-pad" style={styles.input} /><Pressable disabled={busy} onPress={createClub} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Creating…' : 'Create club'}</Text></Pressable></Card>}

        {clubs.length === 0 && <Card><Text style={styles.muted}>No clubs created yet.</Text></Card>}
        {clubs.map((club) => <Pressable key={club.id} onPress={async () => { setSelectedClub(club); setFacilities(await api.adminFacilities(club.id)); }} style={[styles.clubRow, selectedClub?.id === club.id && styles.selectedRow]}><View style={styles.clubIcon}><Ionicons name="business" size={20} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{club.name}</Text><Text style={styles.muted}>{club.city} · {club.status || 'active'}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} /></Pressable>)}

        {selectedClub && <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>{selectedClub.name}</Text><Text style={styles.muted}>Facilities & courts</Text></View><Pressable onPress={() => setShowFacilityForm(!showFacilityForm)} style={styles.smallPrimary}><Ionicons name="add" size={18} color={colors.onBrandPrimary} /><Text style={styles.smallPrimaryText}>Add court</Text></Pressable></View>
          {showFacilityForm && <Card style={styles.form}><TextInput placeholder="Facility / venue name" placeholderTextColor={colors.onSurfaceMuted} value={facilityName} onChangeText={setFacilityName} style={styles.input} /><TextInput placeholder="Area / locality" placeholderTextColor={colors.onSurfaceMuted} value={facilityArea} onChangeText={setFacilityArea} style={styles.input} /><TextInput placeholder="City" placeholderTextColor={colors.onSurfaceMuted} value={facilityCity} onChangeText={setFacilityCity} style={styles.input} /><View style={styles.two}><TextInput placeholder="Courts" placeholderTextColor={colors.onSurfaceMuted} value={courts} onChangeText={setCourts} keyboardType="numeric" style={[styles.input, { flex: 1 }]} /><TextInput placeholder="₹ / hour" placeholderTextColor={colors.onSurfaceMuted} value={price} onChangeText={setPrice} keyboardType="numeric" style={[styles.input, { flex: 1 }]} /></View><Pressable disabled={busy} onPress={createFacility} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Adding…' : 'Add facility'}</Text></Pressable></Card>}
          {facilities.length === 0 && <Card><Text style={styles.muted}>No facilities yet.</Text></Card>}
          {facilities.map((f) => <View key={f.id} style={styles.facilityRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{f.name}</Text><Text style={styles.muted}>{f.area}, {f.city} · {f.courts_count} court(s) · ₹{f.price_per_hour}/hr</Text></View><Pressable onPress={() => deactivateFacility(f.id)} style={styles.danger}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable></View>)}
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface }, content: { padding: spacing.lg, paddingBottom: spacing.xxxl }, center: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }, eyebrow: { color: colors.brandPrimary, fontSize: font.sizes.xs, fontWeight: '800', letterSpacing: 2 }, heading: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' }, title: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900', marginTop: spacing.md }, muted: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, lineHeight: 20 }, adminCard: { borderColor: colors.brandSecondary, borderWidth: 1 }, cardTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800', marginBottom: 6 }, sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md }, sectionTitle: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800' }, smallPrimary: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill }, smallPrimaryText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.sm }, form: { marginBottom: spacing.md }, input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.sm, fontSize: font.sizes.base }, primary: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: spacing.sm }, primaryText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.base }, two: { flexDirection: 'row', gap: spacing.sm }, clubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm }, selectedRow: { borderColor: colors.brandPrimary }, clubIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' }, rowTitle: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '750' }, facilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm }, danger: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,0,0,0.08)' },
});
