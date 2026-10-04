import { route as baseRoute, type MockRoute, type RouteContext } from '@/api/mockRouter'
import { ApiError } from '@/api/transport'
import { DomainError } from '@/core/errors'
import type { HttpMethod } from '@/types/installation'
import { persistSoon, runtime } from '../boot'
import type { Runtime } from '../runtime'

export type Handler<B = unknown> = (rt: Runtime, c: RouteContext<B>) => unknown

/** The parameter object of a `(ctx, params)` command. */
export type CommandParams<F> = F extends (ctx: never, p: infer P) => unknown ? P : never

/**
 * Request body for a route that forwards to command `F`: the command's parameter
 * object minus `actor` and the keys the route supplies itself (`Supplied`), with
 * the keys the route defaults via `??` made optional (`Defaulted`).
 */
export type BodyFor<F, Supplied extends keyof CommandParams<F> = never, Defaulted extends keyof CommandParams<F> = never> =
  Omit<CommandParams<F>, 'actor' | Supplied | Defaulted> & Partial<Pick<CommandParams<F>, Defaulted>>

/**
 * Declare a route that runs against the demo installation runtime. `B` is the request body shape.
 * Non-GET routes are treated as mutations (persisted and announced to other tabs) unless `readOnly`
 * says the POST is really a query (e.g. a catalog search with a body).
 */
export function r<B = unknown>(method: HttpMethod, pattern: string, fn: Handler<B>, opts: { readOnly?: boolean } = {}): MockRoute {
  return baseRoute<B>(method, pattern, async (c) => {
    const rt = await runtime()
    try {
      const out = fn(rt, c)
      if (method !== 'GET' && !opts.readOnly) persistSoon(rt, { announce: true })
      return out
    } catch (e) {
      if (e instanceof DomainError) throw new ApiError(e.status, e.code, e.message, e.details)
      throw e
    }
  })
}

export function paginate<T>(items: T[], query: Record<string, string>, size = 25) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? size)))
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }
}

export function matches(hay: (string | number | null | undefined)[], q?: string) {
  if (!q) return true
  const needles = q.trim().toLowerCase().split(/\s+/)
  const text = hay.filter((h) => h != null).join(' ').toLowerCase()
  return needles.every((n) => text.includes(n))
}

export const DAY = 86400_000
export const HOUR = 3600_000
export const ts = (iso: string) => new Date(iso).getTime()

export function startOfToday(now: number) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
