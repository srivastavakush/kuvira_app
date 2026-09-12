import { Stack, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { c } from '@/src/theme';
import { dismissAuth } from '@/src/auth-gate';
export default function AuthLayout() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  function close() { dismissAuth(router); }
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close sign in" onPress={close} />
    <View accessibilityViewIsModal style={[s.sheet, { height: Math.min(660, height - insets.top - 24), paddingBottom: insets.bottom }]}>
      <View style={s.top}><View style={s.handle} /><Pressable accessibilityRole="button" accessibilityLabel="Close sign in" onPress={close} style={s.close}><Ionicons name="close" size={24} color={c.text} /></Pressable></View>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: c.bgElevated } }} />
    </View>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(8,28,43,0.55)', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 560, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: c.bgElevated }, top: { height: 44, alignItems: 'center', justifyContent: 'center' }, handle: { width: 40, height: 5, borderRadius: 5, backgroundColor: c.border }, close: { position: 'absolute', right: 8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' } });
