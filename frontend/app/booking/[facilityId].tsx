import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';
import { ErrorBanner } from '@/src/components/states';
import { openCheckout, verifiedPayment } from '@/src/payments';
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { c, spacing, font, radius } from '@/src/theme';
import { Loader, ScreenHeader, Button, SuccessMark } from '@/src/components/ui';
import { api, apiBaseUrl } from '@/src/api';

function nextDates(n: number) {
  const out = [];
  for (let i = 0; i < n; i++) { const d = new Date(); d.setDate(d.getDate() + i); out.push(d); }
  return out;
}

export default function Booking() {
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [loadError, setLoadError] = useState<unknown>();
  const [paymentId, setPaymentId] = useState('');
  const [retry, setRetry] = useState(0);
  const [facility, setFacility] = useState<any>(null);
  const [dates] = useState(nextDates(7));
  const [dateIdx, setDateIdx] = useState(0);
  const [court, setCourt] = useState(1);
  const [avail, setAvail] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const dateStr = dates[dateIdx].toLocaleDateString('en-CA');

  useEffect(() => { api.facility(String(facilityId)).then(setFacility).catch(setLoadError); }, [facilityId, retry]);
  useEffect(() => {
    setSelectedSlot(null);
    setAvail(null); setLoadError(null); let active = true;
    api.availability(String(facilityId), dateStr).then(value => { if (active) setAvail(value); }).catch(e => { if (active) setLoadError(e); });
    return () => { active = false; };
  }, [facilityId, dateStr, retry]);

  const courtData = avail?.courts?.find((c: any) => c.court_number === court);

  async function confirm(authenticated = false) {
    if (!authenticated && !requireAuth(user, router, undefined, () => confirm(true))) return;
    if (!selectedSlot && !paymentId) return;
    setBooking(true);
    try {
      setPaymentMessage(null);
      if (paymentId) { setConfirmed(await verifiedPayment(paymentId)); return; }
      const res: any = await api.createBooking({ facility_id: facilityId, court_number: court, date: dateStr, slot: selectedSlot, duration_min: 60, customer_email: email.trim() || undefined });
      if (res.checkout_url && res.payment?.id) {
        setPaymentId(res.payment.id);
        await openCheckout(res);
        setConfirmed(await verifiedPayment(res.payment.id));
      } else setConfirmed(res);
    } catch (error) { setPaymentMessage(error instanceof Error ? error.message : 'Could not start payment.'); }
    finally { setBooking(false); }
  }

  if (loadError) return <SafeAreaView style={{ flex: 1 }}><ScreenHeader title="Book a court" onBack={() => router.back()} /><ErrorBanner error={loadError} retry={() => setRetry(v => v + 1)} /></SafeAreaView>;
  if (!facility || !avail) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><Loader /></SafeAreaView>;

  if (confirmed) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']} testID="booking-confirmed">
        <View style={styles.confirmWrap}>
          <SuccessMark />
          <Text style={styles.confirmTitle}>Booking confirmed</Text>
          <Text style={styles.confirmSub}>{facility.name}</Text>
          <View style={styles.confirmCard}>
            <Row label="Date" value={new Date(confirmed.date).toDateString()} />
            <Row label="Slot" value={confirmed.slot} />
            <Row label="Court" value={`Court ${confirmed.court_number}`} />
            <Row label="Paid" value={`₹${confirmed.price} · PayU`} />
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, maxWidth: 340 }}>
            <Button label="View my bookings" onPress={() => router.replace('/(tabs)/play')} testID="booking-done" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="booking-screen">
      <ScreenHeader title={facility.name} onBack={() => router.back()} testID="booking" />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <Text style={styles.label}>Payment email</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={c.textFaint} style={styles.emailInput} />
        {paymentMessage ? <Text style={styles.paymentMessage}>{paymentMessage}</Text> : null}
        <Text style={styles.label}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {dates.map((d, i) => (
            <Pressable
              key={i}
              testID={`booking-date-${i}`}
              onPress={() => setDateIdx(i)}
              style={[styles.dateCard, i === dateIdx && styles.dateCardActive]}
            >
              <Text style={[styles.dateDow, i === dateIdx && styles.textActive]}>
                {d.toLocaleString('en', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateNum, i === dateIdx && styles.textActive]}>{d.getDate()}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Court</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {avail.courts.map((cc: any) => (
            <Pressable
              key={cc.court_number}
              testID={`booking-court-${cc.court_number}`}
              onPress={() => { setCourt(cc.court_number); setSelectedSlot(null); }}
              style={[styles.courtChip, court === cc.court_number && styles.courtChipActive]}
            >
              <Text style={[styles.courtChipText, court === cc.court_number && styles.textActive]}>
                Court {cc.court_number}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Time</Text>
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
                <Text style={[styles.slotText, active && styles.textActive, !s.available && styles.slotTextDisabled]}>
                  {s.slot.split('-')[0]}
                </Text>
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
        <View style={{ minWidth: 160 }}>
          <Button
            label={booking ? 'Processing…' : paymentId ? 'Check payment' : 'Confirm & pay'}
            testID="booking-confirm-btn"
            disabled={(!selectedSlot && !paymentId) || booking}
            onPress={() => confirm()}
            fullWidth={false}
            style={{ paddingHorizontal: spacing.xl }}
          />
        </View>
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
  wrap: { flex: 1, backgroundColor: c.bg },
  label: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: font.weights.semibold, marginTop: spacing.xl, marginBottom: spacing.md },
  emailInput: { backgroundColor: c.bgElevated, color: c.text, minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: font.sizes.base },
  paymentMessage: { color: c.danger, fontSize: font.sizes.sm, marginTop: spacing.sm },
  dateCard: { width: 56, height: 68, borderRadius: radius.md, backgroundColor: c.bgElevated, alignItems: 'center', justifyContent: 'center' },
  dateCardActive: { backgroundColor: c.text },
  dateDow: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateNum: { color: c.text, fontSize: font.sizes.xl, fontWeight: font.weights.heavy, marginTop: 2 },
  textActive: { color: c.bg },
  courtChip: { paddingHorizontal: spacing.lg, height: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: c.bgElevated },
  courtChipActive: { backgroundColor: c.text },
  courtChipText: { color: c.text, fontWeight: font.weights.semibold, fontSize: font.sizes.sm },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { width: '22%', paddingVertical: spacing.md, borderRadius: radius.sm, backgroundColor: c.bgElevated, alignItems: 'center' },
  slotActive: { backgroundColor: c.text },
  slotDisabled: { opacity: 0.3 },
  slotText: { color: c.text, fontWeight: font.weights.semibold, fontSize: font.sizes.sm },
  slotTextDisabled: { color: c.textFaint },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
  footerPrice: { color: c.text, fontSize: font.sizes.xl, fontWeight: font.weights.heavy },
  footerSub: { color: c.textMuted, fontSize: font.sizes.xs, marginTop: 2 },
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  confirmTitle: { color: c.text, fontSize: font.sizes.xxl, fontWeight: font.weights.heavy, marginTop: spacing.lg, letterSpacing: -0.3 },
  confirmSub: { color: c.textMuted, fontSize: font.sizes.base, marginTop: 4 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: c.bgElevated, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl, maxWidth: 400 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { color: c.textMuted, fontSize: font.sizes.sm },
  rowValue: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
});
