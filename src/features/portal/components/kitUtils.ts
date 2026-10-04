/**
 * Non-component helpers shared by the vendor-portal screens: motion easing,
 * time/version maths, hooks and display metadata. Components live in kit.tsx.
 */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { ShieldCheck, Sparkles, TrendingUp, Wrench } from 'lucide-react'
import type { Tone } from '@/types/common'
import type { Release, ReleaseNote } from '@/types/release'
import type { InstallationRef, SupportTicket } from '@/types/vendor'

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const COUNTRIES = ['Netherlands', 'Germany', 'Belgium', 'France', 'Ireland', 'Spain', 'Sweden', 'Denmark', 'United Kingdom', 'United States'].map((c) => ({ value: c, label: c }))
const DAY = 86_400_000

/** The demo customer's billing address, shown on the Billing page and printed on invoices. */
export const BILLING_ADDRESS = ['Keizersgracht 100', '1015 CX Amsterdam', 'Netherlands']

/* ------------------------------------------------------------------ */
/*  Time helpers                                                       */
/* ------------------------------------------------------------------ */

/** Re-render periodically so relative times ("seen 3 minutes ago") stay fresh. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY)
}

export function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY))
}

/** Fraction (0–1) of the way through a period. */
export function periodProgress(start: string, end: string) {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(0, Math.min(1, (Date.now() - s) / Math.max(1, e - s)))
}

/** Scroll to `#hash` targets after the page has rendered (the shell scrolls to top first). */
export function useHashScroll(ready = true) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash || !ready) return
    const id = decodeURIComponent(hash.slice(1))
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 160)
    return () => clearTimeout(t)
  }, [hash, ready])
}

/* ------------------------------------------------------------------ */
/*  Versions & releases                                                */
/* ------------------------------------------------------------------ */

export function cmpVersion(a: string, b: string) {
  const parse = (v: string) => {
    const [core = '', pre] = v.split('-')
    return { n: core.split('.').map((x) => Number(x) || 0), pre }
  }
  const A = parse(a)
  const B = parse(b)
  for (let i = 0; i < 3; i++) {
    const d = (A.n[i] ?? 0) - (B.n[i] ?? 0)
    if (d) return d
  }
  if (A.pre && !B.pre) return -1
  if (!A.pre && B.pre) return 1
  return 0
}

export function latestStable(releases: Release[] | undefined) {
  return releases?.filter((r) => r.channel === 'stable').sort((a, b) => cmpVersion(b.version, a.version))[0]
}

export const NOTE_META: Record<ReleaseNote['type'], { label: string; icon: LucideIcon; color: string }> = {
  feature: { label: 'New', icon: Sparkles, color: 'var(--c1)' },
  improvement: { label: 'Improved', icon: TrendingUp, color: 'var(--c2)' },
  fix: { label: 'Fixed', icon: Wrench, color: 'var(--c4)' },
  security: { label: 'Security', icon: ShieldCheck, color: 'var(--c3)' },
}

/* ------------------------------------------------------------------ */
/*  Installations                                                      */
/* ------------------------------------------------------------------ */

export function installationLabel(id: string | null, list: InstallationRef[] | undefined) {
  if (!id) return null
  return list?.find((i) => i.id === id) ?? null
}

/** How an installation is operated. Every installation is single-customer — never shared SaaS. */
export function deploymentLabel(d: InstallationRef['deployment']) {
  return d === 'vendor-assisted' ? 'Vendor-managed dedicated' : 'Self-hosted'
}

/* ------------------------------------------------------------------ */
/*  Tickets                                                            */
/* ------------------------------------------------------------------ */

export const TICKET_CATEGORIES: SupportTicket['category'][] = ['General', 'Installation', 'Update', 'Licensing', 'Billing', 'Provider adapter', 'Custom development']

/** Display label for a ticket category (the stored value "Provider adapter" predates supplier drivers). */
export function categoryLabel(c: SupportTicket['category']) {
  return c === 'Provider adapter' ? 'Supplier driver' : c
}

export const PRIORITY_META: Record<SupportTicket['priority'], { label: string; tone: Tone }> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  normal: { label: 'Normal', tone: 'neutral' },
  low: { label: 'Low', tone: 'neutral' },
}

export const isOpenTicket = (t: SupportTicket) => t.status !== 'resolved' && t.status !== 'closed'

/** "Jonas — ORVEX Support" → { name: "Jonas", team: "ORVEX Support" } */
export function splitAuthor(author: string) {
  const [name, team] = author.split(' — ')
  return { name: name ?? author, team: team ?? null }
}
