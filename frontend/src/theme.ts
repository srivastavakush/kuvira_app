// MatchDrome design tokens: Delhi street-sport energy on a clean white base.
const palette = {
  paper: '#F8FAFC', surface: '#FFFFFF', raised: '#EEF2F6', line: '#DFE5EC', lineStrong: '#181818',
  ink: '#081C2B', inkSoft: '#475569', inkMute: '#596779', inkFaint: '#64748B',
  pink: '#D60068', pinkDark: '#D80065', lime: '#D8FF27', yellow: '#FFD928', blue: '#63D8FF', purple: '#B79AFF',
  green: '#147A47', amber: '#906000', red: '#E92B48', info: '#1976D2',
};

export const c = {
  bg: palette.paper, bgElevated: palette.surface, bgRaised: palette.raised,
  text: palette.ink, textSecondary: palette.inkSoft, textMuted: palette.inkMute, textFaint: palette.inkFaint, textInverse: palette.paper,
  border: palette.line, borderStrong: palette.lineStrong, borderFocus: palette.pink, divider: palette.line,
  accent: palette.pink, accentDim: palette.pinkDark, accentDark: '#A9004E', accentSoft: '#FFE1EF', onAccent: '#FFFFFF',
  success: palette.green, warning: palette.amber, danger: palette.red, info: palette.info, positive: palette.green, negative: palette.red,
  lime: palette.lime, yellow: palette.yellow, blue: palette.blue, purple: palette.purple,
};

export const colors = {
  ...c, surface: c.bg, onSurface: c.text, surfaceSecondary: c.bgElevated, onSurfaceSecondary: c.textSecondary,
  surfaceTertiary: c.bgRaised, onSurfaceTertiary: c.textSecondary, surfaceInverse: c.text, onSurfaceInverse: c.textInverse,
  onSurfaceMuted: c.textMuted, brand: c.accent, brandPrimary: c.accent, brandSecondary: c.accentDim,
  brandTertiary: c.accentSoft, onBrandPrimary: c.onAccent, onBrandTertiary: c.accent, error: c.danger,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { xs: 6, sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const font = {
  displayFamily: 'System', textFamily: 'System',
  sizes: { xs: 11, sm: 13, base: 15, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 30, hero: 36 },
  weights: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const, heavy: '800' as const, black: '900' as const },
  lineHeights: { tight: 1.1, snug: 1.25, normal: 1.4, relaxed: 1.55 },
};
export const elevation = {
  none: { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  low: { shadowColor: '#20180E', shadowOpacity: 0.09, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  med: { shadowColor: '#20180E', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
};
