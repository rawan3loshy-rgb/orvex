/**
 * Non-component helpers for the Accounts screens (list + detail) — tier / kind
 * metadata, form constants and ledger previews. Components live in `./shared`.
 */
import type { LucideIcon } from 'lucide-react'
import { Building, CodeXml, ShoppingBag, Store, UserRound } from 'lucide-react'
import { ACCOUNT_TIER_LABEL } from '@/core/domain'
import { formatMoney, type Micros } from '@/core/money'
import type { AccountTier, LedgerTransaction, LedgerTxKind, PricingTier } from '@/types/installation'

export const TIER_META: Record<AccountTier, { label: string; icon: LucideIcon; blurb: string }> = {
  retail: { label: ACCOUNT_TIER_LABEL.retail, icon: ShoppingBag, blurb: 'Storefront customers who pay per order or keep a small wallet.' },
  reseller: { label: ACCOUNT_TIER_LABEL.reseller, icon: Store, blurb: 'GSM shops and distributors ordering via portal, API or DHRU endpoint.' },
  business: { label: ACCOUNT_TIER_LABEL.business, icon: Building, blurb: 'Trade-in desks, insurers and fleets ordering through the portal.' },
  api_only: { label: ACCOUNT_TIER_LABEL.api_only, icon: CodeXml, blurb: 'Integrations that only talk to the native API.' },
}

export const GUEST_META = { label: 'Guest', icon: UserRound, blurb: 'Lightweight accounts created by guest checkout so every payment still lands in a wallet.' }

export function tierColor(tiers: PricingTier[] | undefined, id: string) {
  return tiers?.find((t) => t.id === id)?.color ?? null
}

/** Client-generated idempotency key: retries of the same submission can never post twice. */
export function newIdempotencyKey(prefix: string) {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 15)
  return `${prefix}_${Date.now().toString(36)}_${rnd}`
}

export const COUNTRIES: { value: string; label: string }[] = [
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'DE', label: 'Germany' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'TR', label: 'Türkiye' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'CA', label: 'Canada' },
  { value: 'BR', label: 'Brazil' },
  { value: 'PL', label: 'Poland' },
  { value: 'CH', label: 'Switzerland' },
]

export const MEMBER_ROLES = ['owner', 'admin', 'orderer', 'finance', 'developer', 'viewer'] as const
export const MEMBER_ROLE_HINT: Record<(typeof MEMBER_ROLES)[number], string> = {
  owner: 'Everything, including members and billing',
  admin: 'Everything except ownership transfer',
  orderer: 'Place and track orders',
  finance: 'Wallet, top-ups and statements',
  developer: 'API keys, webhooks and logs',
  viewer: 'Read-only',
}

/** Prefill a money input from micros ("1,250.50" style without symbol/commas). Parse back with parseMoney. */
export function moneyInput(m: Micros | null | undefined) {
  return m == null ? '' : formatMoney(m).replace(/[$,]/g, '')
}

/** Build an unsaved transaction so <LedgerEntries> can preview the exact posting a command will make. */
export function previewTx(kind: LedgerTxKind, description: string, lines: { account: string; direction: 'debit' | 'credit'; amount: Micros }[]): LedgerTransaction {
  return {
    id: 'preview',
    ref: 'Preview — not posted yet',
    at: new Date().toISOString(),
    kind,
    description,
    entries: lines.map((l, i) => ({ id: `preview_${i}`, txId: 'preview', ...l })),
    orderId: null,
    accountId: null,
    supplierId: null,
    paymentIntentId: null,
    refundId: null,
    idempotencyKey: 'preview',
    actor: { type: 'admin', id: 'preview', name: 'You' },
    reason: null,
  }
}
