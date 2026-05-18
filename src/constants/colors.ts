// ─────────────────────────────────────────────────────────────
// CrisisAI — Color Palette & Severity Theme
// ─────────────────────────────────────────────────────────────

/** Severity-based color system */
export const SEVERITY_COLORS = {
  critical: {
    primary: '#FF1744',   // Vivid red
    light: '#FF616F',
    dark: '#C4001D',
    bg: 'rgba(255, 23, 68, 0.12)',
  },
  high: {
    primary: '#FF6D00',   // Deep orange
    light: '#FF9E40',
    dark: '#C43E00',
    bg: 'rgba(255, 109, 0, 0.12)',
  },
  medium: {
    primary: '#FFD600',   // Amber
    light: '#FFFF52',
    dark: '#C7A500',
    bg: 'rgba(255, 214, 0, 0.12)',
  },
  low: {
    primary: '#00E676',   // Green
    light: '#66FFA6',
    dark: '#00B248',
    bg: 'rgba(0, 230, 118, 0.12)',
  },
  info: {
    primary: '#448AFF',   // Blue accent
    light: '#83B9FF',
    dark: '#005ECB',
    bg: 'rgba(68, 138, 255, 0.12)',
  },
} as const;

/** Core app colors — dark theme */
export const COLORS = {
  // Backgrounds
  background: '#0D0D0D',
  surface: '#1A1A2E',
  surfaceElevated: '#222240',
  card: '#16213E',

  // Text
  textPrimary: '#EAEAEA',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  // Accents
  accent: '#00E5FF',
  accentAlt: '#7C4DFF',
  success: '#00E676',
  warning: '#FFD600',
  danger: '#FF1744',

  // Borders / dividers
  border: 'rgba(255, 255, 255, 0.08)',
  divider: 'rgba(255, 255, 255, 0.05)',

  // Tab bar
  tabActive: '#00E5FF',
  tabInactive: '#6B7280',
  tabBarBg: '#0D0D0D',

  // Map
  mapOverlay: 'rgba(13, 13, 13, 0.65)',
} as const;

/** Typography sizes */
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  hero: 36,
} as const;

/** Spacing scale (multiples of 4) */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Border radii */
export const RADII = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
