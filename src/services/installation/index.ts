/**
 * Installation services — typed functions over the installation APIs.
 * UI code never calls the API client directly; it goes through these (via hooks).
 *
 *   /admin/…   operator console      /portal/…  reseller portal
 *   /store/…   storefront            /demo/…    DEMO / SIMULATION controls
 */
import { installationApi as api } from '@/api'
import type { Micros } from '@/core/money'
import type {
  AccountDetail,
  AccountRow,
  AdminMe,
  AdminUser,
  ApiKey,
  ApiKeyRow,
  ApiLogEntry,
  ApiLogStats,
  AuditEvent,
  BulkLineResult,
  Category,
  Chargeback,
  CockpitData,
  ConsoleResponse,
  DemoState,
  DhruOverview,
  FieldDef,
  GoLiveItem,
  HealthView,
  InboundWebhook,
  InstallationInfo,
  InstallationLicense,
  InstallationSettings,
  IntegrityReport,
  LedgerOverview,
  LedgerTransaction,
  NotificationChannelConfig,
  NotificationRecord,
  NotificationRoute,
  Offer,
  OrderDetail,
  OrderQuery,
  OrderRow,
  Paginated,
  PaymentIntent,
  PaymentMethodConfig,
  PaymentRow,
  PortalDashboard,
  PortalMe,
  PortalOrder,
  PortalService,
  PriceMatrixRow,
  PriceQuote,
  PricingOverview,
  PricingRule,
  ReconciliationRow,
  Refund,
  ResultFieldDef,
  Role,
  Service,
  ServiceDetail,
  ServiceRevision,
  ServiceRow,
  StatementMonth,
  StoreCheckoutResult,
  StoreServiceCard,
  StoreServiceDetail,
  StoreTracking,
  StorefrontConfig,
  StorefrontContent,
  StorefrontContentSection,
  StorefrontEditorView,
  StorefrontSettings,
  StorefrontPage,
  SupplierDetail,
  SupplierView,
  SyncChange,
  SyncRun,
  UpdateCenterState,
  VerificationRequest,
  WalletLine,
  WebhookDelivery,
  WebhookEndpoint,
  CatalogQuery,
  AccountMember,
  AccountBalance,
  Account,
  PaymentMethodKind,
  ApiScope,
  WebhookEventType,
  DriverId,
  GatewayEvent,
} from '@/types/installation'
import type { InstalledExtension } from '@/types/extensions'

export const cockpitService = {
  get: () => api.get<CockpitData>('/admin/cockpit'),
}

/* ------------------------------- Orders ------------------------------- */
export const ordersService = {
  list: (q: OrderQuery & { scenario?: string }) => api.get<Paginated<OrderRow>>('/admin/orders', q),
  stats: () => api.get<Record<string, number>>('/admin/orders/stats'),
  get: (id: string) => api.get<OrderDetail>(`/admin/orders/${id}`),
  create: (body: { accountId: string; serviceId: string; input: Record<string, string>; clientReference?: string; idempotencyKey?: string }) => api.post<OrderRow>('/admin/orders', body),
  cancel: (id: string, reason: string) => api.post<OrderRow>(`/admin/orders/${id}/cancel`, { reason }),
  refund: (id: string, body: { amount: Micros; destination: 'wallet' | 'original_method'; reason: string; idempotencyKey: string }) => api.post<Refund>(`/admin/orders/${id}/refund`, body),
  lookup: (id: string) => api.post<OrderDetail>(`/admin/orders/${id}/review/lookup`),
  confirmNotReceived: (id: string, body: { reason: string; then: 'retry' | 'cancel' }) => api.post<OrderDetail>(`/admin/orders/${id}/review/confirm-not-received`, body),
  enterReference: (id: string, body: { externalRef: string; reason: string }) => api.post<OrderDetail>(`/admin/orders/${id}/review/reference`, body),
  resolve: (id: string, body: { outcome: 'completed' | 'rejected'; reason: string; result?: Record<string, string> }) => api.post<OrderDetail>(`/admin/orders/${id}/review/resolve`, body),
}

export interface VerificationRow {
  verification: VerificationRequest
  orderRef: string
  orderId: string
  serviceName: string
  accountName: string
  price: Micros
  refunded: Micros
  supplierName: string
  result: string | null
}

export const verificationsService = {
  list: (status?: string) => api.get<VerificationRow[]>('/admin/verifications', { status }),
  recheck: (id: string) => api.post<VerificationRequest>(`/admin/verifications/${id}/recheck`),
  requestSupplier: (id: string) => api.post<VerificationRequest>(`/admin/verifications/${id}/request-supplier`),
  approve: (id: string, body: { amount: Micros; destination: 'wallet' | 'original_method'; note: string }) => api.post<VerificationRequest>(`/admin/verifications/${id}/approve`, body),
  reject: (id: string, note: string) => api.post<VerificationRequest>(`/admin/verifications/${id}/reject`, { note }),
}

/* ------------------------------- Accounts ------------------------------- */
export const accountsService = {
  list: (q?: { search?: string; tier?: string; status?: string; kind?: string; pricingTierId?: string; attention?: boolean; page?: number; pageSize?: number }) => api.get<Paginated<AccountRow>>('/admin/accounts', q),
  get: (id: string) => api.get<AccountDetail>(`/admin/accounts/${id}`),
  summary: () => api.get<{ total: number; guests: number; byTier: Record<string, number>; frozen: number; pending: number; walletLiability: Micros; held: Micros }>('/admin/accounts-summary'),
  create: (body: { name: string; email: string; contactName: string; country: string; tier: Account['tier']; pricingTierId: string; creditLimit: Micros }) => api.post<AccountRow>('/admin/accounts', body),
  update: (id: string, patch: Partial<Account>, reason?: string) => api.patch<AccountRow>(`/admin/accounts/${id}`, { patch, reason }),
  setStatus: (id: string, status: 'active' | 'frozen' | 'closed', reason: string) => api.post<AccountRow>(`/admin/accounts/${id}/status`, { status, reason }),
  adjust: (id: string, body: { amount: Micros; reason: string; idempotencyKey: string }) => api.post<LedgerTransaction>(`/admin/accounts/${id}/adjust`, body),
  topUp: (id: string, body: { amount: Micros; method: PaymentMethodKind }) => api.post<PaymentIntent>(`/admin/accounts/${id}/top-up`, body),
  inviteMember: (id: string, body: { name: string; email: string; role: AccountMember['role'] }) => api.post<AccountMember>(`/admin/accounts/${id}/members`, body),
  updateMember: (id: string, patch: Partial<Pick<AccountMember, 'role' | 'status'>>) => api.patch<AccountMember>(`/admin/members/${id}`, patch),
}

/* ------------------------------- Catalog ------------------------------- */
export interface ProductRow {
  id: string
  supplierId: string
  supplierName: string
  externalId: string
  name: string
  cost: Micros
  remoteFields: string[]
  mapped: number
}

export const catalogService = {
  categories: () => api.get<(Category & { services: number })[]>('/admin/categories'),
  services: (q?: { search?: string; categoryId?: string; status?: string; availability?: string; supplierId?: string }) => api.get<ServiceRow[]>('/admin/services', q),
  service: (id: string) => api.get<ServiceDetail>(`/admin/services/${id}`),
  createService: (body: { name: string; categoryId: string; processing: Service['processing']; turnaround: Service['turnaround']; summary: string; fields: FieldDef[]; resultSchema: ResultFieldDef[] }) => api.post<Service>('/admin/services', body),
  updateService: (id: string, patch: Partial<Service>) => api.patch<Service>(`/admin/services/${id}`, patch),
  publishRevision: (id: string, body: { fields: FieldDef[]; resultSchema?: ResultFieldDef[]; note: string }) => api.post<ServiceRevision>(`/admin/services/${id}/revisions`, body),
  setPrice: (id: string, body: { tierId: string; amount: Micros; reason?: string }) => api.post<PricingRule>(`/admin/services/${id}/price`, body),
  addOffer: (id: string, body: { supplierProductId: string; fieldMapping: Record<string, string>; maxCost: Micros | null }) => api.post<Offer>(`/admin/services/${id}/offers`, body),
  reorderOffers: (id: string, offerIds: string[]) => api.put<Offer[]>(`/admin/services/${id}/offers/order`, { offerIds }),
  updateOffer: (id: string, patch: Partial<Pick<Offer, 'enabled' | 'fieldMapping' | 'maxCost'>>) => api.patch<Offer>(`/admin/offers/${id}`, patch),
  removeOffer: (id: string) => api.delete<{ ok: true }>(`/admin/offers/${id}`),
  products: (q?: { supplierId?: string; search?: string }) => api.get<ProductRow[]>('/admin/products', q),
}

export const pricingService = {
  overview: () => api.get<PricingOverview>('/admin/pricing'),
  matrix: (q?: { categoryId?: string; search?: string; guard?: string }) => api.get<PriceMatrixRow[]>('/admin/pricing/matrix', q),
  quote: (serviceId: string, tierId: string) => api.post<PriceQuote>('/admin/pricing/quote', { serviceId, tierId }),
  createRule: (rule: Omit<PricingRule, 'id' | 'updatedAt' | 'updatedBy'>, reason?: string) => api.post<PricingRule>('/admin/pricing/rules', { rule, reason }),
  updateRule: (id: string, rule: Partial<PricingRule>, reason?: string) => api.patch<PricingRule>(`/admin/pricing/rules/${id}`, { rule, reason }),
  deleteRule: (id: string) => api.delete<{ ok: true }>(`/admin/pricing/rules/${id}`),
}

/* ------------------------------- Suppliers ------------------------------- */
export interface SyncChangeRow extends SyncChange {
  supplierName: string
  services: { id: string; name: string }[]
}

export const suppliersService = {
  drivers: () => api.get<{ id: DriverId; name: string; version: string; protocol: string; suppliers: number }[]>('/admin/drivers'),
  list: () => api.get<SupplierView[]>('/admin/suppliers'),
  get: (id: string) => api.get<SupplierDetail>(`/admin/suppliers/${id}`),
  connect: (body: { name: string; driver: DriverId; url: string; username: string | null; credentials: { key: string; label: string; value: string }[] }) => api.post<SupplierView>('/admin/suppliers', body),
  test: (id: string) => api.post<{ ok: boolean; message: string; steps: { label: string; ok: boolean; ms: number }[] }>(`/admin/suppliers/${id}/test`),
  balance: (id: string) => api.post<{ ok: boolean; balance: Micros | null; message: string }>(`/admin/suppliers/${id}/balance`),
  sync: (id: string) => api.post<SyncRun>(`/admin/suppliers/${id}/sync`),
  maintenance: (id: string, body: { active: boolean; until?: string | null; note?: string }) => api.post<SupplierView>(`/admin/suppliers/${id}/maintenance`, body),
  resetCircuit: (id: string) => api.post<SupplierView>(`/admin/suppliers/${id}/circuit-reset`),
  credentials: (id: string, credentials: { key: string; value: string }[]) => api.post<SupplierView>(`/admin/suppliers/${id}/credentials`, { credentials }),
  update: (id: string, patch: Record<string, unknown>) => api.patch<SupplierView>(`/admin/suppliers/${id}`, patch),
  topUp: (id: string, body: { amount: Micros; idempotencyKey: string }) => api.post<LedgerTransaction>(`/admin/suppliers/${id}/top-up`, body),
  syncChanges: (q?: { supplierId?: string; runId?: string; decision?: string }) => api.get<SyncChangeRow[]>('/admin/sync/changes', q),
  syncRuns: () => api.get<(SyncRun & { supplierName: string })[]>('/admin/sync/runs'),
  decide: (changeIds: string[], decision: 'applied' | 'ignored') => api.post<SyncChange[]>('/admin/sync/changes/decide', { changeIds, decision }),
}

/* ------------------------------- Finance ------------------------------- */
export interface LedgerTxRow extends LedgerTransaction {
  orderRef: string | null
  accountName: string | null
}

export interface FinanceSummary {
  revenue: Micros
  refunds: Micros
  costOfSales: Micros
  walletAvailable: Micros
  walletHeld: Micros
  gatewayClearing: Micros
  supplierPrepaid: Micros
  bank: Micros
  revenue30d: Micros
  cost30d: Micros
  refundsToday: Micros
}

export const financeService = {
  transactions: (q: { kind?: string; account?: string; accountId?: string; orderId?: string; supplierId?: string; search?: string; page?: number; pageSize?: number }) => api.get<Paginated<LedgerTxRow>>('/admin/ledger/transactions', q),
  ledgerAccounts: () => api.get<LedgerOverview>('/admin/ledger/accounts'),
  integrity: () => api.get<IntegrityReport>('/admin/ledger/integrity'),
  reconciliation: () => api.get<ReconciliationRow[]>('/admin/finance/reconciliation'),
  summary: () => api.get<FinanceSummary>('/admin/finance/summary'),
  paymentMethods: () => api.get<PaymentMethodConfig[]>('/admin/payment-methods'),
  setPaymentMethod: (id: string, enabled: boolean) => api.patch<PaymentMethodConfig>(`/admin/payment-methods/${id}`, { enabled }),
  payments: (q: { status?: string; method?: string; purpose?: string; accountId?: string; intent?: string; page?: number; pageSize?: number }) => api.get<Paginated<PaymentRow>>('/admin/payments', q),
  confirmPayment: (id: string) => api.post<PaymentIntent>(`/admin/payments/${id}/confirm`),
  chargeback: (id: string, reason: string) => api.post<Chargeback>(`/admin/payments/${id}/chargeback`, { reason }),
  replayWebhook: (id: string) => api.post<GatewayEvent>(`/admin/payments/${id}/replay-webhook`),
  refunds: () => api.get<(Refund & { orderRef: string | null; accountName: string })[]>('/admin/refunds'),
  chargebacks: () => api.get<(Chargeback & { accountName: string; paymentRef: string })[]>('/admin/chargebacks'),
  resolveChargeback: (id: string, outcome: 'won' | 'lost') => api.post<Chargeback>(`/admin/chargebacks/${id}/resolve`, { outcome }),
}

/* ------------------------------- Developer ------------------------------- */
export interface WebhookEndpointRow extends WebhookEndpoint {
  accountName: string | null
  deliveries24h: number
  failed24h: number
  retrying: number
  successRate24h: number
}

export const developerService = {
  apiKeys: (q?: { accountId?: string; status?: string }) => api.get<ApiKeyRow[]>('/admin/api-keys', q),
  createApiKey: (body: { accountId: string; name: string; environment: 'live' | 'test'; scopes: ApiScope[]; ipAllowlist: string[]; rateLimitPerMin: number; dhruCompat: boolean; expiresInDays: number | null }) => api.post<{ key: ApiKey; secret: string }>('/admin/api-keys', body),
  revokeApiKey: (id: string, reason?: string) => api.post<ApiKey>(`/admin/api-keys/${id}/revoke`, { reason }),
  updateApiKey: (id: string, patch: Partial<ApiKey>) => api.patch<ApiKey>(`/admin/api-keys/${id}`, patch),
  apiLogs: (q: { protocol?: string; status?: string; accountId?: string; keyId?: string; search?: string; page?: number; pageSize?: number }) => api.get<Paginated<ApiLogEntry & { accountName: string | null; orderRef: string | null }>>('/admin/api-logs', q),
  apiLogStats: () => api.get<ApiLogStats>('/admin/api-logs/stats'),
  consoleNative: (body: { method: 'GET' | 'POST'; path: string; headers: Record<string, string>; query?: Record<string, string>; body?: unknown; ip?: string }) => api.post<ConsoleResponse>('/admin/console/native', body),
  consoleDhru: (body: { username: string; apiaccesskey: string; action: string; parameters?: string }) => api.post<ConsoleResponse>('/admin/console/dhru', body),
  dhru: () => api.get<DhruOverview>('/admin/dhru'),
  webhooks: () => api.get<WebhookEndpointRow[]>('/admin/webhooks'),
  createWebhook: (body: { accountId: string | null; url: string; description: string; events: WebhookEventType[] }) => api.post<{ endpoint: WebhookEndpoint; secret: string }>('/admin/webhooks', body),
  updateWebhook: (id: string, patch: Partial<WebhookEndpoint>) => api.patch<WebhookEndpoint>(`/admin/webhooks/${id}`, patch),
  deleteWebhook: (id: string) => api.delete<{ ok: true }>(`/admin/webhooks/${id}`),
  testWebhook: (id: string) => api.post<WebhookDelivery | null>(`/admin/webhooks/${id}/test`),
  deliveries: (q: { endpointId?: string; status?: string; event?: string; orderId?: string; page?: number; pageSize?: number }) => api.get<Paginated<WebhookDelivery & { url: string; orderRef: string | null }>>('/admin/webhook-deliveries', q),
  replayDelivery: (id: string) => api.post<WebhookDelivery>(`/admin/webhook-deliveries/${id}/replay`),
  inbound: (q: { source?: string; status?: string; page?: number; pageSize?: number }) => api.get<Paginated<InboundWebhook & { orderRef: string | null; paymentRef: string | null }>>('/admin/inbound-webhooks', q),
}

export const notificationsService = {
  list: (q: { channel?: string; audience?: string; template?: string; search?: string; page?: number; pageSize?: number }) => api.get<Paginated<NotificationRecord & { orderRef: string | null }>>('/admin/notifications', q),
  config: () => api.get<{ channels: (NotificationChannelConfig & { id: string })[]; routes: (NotificationRoute & { id: string })[] }>('/admin/notifications/config'),
  updateRoute: (id: string, patch: Partial<NotificationRoute>) => api.patch<NotificationRoute>(`/admin/notifications/routes/${id}`, patch),
  updateChannel: (id: string, patch: Partial<NotificationChannelConfig>) => api.patch<NotificationChannelConfig>(`/admin/notifications/channels/${id}`, patch),
}

export const auditService = {
  list: (q: { severity?: string; actorType?: string; targetType?: string; range?: string; search?: string; page?: number; pageSize?: number }) => api.get<Paginated<AuditEvent>>('/admin/audit', q),
}

/* ------------------------------- System ------------------------------- */
export const systemService = {
  me: () => api.get<AdminMe>('/admin/me'),
  permissions: () => api.get<Record<string, { label: string; description: string; sensitive: boolean }>>('/admin/permissions'),
  users: () => api.get<(AdminUser & { roleName: string })[]>('/admin/users'),
  roles: () => api.get<(Role & { users: number })[]>('/admin/roles'),
  inviteUser: (body: { name: string; email: string; roleId: string }) => api.post<AdminUser>('/admin/users', body),
  changeRole: (userId: string, roleId: string, reason?: string) => api.post<AdminUser>(`/admin/users/${userId}/role`, { roleId, reason }),
  revokeSession: (userId: string, sessionId: string) => api.post<AdminUser>(`/admin/users/${userId}/sessions/${sessionId}/revoke`),
  health: () => api.get<HealthView>('/admin/system/health'),
  installation: () => api.get<InstallationInfo>('/admin/system/installation'),
  license: () => api.get<InstallationLicense>('/admin/system/license'),
  validateLicense: () => api.post<InstallationLicense>('/admin/system/license/validate'),
  updates: () => api.get<UpdateCenterState & { entitlement: { status: string; updatesUntil: string; blocked: boolean; message: string } }>('/admin/system/updates'),
  checkUpdates: () => api.post<UpdateCenterState>('/admin/system/updates/check'),
  completeUpdate: (version: string, durationSec: number) => api.post<UpdateCenterState>('/admin/system/updates/complete', { version, durationSec }),
  settings: () => api.get<InstallationSettings>('/admin/system/settings'),
  updateSettings: <K extends keyof InstallationSettings>(section: K, patch: Partial<InstallationSettings[K]>) => api.patch<InstallationSettings>(`/admin/system/settings/${section}`, patch),
  goLive: () => api.get<GoLiveItem[]>('/admin/system/go-live'),
  updateExtension: (id: string, patch: Partial<InstalledExtension>) => api.patch<InstalledExtension>(`/admin/system/extensions/${id}`, patch),
}

/** Storefront content is edited as a DRAFT revision; only publish() changes what visitors see. */
export const storefrontAdminService = {
  /** Draft content + live settings + publishing status. */
  get: () => api.get<StorefrontEditorView>('/admin/storefront'),
  saveDraft: (patch: Partial<Pick<StorefrontContent, StorefrontContentSection>>) => api.patch<StorefrontEditorView>('/admin/storefront/draft', patch),
  savePage: (page: StorefrontPage) => api.put<StorefrontPage>(`/admin/storefront/draft/pages/${page.id}`, page),
  createPage: (page: Omit<StorefrontPage, 'id'>) => api.post<StorefrontPage>('/admin/storefront/draft/pages', page),
  deletePage: (id: string) => api.delete<{ ok: true }>(`/admin/storefront/draft/pages/${id}`),
  discardDraft: () => api.post<StorefrontEditorView>('/admin/storefront/draft/discard'),
  /** Publish the saved draft the admin reviewed (refused if it changed since). */
  publish: (expectedDraftUpdatedAt: string) => api.post<StorefrontEditorView>('/admin/storefront/publish', { expectedDraftUpdatedAt }),
  /** Live commerce settings — not versioned, apply immediately. */
  updateSettings: (patch: Partial<Pick<StorefrontSettings, 'checkout'>>) => api.patch<StorefrontEditorView>('/admin/storefront/settings', patch),
}

export interface MigrationSource {
  panel: string
  host: string
  database: string
  exportFile: string
  exportedAt: string
  scan: { services: number; activeServices: number; categories: number; clients: number; activeClients: number; supplierConnections: number; priceGroups: number; orders: number; creditBalances: Micros; dhruApiResellers: number }
  warnings: { id: string; kind: string; title: string; count: number; samples: { ref: string; detail: string; suggestion: string }[] }[]
  diff: { entity: string; create: number; update: number; skip: number; note: string }[]
  suppliers: { name: string; url: string; driver: string; services: number; status: string }[]
  validation: { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[]
}

export const migrationService = {
  get: () => api.get<MigrationSource>('/admin/migration'),
  run: (step: string) => api.post<{ ok: true; step: string; at: string }>('/admin/migration/run', { step }),
}

/* ------------------------------- Reseller portal ------------------------------- */
export const portalService = {
  me: () => api.get<PortalMe>('/portal/me'),
  dashboard: () => api.get<PortalDashboard>('/portal/dashboard'),
  services: (q?: { search?: string; categoryId?: string }) => api.get<PortalService[]>('/portal/services', q),
  service: (id: string) => api.get<PortalService>(`/portal/services/${id}`),
  orders: (q: { status?: string; search?: string; page?: number; pageSize?: number }) => api.get<Paginated<PortalOrder>>('/portal/orders', q),
  order: (id: string) => api.get<PortalOrder>(`/portal/orders/${id}`),
  placeOrder: (body: { serviceId: string; input: Record<string, string>; clientReference?: string; idempotencyKey: string }) => api.post<PortalOrder>('/portal/orders', body),
  validateBulk: (body: { serviceId: string; text: string }) => api.post<{ lines: BulkLineResult[]; ok: number; invalid: number; unitPrice: Micros; total: Micros; balance: AccountBalance }>('/portal/orders/bulk/validate', body),
  placeBulk: (body: { serviceId: string; imeis: string[]; batchId: string; clientReference?: string; extra?: Record<string, string> }) => api.post<{ batchId: string; results: BulkLineResult[]; placed: number }>('/portal/orders/bulk', body),
  cancel: (id: string) => api.post<PortalOrder>(`/portal/orders/${id}/cancel`),
  verify: (id: string, body: { reason: string; message: string }) => api.post<VerificationRequest>(`/portal/orders/${id}/verify`, body),
  wallet: (q: { page?: number; kind?: string }) => api.get<Paginated<WalletLine> & { balance: AccountBalance; payments: PaymentIntent[] }>('/portal/wallet', q),
  topUp: (body: { amount: Micros; method: PaymentMethodKind }) => api.post<PaymentIntent>('/portal/wallet/top-up', body),
  completePayment: (id: string, outcome: 'succeed' | 'fail' | 'pending') => api.post<PaymentIntent>(`/portal/payments/${id}/complete`, { outcome }),
  statements: () => api.get<StatementMonth[]>('/portal/statements'),
  apiKeys: () => api.get<ApiKey[]>('/portal/api-keys'),
  createApiKey: (body: { name: string; scopes: ApiScope[]; ipAllowlist: string[]; dhruCompat: boolean; environment: 'live' | 'test' }) => api.post<{ key: ApiKey; secret: string }>('/portal/api-keys', body),
  revokeApiKey: (id: string) => api.post<ApiKey>(`/portal/api-keys/${id}/revoke`),
  webhooks: () => api.get<(WebhookEndpoint & { recent: WebhookDelivery[] })[]>('/portal/webhooks'),
  createWebhook: (body: { url: string; description: string; events: WebhookEventType[] }) => api.post<{ endpoint: WebhookEndpoint; secret: string }>('/portal/webhooks', body),
  updateWebhook: (id: string, patch: Partial<WebhookEndpoint>) => api.patch<WebhookEndpoint>(`/portal/webhooks/${id}`, patch),
  deleteWebhook: (id: string) => api.delete<{ ok: true }>(`/portal/webhooks/${id}`),
  testWebhook: (id: string) => api.post<WebhookDelivery | null>(`/portal/webhooks/${id}/test`),
  apiLogs: (q: { page?: number }) => api.get<Paginated<ApiLogEntry>>('/portal/api-logs', q),
  members: () => api.get<AccountMember[]>('/portal/members'),
  inviteMember: (body: { name: string; email: string; role: AccountMember['role'] }) => api.post<AccountMember>('/portal/members', body),
  updateMember: (id: string, patch: Partial<Pick<AccountMember, 'role' | 'status'>>) => api.patch<AccountMember>(`/portal/members/${id}`, patch),
}

/* ------------------------------- Storefront ------------------------------- */
export interface StoreConfigResponse extends StorefrontConfig {
  categories: (Category & { services: number })[]
  customer: { id: string; name: string; email: string; tierName: string; balance: AccountBalance } | null
  paymentMethods: PaymentMethodConfig[]
}

export const storeService = {
  /** Published storefront, or the draft when an admin preview token is given. */
  config: (previewToken?: string | null) => api.get<StoreConfigResponse>('/store/config', previewToken ? { preview: previewToken } : undefined),
  catalog: (query: CatalogQuery) => api.post<StoreServiceCard[]>('/store/catalog', { query }),
  search: (q: string) => api.get<StoreServiceCard[]>('/store/search', { q }),
  service: (slug: string, previewToken?: string | null) => api.get<StoreServiceDetail>(`/store/services/${slug}`, previewToken ? { preview: previewToken } : undefined),
  checkout: (body: { serviceId: string; input: Record<string, string>; email?: string; method: PaymentMethodKind | 'wallet'; idempotencyKey: string }) => api.post<StoreCheckoutResult>('/store/checkout', body),
  completePayment: (id: string, outcome: 'succeed' | 'fail' | 'pending') => api.post<{ status: string; failureReason: string | null; ref: string }>(`/store/payments/${id}/complete`, { outcome }),
  retryPayment: (token: string, method: PaymentMethodKind) => api.post<{ paymentIntentId: string; paymentRef: string; amount: Micros; method: string }>(`/store/orders/${token}/retry-payment`, { method }),
  track: (token: string) => api.get<StoreTracking>(`/store/track/${token}`),
  lookup: (ref: string, email: string) => api.get<{ trackingToken: string }>('/store/lookup', { ref, email }),
  account: () => api.get<{ account: Account; balance: AccountBalance; orders: (PortalOrder & { trackingToken: string | null })[] }>('/store/account'),
  session: (accountId: string | null) => api.post<{ accountId: string | null }>('/store/session', { accountId }),
}

/* ------------------------------- DEMO / SIMULATION ------------------------------- */
export const demoService = {
  state: () => api.get<DemoState>('/demo/state'),
  supplierBehaviour: (body: { supplierId: string; behaviour: string; remaining: number | null; received?: boolean }) => api.post<DemoState>('/demo/supplier-behaviour', body),
  clearBehaviours: () => api.post<DemoState>('/demo/supplier-behaviour/clear'),
  supplierState: (body: { supplierId: string; credentialsValid?: boolean; maintenance?: boolean; balanceDelta?: Micros }) => api.post<DemoState>('/demo/supplier-state', body),
  traffic: (body: { enabled?: boolean; perMinute?: number }) => api.post<DemoState>('/demo/traffic', body),
  paymentOutcome: (outcome: 'auto' | 'succeed' | 'fail' | 'pending') => api.post<DemoState>('/demo/payment-outcome', { outcome }),
  verificationOutcome: (faulty: boolean) => api.post<DemoState>('/demo/verification-outcome', { faulty }),
  fastForward: (minutes: number) => api.post<{ ran: number; minutes: number; state: DemoState }>('/demo/fast-forward', { minutes }),
  actAs: (userId: string) => api.post<DemoState>('/demo/act-as', { userId }),
  portalMember: (memberId: string) => api.post<DemoState>('/demo/portal-member', { memberId }),
  storefrontCustomer: (accountId: string | null) => api.post<DemoState>('/demo/storefront-customer', { accountId }),
  license: (status: 'active' | 'updates_expired') => api.post<DemoState>('/demo/license', { status }),
  reset: () => api.post<DemoState>('/demo/reset'),
}

export type { Micros }
