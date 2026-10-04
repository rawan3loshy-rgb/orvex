import type { SiteTheme } from '@/types/installation'

export type ThemeColors = Pick<SiteTheme, 'primary' | 'accent' | 'background' | 'surface' | 'text' | 'muted'>

export interface ThemePreset {
  id: string
  name: string
  description: string
  light: ThemeColors
  dark: ThemeColors
}

/**
 * Curated palettes for the customer's public website, each tuned for light and
 * dark mode (WCAG AA for body and muted text, AA for button labels on primary).
 * The first preset is the demo customer's own brand (UnlockDesk emerald, matching
 * Settings → Branding). Warm neutrals throughout — no blue-first palettes.
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'UnlockDesk brand — emerald on warm white',
    light: { primary: '#0e7c66', accent: '#b7791f', background: '#fcfbf8', surface: '#f3f1eb', text: '#1d1e1c', muted: '#5f605a' },
    dark: { primary: '#3cc49f', accent: '#e0b25c', background: '#101312', surface: '#181c1a', text: '#eeefeb', muted: '#9b9e97' },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Monochrome, editorial and precise',
    light: { primary: '#1d1c1a', accent: '#77716a', background: '#fafaf8', surface: '#f1f0ec', text: '#151514', muted: '#5f5d58' },
    dark: { primary: '#f2f1ee', accent: '#a8a49c', background: '#0f0f0e', surface: '#191918', text: '#f2f1ee', muted: '#9d9a93' },
  },
  {
    id: 'sand',
    name: 'Sand',
    description: 'Terracotta clay with an olive accent',
    light: { primary: '#9a4a24', accent: '#5f7a52', background: '#faf6ef', surface: '#f1e9dd', text: '#241c16', muted: '#6a5f55' },
    dark: { primary: '#e3906a', accent: '#a9c092', background: '#15120f', surface: '#1f1b17', text: '#f3ece3', muted: '#a69b8f' },
  },
  {
    id: 'plum',
    name: 'Plum',
    description: 'Deep plum with a brass accent',
    light: { primary: '#7a2e64', accent: '#b8801c', background: '#fdfafc', surface: '#f5eef3', text: '#22171f', muted: '#685b65' },
    dark: { primary: '#d993c5', accent: '#e6b75e', background: '#140f13', surface: '#1e171c', text: '#f4ecf1', muted: '#a798a3' },
  },
  {
    id: 'oxblood',
    name: 'Oxblood',
    description: 'Dark red with an antique-gold accent',
    light: { primary: '#8e2b2b', accent: '#9a7a2c', background: '#fcfaf7', surface: '#f4efe8', text: '#201a17', muted: '#655c55' },
    dark: { primary: '#e8857c', accent: '#ddbd6b', background: '#130f0e', surface: '#1d1816', text: '#f4ede8', muted: '#a69a93' },
  },
]

/** The preset new or reset sites start from — the customer's own brand. */
export const DEFAULT_PRESET = THEME_PRESETS[0]!

const KEYS: (keyof ThemeColors)[] = ['primary', 'accent', 'background', 'surface', 'text', 'muted']

export function colorsOf(theme: SiteTheme): ThemeColors {
  return { primary: theme.primary, accent: theme.accent, background: theme.background, surface: theme.surface, text: theme.text, muted: theme.muted }
}

export function sameColors(a: ThemeColors, b: ThemeColors) {
  return KEYS.every((k) => a[k].toLowerCase() === b[k].toLowerCase())
}

/** The preset (and mode) whose palette matches the theme exactly, if any. */
export function matchPreset(theme: SiteTheme): { preset: ThemePreset; mode: 'light' | 'dark' } | null {
  const c = colorsOf(theme)
  for (const p of THEME_PRESETS) {
    if (sameColors(c, p.light)) return { preset: p, mode: 'light' }
    if (sameColors(c, p.dark)) return { preset: p, mode: 'dark' }
  }
  return null
}

/** Warm neutral palette to apply when switching mode on a custom (non-preset) palette. */
export const NEUTRALS: Record<'light' | 'dark', Pick<ThemeColors, 'background' | 'surface' | 'text' | 'muted'>> = {
  light: { background: '#fcfbf8', surface: '#f3f1eb', text: '#1d1e1c', muted: '#5f605a' },
  dark: { background: '#121312', surface: '#1a1c1b', text: '#eeefeb', muted: '#9b9e97' },
}
