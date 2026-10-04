/**
 * Installation API contract (DTOs) — what the admin console, reseller portal,
 * storefront and demo controls receive from ORVEX Core.
 *
 * Domain entities come straight from src/core/domain (single source of truth);
 * the DTOs below add joined labels and projections. All money is `Micros`
 * (integer micro-units) — format with `formatMoney` from '@/core/money'.
 */
import type { Micros } from '@/core/money'
import type {
  Account,
  AccountBalance,
  AccountMember,
  ApiKey,
  ApiLogEntry,
  Attempt,
  AuditEvent,
  Category,
  Chargeback,
  DriverCall,
  FieldDef,
  FinancialStatus,
  GoLiveItem,
  HealthComponent,
  InboundWebhook,
  IntegrityReport,
  LedgerAccountBalance,
  LedgerTransaction,
  NotificationRecord,
  Offer,
  Order,
  OrderChannel,
  OrderEvent,
  OrderStatus,
  PaymentIntent,
  PriceQuote,
  PricingRule,
  PricingTier,
  Refund,
  ResultFieldDef,
  Service,
  ServiceRevision,
  Supplier,
  SupplierHealth,
  SupplierHealthSample,
  SupplierMetrics,
  SupplierProduct,
  SyncChange,
  SyncRun,
  VerificationRequest,
  WalletLine,
  WebhookDelivery,
  WebhookEndpoint,
} from '@/core/domain'

export type * from '@/core/domain'
export type { Micros } from '@/core/money'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/* ------------------------------------------------------------------------- */
/*  Cockpit                                                                  */
/* ------------------------------------------------------------------------- */
export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface CockpitAlert {
  id: string
  severity: AlertSeverity
  area: 'orders' | 'suppliers' | 'catalog' | 'finance' | 'api' | 'webhooks' | 'accounts' | 'system'
  title: string
  detail: string
  href: string
  count?: number
}

export interface CockpitSupplier {
  id: string
  name: string
  driver: string
  health: SupplierHealth
  successRate: number
  latencyP50: number
  balance: Micros
  threshold: Micros
  drift: Micros
  circuit: Supplier['circuit']['state']
}

export interface CockpitData {
  generatedAt: string
  orders: {
    today: number
    yesterdaySameTime: number
    completedToday: number
    rejectedToday: number
    successRate24h: number
    medianProcessingSec: number
    processing: number
    queued: number
    needsReview: number
    awaitingPayment: number
    oldestReviewAt: string | null
  }
  money: {
    revenueToday: Micros
    costToday: Micros
    marginToday: Micros
    marginPct: number
    heldTotal: Micros
    capturedToday: Micros
    refundsToday: Micros
    walletLiability: Micros
  }
  ledger: { status: IntegrityReport['status']; warnings: number; failures: number; checkedAt: string }
  suppliers: CockpitSupplier[]
  catalog: { unavailable: { id: string; name: string; reason: string }[]; negativeMargin: { serviceId: string; name: string; tier: string; margin: Micros }[]; lowMargin: number; pendingSyncChanges: number }
  api: { requests24h: number; errors24h: number; errorRate: number; dhruRequests24h: number }
  webhooks: { failingEndpoints: number; failed24h: number; retrying: number; delivered24h: number }
  accounts: { lowBalance: { id: string; name: string; available: Micros }[]; frozen: { id: string; name: string; reason: string | null }[] }
  verifications: { open: number; awaitingSupplier: number }
  alerts: CockpitAlert[]
  throughput: { t: string; completed: number; rejected: number; review: number }[]
  feed: { id: string; at: string; tone: string; title: string; detail: string; href?: string }[]
}

/* ------------------------------------------------------------------------- */
/*  Orders                                                                   */
/* ------------------------------------------------------------------------- */
export interface OrderRow {
  id: string
  ref: string
  accountId: string
  accountName: string
  accountTier: Account['tier']
  channel: OrderChannel
  serviceId: string
  serviceName: string
  categoryName: string
  input: Record<string, string>
  price: Micros
  supplierCost: Micros | null
  status: OrderStatus
  financialStatus: FinancialStatus
  supplierName: string | null
  attempts: number
  failover: boolean
  reviewReason: string | null
  resultSummary: string | null
  refundedTotal: Micros
  createdAt: string
  updatedAt: string
  completedAt: string | null
  scenario: string | null
}

export interface OrderQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: OrderStatus | 'open' | 'all'
  financial?: FinancialStatus | 'all'
  channel?: OrderChannel | 'all'
  accountId?: string
  serviceId?: string
  supplierId?: string
  failover?: boolean
  range?: '24h' | '7d' | '30d' | 'all'
}

export interface RouteCandidateView {
  offerId: string
  priority: number
  supplierId: string
  supplierName: string
  productName: string
  cost: Micros
  routable: boolean
  eligible: boolean
  attempted: boolean
  marginBlocked: boolean
  reasons: string[]
}

export interface OrderDetail {
  order: Order
  account: Pick<Account, 'id' | 'name' | 'tier' | 'number' | 'email' | 'kind' | 'status'>
  service: Pick<Service, 'id' | 'name' | 'code' | 'processing' | 'categoryId'>
  revision: ServiceRevision
  ledger: LedgerTransaction[]
  payment: PaymentIntent | null
  refunds: Refund[]
  verifications: VerificationRequest[]
  webhooks: WebhookDelivery[]
  notifications: NotificationRecord[]
  driverCalls: DriverCall[]
  candidates: RouteCandidateView[]
  held: Micros
  refundable: Micros
  dhruStatus: number
  publicStatus: { status: string; detail: string | null }
  supplierNames: Record<string, string>
}

/* ------------------------------------------------------------------------- */
/*  Accounts                                                                 */
/* ------------------------------------------------------------------------- */
export interface AccountRow {
  account: Account
  balance: AccountBalance
  tierName: string
  orders30d: number
  spend30d: Micros
  openOrders: number
  lowBalance: boolean
}

export interface AccountDetail extends AccountRow {
  members: AccountMember[]
  apiKeys: ApiKey[]
  webhooks: WebhookEndpoint[]
  recentOrders: OrderRow[]
  wallet: WalletLine[]
  payments: PaymentIntent[]
  refunds: Refund[]
  verifications: VerificationRequest[]
  dhruUsername: string | null
}

/* ------------------------------------------------------------------------- */
/*  Catalog & pricing                                                        */
/* ------------------------------------------------------------------------- */
export interface ServiceRow {
  service: Service
  categoryName: string
  offers: number
  routableOffers: number
  available: boolean
  unavailableReason: string | null
  retail: PriceQuote
  orders30d: number
}

export interface OfferView {
  offer: Offer
  product: SupplierProduct | null
  supplier: Pick<Supplier, 'id' | 'name' | 'driver'> & { health: SupplierHealth }
  cost: Micros
  routable: boolean
  reasons: string[]
}

export interface ServiceDetail {
  service: Service
  category: Category
  revision: ServiceRevision
  revisions: ServiceRevision[]
  offers: OfferView[]
  quotes: PriceQuote[]
  rules: (PricingRule & { label: string })[]
  availability: { available: boolean; reason: string | null; routableOffers: number; totalOffers: number }
  stats: { orders30d: number; completed30d: number; rejected30d: number; revenue30d: Micros; margin30d: Micros }
  recentOrders: OrderRow[]
  inputSchema: Record<string, unknown>
  dhruMapping: { field: string; type: string; dhruParam: string | null }[]
}

export interface PricingOverview {
  tiers: (PricingTier & { accounts: number })[]
  rules: (PricingRule & { label: string; scopeLabel: string })[]
}

export interface PriceMatrixRow {
  serviceId: string
  name: string
  categoryName: string
  referenceCost: Micros | null
  prices: Record<string, { amount: Micros; guard: PriceQuote['guard']; marginBps: number | null; method: string; inherited: boolean }>
}

/* ------------------------------------------------------------------------- */
/*  Suppliers                                                                */
/* ------------------------------------------------------------------------- */
export interface SupplierView {
  supplier: Supplier
  health: SupplierHealth
  metrics: SupplierMetrics
  reconciliation: { ledger: Micros; inFlight: Micros; expected: Micros; actual: Micros; drift: Micros; unknown: { orderId: string; orderRef: string; cost: Micros }[] }
  driver: { id: string; name: string; version: string; protocol: string }
  products: number
  offers: number
  services: number
  lastSync: SyncRun | null
  pendingChanges: number
}

export interface SupplierDetail extends SupplierView {
  productList: (SupplierProduct & { offerCount: number; services: { id: string; name: string; priority: number }[] })[]
  calls: DriverCall[]
  samples: SupplierHealthSample[]
  syncRuns: SyncRun[]
  changes: SyncChange[]
}

/* ------------------------------------------------------------------------- */
/*  Finance                                                                  */
/* ------------------------------------------------------------------------- */
export interface LedgerOverview {
  groups: { group: string; name: string; type: string; total: Micros; accounts: number }[]
  accounts: LedgerAccountBalance[]
  totals: { debits: Micros; credits: Micros; transactions: number; entries: number }
}

export interface ReconciliationRow extends SupplierView {
  explanation: string
}

export interface PaymentRow extends PaymentIntent {
  accountName: string
  orderRef: string | null
}

/* ------------------------------------------------------------------------- */
/*  Developer                                                                */
/* ------------------------------------------------------------------------- */
export interface ApiKeyRow extends ApiKey {
  accountName: string
  requests24h: number
}

export interface ApiLogStats {
  requests24h: number
  errors24h: number
  errorRate: number
  p50: number
  p95: number
  byEndpoint: { endpoint: string; count: number }[]
  byProtocol: { native: number; dhru: number }
}

export interface DhruOverview {
  enabled: boolean
  endpoint: string
  connectedAccounts: { id: string; name: string; username: string; keyPrefix: string; lastUsedAt: string | null; orders7d: number }[]
  ordersToday: number
  errors24h: number
  requests24h: number
  mapping: { dhru: number; label: string; orvex: string[]; note: string }[]
  actions: string[]
  recent: ApiLogEntry[]
}

export interface ConsoleResponse {
  status: number
  headers: Record<string, string>
  body: unknown
  latencyMs: number
}

/* ------------------------------------------------------------------------- */
/*  Admin identity & system                                                  */
/* ------------------------------------------------------------------------- */
export interface AdminMe {
  userId: string
  name: string
  email: string
  role: string
  permissions: string[]
}

export interface HealthView {
  checkedAt: string
  overall: 'healthy' | 'degraded' | 'down' | 'attention'
  components: HealthComponent[]
  queue: { pending: number; due: number; byKind: Record<string, number> }
  incidents: { id: string; title: string; status: string; startedAt: string; resolvedAt: string | null; component: string }[]
}

export type { GoLiveItem }

/* ------------------------------------------------------------------------- */
/*  Reseller portal                                                          */
/* ------------------------------------------------------------------------- */
export interface PortalMe {
  member: AccountMember
  account: Account
  balance: AccountBalance
  tierName: string
  canManageApi: boolean
  canOrder: boolean
  canSeeFinance: boolean
  dhruUsername: string | null
}

export interface PortalService {
  id: string
  code: string
  name: string
  categoryId: string
  categoryName: string
  summary: string
  processing: Service['processing']
  turnaround: Service['turnaround']
  price: Micros
  retailPrice: Micros
  available: boolean
  unavailableReason: string | null
  fields: FieldDef[]
  resultSchema: ResultFieldDef[]
  revision: number
  tags: string[]
}

export interface PortalOrder {
  id: string
  ref: string
  serviceName: string
  serviceCode: string
  input: Record<string, string>
  price: Micros
  status: string
  statusDetail: string | null
  financialStatus: FinancialStatus
  result: Order['result']
  rejection: Order['rejection']
  clientReference: string | null
  channel: OrderChannel
  refundedTotal: Micros
  createdAt: string
  completedAt: string | null
  timeline: { at: string; title: string; detail?: string; tone: string }[]
  verifications: VerificationRequest[]
  resultSchema: ResultFieldDef[]
}

export interface PortalDashboard {
  ordersToday: number
  processing: number
  completed7d: number
  rejected7d: number
  spend30d: Micros
  avgTurnaroundSec: number
  recent: PortalOrder[]
  spendByDay: { t: string; spend: number; orders: number }[]
  topServices: { name: string; orders: number }[]
}

export interface StatementMonth {
  month: string
  opening: Micros
  topUps: Micros
  orders: Micros
  refunds: Micros
  adjustments: Micros
  closing: Micros
  lines: number
}

export interface BulkLineResult {
  line: number
  imei: string
  ok: boolean
  orderRef?: string
  error?: string
  checks: { label: string; ok: boolean }[]
}

/* ------------------------------------------------------------------------- */
/*  Storefront                                                               */
/* ------------------------------------------------------------------------- */
export interface StoreServiceCard {
  id: string
  slug: string
  code: string
  name: string
  summary: string
  categoryId: string
  categoryName: string
  icon: string
  price: Micros
  available: boolean
  unavailableReason: string | null
  processing: Service['processing']
  turnaround: Service['turnaround']
  featured: boolean
  tags: string[]
}

export interface StoreServiceDetail extends StoreServiceCard {
  description: string
  fields: FieldDef[]
  resultSchema: ResultFieldDef[]
  revision: number
  templateSections: string[]
  related: StoreServiceCard[]
  tierName: string
}

export interface StoreTracking {
  ref: string
  serviceName: string
  status: string
  statusDetail: string | null
  financialStatus: FinancialStatus
  price: Micros
  input: Record<string, string>
  result: Order['result']
  rejection: Order['rejection']
  createdAt: string
  completedAt: string | null
  steps: { key: string; label: string; state: 'done' | 'current' | 'todo' | 'failed'; at: string | null }[]
  resultSchema: ResultFieldDef[]
  payment: { ref: string; method: string; status: string } | null
  email: string
}

export interface StoreCheckoutResult {
  orderRef: string
  trackingToken: string
  paymentIntentId: string
  paymentRef: string
  amount: Micros
  method: string
}

/* ------------------------------------------------------------------------- */
/*  Demo / simulation                                                        */
/* ------------------------------------------------------------------------- */
export interface DemoState {
  sessions: { adminUserId: string; portalMemberId: string; storefrontAccountId: string | null }
  rules: { supplierId: string; behaviour: string; remaining: number | null; setAt: string; orderRef?: string }[]
  behaviours: { id: string; label: string; effect: string }[]
  traffic: { enabled: boolean; perMinute: number }
  nextPayment: string
  verificationFaulty: boolean
  scenarios: { id: string; title: string; description: string; links: { label: string; href: string }[] }[]
  demoImeis: { imei: string; story: string }[]
  users: { id: string; name: string; role: string }[]
  members: { id: string; name: string; role: string; accountId: string; accountName: string }[]
  customers: { id: string; name: string; email: string }[]
  suppliers: { id: string; name: string; health: SupplierHealth; remoteBalance: Micros; credentialsValid: boolean; maintenance: boolean }[]
  jobs: { pending: number; next: { kind: string; dueAt: number } | null }
  seededAt: number
  licenseStatus: string
}

export type { Attempt, AuditEvent, Chargeback, InboundWebhook, OrderEvent }
