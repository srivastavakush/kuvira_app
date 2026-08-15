import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { ChipRow, Loader } from '@/src/components/ui';
import { api } from '@/src/api';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'Paddles', label: 'Paddles' },
  { key: 'Shoes', label: 'Shoes' },
  { key: 'Balls', label: 'Balls' },
  { key: 'Bags', label: 'Bags' },
  { key: 'Apparel', label: 'Apparel' },
];

export default function Marketplace() {
  const router = useRouter();
  const [cat, setCat] = useState('all');
  const [products, setProducts] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [p, r] = await Promise.all([api.products(), api.recommendedProducts().catch(() => [])]);
        setProducts(p); setRecommended(r);
      } finally { setLoading(false); }
    })();
  }, []);

  useFocusEffect(useCallback(() => {
    api.cart().then((c: any) => setCartCount(c.count || 0)).catch(() => {});
  }, []));

  const filtered = cat === 'all' ? products : products.filter((p) => p.category === cat);

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <SafeAreaView style={styles.wrap} testID="marketplace-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="marketplace-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Shop</Text>
        <Pressable testID="marketplace-cart-btn" onPress={() => router.push('/cart')} style={styles.cartBtn}>
          <Ionicons name="bag" size={22} color={colors.onSurface} />
          {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
        </Pressable>
      </View>

      <ChipRow items={CATEGORIES} active={cat} onChange={setCat} testIDPrefix="market-cat" />

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.md }}
        ListHeaderComponent={
          cat === 'all' && recommended.length ? (
            <View style={{ marginBottom: spacing.md }}>
              <View style={styles.recoHeader}>
                <Ionicons name="sparkles" size={14} color={colors.brandPrimary} />
                <Text style={styles.recoLabel}>PICKED FOR YOUR PLAY STYLE</Text>
              </View>
              <FlatList
                data={recommended}
                horizontal
                keyExtractor={(p) => 'reco-' + p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                renderItem={({ item }) => (
                  <Pressable testID={`market-reco-${item.id}`} style={styles.recoCard} onPress={() => router.push(`/product/${item.id}`)}>
                    <Image source={{ uri: item.image }} style={styles.recoImg} contentFit="cover" />
                    <Text style={styles.recoName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.recoPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                  </Pressable>
                )}
              />
            </View>
          ) : <View style={{ height: spacing.sm }} />
        }
        renderItem={({ item }) => (
          <Pressable testID={`market-product-${item.id}`} style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
            <Image source={{ uri: item.image }} style={styles.cardImg} contentFit="cover" />
            <View style={{ padding: spacing.sm }}>
              <Text style={styles.brand}>{item.brand}</Text>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>₹{item.price.toLocaleString('en-IN')}</Text>
                <Text style={styles.rating}>⭐ {item.rating}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900' },
  cartBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: '800' },
  recoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  recoLabel: { color: colors.brandPrimary, fontSize: font.sizes.xs, letterSpacing: 1.2, fontWeight: '700' },
  recoCard: { width: 140 },
  recoImg: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  recoName: { color: colors.onSurface, fontSize: font.sizes.sm, fontWeight: '600', marginTop: 6 },
  recoPrice: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: '800', marginTop: 2 },
  card: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  cardImg: { width: '100%', height: 150, backgroundColor: colors.surfaceTertiary },
  brand: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '600', marginTop: 2, minHeight: 38 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  price: { color: colors.brandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
  rating: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm },
});
