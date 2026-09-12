import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c, font } from '@/src/theme';

export function GlobalBottomNav() {
  const router = useRouter();
  const pathname = usePathname() || '';

  // Hide on auth, onboarding, and splash routes
  if (
    pathname === '/' ||
    pathname === '/index' ||
    pathname.includes('(auth)') ||
    pathname.includes('/auth') ||
    pathname.includes('/onboarding')
  ) {
    return null;
  }

  const isHome = pathname.includes('/home') || pathname === '/(tabs)';
  const isDiscover =
    pathname.includes('/discover') ||
    pathname.includes('/facility') ||
    pathname.includes('/marketplace') ||
    pathname.includes('/product');
  const isPlay =
    pathname.includes('/play') ||
    pathname.includes('/game') ||
    pathname.includes('/create-game') ||
    pathname.includes('/booking');
  const isCommunity = pathname.includes('/community');
  const isProfile =
    pathname.includes('/profile') ||
    pathname.includes('/admin') ||
    pathname.includes('/club') ||
    pathname.includes('/refer') ||
    pathname.includes('/training') ||
    pathname.includes('/rankings') ||
    pathname.includes('/cart');

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Pressable
          style={styles.tab}
          onPress={() => router.push('/(tabs)/home')}
          testID="nav-tab-home"
        >
          <Ionicons
            name={isHome ? 'home' : 'home-outline'}
            size={22}
            color={isHome ? c.text : c.textFaint}
          />
          <Text style={[styles.label, isHome && styles.labelActive]}>Home</Text>
        </Pressable>

        <Pressable
          style={styles.tab}
          onPress={() => router.push('/(tabs)/discover')}
          testID="nav-tab-discover"
        >
          <Ionicons
            name={isDiscover ? 'search' : 'search-outline'}
            size={22}
            color={isDiscover ? c.text : c.textFaint}
          />
          <Text style={[styles.label, isDiscover && styles.labelActive]}>Explore</Text>
        </Pressable>

        <Pressable
          style={styles.playTab}
          onPress={() => router.push('/(tabs)/play')}
          testID="nav-tab-play"
        >
          <View style={styles.playBubble}><Ionicons name="add" size={35} color={c.onAccent} /></View>
        </Pressable>

        <Pressable
          style={styles.tab}
          onPress={() => router.push('/(tabs)/community')}
          testID="nav-tab-community"
        >
          <Ionicons
            name={isCommunity ? 'people' : 'people-outline'}
            size={22}
            color={isCommunity ? c.text : c.textFaint}
          />
          <Text style={[styles.label, isCommunity && styles.labelActive]}>Chat</Text>
        </Pressable>

        <Pressable
          style={styles.tab}
          onPress={() => router.push('/(tabs)/profile')}
          testID="nav-tab-profile"
        >
          <Ionicons
            name={isProfile ? 'person' : 'person-outline'}
            size={22}
            color={isProfile ? c.text : c.textFaint}
          />
          <Text style={[styles.label, isProfile && styles.labelActive]}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: c.bgElevated,
    borderTopColor: c.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 70,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  playTab: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  playBubble: { width: 60, height: 60, borderRadius: 30, backgroundColor: c.accent, borderWidth: 4, borderColor: c.bgElevated, marginTop: -24, alignItems: 'center', justifyContent: 'center', shadowColor: c.accent, shadowOpacity: .25, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  label: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: font.weights.semibold,
    letterSpacing: 0.2,
    marginTop: 3,
  },
  labelActive: {
    color: c.accent,
  },
});
