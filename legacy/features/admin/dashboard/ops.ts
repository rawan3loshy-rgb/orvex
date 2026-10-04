/**
 * Client-side derivations for the operations center.
 *
 * Core does not persist "validation" or "routing" as separate order statuses,
 * so the flow stages are projected from what an order row already tells us:
 * its status, its provider attempts (in_flight / success / timeout…) and
 * timestamps. Everything here is derived from ONE rolling 24h order window so
 * the flow, the provider network, the service mix and reseller activity always
 * agree with each other.
 */
import { useMemo } from 'react'
import { useOrders } from '@/hooks/installation'
import type { OrderRow, Provider, ServiceCategory } from '@/types/installation'

export const HOUR = 3_600_000
const PAGE = 200

const IN_FLIGHT = new Set<OrderRow['status']>(['created', 'processing', 'pending'])
export const isInFlight = (o: OrderRow) => IN_FLIGHT.has(o.status)
const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)

/** Every order created in the last 24h. The API caps a page at 200, so a second page is read when needed. */
export function useOrderWindow() {
  const first = useOrders({ range: '24h', pageSize: PAGE, page: 1 }, { live: true })
  const second = useOrders({ range: '24h', pageSize: PAGE, page: 2 }, { live: true })
  const orders = useMemo(() => {
    const byId = new Map<string, OrderRow>()
    for (const o of first.data?.items ?? []) byId.set(o.id, o)
    if ((first.data?.total ?? 0) > PAGE) for (const o of second.data?.items ?? []) if (!byId.has(o.id)) byId.set(o.id, o)
    return [...byId.values()]
  }, [first.data, second.data])
  return { orders, loading: first.isLoading, updatedAt: first.dataUpdatedAt }
}

/**
 * Orders created 24–48h ago — the comparison base for the rolling 24h figures.
 * Read from the newest 600 orders of the 7-day list (≈ 2–3 days of traffic);
 * `complete` is false when those pages do not reach back 48h.
 */
export function usePreviousWindow() {
  const p1 = useOrders({ range: '7d', pageSize: PAGE, page: 1 })
  const p2 = useOrders({ range: '7d', pageSize: PAGE, page: 2 })
  const p3 = useOrders({ range: '7d', pageSize: PAGE, page: 3 })
  return useMemo(() => {
    const now = Date.now()
    const from = now - 48 * HOUR
    const to = now - 24 * HOUR
    const all = [...(p1.data?.items ?? []), ...(p2.data?.items ?? []), ...(p3.data?.items ?? [])]
    const byId = new Map<string, OrderRow>()
    let oldest = Infinity
    for (const o of all) {
      const t = ts(o.createdAt)
      oldest = Math.min(oldest, t)
      if (t >= from && t < to) byId.set(o.id, o)
    }
    const loaded = !!p1.data && !!p2.data && !!p3.data
    const complete = loaded && (oldest <= from || all.length >= (p1.data?.total ?? 0))
    return { orders: [...byId.values()], complete, loading: !loaded }
  }, [p1.data, p2.data, p3.data])
}

/* ------------------------------------------------------------------------- */
/*  Rolling 24h commercial figures                                           */
/* ------------------------------------------------------------------------- */
export interface WindowTotals {
  orders: number
  apiOrders: number
  /** Delivered (success + later refunded). */
  delivered: number
  failed: number
  /** Revenue / cost / margin on orders that are currently successful. */
  revenue: number
  cost: number
  margin: number
  successRate: number | null
}

export function deriveTotals(orders: OrderRow[]): WindowTotals {
  const t: WindowTotals = {
    orders: 0,
    apiOrders: 0,
    delivered: 0,
    failed: 0,
    revenue: 0,
    cost: 0,
    margin: 0,
    successRate: null,
  }
  for (const o of orders) {
    t.orders++
    if (o.channel === 'api') t.apiOrders++
    if (o.status === 'success') {
      t.revenue += o.price
      t.cost += o.cost
    }
    if (o.status === 'success' || o.status === 'refunded') t.delivered++
    else if (o.status === 'failed') t.failed++
  }
  t.revenue = +t.revenue.toFixed(2)
  t.cost = +t.cost.toFixed(2)
  t.margin = +(t.revenue - t.cost).toFixed(2)
  t.successRate = t.delivered + t.failed ? (t.delivered / (t.delivered + t.failed)) * 100 : null
  return t
}

/** 24 hourly buckets ending now (oldest first) — sparklines for the rolling 24h cards. */
export function hourlySeries(orders: OrderRow[], now = Date.now()) {
  const start = now - 24 * HOUR
  const s = {
    orders: Array<number>(24).fill(0),
    revenue: Array<number>(24).fill(0),
    cost: Array<number>(24).fill(0),
    margin: Array<number>(24).fill(0),
  }
  for (const o of orders) {
    const i = Math.floor((ts(o.createdAt) - start) / HOUR)
    if (i < 0 || i > 23) continue
    s.orders[i]!++
    if (o.status === 'success') {
      s.revenue[i]! += o.price
      s.cost[i]! += o.cost
      s.margin[i]! += o.price - o.cost
    }
  }
  return s
}

/** Percent change, hidden when the comparison base is too small to be meaningful. */
export function change(current: number, previous: number | null | undefined, minBase = 20) {
  if (previous == null || previous < minBase) return null
  return ((current - previous) / previous) * 100
}

/* ------------------------------------------------------------------------- */
/*  Order flow                                                               */
/* ------------------------------------------------------------------------- */
export interface FlowStats {
  incoming: number
  lastHour: number
  channels: Record<OrderRow['channel'], number>
  /** Received, input + IMEI checks and balance reservation still running. */
  validatingNow: number
  validated: number
  /** Orders that reached at least one supplier. */
  routed: number
  /** Held by a routing rule (e.g. high-value unlocks) — not yet routed. */
  heldNow: number
  /** Previous supplier timed out / errored; fallback scheduled with backoff. */
  reroutingNow: number
  noRoute: number
  /** Supplier submissions, fallbacks included. */
  submissions: number
  awaitingNow: number
  fallbacks: number
  recovered: number
  /** Accepted by a supplier (result may still be pending). */
  accepted: number
  /** Accepted, waiting for the result callback — the unlock queue / server jobs. */
  processingNow: number
  completed: number
  refunded: number
  failed: number
  cancelled: number
  successRate: number | null
  inFlight: number
  /** Events in the last hour per connector (Incoming→Validation … Processing→Completed). */
  rate: [number, number, number, number, number]
}

export function deriveFlow(orders: OrderRow[], now = Date.now()): FlowStats {
  const s: FlowStats = {
    incoming: 0,
    lastHour: 0,
    channels: { api: 0, website: 0, admin: 0 },
    validatingNow: 0,
    validated: 0,
    routed: 0,
    heldNow: 0,
    reroutingNow: 0,
    noRoute: 0,
    submissions: 0,
    awaitingNow: 0,
    fallbacks: 0,
    recovered: 0,
    accepted: 0,
    processingNow: 0,
    completed: 0,
    refunded: 0,
    failed: 0,
    cancelled: 0,
    successRate: null,
    inFlight: 0,
    rate: [0, 0, 0, 0, 0],
  }
  const hourAgo = now - HOUR
  for (const o of orders) {
    s.incoming++
    s.channels[o.channel]++
    if (ts(o.createdAt) >= hourAgo) {
      s.lastHour++
      s.rate[0]++
      if (o.status !== 'created') s.rate[1]++
    }
    const n = o.attempts.length
    const accepted = o.attempts.some((a) => a.outcome === 'success')
    if (n) s.routed++
    s.submissions += n
    if (n > 1) {
      s.fallbacks++
      if (accepted) s.recovered++
    }
    if (accepted) s.accepted++
    for (const a of o.attempts) {
      if (ts(a.startedAt) >= hourAgo) s.rate[2]++
      if (a.outcome === 'success' && ts(a.endedAt) >= hourAgo) s.rate[3]++
    }
    if (isInFlight(o)) {
      s.inFlight++
      const last = o.attempts.at(-1)
      if (o.status === 'created') s.validatingNow++
      else if (!last) s.heldNow++
      else if (last.outcome === 'in_flight') s.awaitingNow++
      else if (last.outcome === 'success') s.processingNow++
      else s.reroutingNow++
    }
    // A refunded order was delivered first, so it counts as completed too.
    if (o.status === 'success' || o.status === 'refunded') {
      s.completed++
      if (o.status === 'refunded') s.refunded++
      if (ts(o.completedAt) >= hourAgo) s.rate[4]++
    } else if (o.status === 'failed') {
      s.failed++
      if (!n) s.noRoute++
    } else if (o.status === 'cancelled') s.cancelled++
  }
  s.validated = s.incoming - s.validatingNow
  s.successRate = s.completed + s.failed ? (s.completed / (s.completed + s.failed)) * 100 : null
  return s
}

/* ------------------------------------------------------------------------- */
/*  Provider load                                                            */
/* ------------------------------------------------------------------------- */
export interface ProviderLoad {
  /** Concurrency budget derived from the supplier rate limit (halved while degraded). */
  slots: number
  baseSlots: number
  inFlight: number
  awaiting: number
  submissionsLastHour: number
  ratio: number
}

export function slotsFor(p: Provider) {
  const perSecond = p.rateLimit.per === 'second' ? p.rateLimit.requests : p.rateLimit.requests / 60
  const base = Math.max(4, Math.round(perSecond))
  const slots = p.status === 'outage' || p.status === 'disabled' ? 0 : p.status === 'degraded' ? Math.max(2, Math.round(base / 2)) : base
  return { base, slots }
}

export function deriveProviderLoads(providers: Provider[], orders: OrderRow[], now = Date.now()) {
  const acc = new Map<string, { inFlight: number; awaiting: number; lastHour: number }>()
  const hourAgo = now - HOUR
  for (const o of orders) {
    for (const a of o.attempts) {
      if (ts(a.startedAt) < hourAgo) continue
      const x = acc.get(a.providerId) ?? {
        inFlight: 0,
        awaiting: 0,
        lastHour: 0,
      }
      x.lastHour++
      acc.set(a.providerId, x)
    }
    if (!isInFlight(o)) continue
    const last = o.attempts.at(-1)
    if (!last || (last.outcome !== 'in_flight' && last.outcome !== 'success')) continue
    const x = acc.get(last.providerId) ?? {
      inFlight: 0,
      awaiting: 0,
      lastHour: 0,
    }
    x.inFlight++
    if (last.outcome === 'in_flight') x.awaiting++
    acc.set(last.providerId, x)
  }
  const out = new Map<string, ProviderLoad>()
  for (const p of providers) {
    const { base, slots } = slotsFor(p)
    const x = acc.get(p.id) ?? { inFlight: 0, awaiting: 0, lastHour: 0 }
    out.set(p.id, {
      slots,
      baseSlots: base,
      inFlight: x.inFlight,
      awaiting: x.awaiting,
      submissionsLastHour: x.lastHour,
      ratio: slots ? x.inFlight / slots : x.inFlight ? 1 : 0,
    })
  }
  return out
}

/* ------------------------------------------------------------------------- */
/*  Service mix & reseller activity                                          */
/* ------------------------------------------------------------------------- */
export const CATEGORIES: ServiceCategory[] = ['IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services']

export interface CategoryMix {
  category: ServiceCategory
  orders: number
  revenue: number
  margin: number
  top: { serviceId: string; name: string; orders: number } | null
}

export function deriveMix(orders: OrderRow[]): CategoryMix[] {
  const cats = new Map<
    ServiceCategory,
    {
      orders: number
      revenue: number
      margin: number
      svc: Map<string, { name: string; orders: number }>
    }
  >()
  for (const c of CATEGORIES) cats.set(c, { orders: 0, revenue: 0, margin: 0, svc: new Map() })
  for (const o of orders) {
    const c = cats.get(o.serviceCategory) ?? cats.get('Other Services')!
    c.orders++
    if (o.status === 'success') {
      c.revenue += o.price
      c.margin += o.price - o.cost
    }
    const s = c.svc.get(o.serviceId) ?? { name: o.serviceName, orders: 0 }
    s.orders++
    c.svc.set(o.serviceId, s)
  }
  return CATEGORIES.map((category) => {
    const c = cats.get(category)!
    let top: CategoryMix['top'] = null
    for (const [serviceId, s] of c.svc) if (!top || s.orders > top.orders) top = { serviceId, name: s.name, orders: s.orders }
    return {
      category,
      orders: c.orders,
      revenue: +c.revenue.toFixed(2),
      margin: +c.margin.toFixed(2),
      top,
    }
  })
}

export interface ResellerActivityRow {
  resellerId: string
  orders: number
  revenue: number
  success: number
  failed: number
  inFlight: number
  lastAt: number
}

/** Reseller API activity over the rolling 24h window. */
export function deriveResellerActivity(orders: OrderRow[], now = Date.now()): ResellerActivityRow[] {
  const since = now - 24 * HOUR
  const m = new Map<string, ResellerActivityRow>()
  for (const o of orders) {
    if (!o.resellerId) continue
    const t = ts(o.createdAt)
    if (t < since) continue
    const r = m.get(o.resellerId) ?? {
      resellerId: o.resellerId,
      orders: 0,
      revenue: 0,
      success: 0,
      failed: 0,
      inFlight: 0,
      lastAt: 0,
    }
    r.orders++
    if (o.status === 'success') {
      r.success++
      r.revenue += o.price
    } else if (o.status === 'failed') r.failed++
    else if (isInFlight(o)) r.inFlight++
    r.lastAt = Math.max(r.lastAt, t)
    m.set(o.resellerId, r)
  }
  return [...m.values()].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
}

/* ------------------------------------------------------------------------- */
/*  Processing queue                                                         */
/* ------------------------------------------------------------------------- */
export type QueueStage = 'validating' | 'held' | 'retry' | 'awaiting' | 'processing'

export function queueStage(o: OrderRow): QueueStage {
  if (o.status === 'created') return 'validating'
  const last = o.attempts.at(-1)
  if (!last) return 'held'
  if (last.outcome === 'in_flight') return 'awaiting'
  if (last.outcome === 'success') return 'processing'
  return 'retry'
}

/** In-flight orders, oldest first. */
export function deriveQueue(orders: OrderRow[]) {
  return orders.filter(isInFlight).sort((a, b) => ts(a.createdAt) - ts(b.createdAt))
}

/** Median of a list (null when empty). */
export function median(values: number[]) {
  if (!values.length) return null
  const v = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2
}
