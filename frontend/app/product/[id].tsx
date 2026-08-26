import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { api } from '@/src/api';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => { (async () => setP(await api.product(String(id))))(); }, [id]);
  if (!p) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  async function add() {
    setAdding(true);
    try {
      await api.addToCart(p.id, 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAdded(true);
    } finally { setAdding(false); }
  }

  const discount = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0;

  return (
    <View style={styles.wrap} testID="product-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: p.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <SafeAreaView edges={['top']}>
            <Pressable testID="product-back" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <Text style={styles.brand}>{p.brand}</Text>
          <Text style={styles.name}>{p.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{p.price.toLocaleString('en-IN')}</Text>
            {p.original_price ? <Text style={styles.orig}>₹{p.original_price.toLocaleString('en-IN')}</Text> : null}
            {discount > 0 ? <View style={styles.discountBadge}><Text style={styles.discountText}>{discount}% OFF</Text></View> : null}
          </View>
          <View style={styles.ratingRow}><Ionicons name="star" size={12} color={colors.onSurfaceSecondary} /><Text style={styles.rating}>{p.rating} · {p.reviews_count} reviews</Text></View>

          <View style={styles.aiBox} testID="product-ai-fit">
            <Text style={styles.aiEyebrow}>Coach fit</Text>
            <Text style={styles.aiText}>Recommended for <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{p.recommended_skill}</Text> players with a <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{p.playing_style}</Text> style.</Text>
          </View>

          <Text style={styles.sectionH}>Description</Text>
          <Text style={styles.desc}>{p.description}</Text>

          <Text style={styles.sectionH}>Specifications</Text>
          <View style={styles.specs}>
            {Object.entries(p.specs || {}).map(([k, v]) => (
              <View key={k} style={styles.specRow}>
                <Text style={styles.specKey}>{k}</Text>
                <Text style={styles.specVal}>{String(v)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="product-add-cart" disabled={adding} style={styles.addBtn} onPress={add}>
          {added ? <Ionicons name="checkmark" size={16} color={colors.onSurface} /> : null}
          <Text style={styles.addBtnText}>{added ? 'Added' : adding ? 'Adding…' : 'Add to cart'}</Text>
        </Pressable>
        <Pressable testID="product-buy-now" style={styles.buyBtn} onPress={async () => { if (!added) await add(); router.push('/cart'); }}>
          <Text style={styles.buyBtnText}>Buy now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 340, backgroundColor: colors.surfaceSecondary },
  backBtn: { margin: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg },
  brand: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' },
  name: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '800', marginTop: 4, letterSpacing: -0.3 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, marginTop: spacing.sm },
  price: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '800' },
  orig: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  discountText: { color: colors.onSurface, fontSize: font.sizes.xs, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  rating: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm },
  aiBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg, gap: 6 },
  aiEyebrow: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700' },
  aiText: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, lineHeight: 20 },
  sectionH: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md },
  desc: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, lineHeight: 22 },
  specs: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  specKey: { color: colors.onSurfaceMuted, fontSize: font.sizes.base },
  specVal: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  addBtn: { flex: 1, flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  buyBtn: { flex: 1, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  buyBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.base, fontWeight: '700' },
});
