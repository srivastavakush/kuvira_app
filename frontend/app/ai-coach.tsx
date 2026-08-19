import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { ScreenHeader, Button, EmptyState, Divider, Badge } from '@/src/components/ui';
import { api } from '@/src/api';
import { useSession } from '@/src/session';

export default function AICoachHub() {
  const router = useRouter();
  const { user } = useSession();
  const [matches, setMatches] = useState<any[]>([]);
  const [perf, setPerf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api.aiCoach.listMatches().catch(() => []),
        api.aiCoach.playerPerformance().catch(() => null),
      ]);
      setMatches(m); setPerf(p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const latest = matches[0];
  const level = user?.skill_level || null;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="ai-coach-hub">
      <ScreenHeader
        title="Coach"
        onBack={() => router.back()}
        right={level ? <Badge label={level} variant="neutral" size="sm" /> : undefined}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textFaint} />}
      >
        {/* Primary CTA */}
        <View style={styles.primary}>
          <Text style={styles.primaryEyebrow}>Analyze</Text>
          <Text style={styles.primaryTitle}>Turn a match video into a coaching report.</Text>
          <Text style={styles.primarySub}>Upload footage of your match. We’ll produce structured, evidence-based analysis you can train against.</Text>
          <View style={{ marginTop: spacing.lg }}>
            <Button label="Analyze a match" onPress={() => router.push('/ai-coach/upload')} testID="ai-coach-analyze" />
          </View>
        </View>

        {/* Recent match + report shortcut */}
        {latest ? (
          <Pressable
            testID="ai-coach-recent-match"
            onPress={() => router.push(latest.report ? `/ai-coach/report/${latest.id}` : `/ai-coach/analyzing/${latest.job?.id || ''}?matchId=${latest.id}`)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.bgRaised }]}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="videocam-outline" size={20} color={c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Recent match</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {latest.opponent_name ? `vs ${latest.opponent_name}` : latest.sport}
                {latest.result ? ` • ${latest.result}` : ''}
              </Text>
              <Text style={styles.rowMeta}>
                {latest.report ? 'Report ready' : latest.job?.status === 'processing' ? 'Analyzing…' : latest.job?.status === 'failed' ? 'Analysis failed' : 'Awaiting analysis'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
          </Pressable>
        ) : null}

        {/* Secondary entry points */}
        <View style={styles.menuBlock}>
          <View style={styles.menuGroup}>
            <MenuRow icon="stats-chart-outline" label="Performance trends" sub={perf?.matches_analyzed ? `${perf.matches_analyzed} match${perf.matches_analyzed === 1 ? '' : 'es'} analyzed` : 'No analyzed matches yet'} onPress={() => router.push('/ai-coach/performance')} />
            <Divider inset={spacing.md} />
            <MenuRow icon="barbell-outline" label="Training plan" sub={latest?.report ? 'Latest plan available' : 'Available after your first analysis'} onPress={() => latest?.report ? router.push(`/ai-coach/report/${latest.id}?tab=training`) : router.push('/ai-coach/upload')} />
            <Divider inset={spacing.md} />
            <MenuRow icon="chatbubble-ellipses-outline" label="Ask the coach" sub="Grounded in your latest match" onPress={() => router.push('/ai-coach/chat')} />
          </View>
        </View>

        {/* Match list */}
        {loading ? null : matches.length === 0 ? (
          <EmptyState
            title="No analyzed matches yet"
            subtitle="Upload your first match video to see structured coaching."
            icon="videocam-outline"
            cta="Upload a match"
            onCta={() => router.push('/ai-coach/upload')}
            testID="ai-coach-empty"
          />
        ) : (
          <View style={styles.menuBlock}>
            <Text style={styles.sectionLabel}>All matches</Text>
            <View style={styles.menuGroup}>
              {matches.map((m, i) => (
                <View key={m.id}>
                  {i > 0 ? <Divider inset={spacing.md} /> : null}
                  <Pressable
                    testID={`ai-coach-match-${m.id}`}
                    onPress={() => router.push(m.report ? `/ai-coach/report/${m.id}` : `/ai-coach/analyzing/${m.job?.id || ''}?matchId=${m.id}`)}
                    style={({ pressed }) => [styles.matchRow, pressed && { backgroundColor: c.bgRaised }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchTitle} numberOfLines={1}>{m.opponent_name ? `vs ${m.opponent_name}` : m.sport}</Text>
                      <Text style={styles.matchMeta}>{new Date(m.created_at).toDateString()}{m.result ? ` • ${m.result}` : ''}</Text>
                    </View>
                    <Text style={[styles.matchStatus, m.job?.status === 'failed' && { color: c.danger }, m.report && { color: c.positive }]}>
                      {m.report ? 'Ready' : m.job?.status === 'processing' ? 'Analyzing' : m.job?.status === 'failed' ? 'Failed' : 'Pending'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, sub, onPress }: { icon: any; label: string; sub?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: c.bgRaised }]}>
      <Ionicons name={icon} size={18} color={c.text} />
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  primary: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  primaryEyebrow: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: font.weights.semibold, marginBottom: 6 },
  primaryTitle: { color: c.text, fontSize: font.sizes.xxl, fontWeight: font.weights.heavy, letterSpacing: -0.3, lineHeight: 30 },
  primarySub: { color: c.textMuted, fontSize: font.sizes.base, lineHeight: 22, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: c.bgElevated, borderRadius: radius.md },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgRaised, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, fontWeight: font.weights.semibold },
  rowValue: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold, marginTop: 2 },
  rowMeta: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 2 },
  menuBlock: { marginTop: spacing.lg },
  sectionLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: font.weights.semibold, marginBottom: spacing.sm, marginLeft: spacing.lg },
  menuGroup: { marginHorizontal: spacing.lg, backgroundColor: c.bgElevated, borderRadius: radius.md, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  menuLabel: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  menuSub: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 2 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  matchTitle: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  matchMeta: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 2 },
  matchStatus: { color: c.textSecondary, fontSize: font.sizes.sm, fontWeight: font.weights.semibold, marginRight: 6 },
});
