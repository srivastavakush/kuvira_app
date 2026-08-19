import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { c, spacing, font, radius } from '@/src/theme';
import { ScreenHeader, EmptyState, Loader, Divider } from '@/src/components/ui';
import { api } from '@/src/api';

export default function Performance() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { setData(await api.aiCoach.playerPerformance()); } finally { setLoading(false); }
  })(); }, []);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="ai-coach-performance">
      <ScreenHeader title="Performance" onBack={() => router.back()} />
      {loading ? <Loader /> : (
        !data || !data.matches_analyzed ? (
          <EmptyState title="No analyzed matches yet" subtitle="Upload a match to start tracking measurable metrics with source and confidence." icon="stats-chart-outline" cta="Analyze a match" onCta={() => router.replace('/ai-coach/upload')} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}>
            <Text style={styles.header}>{data.matches_analyzed} match{data.matches_analyzed === 1 ? '' : 'es'} analyzed</Text>
            <View style={styles.card}>
              {Object.entries(data.trends || {}).map(([name, t]: any, i) => (
                <View key={name}>
                  {i > 0 ? <Divider inset={spacing.md} /> : null}
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metric}>{name.replace(/_/g, ' ')}</Text>
                      <Text style={styles.meta}>Source: {t.source} • {Math.round((t.confidence ?? 0) * 100)}%</Text>
                    </View>
                    <Text style={styles.value}>{t.current != null ? String(t.current) : '—'}<Text style={styles.unit}>{t.unit ? ` ${t.unit}` : ''}</Text></Text>
                    {t.previous != null ? <Text style={styles.trend}>{t.previous} → {t.current}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  header: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: font.weights.semibold, marginBottom: 6 },
  card: { backgroundColor: c.bgElevated, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.md },
  metric: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold, textTransform: 'capitalize' },
  meta: { color: c.textFaint, fontSize: font.sizes.xs, marginTop: 2 },
  value: { color: c.text, fontSize: font.sizes.lg, fontWeight: font.weights.heavy },
  unit: { color: c.textMuted, fontSize: font.sizes.sm, fontWeight: font.weights.regular },
  trend: { color: c.textMuted, fontSize: font.sizes.xs, marginLeft: 8 },
});
