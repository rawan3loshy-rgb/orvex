import { env } from '@/config/env'
import { liveRng, sleep } from '@/lib/random'
import type { HttpMethod } from '@/types/installation'
import { ApiError, type ApiRequest, type Transport } from './transport'

export interface RouteContext<B = unknown> {
  params: Record<string, string>
  query: Record<string, string>
  body: B
}

export type RouteHandler<B = unknown> = (ctx: RouteContext<B>) => unknown | Promise<unknown>

export interface MockRoute {
  method: HttpMethod
  pattern: string
  handler: RouteHandler
}

/**
 * Declare a mock route: route('GET', '/orders/:id', ({ params }) => ...).
 * `B` is the JSON body shape the typed client sends: route<{ email: string }>('POST', ...).
 */
export function route<B = unknown>(method: HttpMethod, pattern: string, handler: RouteHandler<B>): MockRoute {
  // The body is the client's JSON payload, unchecked at runtime — B is trusted at this one boundary.
  return { method, pattern, handler: handler as RouteHandler }
}

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const s = path.split('/').filter(Boolean)
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(s[i]!)
    else if (seg !== s[i]) return null
  }
  return params
}

/**
 * In-browser mock backend. Behaves like a REST API: path params, query
 * strings, JSON bodies, status-coded errors and simulated network latency.
 * Responses are deep-cloned so UI code can never mutate the mock database.
 */
export function createMockTransport(routes: MockRoute[], opts?: { name?: string; latency?: [number, number] }): Transport {
  const [lo, hi] = opts?.latency ?? env.mockLatency
  return {
    async request<T>(req: ApiRequest): Promise<T> {
      await sleep(liveRng.int(lo, hi))
      const query: Record<string, string> = {}
      for (const [k, v] of Object.entries(req.query ?? {})) {
        // Same normalisation as the HTTP transport (toQueryString): "all" means no filter.
        if (v !== undefined && v !== null && v !== '' && v !== 'all') query[k] = String(v)
      }
      for (const r of routes) {
        if (r.method !== req.method) continue
        const params = match(r.pattern, req.path)
        if (!params) continue
        try {
          const result = await r.handler({ params, query, body: req.body ? structuredClone(req.body) : undefined })
          return (result === undefined ? null : structuredClone(result)) as T
        } catch (e) {
          if (e instanceof ApiError) throw e
          console.error(`[mock:${opts?.name ?? 'api'}] ${req.method} ${req.path}`, e)
          throw new ApiError(500, 'internal_error', 'Unexpected mock backend error')
        }
      }
      throw new ApiError(404, 'route_not_found', `No mock route for ${req.method} ${req.path}`)
    },
  }
}

export function notFound(entity: string, id: string): never {
  throw new ApiError(404, 'not_found', `${entity} ${id} not found`)
}

export function badRequest(message: string, details?: unknown): never {
  throw new ApiError(422, 'validation_failed', message, details)
}

export function paginate<T>(items: T[], query: Record<string, string>, defaultSize = 25) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? defaultSize)))
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize }
}
