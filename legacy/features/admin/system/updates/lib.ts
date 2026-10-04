import type { LucideIcon } from 'lucide-react'
import { Bug, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import type { Release, ReleaseNote } from '@/types/release'
import type { Tone } from '@/types/common'

/* ------------------------------------------------------------------ */
/*  Minimal semver helpers (enough for "^2.4.0", "~2.4.0", ">=2.3")   */
/* ------------------------------------------------------------------ */
function parse(v: string): [number, number, number] {
  const [core] = v.replace(/^v/, '').split('-')
  const [a = 0, b = 0, c = 0] = (core ?? '').split('.').map((x) => Number.parseInt(x, 10) || 0)
  return [a, b, c]
}

export function compareVersions(a: string, b: string) {
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! - pb[i]!
  }
  return 0
}

/** Does `version` satisfy `range`? Supports ^, ~, >=, > and exact ranges. */
export function satisfies(version: string, range: string): boolean {
  const r = range.trim()
  const [maj, min] = parse(version)
  if (r.startsWith('^')) {
    const base = r.slice(1)
    const [bMaj, bMin] = parse(base)
    if (bMaj === 0) return maj === 0 && min === bMin && compareVersions(version, base) >= 0
    return maj === bMaj && compareVersions(version, base) >= 0
  }
  if (r.startsWith('~')) {
    const base = r.slice(1)
    const [bMaj, bMin] = parse(base)
    return maj === bMaj && min === bMin && compareVersions(version, base) >= 0
  }
  if (r.startsWith('>=')) return compareVersions(version, r.slice(2)) >= 0
  if (r.startsWith('>')) return compareVersions(version, r.slice(1)) > 0
  return compareVersions(version, r) === 0
}

/* ------------------------------------------------------------------ */
/*  Release notes                                                      */
/* ------------------------------------------------------------------ */
/** "Improved routing engine — health-weighted…" → { headline, detail } */
export function splitNote(text: string) {
  const i = text.indexOf(' — ')
  if (i === -1) return { headline: text, detail: '' }
  return { headline: text.slice(0, i), detail: text.slice(i + 3) }
}

export const NOTE_META: Record<ReleaseNote['type'], { label: string; plural: string; icon: LucideIcon; tone: Tone }> = {
  feature: { label: 'Feature', plural: 'New features', icon: Sparkles, tone: 'accent' },
  improvement: { label: 'Improvement', plural: 'Improvements', icon: Zap, tone: 'info' },
  security: { label: 'Security', plural: 'Security', icon: ShieldCheck, tone: 'success' },
  fix: { label: 'Fix', plural: 'Fixes', icon: Bug, tone: 'neutral' },
}

/** Static (scannable) soft tile classes per tone. */
export const TONE_TILE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-2',
  accent: 'bg-accent/10 text-accent-ink',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/10 text-danger',
}

export const NOTE_ORDER: ReleaseNote['type'][] = ['feature', 'improvement', 'security', 'fix']

/** Headline checklist shown in the update hero (notes that carry a headline). */
export function highlights(release: Release) {
  const withHeadline = release.notes.filter((n) => n.text.includes(' — '))
  return (withHeadline.length ? withHeadline : release.notes).map((n) => ({ ...n, ...splitNote(n.text) }))
}

/** Update history recorded by the vendor reads "ORVEX (…)" — the vendor is ORVEX Systems. */
export function byLabel(by: string) {
  return by.replace(/^ORVEX(?! Systems)\b/, 'ORVEX Systems')
}

export function packageFile(release: Release) {
  return `core-${release.version}.tar.zst`
}

export function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Migration step → conventional migration file name, e.g. 018_webhook_delivery_attempts */
export function migrationName(to: string, step: string, index: number) {
  const slug = step
    .toLowerCase()
    .replace(/^(create table|add column|create index|backfill)\s+/, (m) => (m.startsWith('backfill') ? 'backfill_' : ''))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return index === 0 ? `${to}_${slug}` : `${to}_${String.fromCharCode(97 + index)}_${slug}`
}
