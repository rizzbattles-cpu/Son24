/**
 * Newspaper theme — evokes an aged Turkish gazette:
 * near-black ink on aged cream/yellow paper.
 */

import { Platform } from 'react-native';

export const CardPalette = {
  bg: '#f0dfae',
  bgAlt: '#e6d29b',
  text: '#1a1509',
  textMuted: '#5a4d30',
  textDim: '#7a6a45',
  kicker: '#8b2b1f',
  border: '#2a2216',
  rule: '#3a3122',
  ruleFaint: '#a89463',
} as const;

export const NewsprintColors = {
  ink: '#0a0906',
  inkSoft: '#141210',
  inkRule: '#1e1a12',
  paper: '#e8d5a2',
  paperBright: '#f0dfae',
  paperMuted: '#b8a373',
  paperDim: '#8a7a55',
  rule: '#6b5a3a',
  ruleFaint: '#3a3122',
  accent: '#8b2b1f',
  accentSoft: '#c24a3a',
} as const;

// TASARIM 2 — dark home screen with gold accents.
export const Gold = {
  bg: '#0a0a0a',
  surface: '#141310',
  surface2: '#1c1a15',
  gold: '#d9b44a',
  goldSoft: '#c9a94a',
  goldDim: '#8a7635',
  text: '#f3ede0',
  textMuted: '#9a9384',
  textDim: '#6a655a',
  line: '#26241d',
} as const;

// Kept for template compatibility.
export const Colors = {
  light: {
    text: NewsprintColors.ink,
    background: NewsprintColors.paper,
    backgroundElement: NewsprintColors.paperMuted,
    backgroundSelected: NewsprintColors.paperBright,
    textSecondary: NewsprintColors.paperDim,
  },
  dark: {
    text: NewsprintColors.paper,
    background: NewsprintColors.ink,
    backgroundElement: NewsprintColors.inkSoft,
    backgroundSelected: NewsprintColors.inkRule,
    textSecondary: NewsprintColors.paperDim,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// App chrome (masthead, category bar, section heads, dot bar, menu) uses Rubik.
export const Fonts = {
  serifDisplay: 'Rubik_800ExtraBold', // big titles, masthead, drop cap
  serifHead: 'Rubik_700Bold', // secondary headlines
  serifBody: 'Rubik_400Regular', // body / quotes
  sans: 'Rubik_400Regular',
  sansMed: 'Rubik_500Medium',
  sansBold: 'Rubik_700Bold',
} as const;

// One typeface everywhere: Libre Baskerville. Headings Bold, text Regular.
export const CardFonts = {
  display: 'LibreBaskerville_700Bold', // card title / main heading
  displayBold: 'LibreBaskerville_700Bold',
  serifBody: 'LibreBaskerville_400Regular', // summary / quotes / body
  head: 'LibreBaskerville_700Bold', // sub-headlines
  body: 'LibreBaskerville_400Regular',
  sans: 'LibreBaskerville_400Regular',
  sansMed: 'LibreBaskerville_400Regular',
  sansBold: 'LibreBaskerville_700Bold', // category label, tab labels
} as const;

// System-font fallbacks used by any legacy scaffolded component that reads
// `Fonts.serif` / `Fonts.sans` etc.
export const SystemFonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
