import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ui';
import { api } from '@/src/api';

const QUICK = [
  'Why did I lose?',
  'What should I practice this week?',
  'How do I fix my backhand?',
  'Compare my last 3 matches',
  'Create this week’s training plan',
];

type Msg = { role: 'user' | 'assistant'; text: string };

export default function CoachChat() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await api.aiCoach.history();
        setMessages((res.messages || []).map((m: any) => ({ role: m.role, text: m.text })));
      } catch { /* empty state */ }
    })();
  }, []);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      const res: any = await api.aiCoach.chat(text, { match_id: matchId ? String(matchId) : undefined });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', text: e?.message || "I couldn't reach the coach. Try again shortly." }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  const empty = messages.length === 0;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="ai-coach-chat">
      <ScreenHeader title="Ask the coach" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {empty ? (
            <View style={{ paddingTop: spacing.lg }}>
              <Text style={styles.emptyTitle}>Grounded in your latest match</Text>
              <Text style={styles.emptySub}>Answers cite your available metrics and coaching evidence. If evidence is missing, the coach will say so.</Text>
              <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
                {QUICK.map((q) => (
                  <Pressable key={q} onPress={() => send(q)} style={({ pressed }) => [styles.suggest, pressed && { backgroundColor: c.bgRaised }]}>
                    <Text style={styles.suggestText}>{q}</Text>
                    <Ionicons name="arrow-forward" size={16} color={c.textFaint} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                <Text style={styles.bubbleText}>{m.text}</Text>
              </View>
            ))
          )}
          {sending ? (
            <View style={[styles.bubble, styles.aiBubble, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}>
              <ActivityIndicator size="small" color={c.textMuted} />
              <Text style={{ color: c.textMuted, fontSize: font.sizes.sm }}>Thinking…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            value={input} onChangeText={setInput}
            placeholder="Ask the coach" placeholderTextColor={c.textFaint}
            style={styles.input} multiline
            testID="coach-input"
          />
          <Pressable onPress={() => send(input)} disabled={!input.trim() || sending} style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]} testID="coach-send">
            <Ionicons name="arrow-up" size={20} color={c.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  emptyTitle: { color: c.text, fontSize: font.sizes.xxl, fontWeight: font.weights.heavy, letterSpacing: -0.3 },
  emptySub: { color: c.textMuted, fontSize: font.sizes.base, lineHeight: 22, marginTop: spacing.sm },
  suggest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.bgElevated, borderRadius: radius.md, padding: spacing.md },
  suggestText: { color: c.text, fontSize: font.sizes.base, fontWeight: font.weights.medium, flex: 1, marginRight: spacing.sm },
  bubble: { maxWidth: '86%', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.lg },
  userBubble: { alignSelf: 'flex-end', backgroundColor: c.bgRaised, borderBottomRightRadius: 6 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: c.bgElevated, borderBottomLeftRadius: 6 },
  bubbleText: { color: c.text, fontSize: font.sizes.base, lineHeight: 22 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, backgroundColor: c.bg },
  input: { flex: 1, backgroundColor: c.bgElevated, borderRadius: radius.lg, color: c.text, fontSize: font.sizes.base, paddingHorizontal: spacing.md, paddingVertical: spacing.md, maxHeight: 120, minHeight: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
});
