import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import { api } from '@/src/api';

export default function Refer() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  async function load() { setData(await api.myReferral()); }
  useEffect(() => { load(); }, []);

  async function copy() { await Clipboard.setStringAsync(data.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  async function share() { try { await Share.share({ message: data.share_message }); } catch {} }
  async function apply() {
    setApplyMsg(null);
    try { const r: any = await api.applyReferral(applyCode.trim()); setApplyMsg(r.message); setApplyCode(''); await load(); }
    catch (e: any) { setApplyMsg(e.message || 'Could not apply code'); }
  }

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loader /></View>;

  return (
    <SafeAreaView style={styles.wrap} testID="refer-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="refer-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Refer & Earn</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ padding: spacing.lg }}>
        <View style={styles.hero}>
          <Ionicons name="gift" size={40} color={colors.brandPrimary} />
          <Text style={styles.heroTitle}>Earn ₹{data.reward_per_referral}</Text>
          <Text style={styles.heroSub}>for every friend who joins and plays their first game. They get ₹{data.reward_per_referral} too.</Text>
        </View>

        <Text style={styles.label}>Your code</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code} testID="refer-code">{data.code}</Text>
          <Pressable testID="refer-copy" onPress={copy} style={styles.copyBtn}><Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text></Pressable>
        </View>

        <Pressable testID="refer-share" style={styles.shareBtn} onPress={share}>
          <Ionicons name="share-social" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.shareText}>Share Invite</Text>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statVal}>{data.referrals}</Text><Text style={styles.statLabel}>Referrals</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>₹{data.rewards_earned}</Text><Text style={styles.statLabel}>Earned</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>₹{data.credits}</Text><Text style={styles.statLabel}>Credits</Text></View>
        </View>

        <Text style={styles.label}>Have a code?</Text>
        <View style={styles.applyRow}>
          <TextInput testID="refer-apply-input" value={applyCode} onChangeText={setApplyCode} autoCapitalize="characters" placeholder="Enter friend's code" placeholderTextColor={colors.onSurfaceMuted} style={styles.applyInput} />
          <Pressable testID="refer-apply-btn" style={styles.applyBtn} onPress={apply}><Text style={styles.applyBtnText}>Apply</Text></Pressable>
        </View>
        {applyMsg ? <Text style={styles.applyMsg} testID="refer-apply-msg">{applyMsg}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: '900' },
  hero: { backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
  heroTitle: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900', marginTop: spacing.sm },
  heroSub: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, textAlign: 'center', marginTop: spacing.sm },
  label: { color: colors.onSurfaceMuted, fontSize: font.sizes.sm, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, borderStyle: 'dashed' },
  code: { color: colors.brandPrimary, fontSize: font.sizes.xxl, fontWeight: '900', letterSpacing: 2 },
  copyBtn: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.sm },
  copyText: { color: colors.onSurface, fontWeight: '700' },
  shareBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.md },
  shareText: { color: colors.onBrandPrimary, fontWeight: '800', fontSize: font.sizes.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statVal: { color: colors.brandPrimary, fontSize: font.sizes.xl, fontWeight: '900' },
  statLabel: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  applyRow: { flexDirection: 'row', gap: spacing.sm },
  applyInput: { flex: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.onSurface, fontSize: font.sizes.base, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  applyBtn: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.md },
  applyBtnText: { color: colors.onSurface, fontWeight: '800' },
  applyMsg: { color: colors.brandPrimary, fontSize: font.sizes.sm, marginTop: spacing.sm },
});
