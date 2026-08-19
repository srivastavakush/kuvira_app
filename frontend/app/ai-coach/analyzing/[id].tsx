import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { c, spacing, font, radius } from '@/src/theme';
import { ScreenHeader, Button } from '@/src/components/ui';
import { api } from '@/src/api';

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  processing: 'Preparing',
  reading_video: 'Reading video',
  sampling_frames: 'Sampling frames',
  computing_motion: 'Computing motion signal',
  assessing_quality: 'Assessing data quality',
  finalizing: 'Finalizing analytics',
  completed: 'Completed',
  failed: 'Failed',
};

export default function Analyzing() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const j: any = await api.aiCoach.analysisStatus(String(id));
        if (!alive) return;
        setJob(j);
        if (j.status === 'completed') {
          router.replace(`/ai-coach/report/${matchId || j.match_id}`);
          return;
        }
        if (j.status === 'failed') { setError(j.error || 'Analysis failed'); return; }
      } catch (e: any) {
        if (!alive) return; setError(e?.message || 'Could not fetch job status');
        return;
      }
      timer.current = setTimeout(poll, 1500);
    }
    poll();
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
  }, [id, matchId, router]);

  const stage = job?.stage || 'queued';
  const progress = Math.round(((job?.progress ?? 0) as number) * 100);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="ai-coach-analyzing">
      <ScreenHeader title="Analyzing match" onBack={() => router.replace('/ai-coach')} />
      <View style={styles.body}>
        <Text style={styles.percent}>{progress}%</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.max(4, progress)}%` }]} />
        </View>
        <Text style={styles.stage}>{STAGE_LABELS[stage] || stage}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Analysis failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
              <Button label="Back to Coach" variant="secondary" onPress={() => router.replace('/ai-coach')} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.pipeline}>
              {['reading_video','sampling_frames','computing_motion','assessing_quality','finalizing'].map((s) => (
                <View key={s} style={styles.pipeRow}>
                  <View style={[styles.pipeDot, (progress >= stagePct(s)) && styles.pipeDotActive]} />
                  <Text style={[styles.pipeLabel, (progress >= stagePct(s)) && { color: c.text }]}>{STAGE_LABELS[s]}</Text>
                </View>
              ))}
            </View>
            <View style={styles.note}>
              <ActivityIndicator size="small" color={c.textFaint} />
              <Text style={styles.noteText}>Phase 1 analyzer runs on video metadata and motion only. Shot-level analytics arrive when trained CV models are enabled.</Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function stagePct(stage: string): number {
  switch (stage) {
    case 'reading_video': return 15;
    case 'sampling_frames': return 35;
    case 'computing_motion': return 55;
    case 'assessing_quality': return 75;
    case 'finalizing': return 95;
    default: return 0;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  body: { padding: spacing.xl, alignItems: 'stretch' },
  percent: { color: c.text, fontSize: 56, fontWeight: '800', letterSpacing: -1, textAlign: 'center', marginTop: spacing.xl },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: c.bgElevated, overflow: 'hidden', marginTop: spacing.lg },
  barFill: { height: 6, backgroundColor: c.text, borderRadius: 3 },
  stage: { color: c.textSecondary, fontSize: font.sizes.base, textAlign: 'center', marginTop: spacing.md, fontWeight: font.weights.semibold },
  pipeline: { marginTop: spacing.xxl, gap: spacing.md },
  pipeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pipeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.bgRaised },
  pipeDotActive: { backgroundColor: c.text },
  pipeLabel: { color: c.textMuted, fontSize: font.sizes.base },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.xxl, padding: spacing.md, backgroundColor: c.bgElevated, borderRadius: radius.md },
  noteText: { flex: 1, color: c.textMuted, fontSize: font.sizes.sm, lineHeight: 20 },
  errorBox: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: c.bgElevated, borderRadius: radius.md },
  errorTitle: { color: c.danger, fontSize: font.sizes.base, fontWeight: font.weights.bold },
  errorText: { color: c.textSecondary, fontSize: font.sizes.sm, marginTop: 4, lineHeight: 20 },
});
