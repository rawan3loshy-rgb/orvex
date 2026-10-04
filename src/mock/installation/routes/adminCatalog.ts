/** Admin API — services, revisions, offers, pricing, suppliers, catalog sync. */
import type { MockRoute } from '@/api/mockRouter'
import { add, sub, ZERO, type Micros } from '@/core/money'
import { fieldType, inputSchema } from '@/core/fields'
import { addOffer, createService, deletePricingRule, publishRevision, removeOffer, reorderOffers, setServicePrice, updateOffer, updateService, upsertPricingRule } from '@/core/commands/catalog'
import { connectSupplier, decideSyncChanges, refreshBalance, resetCircuit, setMaintenance, syncSupplierCatalog, testConnection, topUpSupplier, updateCredentials, updateSupplierSettings } from '@/core/commands/suppliers'
import { quote, quoteAllTiers, ruleLabel } from '@/core/services/pricing'
import { availability, rankOffers } from '@/core/services/routing'
import { supplierHealth } from '@/core/services/supplier'
import { requirePermission } from '@/core/services/access'
import type { OfferView, PriceMatrixRow, ServiceDetail, SupplierDetail } from '@/types/installation'
import { adminActor, type Runtime } from '../runtime'
import { remoteOf } from '../sim/drivers'
import { simulatedProviderCatalog } from '../data/providerCatalog'
import { orderRow, serviceRow, supplierView } from '../views'
import { DAY, matches, r, ts, type BodyFor, type CommandParams } from './util'

/** Pricing rule fields the client sends (`upsertPricingRule` input). */
type RuleInput = CommandParams<typeof upsertPricingRule>['rule']

function orders30d(rt: Runtime) {
  const since = rt.clock.now() - 30 * DAY
  const m = new Map<string, number>()
  for (const o of rt.repo.orders.recent()) {
    if (ts(o.createdAt) < since) break
    m.set(o.serviceId, (m.get(o.serviceId) ?? 0) + 1)
  }
  return m
}

function offerViews(rt: Runtime, serviceId: string): OfferView[] {
  return rankOffers(rt.ctx, serviceId).map((x) => ({
    offer: x.offer,
    product: x.product,
    supplier: { id: x.offer.supplierId, name: x.supplier?.name ?? x.offer.supplierId, driver: x.supplier?.driver ?? 'manual', health: x.supplier ? supplierHealth(rt.ctx, x.supplier) : 'disabled' },
    cost: x.cost,
    routable: x.routable,
    reasons: x.reasons,
  }))
}

function scopeLabel(rt: Runtime, scope: { kind: string; serviceId?: string; categoryId?: string }) {
  if (scope.kind === 'service') return rt.repo.services.get(scope.serviceId!)?.name ?? scope.serviceId!
  if (scope.kind === 'category') return rt.repo.categories.get(scope.categoryId!)?.name ?? scope.categoryId!
  return 'All services'
}

export const adminCatalogRoutes: MockRoute[] = [
  r('GET', '/admin/categories', (rt) => rt.repo.categories.all().map((c) => ({ ...c, services: rt.repo.services.count((s) => s.categoryId === c.id) }))),

  /* Services */
  r('GET', '/admin/services', (rt, { query }) => {
    const counts = orders30d(rt)
    return rt.repo.services
      .filter((s) => (!query.categoryId || s.categoryId === query.categoryId) && (!query.status || s.status === query.status) && matches([s.name, s.code, ...s.tags], query.search))
      .map((s) => serviceRow(rt, s.id, counts))
      .filter((x) => !query.availability || (query.availability === 'unavailable' ? !x.available : x.available))
      .filter((x) => !query.supplierId || rt.repo.offers.find((o) => o.serviceId === x.service.id && o.supplierId === query.supplierId))
  }),
  r('GET', '/admin/services/:id', (rt, { params }): ServiceDetail => {
    const s = rt.repo.services.require(params.id!)
    const since = rt.clock.now() - 30 * DAY
    const recent = rt.repo.orders.recent().filter((o) => o.serviceId === s.id)
    let revenue = ZERO
    let margin = ZERO
    let completed = 0
    let rejected = 0
    let n = 0
    for (const o of recent) {
      if (ts(o.createdAt) < since) break
      n++
      if (o.status === 'completed') {
        completed++
        revenue = add(revenue, o.price.amount)
        margin = add(margin, sub(o.price.amount, o.supplierCost ?? ZERO))
      }
      if (o.status === 'rejected') rejected++
    }
    const rev = rt.repo.revisions.require(s.revisionId)
    const retail = quote(rt.ctx, s.id, 'tier_retail')
    const rules = rt.repo.rules
      .filter((x) => (x.scope.kind === 'service' && x.scope.serviceId === s.id) || (x.scope.kind === 'category' && x.scope.categoryId === s.categoryId) || x.scope.kind === 'all')
      .map((x) => ({ ...x, label: ruleLabel(rt.ctx, x) }))
    return {
      service: s,
      category: rt.repo.categories.require(s.categoryId),
      revision: rev,
      revisions: rt.repo.revisions.filter((x) => x.serviceId === s.id).sort((a, b) => b.number - a.number),
      offers: offerViews(rt, s.id),
      quotes: quoteAllTiers(rt.ctx, s.id),
      rules,
      availability: availability(rt.ctx, s, retail.amount),
      stats: { orders30d: n, completed30d: completed, rejected30d: rejected, revenue30d: revenue, margin30d: margin },
      recentOrders: recent.slice(0, 15).map((o) => orderRow(rt, o)),
      inputSchema: inputSchema(rev.fields),
      dhruMapping: rev.fields.map((f) => ({ field: f.key, type: f.type, dhruParam: fieldType(f.type).dhruParam ?? null })),
    }
  }),
  r<BodyFor<typeof createService>>('POST', '/admin/services', (rt, { body }) => createService(rt.ctx, { ...body, actor: adminActor(rt) })),
  r<CommandParams<typeof updateService>['patch']>('PATCH', '/admin/services/:id', (rt, { params, body }) => updateService(rt.ctx, { serviceId: params.id!, patch: body, actor: adminActor(rt) })),
  r<BodyFor<typeof publishRevision, 'serviceId', 'note'>>('POST', '/admin/services/:id/revisions', (rt, { params, body }) => publishRevision(rt.ctx, { serviceId: params.id!, fields: body.fields, resultSchema: body.resultSchema, note: body.note ?? '', actor: adminActor(rt) })),
  r<BodyFor<typeof setServicePrice, 'serviceId'>>('POST', '/admin/services/:id/price', (rt, { params, body }) => setServicePrice(rt.ctx, { serviceId: params.id!, tierId: body.tierId, amount: body.amount, reason: body.reason, actor: adminActor(rt) })),
  r<BodyFor<typeof addOffer, 'serviceId', 'fieldMapping' | 'maxCost'>>('POST', '/admin/services/:id/offers', (rt, { params, body }) => addOffer(rt.ctx, { serviceId: params.id!, supplierProductId: body.supplierProductId, fieldMapping: body.fieldMapping ?? {}, maxCost: body.maxCost ?? null, actor: adminActor(rt) })),
  r<BodyFor<typeof reorderOffers, 'serviceId'>>('PUT', '/admin/services/:id/offers/order', (rt, { params, body }) => reorderOffers(rt.ctx, { serviceId: params.id!, offerIds: body.offerIds, actor: adminActor(rt) })),
  r<CommandParams<typeof updateOffer>['patch']>('PATCH', '/admin/offers/:id', (rt, { params, body }) => updateOffer(rt.ctx, { offerId: params.id!, patch: body, actor: adminActor(rt) })),
  r('DELETE', '/admin/offers/:id', (rt, { params }) => {
    removeOffer(rt.ctx, { offerId: params.id!, actor: adminActor(rt) })
    return { ok: true }
  }),

  /* Pricing */
  r('GET', '/admin/pricing', (rt) => ({
    tiers: rt.repo.tiers
      .all()
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((t) => ({ ...t, accounts: rt.repo.accounts.count((a) => a.pricingTierId === t.id && a.kind === 'customer') })),
    rules: rt.repo.rules.all().map((x) => ({ ...x, label: ruleLabel(rt.ctx, x), scopeLabel: scopeLabel(rt, x.scope) })),
  })),
  r('GET', '/admin/pricing/matrix', (rt, { query }): PriceMatrixRow[] =>
    rt.repo.services
      .filter((s) => s.status !== 'archived' && (!query.categoryId || s.categoryId === query.categoryId) && matches([s.name, s.code], query.search))
      .map((s) => {
        const qs = quoteAllTiers(rt.ctx, s.id)
        return {
          serviceId: s.id,
          name: s.name,
          categoryName: rt.repo.categories.get(s.categoryId)?.name ?? '',
          referenceCost: qs[0]?.referenceCost ?? null,
          prices: Object.fromEntries(qs.map((q) => [q.tierId, { amount: q.amount, guard: q.guard, marginBps: q.marginBps, method: q.method, inherited: !!q.inheritedFrom }])),
        }
      })
      .filter((row) => !query.guard || Object.values(row.prices).some((p) => p.guard === query.guard)),
  ),
  r<{ serviceId: string; tierId: string }>('POST', '/admin/pricing/quote', (rt, { body }) => quote(rt.ctx, body.serviceId, body.tierId), { readOnly: true }),
  r<{ rule: RuleInput; reason?: string }>('POST', '/admin/pricing/rules', (rt, { body }) => upsertPricingRule(rt.ctx, { ruleId: null, rule: body.rule, reason: body.reason, actor: adminActor(rt) })),
  r<{ rule: Partial<RuleInput>; reason?: string }>('PATCH', '/admin/pricing/rules/:id', (rt, { params, body }) => {
    const cur = rt.repo.rules.require(params.id!)
    const { id: _id, updatedAt: _u, updatedBy: _b, ...rest } = cur
    return upsertPricingRule(rt.ctx, { ruleId: params.id!, rule: { ...rest, ...body.rule }, reason: body.reason, actor: adminActor(rt) })
  }),
  r('DELETE', '/admin/pricing/rules/:id', (rt, { params }) => {
    deletePricingRule(rt.ctx, { ruleId: params.id!, actor: adminActor(rt) })
    return { ok: true }
  }),

  /* Suppliers */
  r('GET', '/admin/drivers', (rt) => rt.ctx.drivers.all().map((d) => ({ id: d.id, name: d.name, version: d.version, protocol: d.protocol, suppliers: rt.repo.suppliers.count((s) => s.driver === d.id) }))),
  r('GET', '/admin/suppliers', (rt) => rt.repo.suppliers.all().map((s) => supplierView(rt, s.id))),
  r('GET', '/admin/suppliers/:id', (rt, { params }): SupplierDetail => {
    const v = supplierView(rt, params.id!)
    const s = v.supplier
    return {
      ...v,
      productList: rt.repo.products
        .filter((p) => p.supplierId === s.id)
        .map((p) => {
          const offs = rt.repo.offers.filter((o) => o.supplierProductId === p.id)
          return { ...p, offerCount: offs.length, services: offs.map((o) => ({ id: o.serviceId, name: rt.repo.services.get(o.serviceId)?.name ?? o.serviceId, priority: o.priority })) }
        }),
      calls: rt.repo.driverCalls.filter((c) => c.supplierId === s.id).slice(0, 60),
      samples: rt.repo.healthSamples.filter((h) => h.supplierId === s.id),
      syncRuns: rt.repo.syncRuns.filter((x) => x.supplierId === s.id).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, 20),
      changes: rt.repo.syncChanges.filter((c) => c.supplierId === s.id).slice(-200),
    }
  }),
  r<BodyFor<typeof connectSupplier>>('POST', '/admin/suppliers', (rt, { body }) => {
    const s = connectSupplier(rt.ctx, { ...body, actor: adminActor(rt) })
    const remote = remoteOf(rt.env, s.id)
    remote.balance = 250_000_000 as Micros
    // The simulated provider exposes a full GSM catalog, so Test → Sync discovers ~100 services to review.
    remote.catalog = simulatedProviderCatalog(s.driver, rt.repo.suppliers.count() * 7919)
    return supplierView(rt, s.id)
  }),
  r('POST', '/admin/suppliers/:id/test', (rt, { params }) => testConnection(rt.ctx, { supplierId: params.id!, actor: adminActor(rt) })),
  r('POST', '/admin/suppliers/:id/balance', (rt, { params }) => {
    requirePermission(rt.ctx, adminActor(rt), 'suppliers.manage')
    return refreshBalance(rt.ctx, { supplierId: params.id! })
  }),
  r('POST', '/admin/suppliers/:id/sync', (rt, { params }) => syncSupplierCatalog(rt.ctx, { supplierId: params.id!, actor: adminActor(rt) })),
  r<BodyFor<typeof setMaintenance, 'supplierId', 'until' | 'note'>>('POST', '/admin/suppliers/:id/maintenance', (rt, { params, body }) => {
    const s = setMaintenance(rt.ctx, { supplierId: params.id!, active: body.active, until: body.until ?? null, note: body.note ?? '', actor: adminActor(rt) })
    remoteOf(rt.env, s.id).maintenance = body.active
    return supplierView(rt, s.id)
  }),
  r('POST', '/admin/suppliers/:id/circuit-reset', (rt, { params }) => supplierView(rt, resetCircuit(rt.ctx, { supplierId: params.id!, actor: adminActor(rt) }).id)),
  r<BodyFor<typeof updateCredentials, 'supplierId'>>('POST', '/admin/suppliers/:id/credentials', (rt, { params, body }) => {
    const s = updateCredentials(rt.ctx, { supplierId: params.id!, credentials: body.credentials, actor: adminActor(rt) })
    // Simulated supplier accepts the new key (fixes Epsilon's rotated credentials).
    remoteOf(rt.env, s.id).credentialsValid = true
    return supplierView(rt, s.id)
  }),
  r<CommandParams<typeof updateSupplierSettings>['patch']>('PATCH', '/admin/suppliers/:id', (rt, { params, body }) => supplierView(rt, updateSupplierSettings(rt.ctx, { supplierId: params.id!, patch: body, actor: adminActor(rt) }).id)),
  r<BodyFor<typeof topUpSupplier, 'supplierId'>>('POST', '/admin/suppliers/:id/top-up', (rt, { params, body }) => {
    const tx = topUpSupplier(rt.ctx, { supplierId: params.id!, amount: body.amount, actor: adminActor(rt), idempotencyKey: body.idempotencyKey })
    const remote = remoteOf(rt.env, params.id!)
    remote.balance = (remote.balance + body.amount) as Micros
    refreshBalance(rt.ctx, { supplierId: params.id! })
    return tx
  }),

  /* Catalog sync review */
  r('GET', '/admin/sync/changes', (rt, { query }) => {
    const items = rt.repo.syncChanges.filter((c) => (!query.supplierId || c.supplierId === query.supplierId) && (!query.runId || c.runId === query.runId) && (!query.decision || c.decision === query.decision))
    return items.map((c) => ({ ...c, supplierName: rt.repo.suppliers.get(c.supplierId)?.name ?? c.supplierId, services: c.impact.serviceIds.map((id) => ({ id, name: rt.repo.services.get(id)?.name ?? id })) }))
  }),
  r('GET', '/admin/sync/runs', (rt) => rt.repo.syncRuns.all().slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, 60).map((x) => ({ ...x, supplierName: rt.repo.suppliers.get(x.supplierId)?.name ?? x.supplierId }))),
  r<BodyFor<typeof decideSyncChanges>>('POST', '/admin/sync/changes/decide', (rt, { body }) => decideSyncChanges(rt.ctx, { changeIds: body.changeIds, decision: body.decision, actor: adminActor(rt) })),
  r('GET', '/admin/products', (rt, { query }) =>
    rt.repo.products
      .filter((p) => (!query.supplierId || p.supplierId === query.supplierId) && p.status === 'available' && matches([p.name, p.externalId], query.search))
      .slice(0, 80)
      .map((p) => ({ ...p, supplierName: rt.repo.suppliers.get(p.supplierId)?.name ?? p.supplierId, mapped: rt.repo.offers.count((o) => o.supplierProductId === p.id) })),
  ),
]
