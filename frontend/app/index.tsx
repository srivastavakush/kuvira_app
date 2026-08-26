// Entry — home is public; authentication is requested only for protected actions.
import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/src/session';
import { c, font, spacing } from '@/src/theme';

export default function Index() {
  const router = useRouter();
  const { loading } = useSession();

  useEffect(() => {
    if (!loading) router.replace('/(tabs)/home');
  }, [loading, router]);

  return (
    <View style={styles.wrap} testID="splash-screen">
      <Text style={styles.brand}>KUVIRA</Text>
      <Text style={styles.tagline}>Play with intent.</Text>
      <ActivityIndicator size="small" color={c.textFaint} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  brand: { color: c.text, fontSize: 40, fontWeight: '800', letterSpacing: 6 },
  tagline: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: spacing.sm, letterSpacing: 2, textTransform: 'uppercase' },
});
