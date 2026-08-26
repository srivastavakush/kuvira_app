import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, font, radius, HERO_IMAGES } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { startVerification, normalizeIndianPhone, IS_MOCK_AUTH } from '@/src/auth-provider';

export default function Login() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    try {
      const phone = normalizeIndianPhone(mobile.trim());
      setLoading(true);
      setErr(null);
      await startVerification(phone);
      router.push({ pathname: '/(auth)/otp', params: { mobile: phone } });
    } catch (e: any) {
      setErr(e?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap} testID="login-screen">
      <Image source={{ uri: HERO_IMAGES.home }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient colors={['rgba(10,10,10,0.4)', 'rgba(10,10,10,0.85)', colors.surface]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>KUVIRA</Text>
            <Text style={styles.tagline}>Play with intent</Text>
          </View>
          <View style={styles.form}>
            <Text style={styles.headline}>Sign in with mobile</Text>
            <Text style={styles.sub}>We{'\u2019'}ll send you a one-time code.</Text>
            <View style={styles.inputRow}>
              <Text style={styles.cc}>+91</Text>
              <TextInput
                testID="login-mobile-input"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                placeholder="Mobile number"
                placeholderTextColor={colors.onSurfaceMuted}
                style={styles.input}
                maxLength={10}
              />
            </View>
            {err ? <Text testID="login-error" style={styles.err}>{err}</Text> : null}
            <View style={{ height: spacing.lg }} />
            <Button label="Send OTP" onPress={submit} loading={loading} testID="login-send-otp-button" />
            {IS_MOCK_AUTH ? <Text style={styles.demoHint}>Preview mode: use code 123456 to sign in.</Text> : null}
            <Text style={styles.terms}>By continuing you agree to Kuvira{'\u2019'}s Terms & Privacy.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  brandWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  brand: { color: colors.onSurface, fontSize: 44, fontWeight: '800', letterSpacing: 6 },
  tagline: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, marginTop: spacing.xs, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  form: { padding: spacing.xl, backgroundColor: 'rgba(10,10,10,0.85)', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  headline: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cc: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700', marginRight: spacing.md },
  input: { flex: 1, color: colors.onSurface, fontSize: font.sizes.lg, paddingVertical: spacing.lg },
  err: { color: colors.error, marginTop: spacing.sm, fontSize: font.sizes.sm },
  demoHint: { color: colors.brandPrimary, textAlign: 'center', marginTop: spacing.md, fontSize: font.sizes.xs, fontWeight: '700' },
  terms: { color: colors.onSurfaceMuted, textAlign: 'center', marginTop: spacing.lg, fontSize: font.sizes.xs },
});
