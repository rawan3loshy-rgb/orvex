import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { PageLoader } from '@/components/layout/PageLoader'
import { ResellerShell } from './ResellerShell'

/**
 * Reseller portal — "UnlockDesk Partner Portal", mounted at /portal by src/app/router.tsx.
 * Served by the customer's own ORVEX installation; every order placed here enters
 * the same PlaceOrder command as the storefront, API, DHRU endpoint and admin.
 */
const load = (f: () => Promise<{ default: ComponentType }>) => lazy(f)
const page = (C: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<PageLoader />}>
    <C />
  </Suspense>
)

const Dashboard = load(() => import('./pages/DashboardPage'))
const PlaceOrder = load(() => import('./pages/PlaceOrderPage'))
const BulkOrders = load(() => import('./pages/BulkOrdersPage'))
const Orders = load(() => import('./pages/OrdersPage'))
const OrderDetail = load(() => import('./pages/OrderDetailPage'))
const Services = load(() => import('./pages/ServicesPage'))
const Wallet = load(() => import('./pages/WalletPage'))
const Statements = load(() => import('./pages/StatementsPage'))
const ApiKeys = load(() => import('./pages/ApiKeysPage'))
const Webhooks = load(() => import('./pages/WebhooksPage'))
const ApiLogs = load(() => import('./pages/ApiLogsPage'))
const Dhru = load(() => import('./pages/DhruPage'))
const Profile = load(() => import('./pages/ProfilePage'))

export const resellerRoute: RouteObject = {
  path: '/portal',
  element: <ResellerShell />,
  children: [
    { index: true, element: page(Dashboard) },
    { path: 'order', element: page(PlaceOrder) },
    { path: 'bulk', element: page(BulkOrders) },
    { path: 'orders', element: page(Orders) },
    { path: 'orders/:ref', element: page(OrderDetail) },
    { path: 'services', element: page(Services) },
    { path: 'wallet', element: page(Wallet) },
    { path: 'statements', element: page(Statements) },
    { path: 'api', element: <Navigate to="/portal/api/keys" replace /> },
    { path: 'api/keys', element: page(ApiKeys) },
    { path: 'api/webhooks', element: page(Webhooks) },
    { path: 'api/logs', element: page(ApiLogs) },
    { path: 'api/dhru', element: page(Dhru) },
    { path: 'profile', element: page(Profile) },
    { path: '*', element: <Navigate to="/portal" replace /> },
  ],
}
