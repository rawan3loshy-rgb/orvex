/**
 * Storefront theme helpers — presets, fonts, WCAG contrast and the mapping of a
 * StorefrontTheme onto CSS variables scoped to the storefront root.
 *
 * The storefront re-maps the design-system tokens (--bg, --surface, --fg,
 * --accent …) inside its own root element, so it is independent of the admin
 * dark/light theme and every token-based utility (`bg-surface`, `text-fg-3`,
 * `bg-accent`) automatically renders in the customer's brand.
 */
import type { CSSProperties } from 'react'
import type { StorefrontTheme } from '@/types/installation'

export type ThemeColors = StorefrontTheme['colors']

export interface ThemePreset {
  id: string
  name: string
  description: string
  light: ThemeColors
  dark: ThemeColors
}

/** Curated palettes (AA body + muted text, AA button labels). Warm neutrals — no blue-first palettes. */
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

export const DEFAULT_PRESET = THEME_PRESETS[0]!

/** The theme used while the storefront config is loading (UnlockDesk brand). */
export const FALLBACK_THEME: StorefrontTheme = {
  presetId: 'emerald',
  brandName: 'UnlockDesk',
  logoText: 'UnlockDesk',
  colors: DEFAULT_PRESET.light,
  radius: 10,
  fontHeading: 'Instrument Sans Variable',
  fontBody: 'Inter Variable',
  mode: 'light',
}

const COLOR_KEYS: (keyof ThemeColors)[] = ['primary', 'accent', 'background', 'surface', 'text', 'muted']

export function sameColors(a: ThemeColors, b: ThemeColors) {
  return COLOR_KEYS.every((k) => a[k].toLowerCase() === b[k].toLowerCase())
}

export function matchPreset(colors: ThemeColors): { preset: ThemePreset; mode: 'light' | 'dark' } | null {
  for (const p of THEME_PRESETS) {
    if (sameColors(colors, p.light)) return { preset: p, mode: 'light' }
    if (sameColors(colors, p.dark)) return { preset: p, mode: 'dark' }
  }
  return null
}

/** Warm neutral palette applied when switching mode on a custom palette. */
export const NEUTRALS: Record<'light' | 'dark', Pick<ThemeColors, 'background' | 'surface' | 'text' | 'muted'>> = {
  light: { background: '#fcfbf8', surface: '#f3f1eb', text: '#1d1e1c', muted: '#5f605a' },
  dark: { background: '#121312', surface: '#1a1c1b', text: '#eeefeb', muted: '#9b9e97' },
}

/* ------------------------------------------------------------------------- */
/*  Fonts                                                                    */
/* ------------------------------------------------------------------------- */
export const FONT_OPTIONS = [
  { value: 'Instrument Sans Variable', label: 'Instrument Sans', kind: 'Display sans' },
  { value: 'Inter Variable', label: 'Inter', kind: 'Neutral sans' },
  { value: 'Archivo Variable', label: 'Archivo', kind: 'Grotesque' },
  { value: 'Geist Variable', label: 'Geist', kind: 'Technical sans' },
  { value: 'JetBrains Mono Variable', label: 'JetBrains Mono', kind: 'Monospace' },
  { value: 'system-ui', label: 'System UI', kind: 'Native sans' },
  { value: 'Georgia', label: 'Georgia', kind: 'Serif' },
] as const

export function fontStack(name: string) {
  switch (name) {
    case 'Instrument Sans Variable':
      return '"Instrument Sans Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif'
    case 'Inter Variable':
      return '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    case 'Archivo Variable':
      return '"Archivo Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif'
    case 'Geist Variable':
      return '"Geist Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif'
    case 'JetBrains Mono Variable':
      return '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace'
    case 'Georgia':
      return 'Georgia, Cambria, "Times New Roman", serif'
    case 'system-ui':
      return 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
    default:
      return `"${name.replace(/["\\;{}<>]/g, '')}", ui-sans-serif, system-ui, sans-serif`
  }
}

/* ------------------------------------------------------------------------- */
/*  Contrast                                                                 */
/* ------------------------------------------------------------------------- */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

export function isValidHex(hex: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim())
}

export function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const ON_DARK_INK = '#151614'
/** Readable label colour on top of the primary colour (white or a warm near-black). */
export function onColor(hex: string) {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, ON_DARK_INK) ? '#ffffff' : ON_DARK_INK
}

export interface ContrastCheck {
  id: string
  label: string
  fg: string
  bg: string
  ratio: number
  /** Required ratio (4.5 body text, 3 large text / UI). */
  min: number
  pass: boolean
}

export function contrastChecks(c: ThemeColors): ContrastCheck[] {
  const rows: Omit<ContrastCheck, 'ratio' | 'pass'>[] = [
    { id: 'text-bg', label: 'Body text on background', fg: c.text, bg: c.background, min: 4.5 },
    { id: 'muted-bg', label: 'Muted text on background', fg: c.muted, bg: c.background, min: 4.5 },
    { id: 'text-surface', label: 'Body text on surface', fg: c.text, bg: c.surface, min: 4.5 },
    { id: 'muted-surface', label: 'Muted text on surface', fg: c.muted, bg: c.surface, min: 4.5 },
    { id: 'btn', label: 'Button label on primary', fg: onColor(c.primary), bg: c.primary, min: 4.5 },
    { id: 'link', label: 'Primary links on background', fg: c.primary, bg: c.background, min: 3 },
  ]
  return rows.map((r) => {
    const ratio = contrastRatio(r.fg, r.bg)
    return { ...r, ratio, pass: ratio >= r.min }
  })
}

/* ------------------------------------------------------------------------- */
/*  Theme → scoped CSS variables                                             */
/* ------------------------------------------------------------------------- */
export function storefrontVars(theme: StorefrontTheme): CSSProperties {
  const c = theme.colors
  const dark = theme.mode === 'dark'
  const r = Math.max(0, Math.min(28, Number(theme.radius) || 0))
  const ink = contrastRatio(c.primary, c.background) >= 4.5 ? c.primary : `color-mix(in oklab, ${c.primary} 70%, ${c.text})`
  const vars: Record<string, string> = {
    '--bg': c.background,
    '--bg-subtle': c.surface,
    '--surface': dark ? `color-mix(in oklab, ${c.surface} 94%, #ffffff)` : `color-mix(in oklab, ${c.background} 30%, #ffffff)`,
    '--surface-2': c.surface,
    '--surface-3': `color-mix(in oklab, ${c.surface} 88%, ${c.text})`,
    '--overlay': dark ? 'rgb(5 5 6 / 0.62)' : 'rgb(24 22 18 / 0.38)',
    '--line': `color-mix(in oklab, ${c.text} 11%, transparent)`,
    '--line-strong': `color-mix(in oklab, ${c.text} 20%, transparent)`,
    '--fg': c.text,
    '--fg-2': `color-mix(in oklab, ${c.text} 70%, ${c.muted})`,
    '--fg-3': c.muted,
    '--accent': c.primary,
    '--accent-ink': ink,
    '--accent-fg': onColor(c.primary),
    '--accent-2': c.accent,
    '--success': dark ? '#3fc98a' : '#13784f',
    '--warning': dark ? '#f0b14a' : '#9c5f06',
    '--danger': dark ? '#f25672' : '#c02a45',
    '--info': dark ? '#9aabb8' : '#56697a',
    '--shadow-card': dark ? '0 1px 0 rgb(255 255 255 / 0.03) inset, 0 1px 2px rgb(0 0 0 / 0.4)' : '0 1px 0 rgb(30 25 15 / 0.03), 0 1px 3px rgb(30 25 15 / 0.06)',
    '--shadow-pop': dark ? '0 0 0 1px rgb(255 255 255 / 0.08), 0 18px 40px -10px rgb(0 0 0 / 0.7)' : '0 0 0 1px rgb(30 25 15 / 0.05), 0 18px 40px -14px rgb(30 25 15 / 0.22), 0 4px 10px -4px rgb(30 25 15 / 0.08)',
    '--sf-r': `${r}px`,
    '--sf-r-sm': `${Math.max(4, Math.round(r * 0.6))}px`,
    '--sf-r-lg': `${Math.round(r * 1.6)}px`,
    '--sf-fh': fontStack(theme.fontHeading),
    '--sf-fb': fontStack(theme.fontBody),
    colorScheme: dark ? 'dark' : 'light',
  }
  return vars as CSSProperties
}
