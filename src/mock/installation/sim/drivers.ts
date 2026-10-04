/**
 * Simulated supplier drivers (MockSupplierDriver implementations).
 *
 *   MockDhruFusionDriver  DHRU Fusion-compatible HTTP API: form-POST to /api/index.php,
 *                         actions accountinfo / imeiservicelist / placeimeiorder /
 *                         getimeiorder, JSON responses, numeric statuses 0/1/3/4.
 *                         (HTTP + JSON — not SOAP/WSDL.)
 *   MockOrvexRestDriver   Generic JSON REST supplier API (instant results inline).
 *   ManualDriver          A supplier that fulfils by hand (work queue) — results arrive later.
 *
 * They implement the real SupplierDriver port. Nothing leaves the browser: each
 * "request" is applied to the supplier's simulated remote state and logged as a
 * DriverCall with a realistic wire representation.
 */
import type { Rng } from '@/lib/random'
import type { IdGenerator } from '@/core/ids'
import { formatMoney, sub, add, type Micros } from '@/core/money'
import type { Clock, DriverRegistry, DriverResult, RemoteOrderState, Repositories, StatusResponse, SubmitRequest, SubmitResponse, SupplierDriver } from '@/core/ports'
import type { DriverCall, DriverId, DriverOperation, Order, Supplier, SupplierProduct } from '@/core/domain'
import { fromDhruStatus } from '@/core/edge/dhru'
import { generateResult } from './results'
import { takeBehaviour, type RemoteOrder, type RemoteSupplierState, type SimBehaviour, type SimulationState } from './simulator'

export interface SimEnv {
  sim: SimulationState
  rng: Rng
  clock: Clock
  ids: IdGenerator
  repo: Repositories
  /** True once the seed has finished — live orders use demo-friendly durations. */
  live: () => boolean
}

const TERMINAL_REJECTIONS = ['IMEI not found in manufacturer database', 'Device not eligible: contract or financing still active', 'Model does not match this IMEI', 'Serial number not recognised']
const SAFE_REJECTIONS = ['Source unavailable for this model', 'Service temporarily disabled by supplier', 'Out of stock — try again later']

export function remoteOf(env: SimEnv, supplierId: string): RemoteSupplierState {
  let r = env.sim.remote[supplierId]
  if (!r) {
    r = { supplierId, balance: 0 as Micros, credentialsValid: true, maintenance: false, catalog: [], orders: {}, byOrderRef: {}, nextRef: 81_000_000 + Math.floor(env.rng.next() * 9_000_000) }
    env.sim.remote[supplierId] = r
  }
  return r
}

function decide(env: SimEnv, s: Supplier, cost: Micros, orderRef: string): { behaviour: SimBehaviour; received?: boolean } {
  const forced = takeBehaviour(env.sim, s.id, orderRef)
  if (forced) return forced
  const remote = remoteOf(env, s.id)
  if (!remote.credentialsValid) return { behaviour: 'auth_error' }
  if (remote.balance < cost) return { behaviour: 'insufficient_funds' }
  if (env.rng.next() < s.profile.successRate) return { behaviour: env.rng.bool(0.03) ? 'slow' : 'success' }
  return { behaviour: env.rng.weighted(['rejected', 'rejected_safe', 'rate_limited', 'timeout', 'unknown', 'network_error'] as const, [52, 22, 9, 6, 3, 8]) }
}

function latency(env: SimEnv, s: Supplier) {
  return Math.max(60, Math.round(env.rng.normal(s.profile.latencyMs, s.profile.latencyMs * s.profile.jitter)))
}

/** How long the supplier takes to finish an accepted order. */
function etaMs(env: SimEnv, req: SubmitRequest) {
  const { minSec, maxSec } = req.service.turnaround
  if (req.service.processing === 'instant') return env.live() ? env.rng.int(3_000, 9_000) : env.rng.int(Math.max(5, minSec), Math.max(10, maxSec)) * 1000
  return env.rng.int(minSec, maxSec) * 1000
}

function call(env: SimEnv, s: Supplier, op: DriverOperation, p: { method: string; endpoint: string; request: string; response: string; httpStatus: number | null; latencyMs: number; outcome: string; ok: boolean; order?: Order; attemptId?: string }): DriverCall {
  return {
    id: env.ids.id('drv'),
    supplierId: s.id,
    at: env.clock.iso(),
    operation: op,
    orderId: p.order?.id ?? null,
    attemptId: p.attemptId ?? null,
    method: p.method,
    endpoint: p.endpoint,
    request: p.request,
    response: p.response,
    httpStatus: p.httpStatus,
    latencyMs: p.latencyMs,
    outcome: p.outcome,
    ok: p.ok,
  }
}

const secret = (s: Supplier) => s.connection.credentials[0]?.masked ?? '••••••••'

/* ------------------------------------------------------------------------- */
/*  Wire formats                                                             */
/* ------------------------------------------------------------------------- */
interface Wire {
  id: DriverId
  name: string
  version: string
  protocol: string
  submitReq(s: Supplier, p: SupplierProduct, fields: Record<string, string>, order: Order): { method: string; endpoint: string; body: string }
  ok(ref: string, result?: Record<string, unknown>): string
  err(code: string, message: string): string
  statusReq(s: Supplier, ref: string): { method: string; endpoint: string; body: string }
  statusRes(state: RemoteOrderState, ref: string, code: string): { body: string; native: string }
  instantInline: boolean
}

const DHRU: Wire = {
  id: 'dhru_fusion',
  name: 'DHRU Fusion driver',
  version: '2.1.0',
  protocol: 'HTTP form-POST + JSON (DHRU Fusion API v6.1)',
  submitReq: (s, p, fields, order) => ({
    method: 'POST',
    endpoint: '/api/index.php',
    body: [
      `username=${s.connection.username ?? 'orvex'}`,
      `apiaccesskey=${secret(s)}`,
      'action=placeimeiorder',
      'requestformat=JSON',
      `parameters=<PARAMETERS><ID>${p.externalId}</ID>${Object.entries(fields)
        .map(([k, v]) => `<${k}>${v}</${k}>`)
        .join('')}<REFERENCE>${order.ref}</REFERENCE></PARAMETERS>`,
    ].join('\n'),
  }),
  ok: (ref) => JSON.stringify({ SUCCESS: [{ MESSAGE: 'Order received', REFERENCEID: ref }], apiversion: '6.1' }, null, 2),
  err: (_code, message) => JSON.stringify({ ERROR: [{ MESSAGE: message }], apiversion: '6.1' }, null, 2),
  statusReq: (s, ref) => ({ method: 'POST', endpoint: '/api/index.php', body: [`username=${s.connection.username ?? 'orvex'}`, `apiaccesskey=${secret(s)}`, 'action=getimeiorder', 'requestformat=JSON', `parameters=<PARAMETERS><ID>${ref}</ID></PARAMETERS>`].join('\n') }),
  statusRes: (state, ref, code) => {
    const n = state === 'completed' ? 4 : state === 'rejected' ? 3 : state === 'processing' ? 1 : 0
    return { native: `DHRU ${n}`, body: JSON.stringify({ SUCCESS: [{ ID: ref, STATUS: String(n), CODE: code }], apiversion: '6.1' }, null, 2) }
  },
  instantInline: false,
}

const REST: Wire = {
  id: 'orvex_rest',
  name: 'ORVEX REST driver',
  version: '1.4.2',
  protocol: 'HTTPS JSON REST (Bearer token, HMAC-signed callbacks)',
  submitReq: (_s, p, fields, order) => ({ method: 'POST', endpoint: '/v1/orders', body: JSON.stringify({ product: p.externalId, fields, reference: order.ref }, null, 2) }),
  ok: (ref, result) => JSON.stringify({ id: ref, status: result ? 'completed' : 'accepted', ...(result ? { result } : {}) }, null, 2),
  err: (code, message) => JSON.stringify({ error: { code, message } }, null, 2),
  statusReq: (_s, ref) => ({ method: 'GET', endpoint: `/v1/orders/${ref}`, body: '' }),
  statusRes: (state, ref, code) => ({ native: state, body: JSON.stringify({ id: ref, status: state, ...(code ? { result: code } : {}) }, null, 2) }),
  instantInline: true,
}

const MANUAL: Wire = {
  id: 'manual',
  name: 'Manual fulfilment driver',
  version: '1.0.0',
  protocol: 'Work queue (email + supplier portal) — results entered by the supplier',
  submitReq: (_s, p, fields, order) => ({ method: 'QUEUE', endpoint: 'manual://work-queue', body: JSON.stringify({ product: p.name, fields, reference: order.ref }, null, 2) }),
  ok: (ref) => JSON.stringify({ queued: true, ticket: ref }, null, 2),
  err: (code, message) => JSON.stringify({ error: code, message }, null, 2),
  statusReq: (_s, ref) => ({ method: 'QUEUE', endpoint: `manual://work-queue/${ref}`, body: '' }),
  statusRes: (state, ref, code) => ({ native: state, body: JSON.stringify({ ticket: ref, state, ...(code ? { result: code } : {}) }, null, 2) }),
  instantInline: false,
}

/* ------------------------------------------------------------------------- */
/*  Driver factory                                                           */
/* ------------------------------------------------------------------------- */
function settleRemote(env: SimEnv, remote: RemoteSupplierState, ro: RemoteOrder) {
  if (ro.state !== 'processing' && ro.state !== 'pending') return
  if (env.clock.now() < ro.completeAt) return
  if (ro.rejectMessage) {
    ro.state = 'rejected'
    if (ro.charged) {
      remote.balance = add(remote.balance, ro.cost)
      ro.charged = false
    }
  } else ro.state = 'completed'
}

function makeDriver(env: SimEnv, w: Wire): SupplierDriver {
  const remoteCode = (ro: RemoteOrder) => (ro.state === 'completed' ? (ro.result?.summary ?? '') : ro.state === 'rejected' ? (ro.rejectMessage ?? '') : '')

  return {
    id: w.id,
    name: w.name,
    version: w.version,
    protocol: w.protocol,

    testConnection(s) {
      const remote = remoteOf(env, s.id)
      const steps = [
        { label: 'DNS & TLS handshake', ok: !remote.maintenance, ms: env.rng.int(18, 60) },
        { label: 'Authenticate', ok: remote.credentialsValid && !remote.maintenance, ms: env.rng.int(60, 180) },
        { label: w.id === 'dhru_fusion' ? 'API version 6.1' : 'API version', ok: !remote.maintenance && remote.credentialsValid, ms: env.rng.int(20, 60) },
        { label: 'Account info & balance', ok: !remote.maintenance && remote.credentialsValid, ms: env.rng.int(80, 240) },
      ]
      const ok = steps.every((x) => x.ok)
      const message = remote.maintenance ? 'Supplier returned 503 — scheduled maintenance' : !remote.credentialsValid ? 'Authentication failed — API key rejected' : `Connected · balance ${formatMoney(remote.balance)}`
      const ms = steps.reduce((a, x) => a + x.ms, 0)
      return {
        latencyMs: ms,
        value: { ok, message, steps },
        call: call(env, s, 'testConnection', { method: w.id === 'dhru_fusion' ? 'POST' : 'GET', endpoint: w.id === 'dhru_fusion' ? '/api/index.php (action=accountinfo)' : '/v1/account', request: w.id === 'dhru_fusion' ? `username=${s.connection.username}\napiaccesskey=${secret(s)}\naction=accountinfo` : 'Authorization: Bearer ••••', response: ok ? JSON.stringify(w.id === 'dhru_fusion' ? { SUCCESS: [{ AccoutInfo: { credit: (remote.balance / 1e6).toFixed(2), currency: 'USD' } }] } : { balance: (remote.balance / 1e6).toFixed(2), currency: 'USD' }, null, 2) : w.err('auth', message), httpStatus: ok ? 200 : remote.maintenance ? 503 : 401, latencyMs: ms, outcome: ok ? 'ok' : 'failed', ok }),
      }
    },

    getBalance(s) {
      const remote = remoteOf(env, s.id)
      const ms = latency(env, s)
      const ok = remote.credentialsValid && !remote.maintenance
      return {
        latencyMs: ms,
        value: { ok, balance: ok ? remote.balance : null, message: ok ? `Balance ${formatMoney(remote.balance)}` : 'Balance unavailable' },
        call: call(env, s, 'getBalance', { method: w.id === 'dhru_fusion' ? 'POST' : 'GET', endpoint: w.id === 'dhru_fusion' ? '/api/index.php (action=accountinfo)' : '/v1/account/balance', request: '', response: ok ? JSON.stringify({ credit: (remote.balance / 1e6).toFixed(2) }) : w.err('auth', 'Authentication failed'), httpStatus: ok ? 200 : 401, latencyMs: ms, outcome: ok ? 'ok' : 'failed', ok }),
      }
    },

    syncCatalog(s) {
      const remote = remoteOf(env, s.id)
      const ok = remote.credentialsValid && !remote.maintenance
      const ms = env.rng.int(600, 1800)
      return {
        latencyMs: ms,
        value: { ok, products: ok ? structuredClone(remote.catalog) : [], message: ok ? `${remote.catalog.length} products` : 'Catalog unavailable' },
        call: call(env, s, 'syncCatalog', { method: w.id === 'dhru_fusion' ? 'POST' : 'GET', endpoint: w.id === 'dhru_fusion' ? '/api/index.php (action=imeiservicelist)' : '/v1/products', request: '', response: ok ? `{ "products": [ …${remote.catalog.length} items… ] }` : w.err('unavailable', 'Catalog unavailable'), httpStatus: ok ? 200 : 503, latencyMs: ms, outcome: ok ? `${remote.catalog.length} products` : 'failed', ok }),
      }
    },

    submit(req): DriverResult<SubmitResponse> {
      const { supplier: s, product, order } = req
      const remote = remoteOf(env, s.id)
      const { behaviour, received: forcedReceived } = decide(env, s, product.cost, order.ref)
      const wire = w.submitReq(s, product, req.mappedFields, order)
      const base = latency(env, s)
      const now = env.clock.now()
      const record = (res: SubmitResponse, body: string, http: number | null, ms: number, ok: boolean): DriverResult<SubmitResponse> => ({
        latencyMs: ms,
        value: res,
        call: call(env, s, 'submit', { method: wire.method, endpoint: wire.endpoint, request: wire.body, response: body, httpStatus: http, latencyMs: ms, outcome: behaviour, ok, order, attemptId: req.attemptId }),
      })
      const accept = (ms: number, rejectLater: string | null): RemoteOrder => {
        const ref = w.id === 'dhru_fusion' ? String(remote.nextRef++) : `${w.id === 'manual' ? 'MAN' : 'sx'}-${env.ids.hex(8)}`
        const eta = etaMs(env, req)
        const ro: RemoteOrder = { externalRef: ref, orderId: order.id, orderRef: order.ref, state: 'processing', createdAt: now, completeAt: now + ms + eta, cost: product.cost, charged: true, result: generateResult(req.revision.resultSchema, order.input, req.service.code, env.clock.iso(now + ms + eta)), rejectMessage: rejectLater }
        remote.balance = sub(remote.balance, product.cost)
        remote.orders[ref] = ro
        remote.byOrderRef[order.ref] = ref
        return ro
      }

      switch (behaviour) {
        case 'success':
        case 'slow': {
          const ms = behaviour === 'slow' ? Math.min(s.timeoutMs - 400, base * env.rng.int(3, 5)) : base
          const rejectLater = req.service.processing !== 'instant' && env.rng.bool(0.04) ? env.rng.pick([...TERMINAL_REJECTIONS.slice(1, 3), SAFE_REJECTIONS[0]!]) : null
          const ro = accept(ms, rejectLater)
          if (w.instantInline && req.service.processing === 'instant' && !rejectLater) {
            ro.state = 'completed'
            ro.completeAt = now + ms
            ro.result = { ...ro.result!, receivedAt: env.clock.iso(now + ms) }
            return record({ kind: 'accepted', externalRef: ro.externalRef, result: ro.result!, message: 'Completed' }, w.ok(ro.externalRef, ro.result!.fields), 200, ms, true)
          }
          return record({ kind: 'accepted', externalRef: ro.externalRef, message: 'Order received', etaMs: ro.completeAt - now - ms }, w.ok(ro.externalRef), 200, ms, true)
        }
        case 'rejected': {
          const msg = env.rng.pick(TERMINAL_REJECTIONS)
          return record({ kind: 'rejected', code: 'supplier_rejected', message: msg }, w.err('rejected', msg), 200, base, false)
        }
        case 'rejected_safe': {
          const msg = env.rng.pick(SAFE_REJECTIONS)
          return record({ kind: 'rejected', code: 'supplier_rejected', message: msg }, w.err('unavailable', msg), 200, base, false)
        }
        case 'timeout': {
          // By default the supplier DID receive the request and will process it — we just never hear back.
          if (forcedReceived !== false) accept(s.timeoutMs, null)
          return record({ kind: 'timeout', message: `No response within ${Math.round(s.timeoutMs / 1000)} s` }, '— no response (read timeout) —', null, s.timeoutMs, false)
        }
        case 'unknown': {
          const received = forcedReceived ?? env.rng.bool(0.5)
          if (received) accept(base, null)
          return record({ kind: 'bad_response', httpStatus: 502, message: 'HTTP 502 Bad Gateway after the request was sent' }, '<html><body><h1>502 Bad Gateway</h1></body></html>', 502, base, false)
        }
        case 'rate_limited':
          return record({ kind: 'rate_limited', message: 'HTTP 429 — rate limit exceeded', retryAfterSec: 30 }, w.err('rate_limited', 'Too many requests'), 429, Math.round(base / 3), false)
        case 'insufficient_funds':
          return record({ kind: 'insufficient_funds', message: 'Insufficient credit on supplier account' }, w.err('credit', 'Insufficient credit'), 200, base, false)
        case 'auth_error':
          return record({ kind: 'auth_failed', message: 'Authentication failed — invalid API access key' }, w.err('auth', 'Authentication failed'), w.id === 'dhru_fusion' ? 200 : 401, Math.round(base / 2), false)
        case 'network_error':
          return record({ kind: 'connect_error', message: 'Connection refused (ECONNREFUSED) — request not sent' }, '— connection refused —', null, env.rng.int(25, 90), false)
        default:
          return record({ kind: 'connect_error', message: 'Unsupported simulation' }, '', null, 50, false)
      }
    },

    getStatus(s, order, externalRef): DriverResult<StatusResponse> {
      const remote = remoteOf(env, s.id)
      const ref = externalRef ?? remote.byOrderRef[order.ref] ?? null
      const ro = ref ? remote.orders[ref] : undefined
      const ms = latency(env, s)
      const req = w.statusReq(s, ref ?? order.ref)
      if (!ro) {
        const body = w.err('not_found', `No order found for reference ${order.ref}`)
        return { latencyMs: ms, value: { state: 'not_found', externalRef: null, message: `No order with reference ${order.ref} at ${s.name}`, native: 'not_found' }, call: call(env, s, 'getStatus', { method: req.method, endpoint: req.endpoint, request: req.body, response: body, httpStatus: 200, latencyMs: ms, outcome: 'not_found', ok: true, order }) }
      }
      settleRemote(env, remote, ro)
      const code = remoteCode(ro)
      const res = w.statusRes(ro.state, ro.externalRef, code)
      const state = w.id === 'dhru_fusion' ? fromDhruStatus(Number(res.native.replace('DHRU ', ''))) : ro.state
      const msg = state === 'completed' ? `Completed (${res.native}) · ${code}` : state === 'rejected' ? `Rejected (${res.native}) · ${code}` : `In process (${res.native}) · reference ${ro.externalRef}`
      return {
        latencyMs: ms,
        value: { state, externalRef: ro.externalRef, result: state === 'completed' ? (ro.result ?? undefined) : undefined, message: msg, native: res.native, retryAfterMs: Math.max(1500, ro.completeAt - env.clock.now() + 500) },
        call: call(env, s, 'getStatus', { method: req.method, endpoint: req.endpoint, request: req.body, response: res.body, httpStatus: 200, latencyMs: ms, outcome: state, ok: true, order }),
      }
    },

    parseCallback(_s, payload) {
      const j = JSON.parse(payload) as { id?: string; ID?: string; status?: string; STATUS?: string; message?: string }
      const native = j.STATUS ?? j.status ?? '0'
      return { externalRef: j.id ?? j.ID ?? '', state: /^\d$/.test(native) ? fromDhruStatus(Number(native)) : (native as RemoteOrderState), message: j.message ?? '' }
    },

    normalizeResult(raw) {
      const out: Record<string, string | number | boolean> = {}
      for (const [k, v] of Object.entries(raw)) out[k.toLowerCase()] = typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean)
      return out
    },

    cancel(s, externalRef) {
      const remote = remoteOf(env, s.id)
      const ro = remote.orders[externalRef]
      const ms = latency(env, s)
      const supported = w.id !== 'dhru_fusion'
      const ok = supported && !!ro && ro.state === 'processing' && env.clock.now() < ro.completeAt - 1000
      if (ok) {
        ro.state = 'rejected'
        ro.rejectMessage = 'Cancelled on request'
        remote.balance = add(remote.balance, ro.cost)
        ro.charged = false
      }
      const message = !supported ? 'DHRU Fusion API v6.1 has no cancel action for IMEI orders' : ok ? 'Cancelled at supplier' : 'Order can no longer be cancelled'
      return { latencyMs: ms, value: { ok, message }, call: call(env, s, 'cancel', { method: 'POST', endpoint: supported ? `/v1/orders/${externalRef}/cancel` : '—', request: '', response: message, httpStatus: supported ? (ok ? 200 : 409) : null, latencyMs: ms, outcome: ok ? 'cancelled' : 'refused', ok }) }
    },
  }
}

export function createMockDrivers(env: SimEnv): DriverRegistry {
  const drivers = { dhru_fusion: makeDriver(env, DHRU), orvex_rest: makeDriver(env, REST), manual: makeDriver(env, MANUAL) }
  return { get: (id) => drivers[id], all: () => Object.values(drivers) }
}

/** Advance every remote supplier's order book (orders finish on the supplier side). */
export function tickRemotes(env: SimEnv) {
  for (const remote of Object.values(env.sim.remote)) for (const ro of Object.values(remote.orders)) settleRemote(env, remote, ro)
}
