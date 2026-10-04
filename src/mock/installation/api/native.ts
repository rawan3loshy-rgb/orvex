/**
 * Native API v1 — the reseller / partner REST API (simulated server side).
 *
 *   GET  /v1/services              GET  /v1/services/:id
 *   POST /v1/orders                POST /v1/orders/batch
 *   GET  /v1/orders                GET  /v1/orders/:id
 *   POST /v1/orders/:id/cancel     POST /v1/orders/:id/verify
 *   GET  /v1/account               GET  /v1/account/transactions
 *
 * Auth: `Authorization: Bearer orx_live_…`. Keys belong to accounts; scopes, IP
 * allow-lists and rate limits are enforced here. `Idempotency-Key` is scoped to
 * the account (not the key), so a retry through another key or channel still
 * returns the original order. Every request is written to the API log.
 * These handlers mutate the real mock state — the API console is not canned.
 */
import type { Rng } from '@/lib/random'
import type { CoreContext } from '@/core/ports'
import type { Account, Actor, ApiKey, ApiScope, Order, OrderStatus } from '@/core/domain'
import { DomainError } from '@/core/errors'
import { placeOrder, cancelOrder } from '@/core/commands/orders'
import { openVerification } from '@/core/commands/verification'
import { quote } from '@/core/services/pricing'
import { availability } from '@/core/services/routing'
import { walletBalance, walletLines } from '@/core/services/ledger'
import { apiAccountSummary, apiMoney, apiOrder, apiService } from '@/core/services/presenters'
import type { MockRepositories } from '../store'

export interface ApiRuntime {
  ctx: CoreContext
  repo: MockRepositories
  rng: Rng
}

export interface ApiRequest {
  method: 'GET' | 'POST'
  path: string
  headers: Record<string, string>
  query?: Record<string, string>
  body?: unknown
  ip?: string
  userAgent?: string
}

export interface ApiResponse {
  status: number
  body: unknown
  headers: Record<string, string>
}

const err = (status: number, code: string, message: string, details?: unknown) => ({ status, body: { error: { code, message, ...(details ? { details } : {}) } } })

function serviceAllowed(account: Account, serviceId: string, categoryId: string) {
  const a = account.serviceAccess
  return a.mode === 'all' || (a.mode === 'categories' ? a.categoryIds.includes(categoryId) : a.serviceIds.includes(serviceId))
}

export function authenticate(rt: ApiRuntime, header: string | undefined, ip: string, protocol: 'native' | 'dhru'): { key: ApiKey; account: Account } | { status: number; body: unknown } {
  const token = (header ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return err(401, 'missing_api_key', 'Send your key as Authorization: Bearer orx_live_…')
  const key = rt.repo.apiKeys.find((k) => token === k.prefix || token.startsWith(`${k.prefix}_`))
  if (!key) return err(401, 'invalid_api_key', 'The API key provided is invalid')
  if (key.status !== 'active') return err(401, 'invalid_api_key', 'This API key has been revoked')
  if (key.expiresAt && new Date(key.expiresAt).getTime() < rt.ctx.clock.now()) return err(401, 'expired_api_key', 'This API key has expired')
  if (protocol === 'dhru' && !key.dhruCompat) return err(401, 'dhru_not_enabled', 'This key is not enabled for the DHRU-compatible endpoint')
  if (key.ipAllowlist.length && !key.ipAllowlist.some((rule) => ipMatches(ip, rule))) return err(403, 'ip_not_allowed', `Requests from ${ip} are not allowed for this key`)
  const account = rt.repo.accounts.require(key.accountId)
  if (account.status === 'frozen') return err(403, 'account_frozen', `Account is frozen${account.statusReason ? `: ${account.statusReason}` : ''}`)
  if (account.status !== 'active') return err(403, 'account_inactive', `Account is ${account.status}`)
  const since = rt.ctx.clock.now() - 60_000
  let recent = 0
  for (const l of rt.repo.apiLogs.all()) {
    if (new Date(l.at).getTime() < since) break
    if (l.apiKeyId === key.id) recent++
  }
  if (recent >= key.rateLimitPerMin) return err(429, 'rate_limited', `Rate limit of ${key.rateLimitPerMin} requests/min exceeded`, { retry_after: 12 })
  return { key, account }
}

function ipMatches(ip: string, rule: string) {
  if (!rule.includes('/')) return ip === rule
  const [base, bits] = rule.split('/')
  const toInt = (x: string) => x.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0
  return (toInt(ip) & mask) === (toInt(base!) & mask)
}

function requireScope(key: ApiKey, scope: ApiScope) {
  return key.scopes.includes(scope) ? null : err(403, 'insufficient_scope', `This key lacks the ${scope} scope`)
}

function findOwnOrder(rt: ApiRuntime, account: Account, id: string): Order | null {
  const o = rt.repo.orders.byRef(id) ?? rt.repo.orders.get(id)
  return o && o.accountId === account.id ? o : null
}

function fromDomainError(e: unknown) {
  if (e instanceof DomainError) return err(e.status, e.code, e.message, e.details)
  throw e
}

function inputFrom(body: Record<string, unknown>) {
  const raw = (body.input ?? body.fields ?? {}) as Record<string, unknown>
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]))
}

function resolveService(rt: ApiRuntime, id: unknown) {
  const s = String(id ?? '')
  return rt.repo.services.find((x) => x.code === s || x.id === s)
}

/** Route a native API request. Logs the call and returns the HTTP response. */
export function handleNative(rt: ApiRuntime, req: ApiRequest): ApiResponse {
  const started = rt.ctx.clock.now()
  const ip = req.ip ?? `203.0.113.${rt.rng.int(2, 250)}`
  const requestId = `req_${rt.ctx.ids.token(20)}`
  const idemKey = req.headers['idempotency-key'] ?? null
  const auth = authenticate(rt, req.headers.authorization, ip, 'native')
  let res: { status: number; body: unknown }
  let key: ApiKey | null = null
  let account: Account | null = null
  let replayed = false
  let orderId: string | null = null
  if ('status' in auth) res = auth
  else {
    key = auth.key
    account = auth.account
    const actor: Actor = { type: 'api_key', id: key.id, name: `${account.name} · ${key.prefix}…` }
    const r = route(rt, req, key, account, actor, idemKey)
    res = r.res
    replayed = r.replayed
    orderId = r.orderId
    key.lastUsedAt = rt.ctx.clock.iso()
  }
  const status = res.status
  const latency = status >= 400 ? rt.rng.int(6, 40) : req.method === 'POST' ? rt.rng.int(60, 260) : rt.rng.int(12, 90)
  const endpoint = normalise(req.method, req.path)
  rt.repo.apiLogs.insert({
    id: rt.ctx.ids.id('log'),
    requestId,
    at: rt.ctx.clock.iso(started),
    protocol: 'native',
    method: req.method,
    path: req.path + (req.query && Object.keys(req.query).length ? `?${new URLSearchParams(req.query).toString()}` : ''),
    endpoint,
    status,
    latencyMs: latency,
    accountId: account?.id ?? null,
    apiKeyId: key?.id ?? null,
    keyPrefix: key?.prefix ?? (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').slice(0, 13) ?? null,
    ip,
    userAgent: req.userAgent ?? 'curl/8.7.1',
    idempotencyKey: idemKey,
    replayed,
    errorCode: status >= 400 ? ((res.body as { error?: { code?: string } }).error?.code ?? 'error') : null,
    requestBody: req.body ? JSON.stringify(req.body, null, 2) : null,
    responseBody: JSON.stringify(res.body, null, 2),
    orderId,
  })
  return { status, body: res.body, headers: { 'x-request-id': requestId, ...(replayed ? { 'idempotent-replayed': 'true' } : {}), 'x-ratelimit-limit': String(key?.rateLimitPerMin ?? 0) } }
}

function normalise(method: string, path: string) {
  const p = path
    .replace(/\/v1\/orders\/(ORD-[A-Z0-9]+|ord_[a-z0-9]+)/, '/v1/orders/:id')
    .replace(/\/v1\/services\/[^/]+$/, '/v1/services/:id')
  return `${method} ${p}`
}

function route(rt: ApiRuntime, req: ApiRequest, key: ApiKey, account: Account, actor: Actor, idemKey: string | null): { res: { status: number; body: unknown }; replayed: boolean; orderId: string | null } {
  const ok = (body: unknown, status = 200) => ({ res: { status, body }, replayed: false, orderId: null })
  const parts = req.path.replace(/^\/v1\/?/, '').split('/').filter(Boolean)
  const body = (req.body ?? {}) as Record<string, unknown>
  try {
    /* Services */
    if (parts[0] === 'services' && req.method === 'GET') {
      const denied = requireScope(key, 'services:read')
      if (denied) return { res: denied, replayed: false, orderId: null }
      const list = rt.repo.services.filter((s) => s.visibility.api && s.status === 'active' && serviceAllowed(account, s.id, s.categoryId))
      const present = (s: (typeof list)[number]) => {
        const q = quote(rt.ctx, s.id, account.pricingTierId)
        return apiService(rt.ctx, s, q.amount, availability(rt.ctx, s, q.amount).available)
      }
      if (parts[1]) {
        const s = list.find((x) => x.code === parts[1] || x.id === parts[1])
        return s ? ok(present(s)) : { res: err(404, 'not_found', `Service ${parts[1]} not found`), replayed: false, orderId: null }
      }
      return ok({ object: 'list', data: list.map(present), has_more: false })
    }

    /* Account */
    if (parts[0] === 'account' && req.method === 'GET') {
      const denied = requireScope(key, 'account:read')
      if (denied) return { res: denied, replayed: false, orderId: null }
      if (parts[1] === 'transactions') {
        const lines = walletLines(rt.ctx, account.id).slice(0, Number(req.query?.limit ?? 50))
        return ok({ object: 'list', data: lines.map((l) => ({ id: l.ref, at: l.at, type: l.kind, description: l.description, order: l.orderRef, available_change: apiMoney(l.available), held_change: apiMoney(l.held), available_after: apiMoney(l.availableAfter) })) })
      }
      const tier = rt.repo.tiers.get(account.pricingTierId)?.name ?? ''
      return ok(apiAccountSummary(account, walletBalance(rt.ctx, account.id), tier))
    }

    /* Orders */
    if (parts[0] === 'orders') {
      if (req.method === 'POST' && parts[1] === 'batch') {
        const denied = requireScope(key, 'orders:write')
        if (denied) return { res: denied, replayed: false, orderId: null }
        const items = (body.orders as Record<string, unknown>[] | undefined) ?? []
        if (!items.length || items.length > 100) return { res: err(422, 'validation_failed', 'Send 1–100 orders in "orders"'), replayed: false, orderId: null }
        const results = items.map((it, i) => {
          const svc = resolveService(rt, it.service)
          if (!svc) return { index: i, status: 404, error: { code: 'not_found', message: `Service ${String(it.service)} not found` } }
          try {
            const r = placeOrder(rt.ctx, { accountId: account.id, serviceId: svc.id, input: inputFrom(it), channel: 'api', actor, idempotencyKey: idemKey ? `${idemKey}:${i}` : null, clientReference: (it.client_reference as string) ?? null, payment: { mode: 'wallet' } })
            return { index: i, status: r.replayed ? 200 : 201, order: apiOrder(rt.ctx, r.order) }
          } catch (e) {
            const x = fromDomainError(e)
            return { index: i, status: x.status, ...(x.body as object) }
          }
        })
        const accepted = results.filter((r) => r.status < 300).length
        return ok({ object: 'batch', accepted, rejected: results.length - accepted, results }, accepted ? 207 : 422)
      }
      if (req.method === 'POST' && !parts[1]) {
        const denied = requireScope(key, 'orders:write')
        if (denied) return { res: denied, replayed: false, orderId: null }
        const svc = resolveService(rt, body.service ?? body.service_id)
        if (!svc) return { res: err(404, 'not_found', `Service ${String(body.service ?? body.service_id ?? '')} not found`), replayed: false, orderId: null }
        const r = placeOrder(rt.ctx, { accountId: account.id, serviceId: svc.id, input: inputFrom(body), channel: 'api', actor, idempotencyKey: idemKey, clientReference: (body.client_reference as string) ?? null, payment: { mode: 'wallet' } })
        return { res: { status: r.replayed ? 200 : 201, body: apiOrder(rt.ctx, r.order) }, replayed: r.replayed, orderId: r.order.id }
      }
      if (req.method === 'GET' && !parts[1]) {
        const denied = requireScope(key, 'orders:read')
        if (denied) return { res: denied, replayed: false, orderId: null }
        const status = req.query?.status as OrderStatus | undefined
        const limit = Math.min(100, Number(req.query?.limit ?? 25))
        const list = rt.repo.orders
          .recent()
          .filter((o) => o.accountId === account.id && (!status || o.status === status || (status === 'processing' && o.status === 'needs_review')))
          .slice(0, limit)
        return ok({ object: 'list', data: list.map((o) => apiOrder(rt.ctx, o)), has_more: false })
      }
      const order = parts[1] ? findOwnOrder(rt, account, parts[1]) : null
      if (!order) return { res: err(404, 'not_found', `Order ${parts[1]} not found`), replayed: false, orderId: null }
      if (req.method === 'GET' && !parts[2]) {
        const denied = requireScope(key, 'orders:read')
        if (denied) return { res: denied, replayed: false, orderId: null }
        return { res: { status: 200, body: apiOrder(rt.ctx, order) }, replayed: false, orderId: order.id }
      }
      if (req.method === 'POST' && parts[2] === 'cancel') {
        const denied = requireScope(key, 'orders:write')
        if (denied) return { res: denied, replayed: false, orderId: null }
        const o = cancelOrder(rt.ctx, { orderId: order.id, actor, reason: (body.reason as string) || 'Cancelled via API' })
        return { res: { status: 200, body: apiOrder(rt.ctx, o) }, replayed: false, orderId: order.id }
      }
      if (req.method === 'POST' && parts[2] === 'verify') {
        const denied = requireScope(key, 'orders:write')
        if (denied) return { res: denied, replayed: false, orderId: null }
        const v = openVerification(rt.ctx, { orderId: order.id, reason: (body.reason as never) ?? 'other', message: String(body.message ?? ''), actor })
        return { res: { status: 201, body: { id: v.ref, object: 'verification_request', order: order.ref, status: v.status, reason: v.reason, message: v.message, created_at: v.createdAt } }, replayed: false, orderId: order.id }
      }
    }
    return ok(err(404, 'route_not_found', `No route for ${req.method} ${req.path}`).body, 404)
  } catch (e) {
    return { res: fromDomainError(e), replayed: false, orderId: null }
  }
}
