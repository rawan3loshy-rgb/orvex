/** Storefront presentation helpers (customer-facing wording). */
import type { Service, StoreServiceCard } from '@/types/installation'

export function turnaroundLabel(t: Service['turnaround'], processing?: Service['processing']) {
  const fmt = (sec: number) => {
    if (sec < 60) return { n: Math.max(1, Math.round(sec)), u: 'sec' }
    if (sec < 3600) return { n: Math.round(sec / 60), u: 'min' }
    if (sec < 86400) return { n: Math.round(sec / 3600), u: 'h' }
    return { n: Math.round(sec / 86400), u: 'day' }
  }
  const a = fmt(t.minSec)
  const b = fmt(t.maxSec)
  const unit = (x: { n: number; u: string }) => (x.u === 'day' ? (x.n === 1 ? 'day' : 'days') : x.u)
  const range = a.u === b.u ? (a.n === b.n ? `${b.n} ${unit(b)}` : `${a.n}–${b.n} ${unit(b)}`) : `${a.n} ${unit(a)} – ${b.n} ${unit(b)}`
  if (processing === 'instant' && t.maxSec <= 300) return `Instant · ${range}`
  return range
}

export function speedTone(card: Pick<StoreServiceCard, 'turnaround'>): 'fast' | 'normal' | 'slow' {
  if (card.turnaround.maxSec <= 600) return 'fast'
  if (card.turnaround.maxSec <= 6 * 3600) return 'normal'
  return 'slow'
}

export interface PublicStatusView {
  label: string
  tone: 'neutral' | 'progress' | 'success' | 'warning' | 'danger'
  description: string
}

/** Customer-facing status (storefront never shows needs_review — it gets processing + under_review). */
export function publicStatusView(status: string, detail: string | null, financial?: string): PublicStatusView {
  switch (status) {
    case 'awaiting_payment':
      return { label: 'Awaiting payment', tone: 'warning', description: 'Complete the payment to start processing.' }
    case 'queued':
      return { label: 'Queued', tone: 'progress', description: 'Your order is in line and will start in a moment.' }
    case 'processing':
      if (detail === 'under_review') return { label: 'Being verified', tone: 'progress', description: 'Our team is verifying the result with the supplier.' }
      if (detail === 'at_supplier') return { label: 'Processing', tone: 'progress', description: 'Your request is being processed by our network partner.' }
      return { label: 'Processing', tone: 'progress', description: 'We are working on your order.' }
    case 'completed':
      return { label: 'Completed', tone: 'success', description: 'Your result is ready.' }
    case 'rejected':
      return { label: financial === 'refunded' || financial === 'released' ? 'Not completed · refunded' : 'Not completed', tone: 'danger', description: 'We could not complete this order.' }
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral', description: 'This order was cancelled.' }
    default:
      return { label: status.replace(/_/g, ' '), tone: 'neutral', description: '' }
  }
}

export function maskEmail(e: string) {
  return e.replace(/^(.).+(@.+)$/, '$1•••$2')
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export function newIdempotencyKey() {
  try {
    return `sf_${crypto.randomUUID()}`
  } catch {
    return `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  }
}

export function prettyValue(v: string | number | boolean) {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}
