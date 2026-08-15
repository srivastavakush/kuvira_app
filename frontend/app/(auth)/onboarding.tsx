import { useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, font, radius } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { api } from '@/src/api';

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const FREQUENCIES = ['1-2x per week', '3-4x per week', '5+x per week'];
const MODES = ['Recreational', 'Competitive', 'Both'];
const GOALS = ['Play more', 'Improve skills', 'Compete in tournaments', 'Meet players', 'Get coaching', 'Buy equipment'];
const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Pune', 'Chennai', 'Hyderabad'];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [city, setCity] = useState('Bangalore');
  const [skill, setSkill] = useState('Intermediate');
  const [freq, setFreq] = useState('1-2x per week');
  const [mode, setMode] = useState('Recreational');
  const [goals, setGoals] = useState<string[]>(['Play more', 'Improve skills']);
  const [loading, setLoading] = useState(false);

  function toggleGoal(g: string) {
    setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  async function finish() {
    setLoading(true);
    try {
      await api.onboarding({
        name: name.trim() || 'Athlete',
        city, primary_sport: 'sport-pickleball',
        sports: ['sport-pickleball'], skill_level: skill,
        playing_frequency: freq, competitive: mode, goals,
      });
      router.replace('/(tabs)/home');
    } finally { setLoading(false); }
  }

  const steps = 4;
  return (
    <SafeAreaView style={styles.wrap} testID="onboarding-screen">
      <View style={styles.progress}>
        {Array.from({ length: steps }).map((_, i) => (
          <View key={i} style={[styles.progressBar, i <= step && { backgroundColor: colors.brandPrimary }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text style={styles.h1}>Welcome to Kuvira.</Text>
            <Text style={styles.sub}>Let{'\u2019'}s set up your player identity.</Text>
            <Text style={styles.label}>Your name</Text>
            <TextInput testID="onboarding-name-input" value={name} onChangeText={setName} placeholder="e.g. Arjun" placeholderTextColor={colors.onSurfaceMuted} style={styles.input} />
            <Text style={styles.label}>City</Text>
            <View style={styles.optRow}>
              {CITIES.map((c) => (
                <Pressable key={c} testID={`onboarding-city-${c}`} onPress={() => setCity(c)} style={[styles.opt, city === c && styles.optActive]}>
                  <Text style={[styles.optText, city === c && styles.optTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {step === 1 && (
          <View>
            <Text style={styles.h1}>What{'\u2019'}s your skill level?</Text>
            <Text style={styles.sub}>Pickleball · we{'\u2019'}ll personalize matches & training.</Text>
            {SKILL_LEVELS.map((s) => (
              <Pressable key={s} testID={`onboarding-skill-${s}`} onPress={() => setSkill(s)} style={[styles.bigOpt, skill === s && styles.bigOptActive]}>
                <Text style={[styles.bigOptText, skill === s && styles.bigOptTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {step === 2 && (
          <View>
            <Text style={styles.h1}>How often do you play?</Text>
            {FREQUENCIES.map((f) => (
              <Pressable key={f} testID={`onboarding-freq-${f}`} onPress={() => setFreq(f)} style={[styles.bigOpt, freq === f && styles.bigOptActive]}>
                <Text style={[styles.bigOptText, freq === f && styles.bigOptTextActive]}>{f}</Text>
              </Pressable>
            ))}
            <Text style={[styles.label, { marginTop: spacing.lg }]}>Style</Text>
            <View style={styles.optRow}>
              {MODES.map((m) => (
                <Pressable key={m} testID={`onboarding-mode-${m}`} onPress={() => setMode(m)} style={[styles.opt, mode === m && styles.optActive]}>
                  <Text style={[styles.optText, mode === m && styles.optTextActive]}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {step === 3 && (
          <View>
            <Text style={styles.h1}>What are your goals?</Text>
            <Text style={styles.sub}>Pick a few. We{'\u2019'}ll tune your feed.</Text>
            <View style={styles.optRow}>
              {GOALS.map((g) => (
                <Pressable key={g} testID={`onboarding-goal-${g}`} onPress={() => toggleGoal(g)} style={[styles.opt, goals.includes(g) && styles.optActive]}>
                  <Text style={[styles.optText, goals.includes(g) && styles.optTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable style={styles.backBtn} onPress={() => setStep(step - 1)} testID="onboarding-back">
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sizes.base, fontWeight: '600' }}>Back</Text>
          </Pressable>
        ) : <View style={{ width: 80 }} />}
        {step < steps - 1 ? (
          <Button label="Continue" onPress={() => setStep(step + 1)} testID="onboarding-next" fullWidth={false} style={{ flex: 1, marginLeft: spacing.md }} />
        ) : (
          <Button label="Finish" onPress={finish} loading={loading} testID="onboarding-finish" fullWidth={false} style={{ flex: 1, marginLeft: spacing.md }} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceTertiary },
  body: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  h1: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900', marginBottom: spacing.xs },
  sub: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, marginBottom: spacing.xl },
  label: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: '600' },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.onSurface, fontSize: font.sizes.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opt: { paddingHorizontal: spacing.lg, height: 42, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary },
  optActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  optText: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, fontWeight: '500' },
  optTextActive: { color: colors.brandPrimary, fontWeight: '700' },
  bigOpt: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  bigOptActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  bigOptText: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '600' },
  bigOptTextActive: { color: colors.brandPrimary, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  backBtn: { width: 80, height: 52, alignItems: 'center', justifyContent: 'center' },
});
