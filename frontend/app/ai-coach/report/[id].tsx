import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { ScreenHeader, Loader, EmptyState, Button, Badge, Divider } from '@/src/components/ui';
import { api } from '@/src/api';

export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setReport(await api.aiCoach.matchReport(String(id))); }
      catch (e: any) { setError(e?.message || 'Report unavailable'); }
    })();
  }, [id]);

  if (error) return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <ScreenHeader title="Report" onBack={() => router.back()} />
      <EmptyState title="Report unavailable" subtitle={error} cta="Back to Coach" onCta={() => router.replace('/ai-coach')} icon="alert-circle-outline" />
    </SafeAreaView>
  );
  if (!report) return <SafeAreaView style={styles.wrap} edges={['top']}><ScreenHeader title="Report" onBack={() => router.back()} /><Loader /></SafeAreaView>;

  const dq = report.data_quality || {};
  const metrics: any[] = report.metrics || [];
  const evidence: any[] = report.evidence || [];
  const unavailable: string[] = report.unavailable || [];

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="ai-coach-report">
      <ScreenHeader title="Match report" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <Text style={styles.summary}>{report.match_summary || 'No summary available.'}</Text>
          {report.key_takeaway ? (
            <View style={styles.takeaway}>
              <Text style={styles.takeawayLabel}>Key takeaway</Text>
              <Text style={styles.takeawayText}>{report.key_takeaway}</Text>
            </View>
          ) : null}
        </View>

        {/* Data quality */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data quality</Text>
          <View style={styles.dqRow}>
            <ConfidencePill value={dq.overall_confidence ?? 0} />
            {dq.resolution ? <Badge label={dq.resolution} variant="neutral" size="sm" /> : null}
            {dq.duration_sec ? <Badge label={`${Math.round(dq.duration_sec)}s`} variant="neutral" size="sm" /> : null}
            {dq.frames_sampled ? <Badge label={`${dq.frames_sampled} frames`} variant="neutral" size="sm" /> : null}
          </View>
          {report.data_quality_summary ? <Text style={styles.body}>{report.data_quality_summary}</Text> : null}
          {Array.isArray(dq.warnings) && dq.warnings.length ? (
            <Text style={styles.warn}>Warnings: {dq.warnings.join(', ')}</Text>
          ) : null}
        </View>

        {/* Metrics */}
        {metrics.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Metrics</Text>
            <View style={styles.metricsCard}>
              {metrics.map((m, i) => (
                <View key={i}>
                  {i > 0 ? <Divider inset={spacing.md} /> : null}
                  <View style={styles.metricRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricName}>{prettyMetric(m.metric)}</Text>
                      {m.note ? <Text style={styles.metricNote} numberOfLines={2}>{m.note}</Text> : null}
                      <Text style={styles.metricSource}>Source: {m.source} • Confidence: {Math.round((m.confidence ?? 0) * 100)}%</Text>
                    </View>
                    <Text style={styles.metricValue}>{m.value != null ? String(m.value) : '—'}<Text style={styles.metricUnit}>{m.unit ? ` ${m.unit}` : ''}</Text></Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Coaching lists */}
        <ListSection title="Strengths" items={report.strengths} emptyLabel={unavailable.includes('strengths_require_shot_analytics') ? 'Requires shot analytics (not yet available)' : undefined} tint={c.positive} />
        <ListSection title="Weaknesses" items={report.weaknesses} emptyLabel={unavailable.includes('weaknesses_require_shot_analytics') ? 'Requires shot analytics (not yet available)' : undefined} tint={c.warning} />
        <ListSection title="Tactical observations" items={report.tactical_observations} emptyLabel={unavailable.includes('tactical_observations_require_shot_analytics') ? 'Requires shot analytics (not yet available)' : undefined} />

        {/* Drills */}
        {Array.isArray(report.recommended_drills) && report.recommended_drills.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recommended drills</Text>
            {report.recommended_drills.map((d: any, i: number) => (
              <View key={i} style={styles.drillCard}>
                <Text style={styles.drillTitle}>{d.title}</Text>
                {d.description ? <Text style={styles.drillBody}>{d.description}</Text> : null}
                {d.target ? <Text style={styles.drillTarget}>Target: {d.target}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Training plan */}
        {Array.isArray(report.training_plan) && report.training_plan.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Training plan</Text>
            {report.training_plan.map((w: any, i: number) => (
              <View key={i} style={styles.weekCard}>
                <Text style={styles.weekLabel}>Week {w.week}</Text>
                <Text style={styles.weekFocus}>{w.focus}</Text>
                {Array.isArray(w.sessions) ? w.sessions.map((s: string, j: number) => (
                  <View key={j} style={styles.sessionRow}><Ionicons name="ellipse" size={6} color={c.textFaint} /><Text style={styles.sessionText}>{s}</Text></View>
                )) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Evidence */}
        {evidence.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Evidence used</Text>
            {evidence.map((e: any, i: number) => (
              <View key={i} style={styles.evidenceRow}>
                <Text style={styles.evTitle}>{e.title}</Text>
                <Text style={styles.evBody} numberOfLines={3}>{e.body}</Text>
                <Text style={styles.evMeta}>{e.source_name || e.source || '—'} • authority tier {e.authority_level || '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Not available */}
        {unavailable.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Not detected in this pass</Text>
            <Text style={styles.body}>{unavailable.map(prettyMetric).join(' • ')}</Text>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Button label="Ask the coach" onPress={() => router.push(`/ai-coach/chat?matchId=${id}`)} testID="report-chat" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ListSection({ title, items, emptyLabel, tint }: { title: string; items?: string[]; emptyLabel?: string; tint?: string }) {
  const has = Array.isArray(items) && items.length > 0;
  if (!has && !emptyLabel) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {has ? items!.map((s, i) => (
        <View key={i} style={styles.bullet}>
          <View style={[styles.bulletDot, tint ? { backgroundColor: tint } : null]} />
          <Text style={styles.bulletText}>{s}</Text>
        </View>
      )) : <Text style={styles.body}>{emptyLabel}</Text>}
    </View>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const label = pct >= 60 ? 'High confidence' : pct >= 30 ? 'Partial confidence' : pct > 0 ? 'Low confidence' : 'No sports-analytics';
  return <Badge label={`${label} • ${pct}%`} variant={pct >= 60 ? 'success' : pct >= 30 ? 'warning' : 'danger'} size="sm" />;
}

function prettyMetric(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: font.weights.semibold, marginBottom: spacing.sm },
  summary: { color: c.text, fontSize: font.sizes.base, lineHeight: 22 },
  takeaway: { marginTop: spacing.md, padding: spacing.md, backgroundColor: c.bgElevated, borderRadius: radius.md },
  takeawayLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, fontWeight: font.weights.semibold },
  takeawayText: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold, marginTop: 4, lineHeight: 22 },
  dqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  body: { color: c.textSecondary, fontSize: font.sizes.sm, lineHeight: 20 },
  warn: { color: c.warning, fontSize: font.sizes.sm, marginTop: spacing.sm },
  metricsCard: { backgroundColor: c.bgElevated, borderRadius: radius.md, overflow: 'hidden' },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.md },
  metricName: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  metricNote: { color: c.textMuted, fontSize: font.sizes.xs, marginTop: 2, lineHeight: 16 },
  metricSource: { color: c.textFaint, fontSize: font.sizes.xs, marginTop: 4 },
  metricValue: { color: c.text, fontSize: font.sizes.lg, fontWeight: font.weights.heavy },
  metricUnit: { color: c.textMuted, fontSize: font.sizes.sm, fontWeight: font.weights.regular },
  bullet: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: 6 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.textFaint, marginTop: 8 },
  bulletText: { flex: 1, color: c.text, fontSize: font.sizes.base, lineHeight: 22 },
  drillCard: { backgroundColor: c.bgElevated, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  drillTitle: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  drillBody: { color: c.textSecondary, fontSize: font.sizes.sm, marginTop: 4, lineHeight: 20 },
  drillTarget: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 6, fontWeight: font.weights.semibold },
  weekCard: { backgroundColor: c.bgElevated, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  weekLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, fontWeight: font.weights.semibold },
  weekFocus: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold, marginTop: 2, marginBottom: 6 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  sessionText: { color: c.textSecondary, fontSize: font.sizes.sm, flex: 1 },
  evidenceRow: { paddingVertical: 10 },
  evTitle: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
  evBody: { color: c.textSecondary, fontSize: font.sizes.sm, marginTop: 4, lineHeight: 20 },
  evMeta: { color: c.textFaint, fontSize: font.sizes.xs, marginTop: 4 },
});
