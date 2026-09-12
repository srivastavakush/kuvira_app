import React from 'react';
import { View, Text } from 'react-native';
import { c } from '@/src/theme';

/** Code-native mark shared by consumer, authentication and club workspaces. */
export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return <View accessible accessibilityLabel="MatchDrome" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
    <View style={{ width: 32, height: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: c.lime, borderRadius: 10, transform: [{ rotate: '-6deg' }] }}>
      <Text style={{ color: c.text, fontSize: 25, fontWeight: '900', fontStyle: 'italic', letterSpacing: -4, paddingRight: 4 }}>M</Text>
    </View>
    {!compact && <Text numberOfLines={1} style={{ color: inverse ? '#FFFFFF' : c.text, fontSize: 24, fontWeight: '900', letterSpacing: -1.2, flexShrink: 1 }}>MatchDrome</Text>}
  </View>;
}
