import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader, EmptyState } from '@/src/components/ui';
import { api } from '@/src/api';

const GOALS = ['Backhand', 'Serve', 'Endurance', 'Net play'];

export default function Training() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState('Backhand');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([api.trainingPlans(), api.trainingStreak()]);
    setPlans(p); setStreak(s); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createPlan() {
    setCreating(true);
    try { await api.createTrainingPlan(goal.toLowerCase(), 4); await load(); } finally { setCreating(false); }
  }
  async function toggle(planId: string, drillId: string) {
    await api.toggleDrill(planId, drillId); await load();
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <SafeAreaView style={styles.wrap} testID="training-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="training-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Training</Text>
        <View style={styles.streakPill}><Ionicons name="flame" size={14} color={colors.brandPrimary} /><Text style={styles.streakText}>{streak.streak_days}d</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.generator}>
          <Text style={styles.genLabel}>Generate an AI-assisted plan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginVertical: spacing.md }}>
            {GOALS.map((g) => (
              <Pressable key={g} testID={`training-goal-${g}`} onPress={() => setGoal(g)} style={[styles.goalChip, goal === g && styles.goalChipActive]}>
                <Text style={[styles.goalText, goal === g && styles.goalTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable testID="training-create-btn" style={styles.genBtn} disabled={creating} onPress={createPlan}>
            <Ionicons name="sparkles" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.genBtnText}>{creating ? 'Building…' : `Create ${goal} Plan`}</Text>
          </Pressable>
        </View>

        {plans.length === 0 ? (
          <EmptyState title="No training plans yet" subtitle="Tell AI Coach your goal and we'll create a plan." testID="training-empty" />
        ) : plans.map((plan) => {
          const total = plan.weeks.reduce((a: number, w: any) => a + w.drills.length, 0);
          const done = plan.weeks.reduce((a: number, w: any) => a + w.drills.filter((d: any) => d.done).length, 0);
          return (
            <View key={plan.id} style={styles.planCard} testID={`training-plan-${plan.id}`}>
              <Text style={styles.planTitle}>{plan.title}</Text>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${(done / total) * 100}%` }]} /></View>
              <Text style={styles.progressText}>{done}/{total} drills complete</Text>
              {plan.weeks.map((w: any) => (
                <View key={w.week} style={{ marginTop: spacing.md }}>
                  <Text style={styles.weekLabel}>{w.focus}</Text>
                  {w.drills.map((d: any) => (
                    <Pressable key={d.id} testID={`training-drill-${d.id}`} style={styles.drill} onPress={() => toggle(plan.id, d.id)}>
                      <Ionicons name={d.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={d.done ? colors.brandPrimary : colors.onSurfaceMuted} />
                      <Text style={[styles.drillText, d.done && styles.drillDone]}>{d.text}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill },
  streakText: { color: colors.brandPrimary, fontWeight: '800', fontSize: font.sizes.sm },
  generator: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  genLabel: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '700' },
  goalChip: { paddingHorizontal: spacing.lg, height: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  goalChipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  goalText: { color: colors.onSurfaceSecondary, fontWeight: '600' },
  goalTextActive: { color: colors.brandPrimary, fontWeight: '800' },
  genBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill },
  genBtnText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.base },
  planCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  planTitle: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '800' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.brandPrimary },
  progressText: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 6 },
  weekLabel: { color: colors.brandPrimary, fontSize: font.sizes.sm, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700', marginBottom: spacing.sm },
  drill: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  drillText: { color: colors.onSurface, fontSize: font.sizes.base, flex: 1 },
  drillDone: { color: colors.onSurfaceMuted, textDecorationLine: 'line-through' },
});
