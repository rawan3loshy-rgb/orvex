import type { MockRoute } from '@/api/mockRouter'
import { adminOpsRoutes } from './adminOps'
import { adminCatalogRoutes } from './adminCatalog'
import { adminFinanceDevRoutes } from './adminFinanceDev'
import { adminSystemRoutes } from './adminSystem'
import { portalRoutes } from './portal'
import { storeRoutes } from './store'
import { demoRoutes } from './demo'

/**
 * Mock routes of the customer's ORVEX installation (one Core, one database):
 *   /admin/…   operator console API          /portal/… reseller portal API
 *   /store/…   storefront API                 /demo/…   DEMO / SIMULATION controls
 * The native API v1 and DHRU-compatible endpoint are reached through the
 * admin consoles (/admin/console/native, /admin/console/dhru) in the prototype.
 */
export function createInstallationRoutes(): MockRoute[] {
  return [...adminOpsRoutes, ...adminCatalogRoutes, ...adminFinanceDevRoutes, ...adminSystemRoutes, ...portalRoutes, ...storeRoutes, ...demoRoutes]
}
