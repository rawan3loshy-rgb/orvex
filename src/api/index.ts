/**
 * API clients.
 *
 * Two independent backends, mirroring the production architecture:
 *
 *  installationApi → the customer's own ORVEX Core installation
 *                    (their server, their PostgreSQL, their data)
 *  vendorApi       → the vendor platform (account, subscription, license,
 *                    billing, releases, support)
 *
 * The two never share a database. Swap the mock transports for HTTP by
 * setting VITE_API_MODE=http — services and UI stay unchanged.
 */
import { env } from '@/config/env'
import { createInstallationRoutes } from '@/mock/installation/routes'
import { createVendorRoutes } from '@/mock/vendor/routes'
import { createApiClient } from './client'
import { createHttpTransport } from './http'
import { createMockTransport } from './mockRouter'

export const installationApi = createApiClient(
  env.apiMode === 'http'
    ? createHttpTransport(env.installationApiUrl)
    : createMockTransport(createInstallationRoutes(), { name: 'installation' }),
)

export const vendorApi = createApiClient(
  env.apiMode === 'http' ? createHttpTransport(env.vendorApiUrl) : createMockTransport(createVendorRoutes(), { name: 'vendor' }),
)

export { ApiError } from './transport'
