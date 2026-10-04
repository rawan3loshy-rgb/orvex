/**
 * React Query hooks for the installation APIs.
 * Query keys are rooted at ['inst', area, ...params]; every mutation made with
 * useInstMutation invalidates them, so all screens stay consistent.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/api'
import {
  accountsService,
  auditService,
  catalogService,
  cockpitService,
  demoService,
  developerService,
  financeService,
  migrationService,
  notificationsService,
  ordersService,
  portalService,
  pricingService,
  storeService,
  type StoreConfigResponse,
  storefrontAdminService,
  suppliersService,
  systemService,
  verificationsService,
} from '@/services/installation'
import type { CatalogQuery, OrderQuery } from '@/types/installation'
import { INST } from './core'

export { useInstMutation, INST } from './core'

const LIVE = 4_000
type Q<T extends (...a: never[]) => unknown> = Parameters<T>[0]

/* Cockpit */
export const useCockpit = () => useQuery({ queryKey: [INST, 'cockpit'], queryFn: cockpitService.get, refetchInterval: LIVE })

/* Orders */
export const useOrders = (q: OrderQuery & { scenario?: string }, opts?: { live?: boolean }) =>
  useQuery({ queryKey: [INST, 'orders', 'list', q], queryFn: () => ordersService.list(q), placeholderData: keepPreviousData, refetchInterval: opts?.live === false ? false : LIVE })
export const useOrderStats = () => useQuery({ queryKey: [INST, 'orders', 'stats'], queryFn: ordersService.stats, refetchInterval: LIVE })
export const useOrder = (id: string | undefined) =>
  useQuery({ queryKey: [INST, 'orders', 'detail', id], queryFn: () => ordersService.get(id!), enabled: !!id, refetchInterval: (q) => (q.state.data && ['awaiting_payment', 'queued', 'processing', 'needs_review'].includes(q.state.data.order.status) ? 2_000 : 10_000) })
export const useVerifications = (status?: string) => useQuery({ queryKey: [INST, 'verifications', status ?? 'all'], queryFn: () => verificationsService.list(status), refetchInterval: LIVE * 2 })

/* Accounts */
export const useAccounts = (q?: Q<typeof accountsService.list>) => useQuery({ queryKey: [INST, 'accounts', 'list', q ?? {}], queryFn: () => accountsService.list(q), placeholderData: keepPreviousData })
export const useAccount = (id: string | undefined) => useQuery({ queryKey: [INST, 'accounts', 'detail', id], queryFn: () => accountsService.get(id!), enabled: !!id, refetchInterval: LIVE * 2 })
export const useAccountsSummary = () => useQuery({ queryKey: [INST, 'accounts', 'summary'], queryFn: accountsService.summary })

/* Catalog & pricing */
export const useCategories = () => useQuery({ queryKey: [INST, 'catalog', 'categories'], queryFn: catalogService.categories, staleTime: 30_000 })
export const useServices = (q?: Q<typeof catalogService.services>) => useQuery({ queryKey: [INST, 'catalog', 'services', q ?? {}], queryFn: () => catalogService.services(q), placeholderData: keepPreviousData })
export const useService = (id: string | undefined) => useQuery({ queryKey: [INST, 'catalog', 'service', id], queryFn: () => catalogService.service(id!), enabled: !!id })
export const useProducts = (q?: Q<typeof catalogService.products>) => useQuery({ queryKey: [INST, 'catalog', 'products', q ?? {}], queryFn: () => catalogService.products(q) })
export const usePricing = () => useQuery({ queryKey: [INST, 'pricing', 'overview'], queryFn: pricingService.overview })
export const usePriceMatrix = (q?: Q<typeof pricingService.matrix>) => useQuery({ queryKey: [INST, 'pricing', 'matrix', q ?? {}], queryFn: () => pricingService.matrix(q), placeholderData: keepPreviousData })
export const useQuote = (serviceId: string | undefined, tierId: string | undefined) => useQuery({ queryKey: [INST, 'pricing', 'quote', serviceId, tierId], queryFn: () => pricingService.quote(serviceId!, tierId!), enabled: !!serviceId && !!tierId })

/* Suppliers */
export const useDrivers = () => useQuery({ queryKey: [INST, 'suppliers', 'drivers'], queryFn: suppliersService.drivers, staleTime: 60_000 })
export const useSuppliers = () => useQuery({ queryKey: [INST, 'suppliers', 'list'], queryFn: suppliersService.list, refetchInterval: LIVE * 2 })
export const useSupplier = (id: string | undefined) => useQuery({ queryKey: [INST, 'suppliers', 'detail', id], queryFn: () => suppliersService.get(id!), enabled: !!id, refetchInterval: LIVE * 2 })
export const useSyncChanges = (q?: Q<typeof suppliersService.syncChanges>) => useQuery({ queryKey: [INST, 'suppliers', 'changes', q ?? {}], queryFn: () => suppliersService.syncChanges(q) })
export const useSyncRuns = () => useQuery({ queryKey: [INST, 'suppliers', 'runs'], queryFn: suppliersService.syncRuns })

/* Finance */
export const useLedgerTransactions = (q: Q<typeof financeService.transactions>) => useQuery({ queryKey: [INST, 'finance', 'tx', q], queryFn: () => financeService.transactions(q), placeholderData: keepPreviousData })
export const useLedgerAccounts = () => useQuery({ queryKey: [INST, 'finance', 'accounts'], queryFn: financeService.ledgerAccounts })
export const useIntegrity = () => useQuery({ queryKey: [INST, 'finance', 'integrity'], queryFn: financeService.integrity, refetchInterval: LIVE * 3 })
export const useReconciliation = () => useQuery({ queryKey: [INST, 'finance', 'recon'], queryFn: financeService.reconciliation, refetchInterval: LIVE * 3 })
export const useFinanceSummary = () => useQuery({ queryKey: [INST, 'finance', 'summary'], queryFn: financeService.summary, refetchInterval: LIVE * 3 })
export const usePaymentMethods = () => useQuery({ queryKey: [INST, 'finance', 'methods'], queryFn: financeService.paymentMethods })
export const usePayments = (q: Q<typeof financeService.payments>) => useQuery({ queryKey: [INST, 'finance', 'payments', q], queryFn: () => financeService.payments(q), placeholderData: keepPreviousData })
export const useRefunds = () => useQuery({ queryKey: [INST, 'finance', 'refunds'], queryFn: financeService.refunds })
export const useChargebacks = () => useQuery({ queryKey: [INST, 'finance', 'chargebacks'], queryFn: financeService.chargebacks })

/* Developer */
export const useApiKeys = (q?: Q<typeof developerService.apiKeys>) => useQuery({ queryKey: [INST, 'dev', 'keys', q ?? {}], queryFn: () => developerService.apiKeys(q) })
export const useApiLogs = (q: Q<typeof developerService.apiLogs>) => useQuery({ queryKey: [INST, 'dev', 'logs', q], queryFn: () => developerService.apiLogs(q), placeholderData: keepPreviousData, refetchInterval: LIVE * 2 })
export const useApiLogStats = () => useQuery({ queryKey: [INST, 'dev', 'logstats'], queryFn: developerService.apiLogStats, refetchInterval: LIVE * 3 })
export const useDhru = () => useQuery({ queryKey: [INST, 'dev', 'dhru'], queryFn: developerService.dhru, refetchInterval: LIVE * 3 })
export const useWebhooks = () => useQuery({ queryKey: [INST, 'dev', 'webhooks'], queryFn: developerService.webhooks, refetchInterval: LIVE * 3 })
export const useWebhookDeliveries = (q: Q<typeof developerService.deliveries>) => useQuery({ queryKey: [INST, 'dev', 'deliveries', q], queryFn: () => developerService.deliveries(q), placeholderData: keepPreviousData, refetchInterval: LIVE * 2 })
export const useInboundWebhooks = (q: Q<typeof developerService.inbound>) => useQuery({ queryKey: [INST, 'dev', 'inbound', q], queryFn: () => developerService.inbound(q), placeholderData: keepPreviousData })
export const useNotifications = (q: Q<typeof notificationsService.list>) => useQuery({ queryKey: [INST, 'notifications', q], queryFn: () => notificationsService.list(q), placeholderData: keepPreviousData, refetchInterval: LIVE * 2 })
export const useNotificationConfig = () => useQuery({ queryKey: [INST, 'notifications', 'config'], queryFn: notificationsService.config })
export const useAudit = (q: Q<typeof auditService.list>) => useQuery({ queryKey: [INST, 'audit', q], queryFn: () => auditService.list(q), placeholderData: keepPreviousData })

/* System */
export const useMe = () => useQuery({ queryKey: [INST, 'me'], queryFn: systemService.me, staleTime: 10_000 })
export const usePermissionCatalog = () => useQuery({ queryKey: [INST, 'permissions'], queryFn: systemService.permissions, staleTime: Infinity })
export const useUsers = () => useQuery({ queryKey: [INST, 'users'], queryFn: systemService.users })
export const useRoles = () => useQuery({ queryKey: [INST, 'roles'], queryFn: systemService.roles })
export const useHealth = () => useQuery({ queryKey: [INST, 'health'], queryFn: systemService.health, refetchInterval: LIVE * 2 })
export const useInstallation = () => useQuery({ queryKey: [INST, 'installation'], queryFn: systemService.installation })
export const useLicense = () => useQuery({ queryKey: [INST, 'license'], queryFn: systemService.license })
export const useUpdates = () => useQuery({ queryKey: [INST, 'updates'], queryFn: systemService.updates })
export const useSettings = () => useQuery({ queryKey: [INST, 'settings'], queryFn: systemService.settings })
export const useGoLive = () => useQuery({ queryKey: [INST, 'golive'], queryFn: systemService.goLive })
export const useStorefrontAdmin = () => useQuery({ queryKey: [INST, 'storefront', 'admin'], queryFn: storefrontAdminService.get })
export const useMigration = () => useQuery({ queryKey: [INST, 'migration'], queryFn: migrationService.get, staleTime: Infinity })

/* Reseller portal */
export const usePortalMe = () => useQuery({ queryKey: [INST, 'portal', 'me'], queryFn: portalService.me, refetchInterval: LIVE * 2 })
export const usePortalDashboard = () => useQuery({ queryKey: [INST, 'portal', 'dashboard'], queryFn: portalService.dashboard, refetchInterval: LIVE * 2 })
export const usePortalServices = (q?: Q<typeof portalService.services>) => useQuery({ queryKey: [INST, 'portal', 'services', q ?? {}], queryFn: () => portalService.services(q), placeholderData: keepPreviousData })
export const usePortalService = (id: string | undefined) => useQuery({ queryKey: [INST, 'portal', 'service', id], queryFn: () => portalService.service(id!), enabled: !!id })
export const usePortalOrders = (q: Q<typeof portalService.orders>) => useQuery({ queryKey: [INST, 'portal', 'orders', q], queryFn: () => portalService.orders(q), placeholderData: keepPreviousData, refetchInterval: LIVE })
export const usePortalOrder = (id: string | undefined) => useQuery({ queryKey: [INST, 'portal', 'order', id], queryFn: () => portalService.order(id!), enabled: !!id, refetchInterval: 2_500 })
export const usePortalWallet = (q: Q<typeof portalService.wallet>) => useQuery({ queryKey: [INST, 'portal', 'wallet', q], queryFn: () => portalService.wallet(q), placeholderData: keepPreviousData })
export const usePortalStatements = () => useQuery({ queryKey: [INST, 'portal', 'statements'], queryFn: portalService.statements })
export const usePortalApiKeys = () => useQuery({ queryKey: [INST, 'portal', 'keys'], queryFn: portalService.apiKeys })
export const usePortalWebhooks = () => useQuery({ queryKey: [INST, 'portal', 'webhooks'], queryFn: portalService.webhooks, refetchInterval: LIVE * 2 })
export const usePortalApiLogs = (q: Q<typeof portalService.apiLogs>) => useQuery({ queryKey: [INST, 'portal', 'logs', q], queryFn: () => portalService.apiLogs(q) })
export const usePortalMembers = () => useQuery({ queryKey: [INST, 'portal', 'members'], queryFn: portalService.members })

/* Storefront */
export const useStoreConfig = (previewToken?: string | null) => useQuery<StoreConfigResponse, ApiError>({ queryKey: [INST, 'store', 'config', previewToken ?? null], queryFn: () => storeService.config(previewToken), staleTime: 5_000, retry: (n, e) => n < 1 && !(e instanceof ApiError && e.status === 403) })
export const useStoreCatalog = (query: CatalogQuery) => useQuery({ queryKey: [INST, 'store', 'catalog', query], queryFn: () => storeService.catalog(query), staleTime: 3_000 })
export const useStoreSearch = (q: string) => useQuery({ queryKey: [INST, 'store', 'search', q], queryFn: () => storeService.search(q), enabled: q.trim().length >= 2, placeholderData: keepPreviousData })
export const useStoreService = (slug: string | undefined, previewToken?: string | null) => useQuery({ queryKey: [INST, 'store', 'service', slug, previewToken ?? null], queryFn: () => storeService.service(slug!, previewToken), enabled: !!slug })
export const useStoreTracking = (token: string | undefined) => useQuery({ queryKey: [INST, 'store', 'track', token], queryFn: () => storeService.track(token!), enabled: !!token, refetchInterval: (q) => (q.state.data && ['completed', 'rejected', 'cancelled'].includes(q.state.data.status) ? false : 2_000) })
export const useStoreAccount = (enabled: boolean) => useQuery({ queryKey: [INST, 'store', 'account'], queryFn: storeService.account, enabled, refetchInterval: LIVE })

/* DEMO / SIMULATION */
export const useDemoState = () => useQuery({ queryKey: [INST, 'demo'], queryFn: demoService.state, refetchInterval: LIVE })
