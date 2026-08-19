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
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';

export default function FacilityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [f, setF] = useState<any>(null);

  useEffect(() => { (async () => setF(await api.facility(String(id))))(); }, [id]);
  if (!f) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  function bookCourt() { if (requireAuth(user, router)) router.push(`/booking/${f.id}`); }

  return (
    <View style={styles.wrap} testID="facility-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}><Image source={{ uri: f.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" /><LinearGradient colors={['rgba(10,10,11,0.5)', 'transparent', 'rgba(10,10,11,0.95)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} /><SafeAreaView edges={['top']}><Pressable testID="facility-back" onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable></SafeAreaView><View style={styles.heroBottom}>{f.is_experience_center && <View style={styles.badge}><Text style={styles.badgeText}>EXPERIENCE CENTER</Text></View>}<Text style={styles.name}>{f.name}</Text><View style={styles.locRow}><Ionicons name="location-outline" size={12} color={colors.onSurfaceSecondary} /><Text style={styles.loc}>{f.area}, {f.city}</Text><Text style={styles.locDot}>·</Text><Ionicons name="star" size={11} color={colors.onSurfaceSecondary} /><Text style={styles.loc}>{f.rating} ({f.reviews_count})</Text></View></View></View>
        <View style={styles.body}><Text style={styles.desc}>{f.description}</Text><Text style={styles.sectionH}>Amenities</Text><View style={styles.amenities}>{f.amenities.map((a: string) => <View key={a} style={styles.amenity}><Text style={styles.amenityText}>{a}</Text></View>)}</View><Text style={styles.sectionH}>Details</Text><View style={styles.detailGrid}><View style={styles.detailBox}><Text style={styles.detailVal}>{f.courts_count}</Text><Text style={styles.detailLabel}>Courts</Text></View><View style={styles.detailBox}><Text style={styles.detailVal}>₹{f.price_per_hour}</Text><Text style={styles.detailLabel}>Per hour</Text></View><View style={styles.detailBox}><Text style={styles.detailVal}>{f.rating}</Text><Text style={styles.detailLabel}>Rating</Text></View></View></View>
      </ScrollView>
      <View style={styles.footer}><View><Text style={styles.footerPrice}>₹{f.price_per_hour}<Text style={styles.footerUnit}>/hr</Text></Text><Text style={styles.footerSub}>+ taxes</Text></View><Pressable testID="facility-book-btn" style={styles.bookBtn} onPress={bookCourt}><Text style={styles.bookBtnText}>Book a Court</Text></Pressable></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface }, hero: { height: 340, backgroundColor: colors.surfaceSecondary }, backBtn: { margin: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }, heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg }, badge: { alignSelf: 'flex-start', backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginBottom: 6 }, badgeText: { color: colors.brandPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 1 }, name: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' }, loc: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, marginTop: 4 }, body: { padding: spacing.lg }, desc: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, lineHeight: 22 }, sectionH: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md }, amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, amenity: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill }, amenityText: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm }, detailGrid: { flexDirection: 'row', gap: spacing.md }, detailBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border }, detailVal: { color: colors.brandPrimary, fontSize: font.sizes.xxl, fontWeight: '900' }, detailLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }, footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border }, footerPrice: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900' }, footerUnit: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, fontWeight: '600' }, footerSub: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs }, bookBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.pill }, bookBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
});
