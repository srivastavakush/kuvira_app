// Entry — routes to (auth)/login or (tabs)/home based on session + onboarding.
import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/src/session';
import { colors, font, spacing } from '@/src/theme';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/(auth)/login');
    else if (!user.onboarded) router.replace('/(auth)/onboarding');
    else router.replace('/(tabs)/home');
  }, [user, loading, router]);

  return (
    <View style={styles.wrap} testID="splash-screen">
      <Text style={styles.brand}>KUVIRA</Text>
      <Text style={styles.tagline}>Sports · Operating System</Text>
      <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.brandPrimary, fontSize: 48, fontWeight: '900', letterSpacing: 4 },
  tagline: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, marginTop: spacing.sm, letterSpacing: 2 },
});
