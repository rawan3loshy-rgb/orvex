/**
 * Storefront API — the customer's public website.
 *
 * Catalog blocks never contain prices: the storefront asks this API, which
 * resolves services live through the PricingEngine (signed-in customer's tier,
 * otherwise Retail) and the RoutingEngine (availability). Checkout goes through
 * PlaceOrder (channel "storefront") + a simulated payment.
 *
 * Content comes from the PUBLISHED storefront revision. `?preview=<token>` swaps in
 * the draft revision, but only with the draft's admin-issued preview token — an
 * invalid token is an error, never a silent fallback to either version.
 */
import type { MockRoute } from '@/api/mockRouter'
import type { CatalogQuery, Order, PaymentMethodKind, Service } from '@/core/domain'
import { invalid, notFound } from '@/core/errors'
import { placeOrder, type PlaceOrderInput } from '@/core/commands/orders'
import { completePayment, retryOrderPayment } from '@/core/commands/payments'
import { ensureGuestAccount } from '@/core/commands/accounts'
import { quote } from '@/core/services/pricing'
import { availability } from '@/core/services/routing'
import { resolvePublished } from '@/core/services/storefront'
import { previewStorefront } from '@/core/commands/storefront'
import { walletBalance } from '@/core/services/ledger'
import { publicStatus } from '@/core/services/presenters'
import type { StoreCheckoutResult, StoreServiceCard, StoreServiceDetail, StoreTracking } from '@/types/installation'
import type { Runtime } from '../runtime'
import { POPULARITY } from '../data/catalog'
import { portalOrder } from '../views'
import { r, type BodyFor } from './util'

function tierOf(rt: Runtime) {
  const id = rt.sessions.storefrontAccountId
  const a = id ? rt.repo.accounts.get(id) : undefined
  return a?.pricingTierId ?? 'tier_retail'
}

function card(rt: Runtime, s: Service): StoreServiceCard {
  const q = quote(rt.ctx, s.id, tierOf(rt))
  const av = availability(rt.ctx, s, q.amount)
  return { id: s.id, slug: s.slug, code: s.code, name: s.name, summary: s.summary, categoryId: s.categoryId, categoryName: rt.repo.categories.get(s.categoryId)?.name ?? '', icon: s.icon, price: q.amount, available: av.available, unavailableReason: av.available ? null : 'Temporarily unavailable', processing: s.processing, turnaround: s.turnaround, featured: s.featured, tags: s.tags }
}

/** Published content, or the draft when a valid preview token is supplied. */
function content(rt: Runtime, previewToken: string | undefined) {
  return previewToken ? previewStorefront(rt.ctx, previewToken) : resolvePublished(rt.repo.storefront.get())
}

function visible(s: Service) {
  return s.visibility.storefront && (s.status === 'active' || s.status === 'paused')
}

function runQuery(rt: Runtime, q: CatalogQuery): StoreServiceCard[] {
  let list = rt.repo.services.filter((s) => visible(s))
  if (q.serviceIds?.length) list = q.serviceIds.map((id) => rt.repo.services.get(id)).filter((s): s is Service => !!s && visible(s))
  if (q.categoryId) list = list.filter((s) => s.categoryId === q.categoryId)
  if (q.featured) list = list.filter((s) => s.featured)
  if (q.tag) list = list.filter((s) => s.tags.includes(q.tag!))
  let cards = list.map((s) => card(rt, s)).filter((c) => c.available || rt.repo.services.get(c.id)!.whenUnavailable === 'show_unavailable')
  if (q.sort === 'popular') cards.sort((a, b) => (POPULARITY[b.id] ?? 0) - (POPULARITY[a.id] ?? 0))
  if (q.sort === 'price_asc') cards.sort((a, b) => a.price - b.price)
  if (q.sort === 'name') cards.sort((a, b) => a.name.localeCompare(b.name))
  cards = cards.slice(0, q.limit || 12)
  return cards
}

function search(rt: Runtime, text: string): StoreServiceCard[] {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return []
  const scored = rt.repo.services
    .filter((s) => visible(s))
    .map((s) => {
      const hay = `${s.name} ${s.tags.join(' ')} ${s.summary} ${rt.repo.categories.get(s.categoryId)?.name ?? ''}`.toLowerCase()
      let score = 0
      for (const w of words) {
        if (s.name.toLowerCase().includes(w)) score += 3
        else if (s.tags.some((t) => t.includes(w))) score += 2
        else if (hay.includes(w)) score += 1
      }
      return { s, score: score + (POPULARITY[s.id] ?? 0) / 100 }
    })
    .filter((x) => x.score >= Math.max(1, words.length * 0.9))
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, 12).map((x) => card(rt, x.s))
}

const STEP_ORDER = ['placed', 'paid', 'processing', 'done'] as const

function tracking(rt: Runtime, o: Order): StoreTracking {
  const ps = publicStatus(o)
  const intent = o.paymentIntentId ? rt.repo.payments.get(o.paymentIntentId) : undefined
  const ev = (type: string) => o.events.find((e) => e.type === type)?.at ?? null
  const failed = o.status === 'rejected' || o.status === 'cancelled'
  const stepState = (key: (typeof STEP_ORDER)[number]): 'done' | 'current' | 'todo' | 'failed' => {
    const reached = { placed: true, paid: o.financialStatus !== 'none', processing: ['processing', 'needs_review', 'completed'].includes(o.status) || o.attempts.length > 0, done: o.status === 'completed' || failed }
    if (key === 'done' && failed) return 'failed'
    if (reached[key]) {
      const next = STEP_ORDER[STEP_ORDER.indexOf(key) + 1]
      return next && !reached[next] && !failed ? 'current' : 'done'
    }
    return 'todo'
  }
  const rev = rt.repo.revisions.get(o.serviceRevisionId)
  return {
    ref: o.ref,
    serviceName: o.serviceName,
    status: ps.status,
    statusDetail: ps.detail,
    financialStatus: o.financialStatus,
    price: o.price.amount,
    input: o.input,
    result: o.result,
    rejection: o.rejection,
    createdAt: o.createdAt,
    completedAt: o.completedAt,
    steps: [
      { key: 'placed', label: 'Order placed', state: stepState('placed'), at: o.createdAt },
      { key: 'paid', label: o.channel === 'storefront' && intent ? 'Payment confirmed' : 'Funds reserved', state: stepState('paid'), at: ev('payment_succeeded') ?? ev('hold_created') },
      { key: 'processing', label: ps.detail === 'under_review' ? 'Processing — being verified' : 'Processing', state: stepState('processing'), at: ev('processing') },
      { key: 'done', label: o.status === 'rejected' ? 'Could not be completed — refunded to your wallet' : o.status === 'cancelled' ? 'Cancelled' : 'Result ready', state: stepState('done'), at: o.completedAt },
    ],
    resultSchema: rev?.resultSchema ?? [],
    payment: intent ? { ref: intent.ref, method: intent.method, status: intent.status } : null,
    email: (() => {
      const e = rt.repo.accounts.get(o.accountId)?.email ?? ''
      return e.replace(/^(.).+(@.+)$/, '$1•••$2')
    })(),
  }
}

export const storeRoutes: MockRoute[] = [
  r('GET', '/store/config', (rt, { query }) => {
    const cfg = content(rt, query.preview)
    const id = rt.sessions.storefrontAccountId
    const acct = id ? rt.repo.accounts.get(id) : undefined
    return {
      ...cfg,
      categories: rt.repo.categories.all().map((c) => ({ ...c, services: rt.repo.services.count((s) => s.categoryId === c.id && visible(s)) })),
      customer: acct ? { id: acct.id, name: acct.name, email: acct.email, tierName: rt.repo.tiers.get(acct.pricingTierId)?.name ?? 'Retail', balance: walletBalance(rt.ctx, acct.id) } : null,
      paymentMethods: rt.repo.paymentMethods.filter((m) => m.enabled && m.customerFacing && cfg.checkout.methods.includes(m.id)),
    }
  }),
  r<{ query: CatalogQuery }>('POST', '/store/catalog', (rt, { body }) => runQuery(rt, body.query), { readOnly: true }),
  r('GET', '/store/search', (rt, { query }) => search(rt, query.q ?? '')),
  r('GET', '/store/services/:slug', (rt, { params, query }): StoreServiceDetail => {
    const s = rt.repo.services.find((x) => x.slug === params.slug || x.id === params.slug)
    if (!s || !visible(s)) throw notFound('Service', params.slug!)
    const rev = rt.repo.revisions.require(s.revisionId)
    const cfg = content(rt, query.preview)
    const tpl = cfg.templates.find((t) => t.id === s.templateId) ?? cfg.templates.find((t) => t.isDefault)!
    const related = rt.repo.services.filter((x) => x.id !== s.id && x.categoryId === s.categoryId && visible(x)).slice(0, 4).map((x) => card(rt, x))
    return { ...card(rt, s), description: s.description, fields: rev.fields, resultSchema: rev.resultSchema, revision: rev.number, templateSections: tpl.sections, related, tierName: rt.repo.tiers.get(tierOf(rt))?.name ?? 'Retail' }
  }),
  r<Pick<PlaceOrderInput, 'serviceId' | 'idempotencyKey'> & Partial<Pick<PlaceOrderInput, 'input'>> & { email?: string; method: PaymentMethodKind | 'wallet' }>('POST', '/store/checkout', (rt, { body }): StoreCheckoutResult => {
    const { checkout } = rt.repo.storefront.get().settings
    const signedIn = rt.sessions.storefrontAccountId
    if (!signedIn && !checkout.guestCheckout) throw invalid('Please sign in to order')
    const account = signedIn ? rt.repo.accounts.require(signedIn) : ensureGuestAccount(rt.ctx, body.email ?? '', 'tier_retail')
    const actor = signedIn ? { type: 'member' as const, id: account.id, name: account.name } : { type: 'guest' as const, id: account.id, name: account.email }
    if (body.method === 'wallet') {
      const res = placeOrder(rt.ctx, { accountId: account.id, serviceId: body.serviceId, input: body.input ?? {}, channel: 'storefront', actor, idempotencyKey: body.idempotencyKey ?? null, payment: { mode: 'wallet' }, tracking: true })
      return { orderRef: res.order.ref, trackingToken: res.order.trackingToken!, paymentIntentId: '', paymentRef: 'Wallet', amount: res.order.price.amount, method: 'wallet' }
    }
    const res = placeOrder(rt.ctx, { accountId: account.id, serviceId: body.serviceId, input: body.input ?? {}, channel: 'storefront', actor, idempotencyKey: body.idempotencyKey ?? null, payment: { mode: 'external', method: body.method }, tracking: true })
    const intent = rt.repo.payments.require(res.paymentIntentId!)
    return { orderRef: res.order.ref, trackingToken: res.order.trackingToken!, paymentIntentId: intent.id, paymentRef: intent.ref, amount: intent.amount, method: intent.method }
  }),
  r<BodyFor<typeof completePayment, 'intentId', 'outcome'>>('POST', '/store/payments/:id/complete', (rt, { params, body }) => {
    const forced = rt.sim.nextPayment !== 'auto' ? rt.sim.nextPayment : null
    if (forced) rt.sim.nextPayment = 'auto'
    const intent = completePayment(rt.ctx, { intentId: params.id!, outcome: (forced ?? body.outcome ?? 'succeed') as 'succeed' | 'fail' | 'pending' })
    return { status: intent.status, failureReason: intent.failureReason, ref: intent.ref }
  }),
  r<BodyFor<typeof retryOrderPayment, 'orderId', 'method'>>('POST', '/store/orders/:token/retry-payment', (rt, { params, body }) => {
    const o = rt.repo.orders.byTrackingToken(params.token!)
    if (!o) throw notFound('Order', 'tracking link')
    const intent = retryOrderPayment(rt.ctx, { orderId: o.id, method: body.method ?? 'card' })
    return { paymentIntentId: intent.id, paymentRef: intent.ref, amount: intent.amount, method: intent.method }
  }),
  r('GET', '/store/track/:token', (rt, { params }) => {
    const o = rt.repo.orders.byTrackingToken(params.token!)
    if (!o) throw notFound('Order', 'tracking link')
    return tracking(rt, o)
  }),
  r('GET', '/store/lookup', (rt, { query }) => {
    // Reference + email together reveal the tracking link; a reference alone never shows a result.
    const o = rt.repo.orders.byRef(String(query.ref ?? ''))
    const acct = o ? rt.repo.accounts.get(o.accountId) : undefined
    if (!o || !acct || acct.email !== String(query.email ?? '').trim().toLowerCase() || !o.trackingToken) throw notFound('Order', 'for this reference and email')
    return { trackingToken: o.trackingToken }
  }),
  r('GET', '/store/account', (rt) => {
    const id = rt.sessions.storefrontAccountId
    if (!id) throw notFound('Session', 'customer')
    const acct = rt.repo.accounts.require(id)
    return { account: acct, balance: walletBalance(rt.ctx, id), orders: rt.repo.orders.recent().filter((o) => o.accountId === id).slice(0, 30).map((o) => ({ ...portalOrder(rt, o), trackingToken: o.trackingToken })) }
  }),
  r<{ accountId?: string | null }>('POST', '/store/session', (rt, { body }) => {
    rt.sessions.storefrontAccountId = body.accountId ?? null
    return { accountId: rt.sessions.storefrontAccountId }
  }),
]
