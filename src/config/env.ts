/**
 * Runtime configuration.
 *
 * The prototype ships with in-browser mock transports. Setting
 * VITE_API_MODE=http switches every service to real HTTP calls against:
 *   - VITE_INSTALLATION_API_URL  → the customer's own installation (e.g. https://portal.unlockdesk-demo.com/api/admin)
 *   - VITE_VENDOR_API_URL        → the vendor platform (account, licensing, releases)
 * No UI code changes are required — only the transport changes.
 */
type ApiMode = 'mock' | 'http'

export const env = {
  apiMode: ((import.meta.env.VITE_API_MODE as string | undefined) ?? 'mock') as ApiMode,
  installationApiUrl: (import.meta.env.VITE_INSTALLATION_API_URL as string | undefined) ?? '/api/admin',
  vendorApiUrl: (import.meta.env.VITE_VENDOR_API_URL as string | undefined) ?? 'https://account.orvex.io/api',
  /** Simulated network latency for mock transports (ms). */
  mockLatency: [90, 260] as [number, number],
}
