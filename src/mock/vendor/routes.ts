import { badRequest, notFound, route, type MockRoute } from '@/api/mockRouter'
import { liveRng } from '@/lib/random'
import { RELEASES } from '@/mock/shared/releases'
import { licenseServer } from '@/mock/shared/licenseServer'
import { createDemoStore } from '@/mock/shared/persist'
import type { Subscription, SupportTicket, VendorAccount, VendorOverview } from '@/types/vendor'
import { ACCOUNT, INVOICES, LICENSE, PAYMENTS, PLANS, PUBLIC_METRICS, SUBSCRIPTION, TICKETS } from './seed'

const seedState = () => ({
  account: structuredClone(ACCOUNT),
  subscription: structuredClone(SUBSCRIPTION),
  invoices: structuredClone(INVOICES),
  payments: structuredClone(PAYMENTS),
  license: structuredClone(LICENSE),
  tickets: structuredClone(TICKETS),
})
type VendorState = ReturnType<typeof seedState>

/** Mutable copy of the vendor data, persisted across reloads for the demo. */
const store = createDemoStore<VendorState>('vendor', 3)
const state: VendorState = freshen(store.read()) ?? seedState()

/** Keep relative timestamps (heartbeats) believable when a snapshot is restored later. */
function freshen(saved: VendorState | null) {
  if (!saved) return null
  const seed = seedState()
  for (const inst of saved.license.installations) {
    const s = seed.license.installations.find((x) => x.id === inst.id)
    if (s && new Date(inst.lastHeartbeatAt) < new Date(s.lastHeartbeatAt)) inst.lastHeartbeatAt = s.lastHeartbeatAt
  }
  return saved
}
const persist = () => store.saveSoon(() => state)

// The license server records heartbeats from installations (metadata only).
licenseServer.onHeartbeat((hb) => {
  const inst = state.license.installations.find((i) => i.id === hb.installationId)
  if (!inst || state.license.id !== hb.licenseId) return
  inst.version = hb.version
  inst.schemaVersion = hb.schemaVersion
  inst.lastHeartbeatAt = hb.at
  inst.status = 'online'
  persist()
})

/**
 * Mock routes for the vendor platform API (account.orvex.io/api).
 */
export function createVendorRoutes(): MockRoute[] {
  const routes: MockRoute[] = [
    route('POST', '/demo/reset', () => {
      store.clear()
      Object.assign(state, seedState())
      return { ok: true }
    }),
    route('GET', '/public/metrics', () => PUBLIC_METRICS),
    route('GET', '/public/plans', () => PLANS),

    route<{ email?: string } | undefined>('POST', '/auth/login', ({ body }) => {
      if (!body?.email) badRequest('Email is required')
      return { ok: true, account: state.account }
    }),

    route('GET', '/account/overview', () => {
      const stable = RELEASES.filter((r) => r.channel === 'stable')[0]!
      const next = state.invoices.find((i) => i.status === 'open')
      const overview: VendorOverview = {
        account: state.account,
        subscription: state.subscription,
        license: state.license,
        latestRelease: { version: stable.version, releasedAt: stable.releasedAt, title: stable.title },
        openTickets: state.tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length,
        nextInvoice: { amount: next?.total ?? state.subscription.amount, dueAt: next?.dueAt ?? state.subscription.nextRenewalAt },
      }
      return overview
    }),
    route('GET', '/account', () => state.account),
    route<Partial<VendorAccount>>('PATCH', '/account', ({ body }) => Object.assign(state.account, body)),

    route('GET', '/subscription', () => state.subscription),
    route<Partial<Subscription>>('PATCH', '/subscription', ({ body }) => Object.assign(state.subscription, body)),

    route('GET', '/plans', () => PLANS),
    route('GET', '/invoices', () => state.invoices),
    route('GET', '/invoices/:id', ({ params }) => {
      const i = state.invoices.find((x) => x.id === params.id || x.number === params.id)
      if (!i) notFound('Invoice', params.id!)
      return i
    }),
    route('POST', '/invoices/:id/pay', ({ params }) => {
      const i = state.invoices.find((x) => x.id === params.id)
      if (!i) notFound('Invoice', params.id!)
      i.status = 'paid'
      i.paidAt = new Date().toISOString()
      state.payments.unshift({ id: `py_${liveRng.hex(4)}`, at: i.paidAt, amount: i.total, method: `${state.subscription.paymentMethod.brand} •••• ${state.subscription.paymentMethod.last4}`, status: 'succeeded', invoiceId: i.id, description: i.lines[0]?.description ?? i.number })
      return i
    }),
    route('GET', '/payments', () => state.payments),

    route('GET', '/license', () => state.license),
    route('GET', '/installations', () => state.license.installations),
    route('GET', '/installations/:id', ({ params }) => {
      const i = state.license.installations.find((x) => x.id === params.id)
      if (!i) notFound('Installation', params.id!)
      return i
    }),

    route('GET', '/releases', () => RELEASES),

    route('GET', '/tickets', () => state.tickets),
    route('GET', '/tickets/:id', ({ params }) => {
      const t = state.tickets.find((x) => x.id === params.id)
      if (!t) notFound('Ticket', params.id!)
      return t
    }),
    route<(Pick<SupportTicket, 'subject'> & Partial<Pick<SupportTicket, 'priority' | 'category' | 'installationId'>> & { body: string }) | undefined>('POST', '/tickets', ({ body }) => {
      if (!body?.subject || !body?.body) badRequest('Subject and message are required')
      const t: SupportTicket = {
        id: `TCK-${Math.max(...state.tickets.map((t) => Number(t.id.split('-')[1]))) + 1}`,
        subject: body.subject,
        status: 'open',
        priority: body.priority ?? 'normal',
        category: body.category ?? 'General',
        installationId: body.installationId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [{ id: 'm1', author: state.account.name, role: 'customer', body: body.body, at: new Date().toISOString() }],
      }
      state.tickets.unshift(t)
      return t
    }),
    route<{ body: string } | undefined>('POST', '/tickets/:id/messages', ({ params, body }) => {
      const t = state.tickets.find((x) => x.id === params.id)
      if (!t) notFound('Ticket', params.id!)
      if (!body?.body) badRequest('Message is required')
      t.messages.push({ id: `m${t.messages.length + 1}`, author: state.account.name, role: 'customer', body: body.body, at: new Date().toISOString() })
      t.updatedAt = new Date().toISOString()
      if (t.status === 'awaiting_customer') t.status = 'in_progress'
      return t
    }),
  ]
  return routes.map((r) =>
    r.method === 'GET' || r.pattern === '/demo/reset'
      ? r
      : {
          ...r,
          handler: async (ctx) => {
            const result = await r.handler(ctx)
            persist()
            return result
          },
        },
  )
}
