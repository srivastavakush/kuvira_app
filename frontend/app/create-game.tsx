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
  const [facilities, setFacilities] = useState<any[]>([]);
  const [facilityId, setFacilityId] = useState<string>('');
  const [skill, setSkill] = useState('Intermediate');
  const [format, setFormat] = useState('Doubles');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [price, setPrice] = useState('200');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => { const f = await api.facilities(); setFacilities(f); if (f[0]) setFacilityId(f[0].id); })();
  }, []);

  async function create() {
    if (!facilityId) return;
    setCreating(true);
    try {
      const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(18, 0, 0, 0);
      const g = await api.createGame({
        sport: 'sport-pickleball', facility_id: facilityId, date: date.toISOString(),
        duration_min: 90, skill_level: skill, format, max_players: maxPlayers,
        price_per_person: parseInt(price) || 200, notes,
      });
      router.replace(`/game/${g.id}`);
    } finally { setCreating(false); }
  }

  if (!facilities.length) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <SafeAreaView style={styles.wrap} testID="create-game-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="create-game-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Create Game</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Facility</Text>
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
              <Text style={[styles.chipText, skill === s && styles.optTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Format</Text>
        <View style={styles.chipWrap}>
          {FORMATS.map((fmt) => (
            <Pressable key={fmt} testID={`create-format-${fmt}`} onPress={() => setFormat(fmt)} style={[styles.chip, format === fmt && styles.chipActive]}>
              <Text style={[styles.chipText, format === fmt && styles.optTextActive]}>{fmt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Players</Text>
        <View style={styles.chipWrap}>
          {[2, 4, 6, 8].map((n) => (
            <Pressable key={n} testID={`create-players-${n}`} onPress={() => setMaxPlayers(n)} style={[styles.chip, maxPlayers === n && styles.chipActive]}>
              <Text style={[styles.chipText, maxPlayers === n && styles.optTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Price per person (₹)</Text>
        <TextInput testID="create-price-input" value={price} onChangeText={setPrice} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.onSurfaceMuted} />

        <Text style={styles.label}>Notes</Text>
        <TextInput testID="create-notes-input" value={notes} onChangeText={setNotes} placeholder="Casual game, all welcome…" placeholderTextColor={colors.onSurfaceMuted} style={[styles.input, { height: 80 }]} multiline />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="create-game-submit" disabled={creating} style={[styles.submitBtn, creating && { opacity: 0.6 }]} onPress={create}>
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
  optRow: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  optRowActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  optRowText: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  optRowSub: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, marginTop: 2 },
  optTextActive: { color: colors.brandPrimary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, height: 42, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong },
  chipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontWeight: '600' },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.onSurface, fontSize: font.sizes.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  submitBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  submitBtnText: { color: colors.onBrandPrimary, fontSize: font.sizes.lg, fontWeight: '800' },
});
