import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { api } from '@/src/api';

const SUGGESTIONS = [
  'How do I improve my backhand?',
  'Create a 4-week training plan',
  'Which paddle suits my style?',
  'What should I train this week?',
];

type Msg = { role: 'user' | 'assistant'; text: string };

export default function AICoach() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await api.aiHistory();
        setMessages((res.messages || []).map((m: any) => ({ role: m.role, text: m.text })));
      } finally { setLoadingHistory(false); }
    })();
  }, []);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res: any = await api.aiChat(text);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, I could not respond right now. Please try again.' }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <SafeAreaView style={styles.wrap} testID="ai-coach-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="ai-back"><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.aiDot}><Ionicons name="sparkles" size={16} color={colors.onBrandPrimary} /></View>
          <Text style={styles.headerTitle}>AI Coach</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {messages.length === 0 && !loadingHistory && (
            <View style={styles.empty}>
              <View style={styles.bigAiDot}><Ionicons name="sparkles" size={32} color={colors.onBrandPrimary} /></View>
              <Text style={styles.emptyTitle}>Your personal AI Coach</Text>
              <Text style={styles.emptySub}>Ask about training, technique, strategy, or equipment. I know your profile.</Text>
              <View style={{ gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.lg }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} testID={`ai-suggestion-${s.slice(0, 10)}`} style={styles.suggestion} onPress={() => send(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.brandPrimary} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]} testID={`ai-msg-${m.role}-${i}`}>
              <Text style={[styles.bubbleText, m.role === 'assistant' && { color: colors.onSurface }]}>{m.text}</Text>
            </View>
          ))}
          {sending && (
            <View style={[styles.bubble, styles.aiBubble, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <ActivityIndicator size="small" color={colors.brandPrimary} />
              <Text style={{ color: colors.onSurfaceMuted }}>Coach is thinking…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            testID="ai-input"
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.onSurfaceMuted}
            style={styles.input}
            multiline
            onSubmitEditing={() => send(input)}
          />
          <Pressable testID="ai-send-btn" style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]} disabled={!input.trim() || sending} onPress={() => send(input)}>
            <Ionicons name="arrow-up" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: '800' },
  aiDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  bigAiDot: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { color: colors.onSurface, fontSize: font.sizes.xxl, fontWeight: '900' },
  emptySub: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  suggestionText: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '600', flex: 1 },
  bubble: { maxWidth: '85%', padding: spacing.md, borderRadius: radius.lg },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.surfaceTertiary, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandSecondary, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.onSurface, fontSize: font.sizes.base, lineHeight: 21 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, color: colors.onSurface, fontSize: font.sizes.base, paddingHorizontal: spacing.md, paddingVertical: spacing.md, maxHeight: 120 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
});
