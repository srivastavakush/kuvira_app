import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { c } from '@/src/theme';
import { useSession } from '@/src/session';
import { requireAuth, trackAuthOrigin } from '@/src/auth-gate';
const TABS = [
  { label: 'Home', path: '/(tabs)/home', icon: 'home-outline', active: 'home' },
  { label: 'Explore', path: '/(tabs)/discover', icon: 'search-outline', active: 'search' },
  { label: 'Create / Play', path: '/create-game', icon: 'add', active: 'add' },
  { label: 'Chat', path: '/(tabs)/community', icon: 'chatbubbles-outline', active: 'chatbubbles' },
  { label: 'Activity', path: '/(tabs)/activity', icon: 'pulse-outline', active: 'pulse' },
] as const;
export function GlobalBottomNav() {
  const router = useRouter(); const path = usePathname(); const { bottom } = useSafeAreaInsets(); const { user } = useSession();
  useEffect(() => { trackAuthOrigin(path); }, [path]);
  if (['/', '/index', '/login', '/otp', '/onboarding'].includes(path) || path.includes('(auth)')) return null;
  return <View style={[s.wrapper, { paddingBottom: bottom }]}><View accessibilityRole="tablist" style={s.bar}>{TABS.map((tab, i) => {
    const selected = path === tab.path.replace('/(tabs)', '') || (i === 1 && /facility|product|marketplace/.test(path));
    return <Pressable key={tab.label} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} onPress={() => { if ((i === 2 || i === 3) && !requireAuth(user, router, tab.path)) return; router.push(tab.path as any); }} style={s.tab} testID={`nav-tab-${i}`}><View style={i === 2 ? s.plus : undefined}><Ionicons name={selected ? tab.active : tab.icon} size={i === 2 ? 28 : 23} color={i === 2 ? c.text : selected ? c.accent : c.textMuted} /></View><Text style={[s.label, selected && { color: c.accent }]}>{tab.label}</Text></Pressable>;
  })}</View></View>;
}
const s = StyleSheet.create({ wrapper: { backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, bar: { width: '100%', maxWidth: 900, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingHorizontal: 4 }, tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }, label: { fontSize: 11, fontWeight: '700', color: c.textMuted }, plus: { width: 42, height: 34, borderRadius: 13, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' } });
