import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AdminShell } from '@/components/layout/AdminShell'
import { PortalShell } from '@/components/layout/PortalShell'
import { resellerRoute } from '@/features/reseller/routes'
import { storefrontRoute } from '@/features/storefront/routes'
import { RouteError } from './RouteError'
import { RootLayout } from './RootLayout'
import { StandaloneLayout } from './StandaloneLayout'

const load = (f: () => Promise<{ default: ComponentType }>) => lazy(f)
const page = (C: LazyExoticComponent<ComponentType>) => <C />

/* Vendor platform (orvex.io / account.orvex.io) — separate from every customer installation */
const LandingPage = load(() => import('@/features/marketing/LandingPage'))
const VendorLoginPage = load(() => import('@/features/auth/VendorLoginPage'))
const PortalOverview = load(() => import('@/features/portal/OverviewPage'))
const PortalSubscription = load(() => import('@/features/portal/SubscriptionPage'))
const PortalBilling = load(() => import('@/features/portal/BillingPage'))
const PortalInvoices = load(() => import('@/features/portal/InvoicesPage'))
const PortalLicense = load(() => import('@/features/portal/LicensePage'))
const PortalInstallation = load(() => import('@/features/portal/InstallationPage'))
const PortalReleases = load(() => import('@/features/portal/ReleasesPage'))
const PortalUpdates = load(() => import('@/features/portal/UpdatesPage'))
const PortalSupport = load(() => import('@/features/portal/SupportPage'))
const PortalAccount = load(() => import('@/features/portal/AccountSettingsPage'))

/* Customer installation — operator console (their-domain.com/admin) */
const InstallationLogin = load(() => import('@/features/auth/InstallationLoginPage'))
const Cockpit = load(() => import('@/features/admin/cockpit/CockpitPage'))
const Orders = load(() => import('@/features/admin/orders/OrdersPage'))
const OrderDetail = load(() => import('@/features/admin/orders/OrderDetailPage'))
const Verifications = load(() => import('@/features/admin/verifications/VerificationsPage'))
const Accounts = load(() => import('@/features/admin/accounts/AccountsPage'))
const AccountDetail = load(() => import('@/features/admin/accounts/AccountDetailPage'))
const Services = load(() => import('@/features/admin/services/ServicesPage'))
const ServiceDetail = load(() => import('@/features/admin/services/ServiceDetailPage'))
const Suppliers = load(() => import('@/features/admin/suppliers/SuppliersPage'))
const SupplierDetail = load(() => import('@/features/admin/suppliers/SupplierDetailPage'))
const SyncReview = load(() => import('@/features/admin/catalog/SyncReviewPage'))
const ProviderApi = load(() => import('@/features/admin/integrations/ProviderApiPage'))
const Pricing = load(() => import('@/features/admin/pricing/PricingPage'))
const Routing = load(() => import('@/features/admin/routing/RoutingPage'))
const Ledger = load(() => import('@/features/admin/finance/LedgerPage'))
const Payments = load(() => import('@/features/admin/finance/PaymentsPage'))
const Reconciliation = load(() => import('@/features/admin/finance/ReconciliationPage'))
const Integrity = load(() => import('@/features/admin/finance/IntegrityPage'))
const StorefrontOverview = load(() => import('@/features/admin/storefront/StorefrontOverviewPage'))
const StorefrontPages = load(() => import('@/features/admin/storefront/PagesPage'))
const StorefrontTheme = load(() => import('@/features/admin/storefront/ThemePage'))
const StorefrontNav = load(() => import('@/features/admin/storefront/NavigationPage'))
const StorefrontSettings = load(() => import('@/features/admin/storefront/StorefrontSettingsPage'))
const ResellerApi = load(() => import('@/features/admin/developer/ResellerApiPage'))
const ApiClients = load(() => import('@/features/admin/developer/ApiClientsPage'))
const ApiPage = load(() => import('@/features/admin/developer/ApiPage'))
const ApiKeys = load(() => import('@/features/admin/developer/ApiKeysPage'))
const Webhooks = load(() => import('@/features/admin/developer/WebhooksPage'))
const ApiLogs = load(() => import('@/features/admin/developer/ApiLogsPage'))
const Dhru = load(() => import('@/features/admin/dhru/DhruPage'))
const Migration = load(() => import('@/features/admin/migration/MigrationPage'))
const Notifications = load(() => import('@/features/admin/system/NotificationsPage'))
const Audit = load(() => import('@/features/admin/system/AuditPage'))
const Roles = load(() => import('@/features/admin/system/RolesPage'))
const Security = load(() => import('@/features/admin/system/SecurityPage'))
const Health = load(() => import('@/features/admin/system/HealthPage'))
const Updates = load(() => import('@/features/admin/system/UpdatesPage'))
const License = load(() => import('@/features/admin/system/LicensePage'))
const Installation = load(() => import('@/features/admin/system/InstallationPage'))
const Extensions = load(() => import('@/features/admin/system/ExtensionsPage'))
const Settings = load(() => import('@/features/admin/system/SettingsPage'))
const Demo = load(() => import('@/features/admin/demo/DemoPage'))

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        element: <StandaloneLayout />,
        children: [{ path: '/', element: page(LandingPage) }, { path: '/login', element: page(VendorLoginPage) }, { path: '/admin/login', element: page(InstallationLogin) }, storefrontRoute, resellerRoute],
      },
      {
        path: '/account',
        element: <PortalShell />,
        children: [
          { index: true, element: page(PortalOverview) },
          { path: 'subscription', element: page(PortalSubscription) },
          { path: 'billing', element: page(PortalBilling) },
          { path: 'invoices', element: page(PortalInvoices) },
          { path: 'invoices/:id', element: page(PortalInvoices) },
          { path: 'license', element: page(PortalLicense) },
          { path: 'installation', element: page(PortalInstallation) },
          { path: 'releases', element: page(PortalReleases) },
          { path: 'updates', element: page(PortalUpdates) },
          { path: 'support', element: page(PortalSupport) },
          { path: 'support/:id', element: page(PortalSupport) },
          { path: 'settings', element: page(PortalAccount) },
        ],
      },
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          { index: true, element: page(Cockpit) },
          { path: 'orders', element: page(Orders) },
          { path: 'orders/:id', element: page(OrderDetail) },
          { path: 'verifications', element: page(Verifications) },
          { path: 'accounts', element: page(Accounts) },
          { path: 'accounts/:id', element: page(AccountDetail) },
          { path: 'services', element: page(Services) },
          { path: 'services/:id', element: page(ServiceDetail) },
          { path: 'suppliers', element: page(Suppliers) },
          { path: 'suppliers/:id', element: page(SupplierDetail) },
          { path: 'catalog/sync', element: page(SyncReview) },
          { path: 'integrations', element: <Navigate to="/admin/integrations/providers" replace /> },
          { path: 'integrations/providers', element: page(ProviderApi) },
          { path: 'pricing', element: page(Pricing) },
          { path: 'routing', element: page(Routing) },
          { path: 'finance', element: <Navigate to="/admin/finance/ledger" replace /> },
          { path: 'finance/ledger', element: page(Ledger) },
          { path: 'finance/payments', element: page(Payments) },
          { path: 'finance/reconciliation', element: page(Reconciliation) },
          { path: 'finance/integrity', element: page(Integrity) },
          { path: 'storefront', element: page(StorefrontOverview) },
          { path: 'storefront/pages', element: page(StorefrontPages) },
          { path: 'storefront/theme', element: page(StorefrontTheme) },
          { path: 'storefront/navigation', element: page(StorefrontNav) },
          { path: 'storefront/settings', element: page(StorefrontSettings) },
          { path: 'developer', element: page(ResellerApi) },
          { path: 'developer/clients', element: page(ApiClients) },
          { path: 'developer/api', element: page(ApiPage) },
          { path: 'developer/keys', element: page(ApiKeys) },
          { path: 'developer/webhooks', element: page(Webhooks) },
          { path: 'developer/logs', element: page(ApiLogs) },
          { path: 'developer/dhru', element: page(Dhru) },
          { path: 'migration', element: page(Migration) },
          { path: 'system', element: <Navigate to="/admin/system/health" replace /> },
          { path: 'system/notifications', element: page(Notifications) },
          { path: 'system/audit', element: page(Audit) },
          { path: 'system/roles', element: page(Roles) },
          { path: 'system/security', element: page(Security) },
          { path: 'system/health', element: page(Health) },
          { path: 'system/updates', element: page(Updates) },
          { path: 'system/license', element: page(License) },
          { path: 'system/installation', element: page(Installation) },
          { path: 'system/go-live', element: <Navigate to="/admin/system/installation" replace /> },
          { path: 'system/extensions', element: page(Extensions) },
          { path: 'settings', element: page(Settings) },
          { path: 'demo', element: page(Demo) },
          { path: '*', element: <Navigate to="/admin" replace /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
