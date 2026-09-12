import { SportPicker } from '@/src/components/sport-picker';
import { useSession } from '@/src/session';
import { requireAuth } from '@/src/auth-gate';
import { ErrorBanner } from '@/src/components/states';
import { EmptyState, InputField } from '@/src/components/ui';
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { api } from '@/src/api';

const SKILLS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const FORMATS = ['Singles', 'Doubles', 'Mixed Doubles'];
const TIMES = ['Morning', 'Afternoon', 'Evening'];

export default function CreateGame() {
  const router = useRouter();
  const { user } = useSession();
  const [sport, setSport] = useState('badminton');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('18:00');
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [facilityId, setFacilityId] = useState<string>('');
  const [skill, setSkill] = useState('Intermediate');
  const [format, setFormat] = useState('Doubles');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [price, setPrice] = useState('200');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() { setLoading(true); setError(null); try { const f = await api.facilities(); setFacilities(f); if (f[0]) setFacilityId(f[0].id); } catch(e) { setError(e); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);

  async function create(authenticated = false) {
    if (!authenticated && !requireAuth(user, router, undefined, () => create(true))) return;
    if (!facilityId) return;
    setCreating(true);
    try {
      const date = new Date(`${day}T${time}:00+05:30`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(date.getTime()) || date <= new Date()) throw new Error('Choose a future date and time in Indian Standard Time.');
      if (!Number.isFinite(Number(price)) || Number(price) < 0) throw new Error('Enter a valid price per player.');
      const g = await api.createGame({
        sport: `sport-${sport}`, facility_id: facilityId, date: date.toISOString(),
        duration_min: 90, skill_level: skill, format, max_players: maxPlayers,
        price_per_person: Number(price), notes,
      });
      router.replace(`/game/${g.id}`);
    } catch(e) { setError(e); } finally { setCreating(false); }
  }

  if (!loading && !facilities.length) return <SafeAreaView style={{ flex: 1 }}><ErrorBanner error={error} retry={load} /><EmptyState title="No venues available yet" subtitle="Explore venues or try again shortly." cta="Explore" onCta={() => router.push('/(tabs)/discover')} /></SafeAreaView>;
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <SafeAreaView style={styles.wrap} testID="create-game-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="create-game-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Create Game</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={error} /><SportPicker value={sport} onChange={setSport} /><InputField label="Date (YYYY-MM-DD)" value={day} onChangeText={setDay} placeholder="YYYY-MM-DD" /><InputField label="Time (24-hour, IST)" value={time} onChangeText={setTime} placeholder="18:00" /><Text style={styles.label}>Facility</Text>
        {facilities.map((f) => (
          <Pressable key={f.id} testID={`create-facility-${f.id}`} onPress={() => setFacilityId(f.id)} style={[styles.optRow, facilityId === f.id && styles.optRowActive]}>
            <Text style={[styles.optRowText, facilityId === f.id && styles.optTextActive]}>{f.name}</Text>
            <Text style={styles.optRowSub}>{f.area}</Text>
          </Pressable>
        ))}

        <Text style={styles.label}>Skill Level</Text>
        <View style={styles.chipWrap}>
          {SKILLS.map((s) => (
            <Pressable key={s} testID={`create-skill-${s}`} onPress={() => setSkill(s)} style={[styles.chip, skill === s && styles.chipActive]}>
              <Text style={[styles.chipText, skill === s && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Format</Text>
        <View style={styles.chipWrap}>
          {FORMATS.map((fmt) => (
            <Pressable key={fmt} testID={`create-format-${fmt}`} onPress={() => setFormat(fmt)} style={[styles.chip, format === fmt && styles.chipActive]}>
              <Text style={[styles.chipText, format === fmt && styles.chipTextActive]}>{fmt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Players</Text>
        <View style={styles.chipWrap}>
          {[2, 4, 6, 8].map((n) => (
            <Pressable key={n} testID={`create-players-${n}`} onPress={() => setMaxPlayers(n)} style={[styles.chip, maxPlayers === n && styles.chipActive]}>
              <Text style={[styles.chipText, maxPlayers === n && styles.chipTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Price per person (₹)</Text>
        <TextInput testID="create-price-input" value={price} onChangeText={setPrice} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.onSurfaceMuted} />

        <Text style={styles.label}>Notes</Text>
        <TextInput testID="create-notes-input" value={notes} onChangeText={setNotes} placeholder="Casual game, all welcome…" placeholderTextColor={colors.onSurfaceMuted} style={[styles.input, { height: 80 }]} multiline />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="create-game-submit" disabled={creating} style={[styles.submitBtn, creating && { opacity: 0.6 }]} onPress={() => create()}>
          <Text style={styles.submitBtnText}>{creating ? 'Creating…' : 'Create Game'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  label: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, height: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  chipActive: { backgroundColor: colors.surfaceTertiary },
  chipText: { color: colors.onSurfaceSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.onSurface, fontWeight: '700' },
  optRow: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  optRowActive: { backgroundColor: colors.surfaceTertiary },
  optRowText: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '600' },
  optRowSub: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  optTextActive: { color: colors.onSurface, fontWeight: '700' },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.onSurface, fontSize: font.sizes.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  submitBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  submitBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
});
