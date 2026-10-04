/**
 * Suppliers (upstream providers) and the drivers that talk to them.
 *
 * Core knows suppliers only through the SupplierDriver contract. DHRU Fusion is
 * one HTTP driver among others; its numeric statuses and form-POST protocol
 * never leak into the order model.
 */
import type { Micros } from '../money'
import type { ISODate } from './common'

export type DriverId = 'dhru_fusion' | 'orvex_rest' | 'manual'

export type CircuitState = 'closed' | 'open' | 'half_open'

export type SupplierHealth =
  | 'healthy'
  | 'degraded'
  | 'auth_error'
  | 'low_balance'
  | 'circuit_open'
  | 'half_open'
  | 'maintenance'
  | 'disabled'

export interface SupplierCredential {
  key: string
  label: string
  /** Secrets are encrypted at rest and write-only — the API only ever returns this mask. */
  masked: string
  updatedAt: ISODate
}

/** Normalised outcome classes for supplier responses. */
export type AttemptClass = 'success' | 'rejected_terminal' | 'rejected_failover_safe' | 'not_accepted' | 'unknown'

export interface ErrorMapping {
  id: string
  /** Supplier message or code pattern (case-insensitive substring). */
  match: string
  classifyAs: Exclude<AttemptClass, 'success' | 'unknown'>
  note: string
}

export interface Supplier {
  id: string
  name: string
  code: string
  driver: DriverId
  connection: {
    url: string
    username: string | null
    credentials: SupplierCredential[]
    /** Always "simulated" in the prototype — never claims a live connection. */
    environment: 'simulated'
  }
  enabled: boolean
  maintenance: { active: boolean; until: ISODate | null; note: string }
  circuit: {
    state: CircuitState
    consecutiveFailures: number
    threshold: number
    openedAt: ISODate | null
    cooldownSec: number
  }
  auth: { status: 'ok' | 'failed'; checkedAt: ISODate; message: string | null }
  /** Balance reported by the supplier (driver getBalance). */
  reportedBalance: Micros
  balanceCheckedAt: ISODate
  lowBalanceThreshold: Micros
  timeoutMs: number
  rateLimit: { requests: number; perSeconds: number }
  errorMappings: ErrorMapping[]
  callback: { url: string | null; signing: 'hmac_sha256' | 'none' }
  region: string
  notes: string
  color: string
  connectedAt: ISODate
  lastSyncAt: ISODate | null
  /** Demo-only: expected behaviour profile for the simulator's auto mode. */
  profile: SupplierProfile
}

export interface SupplierProfile {
  successRate: number
  latencyMs: number
  jitter: number
}

/** Rolling metrics over the last 7 days (attempt-level). */
export interface SupplierMetrics {
  windowDays: number
  attempts: number
  attempts24h: number
  /** (accepted + terminal rejections) / attempts — supplier answered correctly. */
  successRate: number
  unknown: number
  latencyP50: number
  latencyP95: number
}

export interface SupplierHealthSample {
  supplierId: string
  at: ISODate
  ok: boolean
  latencyMs: number
  note: string
}

export type DriverOperation = 'testConnection' | 'getBalance' | 'syncCatalog' | 'submit' | 'getStatus' | 'parseCallback' | 'cancel'

/** Wire-level record of a (simulated) driver call — shown in supplier logs. */
export interface DriverCall {
  id: string
  supplierId: string
  at: ISODate
  operation: DriverOperation
  orderId: string | null
  attemptId: string | null
  method: string
  endpoint: string
  request: string
  response: string
  httpStatus: number | null
  latencyMs: number
  outcome: string
  ok: boolean
}

/* ------------------------------------------------------------------------- */
/*  Catalog sync                                                             */
/* ------------------------------------------------------------------------- */
export type SyncChangeKind = 'new' | 'price' | 'removed' | 'fields' | 'warning'

export interface SyncChange {
  id: string
  runId: string
  supplierId: string
  kind: SyncChangeKind
  externalId: string
  name: string
  supplierProductId: string | null
  before: { cost?: Micros; fields?: string[]; name?: string } | null
  after: { cost?: Micros; fields?: string[]; name?: string; groupName?: string } | null
  impact: {
    serviceIds: string[]
    offerIds: string[]
    summary: string
    tone: 'neutral' | 'warning' | 'danger' | 'success'
    marginBefore?: Micros | null
    marginAfter?: Micros | null
  }
  decision: 'pending' | 'applied' | 'ignored'
  decidedAt: ISODate | null
  decidedBy: string | null
}

export interface SyncRun {
  id: string
  supplierId: string
  trigger: 'scheduled' | 'manual'
  startedAt: ISODate
  finishedAt: ISODate
  status: 'review_required' | 'applied' | 'no_changes' | 'failed'
  remoteProducts: number
  counts: Record<SyncChangeKind, number>
  error: string | null
}
