import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '@/src/theme';
import { Loader, EmptyState } from '@/src/components/ui';
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
    <SafeAreaView style={styles.wrap} testID="community-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Community</Text>
        </View>
        <View style={styles.composer} testID="community-composer">
          <TextInput
            testID="community-post-input"
            value={text}
            onChangeText={setText}
            placeholder="Share a match, an insight, a moment…"
            placeholderTextColor={colors.onSurfaceMuted}
            style={styles.composerInput}
            multiline
          />
          <Pressable testID="community-post-btn" onPress={post} disabled={posting || !text.trim()} style={[styles.postBtn, (!text.trim() || posting) && { opacity: 0.5 }]}>
            <Text style={styles.postBtnText}>{posting ? '…' : 'Post'}</Text>
          </Pressable>
        </View>
        {loading ? <Loader /> : (
          <FlatList
            data={posts}
            keyExtractor={(p) => p.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
            ListEmptyComponent={<EmptyState title="No posts yet" subtitle="Be the first to share your game." testID="community-empty" />}
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
                  <Pressable onPress={() => like(item.id)} testID={`community-like-${item.id}`} style={styles.action}>
                    <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={20} color={item.liked ? colors.brandPrimary : colors.onSurfaceSecondary} />
                    <Text style={[styles.actionText, item.liked && { color: colors.brandPrimary }]}>{item.likes}</Text>
                  </Pressable>
                  <View style={styles.action}>
                    <Ionicons name="chatbubble-outline" size={20} color={colors.onSurfaceSecondary} />
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
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { color: colors.onSurface, fontSize: font.sizes.xxxl, fontWeight: '900' },
  composer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', padding: spacing.md, marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  composerInput: { flex: 1, color: colors.onSurface, fontSize: font.sizes.base, maxHeight: 100, minHeight: 40 },
  postBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  postBtnText: { color: colors.onBrandPrimary, fontWeight: '800' },
  postCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  pAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary },
  pName: { color: colors.onSurface, fontSize: font.sizes.base, fontWeight: '700' },
  pTime: { color: colors.onSurfaceMuted, fontSize: font.sizes.xs, marginTop: 2 },
  pContent: { color: colors.onSurface, fontSize: font.sizes.base, lineHeight: 20, marginBottom: spacing.sm },
  pImage: { width: '100%', height: 200, borderRadius: radius.md, marginBottom: spacing.sm },
  pActions: { flexDirection: 'row', gap: spacing.lg, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: colors.onSurfaceSecondary, fontSize: font.sizes.sm, fontWeight: '600' },
});
