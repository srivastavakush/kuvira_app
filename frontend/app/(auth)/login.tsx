import { Brand } from '@/src/components/brand';
import { friendlyError } from '@/src/errors';
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, font, radius } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { startVerification, normalizeIndianPhone } from '@/src/auth-provider';

export default function Login() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    try {
      const phone = normalizeIndianPhone(mobile.trim());
      setLoading(true);
      setErr(null);
      await startVerification(phone);
      router.push({ pathname: '/(auth)/otp', params: { mobile: phone, next } });
    } catch (e: any) {
      setErr(friendlyError(e, 'Could not send your code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap} testID="login-screen">
      <SafeAreaView edges={[]} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.brandWrap}>
            <Brand />
            <Text style={styles.tagline}>GOOD GAMES. GREAT PEOPLE.</Text>
          </View>
          <View style={styles.form}>
            <Text style={styles.headline}>Ready to play?</Text>
            <Text style={styles.sub}>We{'\u2019'}ll send you a one-time code.</Text>
            <View style={styles.inputRow}>
              <Text style={styles.cc}>+91</Text>
              <TextInput
                accessibilityLabel="Indian mobile number"
                autoComplete="tel"
                testID="login-mobile-input"
                value={mobile}
                onChangeText={value => setMobile(value.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                placeholder="Mobile number"
                placeholderTextColor={colors.onSurfaceMuted}
                style={styles.input}
                maxLength={10}
              />
            </View>
            {err ? <Text testID="login-error" style={styles.err}>{err}</Text> : null}
            <View style={{ height: spacing.lg }} />
            <Button label="Send OTP" onPress={submit} loading={loading} disabled={!/^[6-9]\d{9}$/.test(mobile)} testID="login-send-otp-button" />
            <Text style={styles.terms}>By continuing you agree to MatchDrome’s <Text accessibilityRole="link" onPress={()=>router.push("/policies/terms" as any)}>Terms</Text> and <Text accessibilityRole="link" onPress={()=>router.push("/policies/privacy" as any)}>Privacy policy</Text>.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  brandWrap: { paddingTop: spacing.xl, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  brand: { color: colors.onSurface, fontSize: 44, fontWeight: '800', letterSpacing: 6 },
  tagline: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, marginTop: spacing.xs, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  form: { padding: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: 1, borderColor: colors.border },
  headline: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cc: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700', marginRight: spacing.md },
  input: { flex: 1, color: colors.onSurface, fontSize: font.sizes.lg, paddingVertical: spacing.lg },
  err: { color: colors.error, marginTop: spacing.sm, fontSize: font.sizes.sm },
  terms: { color: colors.onSurfaceMuted, textAlign: 'center', marginTop: spacing.lg, fontSize: font.sizes.xs },
});
