/**
 * Non-component helpers shared by the cockpit, orders and verifications screens.
 * (Feature-local on purpose — shared layers belong to the lead.) Components live in `./lib`.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { Tone } from '@/types/installation'
import { cn } from '@/lib/cn'

/** Client-generated idempotency key — generated once per modal/command, never per click. */
export function newIdempotencyKey(prefix = 'adm') {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${prefix}_${raw.slice(0, 24)}`
}

/** Re-render on an interval (for "updated 3s ago" labels and ages). */
export function useNow(interval = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval, enabled])
  return now
}

/** Compact age: "42s", "17m", "3h 05m", "2d 4h". */
export function age(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export const isDeviceField = (type: string) => type === 'gsm.imei' || type === 'gsm.serial'

/** Mask an IMEI for compact table display: 35609811·••••·345 */
export function deviceLabel(input: Record<string, string>) {
  const v = input.imei ?? input.serial ?? input.serial_number
  if (!v) return null
  if (/^\d{15}$/.test(v)) return `${v.slice(0, 8)}·${v.slice(8, 12).replace(/\d/g, '•')}·${v.slice(12)}`
  return v
}

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg-2',
  accent: 'text-accent-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-fg-3',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export const asTone = (t: string): Tone => (['neutral', 'accent', 'success', 'warning', 'danger', 'info'].includes(t) ? (t as Tone) : 'neutral')

/* ------------------------------------------------------------------------- */
/*  Flash highlight — timeline refs scroll to and highlight a record         */
/* ------------------------------------------------------------------------- */
export const FlashCtx = createContext<string | null>(null)

/** className for an anchorable record: highlighted while it is the flash target. */
export function useFlash(domId: string) {
  const flash = useContext(FlashCtx)
  return cn('scroll-mt-24 transition-[box-shadow,background-color] duration-500', flash === domId && 'bg-accent/[0.06] shadow-[0_0_0_2px_var(--accent)]')
}
