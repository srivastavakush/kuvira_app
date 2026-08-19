// Kuvira — shared UI primitives.
// Design principles:
//   • gold is an accent, not decoration
//   • quiet surfaces, clear hierarchy, generous spacing
//   • consistent 44pt+ touch targets, sensible defaults
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
  TextStyle,
  TextInput,
  TextInputProps,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, c, spacing, radius, font } from '@/src/theme';

// =========================================================================
// Text
// =========================================================================
export const typo = {
  hero: {
    fontSize: font.sizes.hero,
    fontWeight: font.weights.heavy,
    color: c.text,
    letterSpacing: -0.5,
    lineHeight: font.sizes.hero * 1.1,
  } as TextStyle,
  title: {
    fontSize: font.sizes.xxl,
    fontWeight: font.weights.heavy,
    color: c.text,
    letterSpacing: -0.2,
  } as TextStyle,
  h1: {
    fontSize: font.sizes.xxl,
    fontWeight: font.weights.bold,
    color: c.text,
    letterSpacing: -0.2,
  } as TextStyle,
  h2: {
    fontSize: font.sizes.xl,
    fontWeight: font.weights.bold,
    color: c.text,
  } as TextStyle,
  h3: {
    fontSize: font.sizes.lg,
    fontWeight: font.weights.semibold,
    color: c.text,
  } as TextStyle,
  body: {
    fontSize: font.sizes.base,
    color: c.text,
    lineHeight: font.sizes.base * 1.5,
  } as TextStyle,
  bodySecondary: {
    fontSize: font.sizes.base,
    color: c.textSecondary,
    lineHeight: font.sizes.base * 1.5,
  } as TextStyle,
  caption: {
    fontSize: font.sizes.sm,
    color: c.textMuted,
  } as TextStyle,
  eyebrow: {
    fontSize: font.sizes.xs,
    color: c.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.4,
    fontWeight: font.weights.semibold,
  } as TextStyle,
  metric: {
    fontSize: font.sizes.xxxl,
    fontWeight: font.weights.heavy,
    color: c.text,
    letterSpacing: -0.5,
  } as TextStyle,
};

// =========================================================================
// Screen header — standard back / title / optional action
// =========================================================================
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  compact,
  testID,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  compact?: boolean;
  testID?: string;
}) {
  return (
    <View
      style={[headerStyles.wrap, compact && { paddingVertical: spacing.sm }]}
      testID={testID}
    >
      {onBack ? (
        <Pressable
          testID={testID ? `${testID}-back` : 'header-back'}
          onPress={onBack}
          hitSlop={12}
          style={headerStyles.back}
        >
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? (
          <Text
            style={[typo.h3, { textAlign: 'center' }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[typo.caption, { marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: c.bg,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// =========================================================================
// Section header — title + optional right link
// =========================================================================
export function SectionHeader({
  title,
  action,
  onAction,
  style,
  testID,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View style={[sectionStyles.wrap, style]} testID={testID}>
      <Text style={sectionStyles.title}>{title}</Text>
      {action ? (
        <Pressable
          onPress={onAction}
          hitSlop={12}
          testID={testID ? `${testID}-action` : undefined}
        >
          <Text style={sectionStyles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  title: {
    color: c.text,
    fontSize: font.sizes.lg,
    fontWeight: font.weights.bold,
    letterSpacing: -0.1,
  },
  action: {
    color: c.textSecondary,
    fontSize: font.sizes.sm,
    fontWeight: font.weights.semibold,
  },
});

// =========================================================================
// Button — variants + sizes
// =========================================================================
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type BtnSize = 'sm' | 'md' | 'lg';

type BtnProps = {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  testID,
  icon,
  iconRight,
  style,
  fullWidth = true,
}: BtnProps) {
  const bg =
    variant === 'primary'
      ? c.accent
      : variant === 'secondary'
      ? c.bgRaised
      : variant === 'destructive'
      ? 'transparent'
      : 'transparent';
  const fg =
    variant === 'primary'
      ? c.onAccent
      : variant === 'destructive'
      ? c.danger
      : c.text;
  const bd =
    variant === 'ghost'
      ? c.borderStrong
      : variant === 'destructive'
      ? c.danger
      : 'transparent';
  const bw = variant === 'ghost' || variant === 'destructive' ? 1 : 0;

  const heights: Record<BtnSize, number> = { sm: 40, md: 48, lg: 54 };
  const paddings: Record<BtnSize, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl };
  const fontSize = size === 'sm' ? font.sizes.sm : font.sizes.base;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        btnStyles.base,
        {
          backgroundColor: bg,
          borderColor: bd,
          borderWidth: bw,
          minHeight: heights[size],
          paddingHorizontal: paddings[size],
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={btnStyles.row}>
          {icon}
          <Text
            style={{
              color: fg,
              fontSize,
              fontWeight: font.weights.bold,
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
          {iconRight}
        </View>
      )}
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

// =========================================================================
// Icon button — 40pt circular
// =========================================================================
export function IconButton({
  icon,
  onPress,
  testID,
  size = 40,
  color,
  bg = c.bgElevated,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  testID?: string;
  size?: number;
  color?: string;
  bg?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.floor(size * 0.5)} color={color || c.text} />
    </Pressable>
  );
}

// =========================================================================
// Card — quiet surface, subtle border, optional press
// =========================================================================
export function Card({
  children,
  style,
  onPress,
  testID,
  bordered = true,
  padded = true,
  variant = 'default',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  testID?: string;
  bordered?: boolean;
  padded?: boolean;
  variant?: 'default' | 'accent';
}) {
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp
      testID={testID}
      onPress={onPress}
      style={[
        cardStyles.base,
        variant === 'accent' && cardStyles.accent,
        bordered && cardStyles.bordered,
        padded && cardStyles.padded,
        style,
      ]}
    >
      {children}
    </Comp>
  );
}

const cardStyles = StyleSheet.create({
  base: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.lg,
  },
  bordered: { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  padded: { padding: spacing.lg },
  accent: {
    backgroundColor: c.bgElevated,
    borderColor: c.accentDark,
  },
});

// =========================================================================
// List item — icon/avatar + primary text + secondary text + right adornment
// =========================================================================
export function ListItem({
  title,
  subtitle,
  leftIcon,
  leftAvatar,
  right,
  onPress,
  testID,
  chevron = true,
  style,
}: {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  leftAvatar?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  chevron?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        listStyles.wrap,
        pressed && onPress ? { backgroundColor: c.bgRaised } : null,
        style,
      ]}
    >
      {leftAvatar ? (
        <Image source={{ uri: leftAvatar }} style={listStyles.avatar} />
      ) : leftIcon ? (
        <View style={listStyles.iconWrap}>
          <Ionicons name={leftIcon} size={20} color={c.textSecondary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={listStyles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={listStyles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
      ) : null}
    </Pressable>
  );
}

const listStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.bgElevated,
  },
  title: {
    color: c.text,
    fontSize: font.sizes.base,
    fontWeight: font.weights.semibold,
  },
  subtitle: {
    color: c.textMuted,
    fontSize: font.sizes.sm,
    marginTop: 2,
  },
});

// =========================================================================
// Stat — large number over caption; three per row typical
// =========================================================================
export function Stat({
  value,
  label,
  trend,
  align = 'left',
  emphasis = 'default',
  testID,
}: {
  value: string | number;
  label: string;
  trend?: { value: string; positive?: boolean };
  align?: 'left' | 'center';
  emphasis?: 'default' | 'accent';
  testID?: string;
}) {
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }} testID={testID}>
      <Text
        style={{
          color: emphasis === 'accent' ? c.accent : c.text,
          fontSize: font.sizes.xxl,
          fontWeight: font.weights.heavy,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: c.textMuted,
          fontSize: font.sizes.xs,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: 4,
          fontWeight: font.weights.semibold,
        }}
      >
        {label}
      </Text>
      {trend ? (
        <Text
          style={{
            color: trend.positive === false ? c.negative : c.positive,
            fontSize: font.sizes.xs,
            marginTop: 4,
            fontWeight: font.weights.semibold,
          }}
        >
          {trend.positive === false ? '↓' : '↑'} {trend.value}
        </Text>
      ) : null}
    </View>
  );
}

// =========================================================================
// Badge — subtle status pill
// =========================================================================
export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  testID,
}: {
  label: string;
  variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  testID?: string;
}) {
  const map = {
    neutral: { bg: c.bgRaised, fg: c.textSecondary, bd: 'transparent' },
    accent: { bg: 'transparent', fg: c.accent, bd: c.accentDark },
    success: { bg: 'transparent', fg: c.success, bd: 'rgba(63,185,80,0.35)' },
    warning: { bg: 'transparent', fg: c.warning, bd: 'rgba(227,179,65,0.35)' },
    danger: { bg: 'transparent', fg: c.danger, bd: 'rgba(248,81,73,0.35)' },
  } as const;
  const t = map[variant];
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: t.bg,
        borderColor: t.bd,
        borderWidth: t.bd === 'transparent' ? 0 : 1,
        paddingHorizontal: size === 'sm' ? 6 : 8,
        paddingVertical: size === 'sm' ? 2 : 3,
        borderRadius: radius.sm,
      }}
    >
      <Text
        style={{
          color: t.fg,
          fontSize: size === 'sm' ? 10 : 11,
          fontWeight: font.weights.bold,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// =========================================================================
// Divider
// =========================================================================
export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.divider,
        marginLeft: inset,
      }}
    />
  );
}

// =========================================================================
// Chip row — horizontally scrollable filter chips.
// Active state is a quiet underline + strong text, not a filled pill.
// =========================================================================
export function ChipRow({
  items,
  active,
  onChange,
  testIDPrefix = 'chip',
  style,
}: {
  items: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
  testIDPrefix?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[chipStyles.wrap, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={chipStyles.content}
      >
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <Pressable
              key={it.key}
              testID={`${testIDPrefix}-${it.key}`}
              onPress={() => onChange(it.key)}
              style={[chipStyles.chip, isActive && chipStyles.chipActive]}
            >
              <Text
                style={[chipStyles.text, isActive && chipStyles.textActive]}
                numberOfLines={1}
              >
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: { height: 48, justifyContent: 'center' },
  content: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  chip: {
    height: 34,
    flexShrink: 0,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: c.bgElevated,
  },
  text: {
    color: c.textMuted,
    fontSize: font.sizes.sm,
    fontWeight: font.weights.semibold,
  },
  textActive: { color: c.text },
});

// =========================================================================
// Segmented control — 2-3 options
// =========================================================================
export function Segmented({
  items,
  active,
  onChange,
  testIDPrefix = 'seg',
}: {
  items: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={segStyles.wrap}>
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <Pressable
            key={it.key}
            testID={`${testIDPrefix}-${it.key}`}
            onPress={() => onChange(it.key)}
            style={[segStyles.item, isActive && segStyles.itemActive]}
          >
            <Text style={[segStyles.text, isActive && segStyles.textActive]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    padding: 4,
  },
  item: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: c.bgRaised,
  },
  text: { color: c.textMuted, fontSize: font.sizes.sm, fontWeight: font.weights.semibold },
  textActive: { color: c.text },
});

// =========================================================================
// Input field — label + optional error + consistent focus behavior
// =========================================================================
export const InputField = React.forwardRef<
  TextInput,
  TextInputProps & {
    label?: string;
    error?: string | null;
    hint?: string;
    right?: React.ReactNode;
    containerStyle?: ViewStyle;
  }
>(function InputField(
  { label, error, hint, right, containerStyle, style, ...rest },
  ref
) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <Text style={inputStyles.label}>{label}</Text> : null}
      <View
        style={[
          inputStyles.wrap,
          focused && inputStyles.wrapFocused,
          !!error && inputStyles.wrapError,
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={c.textFaint}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[inputStyles.input, style]}
        />
        {right}
      </View>
      {error ? (
        <Text style={inputStyles.error}>{error}</Text>
      ) : hint ? (
        <Text style={inputStyles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const inputStyles = StyleSheet.create({
  label: {
    color: c.textMuted,
    fontSize: font.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: font.weights.semibold,
    marginBottom: 6,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 48,
  },
  wrapFocused: { borderColor: c.borderFocus },
  wrapError: { borderColor: c.danger },
  input: {
    flex: 1,
    color: c.text,
    fontSize: font.sizes.base,
    paddingVertical: spacing.md,
  },
  error: { color: c.danger, fontSize: font.sizes.sm, marginTop: 6 },
  hint: { color: c.textMuted, fontSize: font.sizes.sm, marginTop: 6 },
});

// =========================================================================
// Empty state
// =========================================================================
export function EmptyState({
  title,
  subtitle,
  cta,
  onCta,
  icon,
  testID,
}: {
  title: string;
  subtitle?: string;
  cta?: string;
  onCta?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  return (
    <View style={emptyStyles.wrap} testID={testID}>
      {icon ? (
        <View style={emptyStyles.iconWrap}>
          <Ionicons name={icon} size={24} color={c.textMuted} />
        </View>
      ) : null}
      <Text style={emptyStyles.title}>{title}</Text>
      {subtitle ? <Text style={emptyStyles.subtitle}>{subtitle}</Text> : null}
      {cta ? (
        <View style={{ marginTop: spacing.lg, alignSelf: 'stretch', maxWidth: 320 }}>
          <Button
            label={cta}
            onPress={onCta}
            variant="secondary"
            size="md"
            testID={testID ? `${testID}-cta` : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: c.text,
    fontSize: font.sizes.lg,
    fontWeight: font.weights.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: c.textMuted,
    fontSize: font.sizes.base,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: font.sizes.base * 1.5,
    maxWidth: 320,
  },
});

// =========================================================================
// Loader
// =========================================================================
export function Loader({ testID }: { testID?: string }) {
  return (
    <View style={loaderStyles.wrap} testID={testID}>
      <ActivityIndicator size="small" color={c.textSecondary} />
    </View>
  );
}

const loaderStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
});

// =========================================================================
// Skeleton — for content placeholders
// =========================================================================
export function Skeleton({
  width = '100%' as number | string,
  height = 16,
  radius: r = radius.sm,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius: r,
          backgroundColor: c.bgElevated,
          opacity: 0.7,
        },
        style,
      ]}
    />
  );
}

// =========================================================================
// Match score — quiet pill instead of huge gold disc
// =========================================================================
export function MatchScoreBadge({
  score,
  testID,
}: {
  score: number;
  testID?: string;
}) {
  return (
    <View style={matchStyles.wrap} testID={testID}>
      <Text style={matchStyles.value}>{score}</Text>
      <Text style={matchStyles.suffix}>%</Text>
    </View>
  );
}

const matchStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: c.bgRaised,
    gap: 1,
  },
  value: {
    color: c.text,
    fontWeight: font.weights.heavy,
    fontSize: font.sizes.base,
  },
  suffix: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: font.weights.bold,
  },
});

// =========================================================================
// Confirmation illustration — used by booking/coach/cart success screens
// =========================================================================
export function SuccessMark({ size = 72 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: c.success,
      }}
    >
      <Ionicons name="checkmark" size={Math.floor(size * 0.5)} color={c.success} />
    </View>
  );
}

// =========================================================================
// Hero image with scrim (kept for detail screens that need it)
// =========================================================================
export function HeroImage({
  uri,
  height = 260,
  children,
}: {
  uri: string;
  height?: number;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ height, backgroundColor: c.bgElevated, position: 'relative' }}>
      <Image
        source={{ uri }}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={['transparent', 'rgba(10,10,11,0.35)', 'rgba(10,10,11,0.95)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing.lg,
        }}
      >
        {children}
      </View>
    </View>
  );
}

// re-export theme colors for convenience in migrated screens
export { colors, c };
