import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { c, spacing, font, radius } from '@/src/theme';
import { Loader, EmptyState, Divider } from '@/src/components/ui';
import { api } from '@/src/api';

export default function Community() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try { setPosts(await api.posts()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }
  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    try { await api.createPost({ content: text.trim() }); setText(''); await load(); }
    finally { setPosting(false); }
  }
  async function like(id: string) {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
    try { await api.likePost(id); } catch {}
  }

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} testID="community-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Community</Text>
        </View>
        <View style={styles.composer} testID="community-composer">
          <TextInput
            testID="community-post-input"
            value={text}
            onChangeText={setText}
            placeholder="Share a match, an insight, a moment"
            placeholderTextColor={c.textFaint}
            style={styles.composerInput}
            multiline
          />
          <Pressable
            testID="community-post-btn"
            onPress={post}
            disabled={posting || !text.trim()}
            style={[styles.postBtn, (!text.trim() || posting) && { opacity: 0.4 }]}
          >
            <Text style={styles.postBtnText}>{posting ? '…' : 'Post'}</Text>
          </Pressable>
        </View>
        {loading ? (
          <Loader />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(p) => p.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textFaint} />}
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
            ItemSeparatorComponent={() => <Divider inset={spacing.lg} />}
            ListEmptyComponent={<EmptyState title="No posts yet" subtitle="Be the first to share your game." icon="chatbubble-outline" testID="community-empty" />}
            renderItem={({ item }) => (
              <View style={styles.postCard} testID={`community-post-${item.id}`}>
                <View style={styles.postHeader}>
                  <Image source={{ uri: item.author?.avatar }} style={styles.pAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pName}>{item.author?.name}</Text>
                    <Text style={styles.pTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
                <Text style={styles.pContent}>{item.content}</Text>
                {item.image ? <Image source={{ uri: item.image }} style={styles.pImage} contentFit="cover" /> : null}
                <View style={styles.pActions}>
                  <Pressable onPress={() => like(item.id)} testID={`community-like-${item.id}`} style={styles.action} hitSlop={8}>
                    <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={20} color={item.liked ? c.danger : c.textSecondary} />
                    <Text style={[styles.actionText, item.liked && { color: c.text }]}>{item.likes}</Text>
                  </Pressable>
                  <View style={styles.action}>
                    <Ionicons name="chatbubble-outline" size={19} color={c.textSecondary} />
                    <Text style={styles.actionText}>{item.comments_count || 0}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { color: c.text, fontSize: font.sizes.xxxl, fontWeight: font.weights.heavy, letterSpacing: -0.5 },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
  },
  composerInput: { flex: 1, color: c.text, fontSize: font.sizes.base, maxHeight: 100, minHeight: 40 },
  postBtn: { backgroundColor: c.accent, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill },
  postBtnText: { color: c.onAccent, fontWeight: font.weights.bold, fontSize: font.sizes.sm },
  postCard: { padding: spacing.lg, gap: spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgElevated },
  pName: { color: c.text, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
  pTime: { color: c.textMuted, fontSize: font.sizes.xs, marginTop: 2 },
  pContent: { color: c.text, fontSize: font.sizes.base, lineHeight: 22 },
  pImage: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: c.bgElevated },
  pActions: { flexDirection: 'row', gap: spacing.xl, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: c.textSecondary, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
});
