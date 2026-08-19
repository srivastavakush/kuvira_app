import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { c, spacing, font, radius } from '@/src/theme';
import { ScreenHeader, Button, InputField, Badge } from '@/src/components/ui';
import { api } from '@/src/api';

const RESULTS = ['win', 'loss', 'draw'] as const;
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];

export default function Upload() {
  const router = useRouter();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [opponent, setOpponent] = useState('');
  const [result, setResult] = useState<string | undefined>(undefined);
  const [level, setLevel] = useState('Intermediate');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<string>('');

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photos to select a match video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1, allowsMultipleSelection: false });
    if (!res.canceled && res.assets[0]) setAsset(res.assets[0]);
  }

  async function submit() {
    if (!asset) { Alert.alert('Select a video', 'Pick a match video from your library first.'); return; }
    setUploading(true);
    try {
      setStage('Creating match');
      const match: any = await api.aiCoach.createMatch({
        sport: 'pickleball', player_level: level, result, opponent_name: opponent || undefined, notes: notes || undefined,
      });
      setStage('Uploading video');
      const uploaded: any = await api.aiCoach.uploadVideo(
        asset.uri, match.id,
        (asset.fileName as any) || 'match.mp4',
        (asset.mimeType as any) || 'video/mp4',
      );
      setStage('Starting analysis');
      const job: any = await api.aiCoach.startAnalysis(match.id, uploaded.id);
      router.replace(`/ai-coach/analyzing/${job.id}?matchId=${match.id}`);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploading(false); setStage('');
    }
  }

  const durationSec = asset?.duration ? Math.round(asset.duration / 1000) : null;
  const sizeMB = asset?.fileSize ? (asset.fileSize / (1024 * 1024)).toFixed(1) : null;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="ai-coach-upload">
      <ScreenHeader title="Analyze a match" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* Video picker */}
        {!asset ? (
          <Pressable onPress={pick} style={styles.dropzone} testID="upload-pick">
            <View style={styles.dzIcon}><Ionicons name="cloud-upload-outline" size={24} color={c.text} /></View>
            <Text style={styles.dzTitle}>Select a match video</Text>
            <Text style={styles.dzSub}>MP4, MOV or M4V. Up to 500 MB.</Text>
          </Pressable>
        ) : (
          <View style={styles.assetCard}>
            <View style={styles.assetHead}>
              <Ionicons name="videocam-outline" size={18} color={c.text} />
              <Text style={styles.assetName} numberOfLines={1}>{asset.fileName || 'Selected video'}</Text>
              <Pressable onPress={() => setAsset(null)} hitSlop={8}><Ionicons name="close" size={18} color={c.textMuted} /></Pressable>
            </View>
            <View style={styles.assetMetaRow}>
              {durationSec != null ? <Badge label={`${durationSec}s`} variant="neutral" size="sm" /> : null}
              {sizeMB ? <Badge label={`${sizeMB} MB`} variant="neutral" size="sm" /> : null}
              {asset.width && asset.height ? <Badge label={`${asset.width}×${asset.height}`} variant="neutral" size="sm" /> : null}
            </View>
            <Pressable onPress={pick} style={styles.reselect}><Text style={styles.reselectText}>Choose a different video</Text></Pressable>
          </View>
        )}

        {/* Match info */}
        <Text style={styles.sectionLabel}>Match details</Text>

        <InputField label="Opponent (optional)" value={opponent} onChangeText={setOpponent} placeholder="e.g. Rohit" testID="upload-opponent" />

        <Text style={styles.fieldLabel}>Result</Text>
        <View style={styles.chipRow}>
          {RESULTS.map((r) => (
            <Pressable key={r} onPress={() => setResult(result === r ? undefined : r)} style={[styles.chip, result === r && styles.chipActive]} testID={`upload-result-${r}`}>
              <Text style={[styles.chipText, result === r && styles.chipTextActive]}>{r[0].toUpperCase() + r.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Your level</Text>
        <View style={styles.chipRow}>
          {LEVELS.map((lv) => (
            <Pressable key={lv} onPress={() => setLevel(lv)} style={[styles.chip, level === lv && styles.chipActive]} testID={`upload-level-${lv}`}>
              <Text style={[styles.chipText, level === lv && styles.chipTextActive]}>{lv}</Text>
            </Pressable>
          ))}
        </View>

        <InputField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything the coach should know?"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
          testID="upload-notes"
        />

        {uploading ? <Text style={styles.stage}>{stage}…</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={uploading ? 'Uploading…' : 'Start analysis'}
          onPress={submit}
          loading={uploading}
          disabled={!asset}
          testID="upload-submit"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  dropzone: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, borderRadius: radius.md, backgroundColor: c.bgElevated, gap: 6 },
  dzIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.bgRaised, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  dzTitle: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  dzSub: { color: c.textMuted, fontSize: font.sizes.sm },
  assetCard: { backgroundColor: c.bgElevated, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  assetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assetName: { flex: 1, color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  assetMetaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reselect: { marginTop: spacing.xs },
  reselectText: { color: c.textSecondary, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
  sectionLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: font.weights.semibold, marginTop: spacing.xl, marginBottom: spacing.md },
  fieldLabel: { color: c.textMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 1, fontWeight: font.weights.semibold, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: c.bgElevated, justifyContent: 'center' },
  chipActive: { backgroundColor: c.text },
  chipText: { color: c.textSecondary, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
  chipTextActive: { color: c.bg, fontWeight: font.weights.bold },
  stage: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: spacing.md, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
});
