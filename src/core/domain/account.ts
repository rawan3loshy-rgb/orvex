/**
 * One Account model for every buyer.
 *
 * Retail customers, resellers, businesses and API-only clients are the same
 * entity with different tier, pricing tier, permissions and channels. They all
 * share one wallet model (ledger-backed), one order model and one idempotency
 * scope. A guest checkout creates a lightweight `guest` account so its payment
 * still lands in a wallet like everyone else's.
 */
import type { Micros } from '../money'
import type { ISODate } from './common'

export type AccountTier = 'retail' | 'reseller' | 'business' | 'api_only'
export type AccountKind = 'customer' | 'guest'
export type AccountStatus = 'active' | 'frozen' | 'pending' | 'closed'

export type MemberRole = 'owner' | 'admin' | 'orderer' | 'finance' | 'developer' | 'viewer'

export interface AccountMember {
  id: string
  accountId: string
  name: string
  email: string
  role: MemberRole
  mfa: boolean
  status: 'active' | 'invited' | 'disabled'
  lastActiveAt: ISODate | null
  createdAt: ISODate
}

export type ServiceAccess =
  | { mode: 'all' }
  | { mode: 'categories'; categoryIds: string[] }
  | { mode: 'services'; serviceIds: string[] }

export interface AccountChannels {
  storefront: boolean
  portal: boolean
  api: boolean
  /** DHRU-compatible endpoint (legacy reseller integrations). */
  dhru: boolean
}

export interface AccountLimits {
  ordersPerMinute: number
  dailyOrders: number
  maxConcurrent: number
  maxOrderValue: Micros
}

export interface Account {
  id: string
  /** Human account number shown on statements, e.g. "AC-10482". */
  number: string
  name: string
  kind: AccountKind
  tier: AccountTier
  status: AccountStatus
  statusReason: string | null
  pricingTierId: string
  /** Negative available balance allowed (post-paid credit). */
  creditLimit: Micros
  email: string
  contactName: string
  phone: string | null
  country: string
  company: string | null
  website: string | null
  serviceAccess: ServiceAccess
  channels: AccountChannels
  limits: AccountLimits
  lowBalanceAlert: Micros | null
  tags: string[]
  notes: string
  createdAt: ISODate
  lastActiveAt: ISODate
}

/** Wallet projection — derived from ledger entries, never stored as a number. */
export interface AccountBalance {
  accountId: string
  available: Micros
  held: Micros
  creditLimit: Micros
  /** available + creditLimit — what the account may still spend. */
  spendable: Micros
}

export const ACCOUNT_TIER_LABEL: Record<AccountTier, string> = {
  retail: 'Retail',
  reseller: 'Reseller',
  business: 'Business',
  api_only: 'API-only',
}
