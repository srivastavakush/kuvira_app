import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { ChipRow, Loader, ScreenHeader } from '@/src/components/ui';
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

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><Loader /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="marketplace-screen">
      <ScreenHeader
        title="Shop"
        onBack={() => router.back()}
        testID="marketplace"
        right={
          <Pressable testID="marketplace-cart-btn" onPress={() => router.push('/cart')} hitSlop={8}>
            <Ionicons name="bag-outline" size={22} color={c.text} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        }
      />

      <ChipRow items={CATEGORIES} active={cat} onChange={setCat} testIDPrefix="market-cat" />

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.md }}
        ListHeaderComponent={
          cat === 'all' && recommended.length ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.recoLabel}>Recommended for you</Text>
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
            <View style={styles.cardBody}>
              <Text style={styles.brand}>{item.brand}</Text>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>₹{item.price.toLocaleString('en-IN')}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={11} color={c.textMuted} />
                  <Text style={styles.rating}>{item.rating}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  cartBadge: { position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: c.onAccent, fontSize: 10, fontWeight: font.weights.bold },
  recoLabel: { color: c.textMuted, fontSize: font.sizes.xs, letterSpacing: 1.2, fontWeight: font.weights.semibold, textTransform: 'uppercase', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  recoCard: { width: 140 },
  recoImg: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: c.bgElevated },
  recoName: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.medium, marginTop: 8 },
  recoPrice: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.bold, marginTop: 2 },
  card: { flex: 1, backgroundColor: c.bgElevated, borderRadius: radius.md, overflow: 'hidden' },
  cardImg: { width: '100%', height: 150, backgroundColor: c.bgRaised },
  cardBody: { padding: spacing.sm },
  brand: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: font.weights.semibold },
  name: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.medium, marginTop: 2, minHeight: 36, lineHeight: 18 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.bold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating: { color: c.textMuted, fontSize: font.sizes.xs },
});
