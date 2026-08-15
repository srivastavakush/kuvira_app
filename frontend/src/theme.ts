// Kuvira Sports — design tokens (mirrors /app/design_guidelines.json)
export const colors = {
  surface: '#0A0A0A',
  onSurface: '#FFFFFF',
  surfaceSecondary: '#141414',
  onSurfaceSecondary: '#A1A1A1',
  surfaceTertiary: '#1E1E1E',
  onSurfaceTertiary: '#CCCCCC',
  surfaceInverse: '#FFFFFF',
  onSurfaceInverse: '#0A0A0A',
  brand: '#D4AF37',
  brandPrimary: '#D4AF37',
  onBrandPrimary: '#0A0A0A',
  brandSecondary: '#B08D28',
  brandTertiary: '#332A0D',
  onBrandTertiary: '#D4AF37',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  border: '#212121',
  borderStrong: '#3A3A3A',
  divider: '#1A1A1A',
  onSurfaceMuted: '#8A8A8A',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
};

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export const font = {
  displayFamily: 'System',
  textFamily: 'System',
  sizes: { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32, hero: 40 },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
};

export const HERO_IMAGES = {
  home: 'https://images.unsplash.com/photo-1618551763300-dc7eb8ce3560?w=1200&q=80',
  discover: 'https://images.unsplash.com/photo-1737476997205-b3336182f215?w=1200&q=80',
  play: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&q=80',
  coach: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=1200&q=80',
};
