/**
 * Simulated outbound HTTP for webhook deliveries. Nothing leaves the browser:
 * endpoints marked "failing" in the demo answer 5xx / time out, others 200.
 */
import type { Rng } from '@/lib/random'
import type { OutboundHttp } from '@/core/ports'

export function createMockOutbound(rng: Rng, failingHosts: () => Set<string>): OutboundHttp {
  return {
    postWebhook(endpoint) {
      const host = (() => {
        try {
          return new URL(endpoint.url).host
        } catch {
          return endpoint.url
        }
      })()
      const failing = endpoint.status === 'failing' || failingHosts().has(host)
      if (failing && rng.bool(0.85)) {
        const timeout = rng.bool(0.35)
        return timeout ? { httpStatus: null, latencyMs: 10_000, error: 'Timed out after 10 s' } : { httpStatus: rng.pick([500, 502, 503]), latencyMs: rng.int(80, 900), error: 'Non-2xx response' }
      }
      return { httpStatus: 200, latencyMs: rng.int(60, 420), error: null }
    },
  }
}
