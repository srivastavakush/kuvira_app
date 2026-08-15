// Shared premium components for Kuvira.
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { colors, spacing, radius, font } from '@/src/theme';

// ----- Button -----
type BtnProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
};
export function Button({ label, onPress, variant = 'primary', disabled, loading, testID, icon, style, fullWidth = true }: BtnProps) {
  const bg = variant === 'primary' ? colors.brandPrimary : variant === 'secondary' ? colors.surfaceTertiary : 'transparent';
  const fg = variant === 'primary' ? colors.onBrandPrimary : colors.onSurface;
  const border = variant === 'ghost' ? colors.borderStrong : 'transparent';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'ghost' ? 1 : 0, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ----- Chip Row (horizontal scroller, spec-compliant) -----
export function ChipRow({ items, active, onChange, testIDPrefix = 'chip' }: { items: { key: string; label: string }[]; active: string; onChange: (k: string) => void; testIDPrefix?: string }) {
  return (
    <View style={styles.chipRowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent}>
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <Pressable
              key={it.key}
              testID={`${testIDPrefix}-${it.key}`}
              onPress={() => onChange(it.key)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>{it.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ----- Hero image with scrim -----
export function HeroImage({ uri, height = 260, children }: { uri: string; height?: number; children?: React.ReactNode }) {
  return (
    <View style={{ height, backgroundColor: colors.surfaceSecondary, position: 'relative' }}>
      <Image source={{ uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={300} />
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.4)', 'rgba(10,10,10,0.95)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg }}>
        {children}
      </View>
    </View>
  );
}

// ----- Card container -----
export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; testID?: string }) {
  const Comp: any = onPress ? Pressable : View;
  return <Comp testID={testID} onPress={onPress} style={[styles.card, style]}>{children}</Comp>;
}

// ----- Section header -----
export function SectionHeader({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View style={styles.sectionHeader} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} testID={`${testID}-action`}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ----- Match Score Badge -----
export function MatchScoreBadge({ score, testID }: { score: number; testID?: string }) {
  return (
    <View style={styles.matchBadge} testID={testID}>
      <Text style={styles.matchBadgeText}>{score}%</Text>
    </View>
  );
}

// ----- Empty / Error state -----
export function EmptyState({ title, subtitle, cta, onCta, testID }: { title: string; subtitle?: string; cta?: string; onCta?: () => void; testID?: string }) {
  return (
    <View style={styles.emptyWrap} testID={testID}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      {cta ? <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}><Button label={cta} onPress={onCta} testID={`${testID}-cta`} /></View> : null}
    </View>
  );
}

// ----- Loader -----
export function Loader({ testID }: { testID?: string }) {
  return (
    <View style={styles.loaderWrap} testID={testID}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

// ----- Text styles -----
export const typo = {
  display: { fontFamily: font.displayFamily, fontSize: font.sizes.xxxl, fontWeight: font.weights.black, color: colors.onSurface, letterSpacing: -0.5 } as TextStyle,
  h1: { fontSize: font.sizes.xxl, fontWeight: font.weights.bold, color: colors.onSurface } as TextStyle,
  h2: { fontSize: font.sizes.xl, fontWeight: font.weights.bold, color: colors.onSurface } as TextStyle,
  body: { fontSize: font.sizes.base, color: colors.onSurfaceSecondary } as TextStyle,
  label: { fontSize: font.sizes.sm, color: colors.onSurfaceMuted, textTransform: 'uppercase' as const, letterSpacing: 0.6, fontWeight: font.weights.semibold } as TextStyle,
  metric: { fontFamily: font.displayFamily, fontSize: font.sizes.xxl, fontWeight: font.weights.black, color: colors.onSurface } as TextStyle,
};

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  btnLabel: {
    fontSize: font.sizes.lg,
    fontWeight: font.weights.bold,
    letterSpacing: 0.3,
  },
  chipRowWrap: { height: 56, justifyContent: 'center' },
  chipRowContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  chip: {
    height: 36,
    flexShrink: 0,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  chipActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
  },
  chipText: { color: colors.onSurfaceSecondary, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  chipTextActive: { color: colors.brandPrimary, fontWeight: font.weights.bold },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.onSurface, fontSize: font.sizes.xl, fontWeight: font.weights.bold },
  sectionAction: { color: colors.brandPrimary, fontSize: font.sizes.base, fontWeight: font.weights.semibold },
  matchBadge: {
    minWidth: 52, height: 52, paddingHorizontal: 6,
    borderRadius: 26,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1, borderColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  matchBadgeText: { color: colors.brandPrimary, fontWeight: font.weights.black, fontSize: font.sizes.base },
  emptyWrap: { padding: spacing.xxl, alignItems: 'center' },
  emptyTitle: { color: colors.onSurface, fontSize: font.sizes.lg, fontWeight: font.weights.bold, textAlign: 'center' },
  emptySubtitle: { color: colors.onSurfaceMuted, fontSize: font.sizes.base, marginTop: spacing.sm, textAlign: 'center' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
});
