import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { Loader, EmptyState, ScreenHeader, Button, SuccessMark } from '@/src/components/ui';
import { api } from '@/src/api';

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const load = useCallback(async () => { setCart(await api.cart()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function remove(pid: string) { setCart(await api.removeFromCart(pid)); }

  async function checkout() {
    setPlacing(true);
    try {
      const res = await api.createOrder({ line1: '123 Court Road', city: 'Bangalore', pincode: '560001' });
      setOrder(res);
    } finally { setPlacing(false); }
  }

  if (!cart) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><Loader /></SafeAreaView>;

  if (order) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']} testID="cart-order-confirmed">
        <View style={styles.confirmWrap}>
          <SuccessMark />
          <Text style={styles.confirmTitle}>Order placed</Text>
          <Text style={styles.confirmSub}>Paid ₹{order.total.toLocaleString('en-IN')} · Order #{order.id.slice(0, 8).toUpperCase()}</Text>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, maxWidth: 340 }}>
            <Button label="Continue shopping" onPress={() => router.replace('/marketplace')} testID="cart-continue-shopping" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="cart-screen">
      <ScreenHeader title="Cart" onBack={() => router.back()} testID="cart" />

      {cart.items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          subtitle="Browse the shop to add gear."
          cta="Browse shop"
          onCta={() => router.replace('/marketplace')}
          icon="bag-outline"
          testID="cart-empty"
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: spacing.md }}>
            {cart.items.map((it: any) => (
              <View key={it.product.id} style={styles.item} testID={`cart-item-${it.product.id}`}>
                <Image source={{ uri: it.product.image }} style={styles.itemImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{it.product.name}</Text>
                  <Text style={styles.itemQty}>Qty {it.qty}</Text>
                  <Text style={styles.itemPrice}>₹{it.subtotal.toLocaleString('en-IN')}</Text>
                </View>
                <Pressable testID={`cart-remove-${it.product.id}`} onPress={() => remove(it.product.id)} hitSlop={8} style={styles.removeBtn}>
                  <Ionicons name="close" size={20} color={c.textMuted} />
                </Pressable>
              </View>
            ))}

            <View style={styles.summary}>
              <View style={styles.sumRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumVal}>₹{cart.total.toLocaleString('en-IN')}</Text></View>
              <View style={styles.sumRow}><Text style={styles.sumLabel}>Delivery</Text><Text style={styles.sumVal}>Free</Text></View>
              <View style={styles.sumSep} />
              <View style={styles.sumRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalVal}>₹{cart.total.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              testID="cart-checkout-btn"
              loading={placing}
              onPress={checkout}
              label={`Checkout · ₹${cart.total.toLocaleString('en-IN')}`}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  item: { flexDirection: 'row', gap: spacing.md, backgroundColor: c.bgElevated, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  itemImg: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: c.bgRaised },
  itemName: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.semibold, lineHeight: 18 },
  itemQty: { color: c.textMuted, fontSize: font.sizes.xs, marginTop: 4 },
  itemPrice: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.bold, marginTop: 4 },
  removeBtn: { padding: spacing.sm },
  summary: { backgroundColor: c.bgElevated, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm, gap: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { color: c.textMuted, fontSize: font.sizes.sm },
  sumVal: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
  sumSep: { height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginVertical: 4 },
  totalLabel: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.bold },
  totalVal: { color: c.text, fontSize: font.sizes.xl, fontWeight: font.weights.heavy },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  confirmTitle: { color: c.text, fontSize: font.sizes.xxl, fontWeight: font.weights.heavy, marginTop: spacing.lg, letterSpacing: -0.3 },
  confirmSub: { color: c.textMuted, fontSize: font.sizes.base, marginTop: 6, textAlign: 'center' },
});
