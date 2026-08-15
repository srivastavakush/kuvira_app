import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader, EmptyState } from '@/src/components/ui';
import { api } from '@/src/api';

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const load = useCallback(async () => { setCart(await api.cart()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function remove(pid: string) {
    setCart(await api.removeFromCart(pid));
  }

  async function checkout() {
    setPlacing(true);
    try {
      const res = await api.createOrder({ line1: '123 Court Road', city: 'Bangalore', pincode: '560001' });
      setOrder(res);
    } finally { setPlacing(false); }
  }

  if (!cart) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  if (order) {
    return (
      <SafeAreaView style={styles.wrap} testID="cart-order-confirmed">
        <View style={styles.confirmWrap}>
          <View style={styles.checkCircle}><Ionicons name="checkmark" size={48} color={colors.onBrandPrimary} /></View>
          <Text style={styles.confirmTitle}>Order Placed!</Text>
          <Text style={styles.confirmSub}>Paid ₹{order.total.toLocaleString('en-IN')} via PayU</Text>
          <Text style={styles.orderId}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
          <Pressable testID="cart-continue-shopping" style={styles.doneBtn} onPress={() => router.replace('/marketplace')}>
            <Text style={styles.doneBtnText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} testID="cart-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="cart-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Cart</Text>
        <View style={{ width: 26 }} />
      </View>

      {cart.items.length === 0 ? (
        <EmptyState title="Your cart is empty" subtitle="Your sports journey starts here." cta="Browse Shop" onCta={() => router.replace('/marketplace')} testID="cart-empty" />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: spacing.md }}>
            {cart.items.map((it: any) => (
              <View key={it.product.id} style={styles.item} testID={`cart-item-${it.product.id}`}>
                <Image source={{ uri: it.product.image }} style={styles.itemImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{it.product.name}</Text>
                  <Text style={styles.itemQty}>Qty: {it.qty}</Text>
                  <Text style={styles.itemPrice}>₹{it.subtotal.toLocaleString('en-IN')}</Text>
                </View>
                <Pressable testID={`cart-remove-${it.product.id}`} onPress={() => remove(it.product.id)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            ))}

            <View style={styles.summary}>
              <View style={styles.sumRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumVal}>₹{cart.total.toLocaleString('en-IN')}</Text></View>
              <View style={styles.sumRow}><Text style={styles.sumLabel}>Delivery</Text><Text style={styles.sumVal}>Free</Text></View>
              <View style={[styles.sumRow, { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm, marginTop: spacing.sm }]}>
                <Text style={styles.totalLabel}>Total</Text><Text style={styles.totalVal}>₹{cart.total.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable testID="cart-checkout-btn" disabled={placing} style={[styles.checkoutBtn, placing && { opacity: 0.6 }]} onPress={checkout}>
              <Text style={styles.checkoutBtnText}>{placing ? 'Processing…' : `Checkout · ₹${cart.total.toLocaleString('en-IN')}`}</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  item: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  itemImg: { width: 80, height: 80, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  itemName: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  itemQty: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 4 },
  itemPrice: { color: colors.brandPrimary, fontSize: font.sizes.lg, fontWeight: '800', marginTop: 4 },
  removeBtn: { padding: spacing.sm },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base },
  sumVal: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '600' },
  totalLabel: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  totalVal: { color: colors.brandPrimary, fontSize: font.sizes.xl, fontWeight: '900' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  checkoutBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  checkoutBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  checkCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  confirmTitle: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' },
  confirmSub: { color: colors.onSurfaceSecondary, fontSize: font.sizes.lg, marginTop: 4 },
  orderId: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: '700', marginTop: spacing.sm },
  doneBtn: { alignSelf: 'stretch', backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center', marginTop: spacing.xl },
  doneBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
});
