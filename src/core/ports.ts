/**
 * Ports — the boundary between ORVEX Core and infrastructure.
 *
 * Domain services and commands depend only on these interfaces. The prototype
 * provides in-memory implementations (src/mock/installation/repositories,
 * drivers, gateways); production replaces them with PostgreSQL repositories,
 * real HTTP supplier drivers and real payment gateways — without touching the
 * domain code.
 */
import type { Micros } from './money'
import type { IdGenerator } from './ids'
import type {
  Account,
  AccountMember,
  ApiKey,
  ApiLogEntry,
  AuditEvent,
  AdminUser,
  Category,
  Chargeback,
  DriverCall,
  DriverId,
  GatewayEvent,
  IdempotencyRecord,
  InboundWebhook,
  Job,
  JobKind,
  LedgerAccountBalance,
  LedgerTransaction,
  NotificationChannelConfig,
  NotificationRecord,
  NotificationRoute,
  Offer,
  Order,
  OrderResult,
  PaymentIntent,
  PaymentMethodConfig,
  PaymentMethodKind,
  PricingRule,
  PricingTier,
  Refund,
  Role,
  Service,
  ServiceRevision,
  StorefrontState,
  Supplier,
  SupplierHealthSample,
  SupplierProduct,
  SyncChange,
  SyncRun,
  VerificationRequest,
  WebhookDelivery,
  WebhookEndpoint,
} from './domain'

/* ------------------------------------------------------------------------- */
/*  Repositories                                                             */
/* ------------------------------------------------------------------------- */
export interface Collection<T extends { id: string }> {
  get(id: string): T | undefined
  /** Throws a domain NotFound error. */
  require(id: string): T
  all(): T[]
  filter(pred: (x: T) => boolean): T[]
  find(pred: (x: T) => boolean): T | undefined
  count(pred?: (x: T) => boolean): number
  insert(item: T): T
  /** Shallow-merge a patch, or mutate through a function. */
  update(id: string, patch: Partial<T> | ((x: T) => void)): T
  remove(id: string): void
}

export interface OrderRepository extends Collection<Order> {
  byRef(ref: string): Order | undefined
  byTrackingToken(token: string): Order | undefined
  /** Newest first. */
  recent(limit?: number): Order[]
}

export interface LedgerRepository {
  /** Append a balanced transaction. Rejects unbalanced or duplicate-key transactions. */
  post(tx: LedgerTransaction): LedgerTransaction
  byIdempotencyKey(key: string): LedgerTransaction | undefined
  get(id: string): LedgerTransaction | undefined
  /** Newest first. */
  transactions(filter?: (t: LedgerTransaction) => boolean): LedgerTransaction[]
  forOrder(orderId: string): LedgerTransaction[]
  /** Projection: balance of one ledger account (O(1) — maintained on post). */
  balance(account: string): LedgerAccountBalance
  balances(prefix?: string): LedgerAccountBalance[]
  /** Recompute every projection from raw entries (integrity check). */
  recompute(): Map<string, LedgerAccountBalance>
  entryCount(): number
}

export interface IdempotencyRepository {
  get(accountId: string, key: string): IdempotencyRecord | undefined
  put(record: IdempotencyRecord): void
  all(): IdempotencyRecord[]
}

export interface Repositories {
  accounts: Collection<Account>
  members: Collection<AccountMember>
  categories: Collection<Category>
  services: Collection<Service>
  revisions: Collection<ServiceRevision>
  products: Collection<SupplierProduct>
  offers: Collection<Offer>
  tiers: Collection<PricingTier>
  rules: Collection<PricingRule>
  suppliers: Collection<Supplier>
  healthSamples: Collection<SupplierHealthSample & { id: string }>
  driverCalls: Collection<DriverCall>
  syncRuns: Collection<SyncRun>
  syncChanges: Collection<SyncChange>
  orders: OrderRepository
  ledger: LedgerRepository
  paymentMethods: Collection<PaymentMethodConfig & { id: PaymentMethodKind }>
  payments: Collection<PaymentIntent>
  refunds: Collection<Refund>
  chargebacks: Collection<Chargeback>
  gatewayEvents: Collection<GatewayEvent>
  verifications: Collection<VerificationRequest>
  notifications: Collection<NotificationRecord>
  notificationRoutes: Collection<NotificationRoute & { id: string }>
  notificationChannels: Collection<NotificationChannelConfig & { id: string }>
  apiKeys: Collection<ApiKey>
  apiLogs: Collection<ApiLogEntry>
  idempotency: IdempotencyRepository
  webhookEndpoints: Collection<WebhookEndpoint>
  webhookDeliveries: Collection<WebhookDelivery>
  inboundWebhooks: Collection<InboundWebhook>
  audit: Collection<AuditEvent>
  users: Collection<AdminUser>
  roles: Collection<Role>
  /** Draft + published storefront revisions and live site settings. `set` replaces the whole state atomically. */
  storefront: { get(): StorefrontState; set(s: StorefrontState): void }
}

/* ------------------------------------------------------------------------- */
/*  Supplier drivers                                                         */
/* ------------------------------------------------------------------------- */
export interface DriverResult<T> {
  latencyMs: number
  value: T
  call: DriverCall
}

export interface SubmitRequest {
  order: Order
  attemptId: string
  attemptNo: number
  supplier: Supplier
  product: SupplierProduct
  offer: Offer
  service: Service
  revision: ServiceRevision
  /** Input already mapped to the supplier's field names. */
  mappedFields: Record<string, string>
}

export type SubmitResponse =
  | { kind: 'accepted'; externalRef: string; result?: OrderResult; message: string; /** Async orders: when the supplier expects to finish. */ etaMs?: number }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'rate_limited'; message: string; retryAfterSec: number }
  | { kind: 'insufficient_funds'; message: string }
  | { kind: 'auth_failed'; message: string }
  /** Request never reached the supplier (DNS / TCP refused / TLS). */
  | { kind: 'connect_error'; message: string }
  /** Request was sent; no response within the timeout. */
  | { kind: 'timeout'; message: string }
  /** Request was sent; response unusable (5xx, malformed). Outcome unknown. */
  | { kind: 'bad_response'; httpStatus: number; message: string }

export type RemoteOrderState = 'pending' | 'processing' | 'completed' | 'rejected' | 'not_found'

export interface StatusResponse {
  state: RemoteOrderState
  externalRef: string | null
  result?: OrderResult
  message: string
  /** Driver-native status, e.g. DHRU numeric status. Kept at the edge only. */
  native: string
  /** Suggested delay before the next poll. */
  retryAfterMs?: number
}

export interface RemoteProduct {
  externalId: string
  name: string
  groupName: string
  cost: Micros
  fields: string[]
  processingHint: string
}

export interface SupplierDriver {
  id: DriverId
  name: string
  version: string
  /** One-line protocol description shown in the UI. */
  protocol: string
  testConnection(supplier: Supplier): DriverResult<{ ok: boolean; message: string; steps: { label: string; ok: boolean; ms: number }[] }>
  getBalance(supplier: Supplier): DriverResult<{ ok: boolean; balance: Micros | null; message: string }>
  syncCatalog(supplier: Supplier, current: SupplierProduct[]): DriverResult<{ ok: boolean; products: RemoteProduct[]; message: string }>
  submit(req: SubmitRequest): DriverResult<SubmitResponse>
  getStatus(supplier: Supplier, order: Order, externalRef: string | null): DriverResult<StatusResponse>
  parseCallback(supplier: Supplier, payload: string): { externalRef: string; state: RemoteOrderState; message: string }
  normalizeResult(raw: Record<string, unknown>): Record<string, string | number | boolean>
  cancel(supplier: Supplier, externalRef: string): DriverResult<{ ok: boolean; message: string }>
}

export interface DriverRegistry {
  get(id: DriverId): SupplierDriver
  all(): SupplierDriver[]
}

/* ------------------------------------------------------------------------- */
/*  Payment gateway                                                          */
/* ------------------------------------------------------------------------- */
export type SimulatedPaymentOutcome = 'succeed' | 'fail' | 'pending'

export interface PaymentGateway {
  /** Register an intent with the (simulated) gateway. */
  createIntent(intent: PaymentIntent): { gatewayRef: string }
  /** Simulate the customer completing (or failing) the payment. Returns the gateway notifications it would send. */
  complete(intent: PaymentIntent, outcome: SimulatedPaymentOutcome): GatewayEvent[]
  refund(intent: PaymentIntent, amount: Micros): { ok: boolean; gatewayRef: string; message: string }
}

/* ------------------------------------------------------------------------- */
/*  Scheduler (job queue) and clock                                          */
/* ------------------------------------------------------------------------- */
export interface Scheduler {
  schedule(kind: JobKind, payload: Record<string, string>, dueAt: number): Job
  cancel(pred: (job: Job) => boolean): number
  pending(): Job[]
}

export interface Clock {
  now(): number
  iso(at?: number): string
}

/* ------------------------------------------------------------------------- */
/*  Outbound HTTP (webhook deliveries to customer endpoints)                  */
/* ------------------------------------------------------------------------- */
export interface OutboundHttp {
  /** POST a signed webhook. Simulated in the prototype — nothing leaves the browser. */
  postWebhook(endpoint: WebhookEndpoint, delivery: WebhookDelivery): { httpStatus: number | null; latencyMs: number; error: string | null }
}

/** Everything a command or domain service needs. */
export interface CoreContext {
  repo: Repositories
  drivers: DriverRegistry
  gateway: PaymentGateway
  outbound: OutboundHttp
  scheduler: Scheduler
  clock: Clock
  ids: IdGenerator
}
