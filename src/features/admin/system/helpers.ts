/**
 * Non-component helpers for the System area (health, updates, license, installation,
 * extensions, settings, notifications, audit, roles, security). Components live in `./shared`.
 */
import { useEffect, useState } from 'react'
import type { HealthState, Tone } from '@/types/installation'

/** Re-render every `ms` so relative times stay fresh. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Health is expressed in status colours only; "attention" is informational. */
export const HEALTH_TONE: Record<HealthState, Tone> = { healthy: 'success', degraded: 'warning', down: 'danger', attention: 'info' }
export const HEALTH_COLOR: Record<HealthState, string> = { healthy: 'var(--success)', degraded: 'var(--warning)', down: 'var(--danger)', attention: 'var(--info)' }
export const HEALTH_LABEL: Record<HealthState, string> = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down', attention: 'Needs attention' }

export const TONE_TILE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-2',
  accent: 'bg-accent/10 text-accent-ink',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/10 text-danger',
}

/** Human label for snake/dot identifiers: "order.needs_review" → "Order · needs review". */
export function humanize(id: string) {
  return id
    .split('.')
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p).replace(/_/g, ' '))
    .join(' · ')
}
