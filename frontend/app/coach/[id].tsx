import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader, SuccessMark, Button } from '@/src/components/ui';
import { api } from '@/src/api';

function nextDates(n: number) {
  const out = [];
  for (let i = 0; i < n; i++) { const d = new Date(); d.setDate(d.getDate() + i); out.push(d); }
  return out;
}

export default function CoachDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [coach, setCoach] = useState<any>(null);
  const [dates] = useState(nextDates(7));
  const [dateIdx, setDateIdx] = useState(0);
  const [avail, setAvail] = useState<any>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<any>(null);

  const dateStr = dates[dateIdx].toISOString().slice(0, 10);
  useEffect(() => { (async () => setCoach(await api.coach(String(id))))(); }, [id]);
  useEffect(() => { setSlot(null); (async () => setAvail(await api.coachAvailability(String(id), dateStr)))(); }, [id, dateStr]);

  async function book() {
    if (!slot) return;
    setBooking(true);
    try { setConfirmed(await api.bookCoachSession(String(id), dateStr, slot)); } finally { setBooking(false); }
  }

  if (!coach || !avail) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  if (confirmed) {
    return (
      <SafeAreaView style={styles.wrap} testID="coach-session-confirmed">
        <View style={styles.confirmWrap}>
          <SuccessMark />
          <Text style={styles.cTitle}>Session booked</Text>
          <Text style={styles.cSub}>{coach.name} · {new Date(confirmed.date).toDateString()} · {confirmed.slot}</Text>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, maxWidth: 340 }}>
            <Button label="View schedule" onPress={() => router.replace('/(tabs)/profile')} testID="coach-done" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.wrap} testID="coach-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: coach.image || coach.avatar }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={['rgba(10,10,10,0.4)', 'transparent', 'rgba(10,10,10,0.95)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={['top']}>
            <Pressable testID="coach-back" onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
          </SafeAreaView>
          <View style={styles.heroBottom}>
            <Image source={{ uri: coach.avatar }} style={styles.avatar} />
            <Text style={styles.name}>{coach.name}</Text>
            <Text style={styles.meta}><Ionicons name="star" size={12} color={colors.onSurfaceSecondary} /> {coach.rating} · {coach.experience_years} yrs · {coach.city}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.bio}>{coach.bio}</Text>
          <View style={styles.tags}>
            {(coach.specialties || []).map((s: string) => <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>)}
          </View>

          <Text style={styles.label}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {dates.map((d, i) => (
              <Pressable key={i} testID={`coach-date-${i}`} onPress={() => setDateIdx(i)} style={[styles.dateCard, i === dateIdx && styles.activeCard]}>
                <Text style={[styles.dow, i === dateIdx && styles.activeTxt]}>{d.toLocaleString('en', { weekday: 'short' })}</Text>
                <Text style={[styles.dnum, i === dateIdx && styles.activeTxt]}>{d.getDate()}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Select Slot</Text>
          <View style={styles.slotGrid}>
            {avail.slots.map((s: any) => {
              const active = slot === s.slot;
              return (
                <Pressable key={s.slot} testID={`coach-slot-${s.slot}`} disabled={!s.available} onPress={() => setSlot(s.slot)} style={[styles.slot, active && styles.activeCard, !s.available && { opacity: 0.3 }]}>
                  <Text style={[styles.slotText, active && styles.activeTxt]}>{s.slot.split('-')[0]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View><Text style={styles.price}>₹{coach.price_per_session}</Text><Text style={styles.priceSub}>{slot ? `${dateStr} · ${slot}` : 'Select a slot'}</Text></View>
        <Pressable testID="coach-book-btn" disabled={!slot || booking} style={[styles.bookBtn, (!slot || booking) && { opacity: 0.5 }]} onPress={book}>
          <Text style={styles.bookText}>{booking ? 'Processing…' : 'Book & Pay'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 320, backgroundColor: colors.surfaceSecondary },
  backBtn: { margin: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.brandPrimary, marginBottom: spacing.sm },
  name: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' },
  meta: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, marginTop: 4 },
  body: { padding: spacing.lg },
  bio: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  tagText: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm },
  label: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.md },
  dateCard: { width: 60, height: 70, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  activeCard: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  activeTxt: { color: colors.onBrandPrimary },
  dow: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase' },
  dnum: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900', marginTop: 2 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { width: '22%', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  slotText: { color: colors.onSurface, fontWeight: '700', fontSize: font.sizes.sm },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  price: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900' },
  priceSub: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs },
  bookBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  bookText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  cTitle: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '800', marginTop: spacing.lg, letterSpacing: -0.3 },
  cSub: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, marginTop: 6, textAlign: 'center' },
});
