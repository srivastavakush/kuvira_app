import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, font, radius } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { api, setToken } from '@/src/api';
import { confirmVerification, resendVerification } from '@/src/auth-provider';

export default function OTP() {
  const router = useRouter();
  const { mobile } = useLocalSearchParams<{ mobile: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function verify() {
    if (otp.length !== 6) { setErr('Enter 6-digit OTP'); return; }
    setLoading(true); setErr(null);
    try {
      const { credential, phoneNumber } = await confirmVerification(String(mobile), otp);
      const expected = String(mobile);
      if (phoneNumber !== expected) throw new Error('Phone number mismatch. Please restart login.');
      const res: any = await api.otpVerify(expected, credential);
      await setToken(res.token);
      if (!res.user.onboarded) router.replace('/(auth)/onboarding');
      else router.replace('/(tabs)/home');
    } catch (e: any) {
      setErr(e?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true); setErr(null);
    try {
      await resendVerification(String(mobile));
      setOtp('');
    } catch (e: any) {
      setErr(e?.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.wrap} testID="otp-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="otp-back">
          <Text style={{ color: colors.onSurface, fontSize: font.sizes.lg }}>‹  Back</Text>
        </Pressable>
        <View style={styles.body}>
          <Text style={styles.headline}>Enter OTP</Text>
          <Text style={styles.sub}>We sent a verification code to {mobile}.</Text>
          <TextInput testID="otp-input" value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="123456" placeholderTextColor={colors.onSurfaceMuted} maxLength={6} style={styles.otpInput} />
          {err ? <Text style={styles.err} testID="otp-error">{err}</Text> : null}
          <View style={{ height: spacing.xl }} />
          <Button label="Verify & Continue" onPress={verify} loading={loading} testID="otp-verify-button" />
          <Pressable onPress={resend} disabled={resending} style={styles.resend}>
            <Text style={styles.resendText}>{resending ? 'Sending…' : 'Resend OTP'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  backBtn: { padding: spacing.lg },
  body: { padding: spacing.xl, flex: 1 },
  headline: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, marginTop: spacing.sm, marginBottom: spacing.xl },
  otpInput: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.onSurface, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 10, paddingVertical: spacing.lg },
  err: { color: colors.error, marginTop: spacing.md, fontSize: font.sizes.sm },
  resend: { alignItems: 'center', marginTop: spacing.lg, padding: spacing.sm },
  resendText: { color: colors.onSurface, fontWeight: '600', fontSize: font.sizes.sm },
});
