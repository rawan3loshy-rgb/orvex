/**
 * Non-component helpers for the reseller portal (UnlockDesk Partner Portal):
 * hosts, ids, session/roles, status & wallet metadata and service maths.
 * Components live in kit.tsx.
 */
import { usePortalMe } from '@/hooks/installation'
import type { MemberRole, PortalService } from '@/types/installation'
import type { Tone } from '@/types/common'
import { usd, type Micros } from '@/core/money'
import { duration } from '@/lib/format'

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Public host of the demo installation (the reseller's view of UnlockDesk). */
export const PORTAL_HOST = 'https://portal.unlockdesk-demo.com'
export const NATIVE_API_BASE = `${PORTAL_HOST}/v1`
export const DHRU_ENDPOINT = `${PORTAL_HOST}/api/dhru`

/* ------------------------------------------------------------------ */
/*  Ids                                                                */
/* ------------------------------------------------------------------ */

function rand(n: number) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(n)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Client-generated idempotency key / batch id (one per form session). */
export function newKey(prefix: string) {
  return `${prefix}_${rand(20)}`
}

/* ------------------------------------------------------------------ */
/*  Session & roles                                                    */
/* ------------------------------------------------------------------ */

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  orderer: 'Orderer',
  finance: 'Finance',
  developer: 'Developer',
  viewer: 'Viewer',
}

export const ROLE_DESC: Record<MemberRole, string> = {
  owner: 'Everything, including members and API access',
  admin: 'Everything except removing the last owner',
  orderer: 'Place and follow orders',
  finance: 'Wallet, top-ups and statements',
  developer: 'API keys, webhooks, logs and DHRU connection',
  viewer: 'Read-only access to orders and services',
}

export type Capability = 'order' | 'finance' | 'api' | 'members'

/** Convenience wrapper: who is signed in and what may they do. */
export function usePortalSession() {
  const me = usePortalMe()
  const d = me.data
  const role = d?.member.role
  const can: Record<Capability, boolean> = {
    order: !!d?.canOrder,
    finance: !!d?.canSeeFinance,
    api: !!d?.canManageApi,
    members: role === 'owner' || role === 'admin',
  }
  return { ...me, me: d, role, can }
}

/* ------------------------------------------------------------------ */
/*  Order status (customer-facing)                                     */
/* ------------------------------------------------------------------ */

export const STATUS_DETAIL: Record<string, { label: string; copy: string }> = {
  under_review: {
    label: 'Being verified',
    copy: 'We’re double-checking this order with our fulfilment partner before finishing it. Your funds stay reserved — you will never be charged twice. Most checks complete within a few hours; no action is needed from you.',
  },
  at_supplier: {
    label: 'In progress',
    copy: 'Your order has been accepted and is being processed. You’ll see the result here (and on your webhooks) as soon as it’s ready.',
  },
}

export const PORTAL_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

/** Financial status in reseller language. */
export const MONEY_STATE: Record<string, { label: string; tone: Tone; hint: string }> = {
  none: { label: 'Not funded', tone: 'neutral', hint: 'No funds reserved yet' },
  held: { label: 'Reserved', tone: 'warning', hint: 'Funds are reserved in your wallet until the order finishes' },
  captured: { label: 'Charged', tone: 'success', hint: 'The order completed and the reserved funds were charged' },
  released: { label: 'Released', tone: 'neutral', hint: 'Reserved funds went back to your available balance' },
  partially_refunded: { label: 'Partially refunded', tone: 'info', hint: 'Part of the charge was refunded to your wallet' },
  refunded: { label: 'Refunded', tone: 'info', hint: 'The full charge was refunded to your wallet' },
}

/* ------------------------------------------------------------------ */
/*  Wallet                                                             */
/* ------------------------------------------------------------------ */

export const WALLET_KIND: Record<string, { label: string; tone: Tone }> = {
  top_up: { label: 'Top-up', tone: 'success' },
  order_hold: { label: 'Funds reserved', tone: 'warning' },
  order_release: { label: 'Funds released', tone: 'neutral' },
  order_settlement: { label: 'Order charged', tone: 'accent' },
  refund: { label: 'Refund', tone: 'info' },
  adjustment: { label: 'Adjustment', tone: 'neutral' },
  chargeback: { label: 'Chargeback', tone: 'danger' },
}

export const WALLET_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'top_up', label: 'Top-ups' },
  { value: 'order_hold', label: 'Reserved' },
  { value: 'order_settlement', label: 'Charged' },
  { value: 'order_release', label: 'Released' },
  { value: 'refund', label: 'Refunds' },
  { value: 'adjustment', label: 'Adjustments' },
] as const

/* ------------------------------------------------------------------ */
/*  Services                                                           */
/* ------------------------------------------------------------------ */

export function turnaroundLabel(s: Pick<PortalService, 'processing' | 'turnaround'>) {
  if (s.processing === 'instant' && s.turnaround.maxSec <= 120) return 'Instant'
  const { minSec, maxSec } = s.turnaround
  if (minSec === maxSec) return duration(maxSec)
  return `${duration(minSec)} – ${duration(maxSec)}`
}

export const PROCESSING_LABEL: Record<string, string> = { instant: 'Automatic · instant', async: 'Automatic', manual: 'Handled by our team' }

/** Saving vs retail in whole percent (display only). */
export function savingPct(price: number, retail: number) {
  if (!retail || price >= retail) return 0
  return Math.round(((retail - price) / retail) * 100)
}

/** Services that can be ordered in bulk (one IMEI / serial per line). */
export function bulkField(s: PortalService) {
  return s.fields.find((f) => f.type === 'gsm.imei' || f.type === 'gsm.serial')
}

/* ------------------------------------------------------------------ */
/*  Demo IMEIs (client-side, for the bulk example)                     */
/* ------------------------------------------------------------------ */

function luhnDigit(body14: string) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let d = Number(body14[13 - i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

/** A few valid IMEIs, one bad checksum and one duplicate — shows every validation path. */
export function sampleImeis() {
  const tacs = ['35693803', '35332510', '35405911', '35847631', '35290611']
  const valid = tacs.map((tac) => {
    const body = tac + String(Math.floor(100000 + Math.random() * 899999))
    return body + luhnDigit(body)
  })
  const bad = valid[1]!.slice(0, 14) + String((Number(valid[1]![14]) + 3) % 10)
  return [...valid.slice(0, 4), bad, valid[0]!, '12345'].join('\n')
}

/* ------------------------------------------------------------------ */
/*  Balance helpers                                                    */
/* ------------------------------------------------------------------ */

/** Low-balance threshold: the account's own alert level, or $100 by default. */
export function lowBalanceThreshold(alert: Micros | null | undefined): Micros {
  return alert ?? usd(100)
}
