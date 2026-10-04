/**
 * Catalog: services, revisions, field schemas, supplier products, offers,
 * pricing tiers and rules.
 *
 * Single sources of truth:
 *  - Service identity, fields and result schema → Service + ServiceRevision
 *  - Supplier cost                              → SupplierProduct.cost
 *  - Offer mapping (service ⇄ supplier product) → Offer
 *  - Price                                      → PricingEngine(rules, cost, tier)
 *  - Availability                               → RoutingEngine(offers, supplier health)
 * The storefront, portal, native API, DHRU endpoint and order engine all read
 * these — nothing copies a price or a field list.
 */
import type { Micros, RoundingMode } from '../money'
import type { ISODate } from './common'

export interface Category {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  /** Vertical pack that contributes this category (e.g. "gsm"). */
  packId: string | null
  sort: number
}

export type ServiceStatus = 'draft' | 'active' | 'paused' | 'archived'
export type ProcessingMode = 'instant' | 'async' | 'manual'

export interface FieldOption {
  value: string
  label: string
}

/**
 * One field definition powers the storefront form, the portal form, the API
 * schema, server-side validation and DHRU compatibility mapping.
 * `type` references a registered field type: core types (text, number, select,
 * email, country, phone) or pack types such as "gsm.imei".
 */
export interface FieldDef {
  key: string
  label: string
  type: string
  required: boolean
  placeholder?: string
  help?: string
  options?: FieldOption[]
  minLength?: number
  maxLength?: number
  pattern?: string
  /** Masked in logs and notifications. */
  sensitive?: boolean
}

export type ResultFieldKind = 'text' | 'status' | 'code' | 'date' | 'boolean'

export interface ResultFieldDef {
  key: string
  label: string
  kind: ResultFieldKind
  /** Shown as the headline of the result card. */
  primary?: boolean
  /** For `status` fields: value → tone. */
  tones?: Record<string, 'success' | 'warning' | 'danger' | 'neutral'>
}

export interface ServiceRevision {
  id: string
  serviceId: string
  number: number
  fields: FieldDef[]
  resultSchema: ResultFieldDef[]
  note: string
  createdAt: ISODate
  createdBy: string
}

export interface Service {
  id: string
  /** Operator-facing code, also the DHRU-compatible service id. */
  code: string
  slug: string
  name: string
  categoryId: string
  packId: string | null
  status: ServiceStatus
  processing: ProcessingMode
  turnaround: { minSec: number; maxSec: number }
  summary: string
  description: string
  icon: string
  tags: string[]
  featured: boolean
  /** Current revision (fields + result schema). Orders snapshot the revision they used. */
  revisionId: string
  revision: number
  visibility: { storefront: boolean; portal: boolean; api: boolean }
  whenUnavailable: 'show_unavailable' | 'hide'
  /** Storefront detail template. */
  templateId: string | null
  createdAt: ISODate
  updatedAt: ISODate
}

export type SupplierProductStatus = 'available' | 'removed'

/** A product as listed in a supplier's catalog (synced). Owns the supplier cost. */
export interface SupplierProduct {
  id: string
  supplierId: string
  externalId: string
  name: string
  groupName: string
  cost: Micros
  previousCost: Micros | null
  status: SupplierProductStatus
  /** Field names the supplier expects. */
  remoteFields: string[]
  processingHint: string
  firstSeenAt: ISODate
  lastSeenAt: ISODate
  costChangedAt: ISODate | null
}

/** A way to fulfil a service through one supplier product. */
export interface Offer {
  id: string
  serviceId: string
  supplierId: string
  supplierProductId: string
  priority: number
  enabled: boolean
  /** Set when the system disabled the offer (e.g. product removed upstream). */
  disabledReason: string | null
  /** service field key → supplier field name */
  fieldMapping: Record<string, string>
  /** Never route if the supplier cost exceeds this. */
  maxCost: Micros | null
  config: Record<string, string>
  createdAt: ISODate
  updatedAt: ISODate
}

/* ------------------------------------------------------------------------- */
/*  Pricing                                                                  */
/* ------------------------------------------------------------------------- */
export interface PricingTier {
  id: string
  name: string
  description: string
  color: string
  sort: number
  /** The tier used for guests and retail accounts. */
  isDefault: boolean
}

export type PricingMethod = 'fixed' | 'cost_plus_percent' | 'cost_plus_fixed'

export type PricingScope = { kind: 'all' } | { kind: 'category'; categoryId: string } | { kind: 'service'; serviceId: string }

export interface PricingRule {
  id: string
  tierId: string
  scope: PricingScope
  method: PricingMethod
  /** Micros for fixed / cost_plus_fixed; basis points for cost_plus_percent. */
  value: number
  rounding: { increment: Micros; mode: RoundingMode }
  /** Warn (and block failover) below this margin, in basis points. */
  minMarginBps: number | null
  enabled: boolean
  note: string
  updatedAt: ISODate
  updatedBy: string
}

export interface PriceStep {
  label: string
  detail?: string
  amount?: Micros
}

export type MarginGuard = 'ok' | 'low_margin' | 'negative_margin' | 'no_cost'

/** Result of PricingEngine.quote — also snapshotted on every order. */
export interface PriceQuote {
  serviceId: string
  tierId: string
  tierName: string
  amount: Micros
  ruleId: string | null
  ruleLabel: string
  method: PricingMethod
  /** Cost of the offer the price was calculated against (first eligible offer). */
  referenceCost: Micros | null
  referenceOfferId: string | null
  referenceSupplierId: string | null
  margin: Micros | null
  marginBps: number | null
  guard: MarginGuard
  steps: PriceStep[]
  /** Tier inherited from another (e.g. no Gold rule → Retail price). */
  inheritedFrom: string | null
}
