import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { c, radius, spacing } from '@/src/theme';
import { Button } from './ui';
import { friendlyError } from '@/src/errors';
export function ErrorBanner({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.banner}>
    <Text style={s.text}>{friendlyError(error)}</Text>
    {retry && <Button label="Try again" size="sm" variant="secondary" onPress={retry} fullWidth={false} />}
  </View>;
}
export function SkeletonCards() {
  return <View accessible accessibilityLabel="Loading content" accessibilityState={{ busy: true }} style={{ padding: spacing.lg, gap: 16 }}>
    {[0, 1, 2].map(i => <View key={i} style={{ backgroundColor: c.bgElevated, borderRadius: radius.lg, padding: 16, gap: 12 }}><View style={{ height: 112, backgroundColor: c.bgRaised, borderRadius: radius.md }} /><View style={{ height: 18, width: '65%', backgroundColor: c.border, borderRadius: 6 }} /><View style={{ height: 14, width: '40%', backgroundColor: c.bgRaised, borderRadius: 6 }} /></View>)}
  </View>;
}
const s = StyleSheet.create({ banner: { margin: 16, padding: 16, borderRadius: radius.md, backgroundColor: '#FFF0F4', borderWidth: 1, borderColor: '#F5C4D5', gap: 12 }, text: { color: c.text, fontSize: 14, lineHeight: 21 } });
