import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { api } from '@/src/api';

function nextDates(n: number) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

export default function Booking() {
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();
  const router = useRouter();
  const [facility, setFacility] = useState<any>(null);
  const [dates] = useState(nextDates(7));
  const [dateIdx, setDateIdx] = useState(0);
  const [court, setCourt] = useState(1);
  const [avail, setAvail] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<any>(null);

  const dateStr = dates[dateIdx].toISOString().slice(0, 10);

  useEffect(() => { (async () => setFacility(await api.facility(String(facilityId))))(); }, [facilityId]);
  useEffect(() => {
    setSelectedSlot(null);
    (async () => setAvail(await api.availability(String(facilityId), dateStr)))();
  }, [facilityId, dateStr]);

  const courtData = avail?.courts?.find((c: any) => c.court_number === court);

  async function confirm() {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      const res = await api.createBooking({ facility_id: facilityId, court_number: court, date: dateStr, slot: selectedSlot, duration_min: 60 });
      setConfirmed(res);
    } finally { setBooking(false); }
  }

  if (!facility || !avail) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  if (confirmed) {
    return (
      <SafeAreaView style={styles.wrap} testID="booking-confirmed">
        <View style={styles.confirmWrap}>
          <View style={styles.checkCircle}><Ionicons name="checkmark" size={48} color={colors.onBrandPrimary} /></View>
          <Text style={styles.confirmTitle}>Booking Confirmed!</Text>
          <Text style={styles.confirmSub}>{facility.name}</Text>
          <View style={styles.confirmCard}>
            <Row label="Date" value={new Date(confirmed.date).toDateString()} />
            <Row label="Slot" value={confirmed.slot} />
            <Row label="Court" value={`Court ${confirmed.court_number}`} />
            <Row label="Paid" value={`₹${confirmed.price} · PayU`} />
          </View>
          <Pressable testID="booking-done" style={styles.doneBtn} onPress={() => router.replace('/(tabs)/play')}>
            <Text style={styles.doneBtnText}>View My Bookings</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} testID="booking-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="booking-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{facility.name}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.label}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {dates.map((d, i) => (
            <Pressable key={i} testID={`booking-date-${i}`} onPress={() => setDateIdx(i)} style={[styles.dateCard, i === dateIdx && styles.dateCardActive]}>
              <Text style={[styles.dateDow, i === dateIdx && styles.textActive]}>{d.toLocaleString('en', { weekday: 'short' })}</Text>
              <Text style={[styles.dateNum, i === dateIdx && styles.textActive]}>{d.getDate()}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Select Court</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {avail.courts.map((c: any) => (
            <Pressable key={c.court_number} testID={`booking-court-${c.court_number}`} onPress={() => setCourt(c.court_number)} style={[styles.courtChip, court === c.court_number && styles.courtChipActive]}>
              <Text style={[styles.courtChipText, court === c.court_number && styles.textActive]}>Court {c.court_number}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Select Time Slot</Text>
        <View style={styles.slotGrid}>
          {courtData?.slots.map((s: any) => {
            const active = selectedSlot === s.slot;
            return (
              <Pressable
                key={s.slot}
                testID={`booking-slot-${s.slot}`}
                disabled={!s.available}
                onPress={() => setSelectedSlot(s.slot)}
                style={[styles.slot, active && styles.slotActive, !s.available && styles.slotDisabled]}
              >
                <Text style={[styles.slotText, active && styles.textActive, !s.available && styles.slotTextDisabled]}>{s.slot.split('-')[0]}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerPrice}>₹{facility.price_per_hour}</Text>
          <Text style={styles.footerSub}>{selectedSlot ? `${selectedSlot} · Court ${court}` : 'Select a slot'}</Text>
        </View>
        <Pressable testID="booking-confirm-btn" disabled={!selectedSlot || booking} style={[styles.confirmBtn, (!selectedSlot || booking) && { opacity: 0.5 }]} onPress={confirm}>
          <Text style={styles.confirmBtnText}>{booking ? 'Processing…' : 'Confirm & Pay'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700', textAlign: 'center', marginHorizontal: spacing.sm },
  label: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.md },
  dateCard: { width: 60, height: 70, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dateCardActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dateDow: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase' },
  dateNum: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900', marginTop: 2 },
  textActive: { color: colors.onBrandPrimary },
  courtChip: { paddingHorizontal: spacing.lg, height: 44, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  courtChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  courtChipText: { color: colors.onSurface, fontWeight: '700' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { width: '22%', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  slotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  slotDisabled: { opacity: 0.3 },
  slotText: { color: colors.onSurface, fontWeight: '700', fontSize: font.sizes.sm },
  slotTextDisabled: { color: colors.onSurfaceMuted },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  footerPrice: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900' },
  footerSub: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs },
  confirmBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  confirmBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  checkCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  confirmTitle: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' },
  confirmSub: { color: colors.onSurfaceSecondary, fontSize: font.sizes.lg, marginTop: 4 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.base },
  rowValue: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  doneBtn: { alignSelf: 'stretch', backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center', marginTop: spacing.xl },
  doneBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
});
