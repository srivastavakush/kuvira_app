// Kuvira design tokens.
// Philosophy: dark + gold, but gold is used sparingly as an accent, not decoration.
// Naming: semantic tokens are the source of truth; legacy names remain as aliases
// so existing screens keep working while we migrate.

// -------------------------------------------------------------------------
// Palette
// -------------------------------------------------------------------------
const palette = {
  ink0: '#0A0A0B',      // background
  ink1: '#101013',      // elevated surface
  ink2: '#17171B',      // raised surface (pressed / focus)
  ink3: '#1F1F24',      // subtle divider / border
  ink4: '#2A2A30',      // stronger border
  ink5: '#3A3A42',      // input outline focus

  fg0: '#F5F5F6',       // primary text
  fg1: '#C6C6CA',       // secondary text
  fg2: '#8C8C93',       // muted text
  fg3: '#5E5E66',       // faint text

  gold: '#D4AF37',
  goldDim: '#B08D28',
  goldDark: '#7A6520',
  goldSoft: '#221C09',  // very low-saturation tint, used sparingly

  green: '#3FB950',
  amber: '#E3B341',
  red: '#F85149',
  blue: '#58A6FF',
};

// -------------------------------------------------------------------------
// Semantic tokens (preferred)
// -------------------------------------------------------------------------
export const c = {
  // Backgrounds
  bg: palette.ink0,
  bgElevated: palette.ink1,
  bgRaised: palette.ink2,

  // Text
  text: palette.fg0,
  textSecondary: palette.fg1,
  textMuted: palette.fg2,
  textFaint: palette.fg3,
  textInverse: palette.ink0,

  // Borders
  border: palette.ink3,
  borderStrong: palette.ink4,
  borderFocus: palette.ink5,
  divider: palette.ink3,

  // Accent
  accent: palette.gold,
  accentDim: palette.goldDim,
  accentDark: palette.goldDark,
  accentSoft: palette.goldSoft,
  onAccent: palette.ink0,

  // Semantic states
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  info: palette.blue,
  positive: palette.green,
  negative: palette.red,
};

// -------------------------------------------------------------------------
// Legacy aliases (do not add new usages — prefer `c.*`)
// -------------------------------------------------------------------------
export const colors = {
  ...c,
  // legacy names still referenced by existing screens
  surface: c.bg,
  onSurface: c.text,
  surfaceSecondary: c.bgElevated,
  onSurfaceSecondary: c.textSecondary,
  surfaceTertiary: c.bgRaised,
  onSurfaceTertiary: c.textSecondary,
  surfaceInverse: c.text,
  onSurfaceInverse: c.textInverse,
  onSurfaceMuted: c.textMuted,
  brand: c.accent,
  brandPrimary: c.accent,
  brandSecondary: c.accentDim,
  brandTertiary: c.accentSoft,
  onBrandPrimary: c.onAccent,
  onBrandTertiary: c.accent,
  error: c.danger,
};

// -------------------------------------------------------------------------
// Spacing (4pt grid, aligned with 44px touch targets)
// -------------------------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// -------------------------------------------------------------------------
// Radii
// -------------------------------------------------------------------------
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// -------------------------------------------------------------------------
// Typography
// -------------------------------------------------------------------------
export const font = {
  displayFamily: 'System',
  textFamily: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    hero: 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
  // curated composable text styles
  lineHeights: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.4,
    relaxed: 1.55,
  },
};

// -------------------------------------------------------------------------
// Elevation (soft, iOS-first; Android uses elevation)
// -------------------------------------------------------------------------
export const elevation = {
  none: { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  low: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  med: {
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
};

// -------------------------------------------------------------------------
// Hero imagery — preserved
// -------------------------------------------------------------------------
export const HERO_IMAGES = {
  home: 'https://images.unsplash.com/photo-1618551763300-dc7eb8ce3560?w=1200&q=80',
  discover: 'https://images.unsplash.com/photo-1737476997205-b3336182f215?w=1200&q=80',
  play: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&q=80',
  coach: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=1200&q=80',
};
