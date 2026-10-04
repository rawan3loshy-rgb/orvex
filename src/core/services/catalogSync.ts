/**
 * CatalogSyncService — diff a supplier's remote catalog against our supplier
 * products and produce reviewable changes.
 *
 *   new      product appears upstream               → review: add to supplier products
 *   price    cost changed                           → review: apply (margin impact shown)
 *   fields   required input fields changed          → review: offers may need re-mapping
 *   removed  product disappeared upstream           → applied immediately for safety:
 *                                                     offers disabled with a visible reason
 *   warning  a change that needs attention (negative margin, rename)
 * Removed products never disappear silently: their offers stay listed as disabled.
 */
import { formatMoney, sub, type Micros } from '../money'
import type { CoreContext, RemoteProduct } from '../ports'
import type { Actor, SupplierProduct, SyncChange, SyncChangeKind, SyncRun } from '../domain'
import { conflict } from '../errors'
import { quoteAllTiers } from './pricing'
import { audit } from './audit'

function impactOfCost(ctx: CoreContext, product: SupplierProduct, newCost: Micros) {
  const offers = ctx.repo.offers.filter((o) => o.supplierProductId === product.id)
  const serviceIds = [...new Set(offers.map((o) => o.serviceId))]
  // Cost-plus tiers re-price automatically; fixed-price tiers absorb the change.
  let worst: { service: string; tier: string; before: Micros; after: Micros } | null = null
  for (const sid of serviceIds) {
    for (const q of quoteAllTiers(ctx, sid)) {
      if (q.method !== 'fixed' || !q.referenceOfferId || !offers.some((o) => o.id === q.referenceOfferId)) continue
      const before = sub(q.amount, product.cost)
      const after = sub(q.amount, newCost)
      if (!worst || after < worst.after) worst = { service: ctx.repo.services.get(sid)?.name ?? sid, tier: q.tierName, before, after }
    }
  }
  return { offers, serviceIds, worst }
}

export function diffCatalog(ctx: CoreContext, supplierId: string, remote: RemoteProduct[], runId: string): SyncChange[] {
  const local = ctx.repo.products.filter((p) => p.supplierId === supplierId)
  const byExt = new Map(local.map((p) => [p.externalId, p]))
  const seen = new Set<string>()
  const changes: SyncChange[] = []
  const mk = (kind: SyncChangeKind, c: Omit<SyncChange, 'id' | 'runId' | 'supplierId' | 'kind' | 'decision' | 'decidedAt' | 'decidedBy'>): SyncChange => ({
    id: ctx.ids.id('chg'),
    runId,
    supplierId,
    kind,
    decision: 'pending',
    decidedAt: null,
    decidedBy: null,
    ...c,
  })

  for (const r of remote) {
    seen.add(r.externalId)
    const p = byExt.get(r.externalId)
    if (!p || p.status === 'removed') {
      changes.push(mk('new', { externalId: r.externalId, name: r.name, supplierProductId: p?.id ?? null, before: null, after: { cost: r.cost, fields: r.fields, name: r.name, groupName: r.groupName }, impact: { serviceIds: [], offerIds: [], summary: `New product · ${formatMoney(r.cost)} · not mapped to a service yet`, tone: 'success' } }))
      continue
    }
    if (r.cost !== p.cost) {
      const { offers, serviceIds, worst } = impactOfCost(ctx, p, r.cost)
      const up = r.cost > p.cost
      const summary = !offers.length
        ? `Cost ${up ? 'increase' : 'decrease'} · product not mapped`
        : up
          ? worst && worst.after < 0
            ? `Margin becomes negative for ${worst.tier} (${formatMoney(worst.after)})`
            : 'Margin reduced'
          : 'Margin improved'
      changes.push(mk('price', { externalId: r.externalId, name: r.name, supplierProductId: p.id, before: { cost: p.cost }, after: { cost: r.cost }, impact: { serviceIds, offerIds: offers.map((o) => o.id), summary, tone: up ? (worst && worst.after < 0 ? 'danger' : 'warning') : 'success', marginBefore: worst?.before ?? null, marginAfter: worst?.after ?? null } }))
      if (worst && worst.after < 0) {
        changes.push(mk('warning', { externalId: r.externalId, name: r.name, supplierProductId: p.id, before: { cost: p.cost }, after: { cost: r.cost }, impact: { serviceIds, offerIds: offers.map((o) => o.id), summary: `${worst.service}: ${worst.tier} price would be below cost — the margin guard will skip this offer until pricing is updated`, tone: 'danger', marginBefore: worst.before, marginAfter: worst.after } }))
      }
    }
    const fieldsChanged = r.fields.join(',') !== p.remoteFields.join(',')
    if (fieldsChanged) {
      const offers = ctx.repo.offers.filter((o) => o.supplierProductId === p.id)
      changes.push(mk('fields', { externalId: r.externalId, name: r.name, supplierProductId: p.id, before: { fields: p.remoteFields }, after: { fields: r.fields }, impact: { serviceIds: [...new Set(offers.map((o) => o.serviceId))], offerIds: offers.map((o) => o.id), summary: `Supplier now expects ${r.fields.filter((f) => !p.remoteFields.includes(f)).join(', ') || 'different fields'} — check field mapping`, tone: 'warning' } }))
    }
    if (r.name !== p.name) {
      changes.push(mk('warning', { externalId: r.externalId, name: r.name, supplierProductId: p.id, before: { name: p.name }, after: { name: r.name }, impact: { serviceIds: [], offerIds: [], summary: `Renamed upstream from “${p.name}” — confirm it is still the same product`, tone: 'warning' } }))
    }
  }

  for (const p of local) {
    if (p.status === 'removed' || seen.has(p.externalId)) continue
    const offers = ctx.repo.offers.filter((o) => o.supplierProductId === p.id)
    changes.push(mk('removed', { externalId: p.externalId, name: p.name, supplierProductId: p.id, before: { cost: p.cost }, after: null, impact: { serviceIds: [...new Set(offers.map((o) => o.serviceId))], offerIds: offers.map((o) => o.id), summary: offers.length ? `${offers.length} offer${offers.length > 1 ? 's' : ''} disabled — routing continues with the next priority` : 'Not mapped — no impact', tone: offers.length ? 'danger' : 'neutral' } }))
  }
  return changes
}

/**
 * Product-level summary of one run: how many remote services were unchanged,
 * new, changed (price / fields / rename — counted once per product) or removed.
 */
export function summarizeSyncRun(run: Pick<SyncRun, 'id' | 'remoteProducts' | 'counts'>, changes: Pick<SyncChange, 'runId' | 'kind' | 'externalId'>[]) {
  const own = changes.filter((c) => c.runId === run.id)
  const changed = new Set(own.filter((c) => c.kind === 'price' || c.kind === 'fields' || c.kind === 'warning').map((c) => c.externalId)).size
  const added = run.counts.new
  return { remote: run.remoteProducts, unchanged: Math.max(0, run.remoteProducts - added - changed), added, changed, removed: run.counts.removed }
}

/** Run a sync through the supplier's driver and record the run + changes. */
export function runSync(ctx: CoreContext, supplierId: string, actor: Actor, trigger: SyncRun['trigger'] = 'manual'): SyncRun {
  const supplier = ctx.repo.suppliers.require(supplierId)
  const started = ctx.clock.now()
  const res = ctx.drivers.get(supplier.driver).syncCatalog(supplier, ctx.repo.products.filter((p) => p.supplierId === supplierId))
  ctx.repo.driverCalls.insert(res.call)
  const runId = ctx.ids.id('sync')
  // Older pending changes are superseded by the new run.
  for (const c of ctx.repo.syncChanges.filter((c) => c.supplierId === supplierId && c.decision === 'pending')) {
    c.decision = 'ignored'
    c.decidedAt = ctx.clock.iso()
    c.decidedBy = 'Superseded by a newer sync'
  }
  const changes = res.value.ok ? diffCatalog(ctx, supplierId, res.value.products, runId) : []
  for (const c of changes) {
    ctx.repo.syncChanges.insert(c)
    if (c.kind === 'removed') applyRemoval(ctx, c, actor)
  }
  const counts = { new: 0, price: 0, removed: 0, fields: 0, warning: 0 } as Record<SyncChangeKind, number>
  for (const c of changes) counts[c.kind]++
  const run: SyncRun = {
    id: runId,
    supplierId,
    trigger,
    startedAt: ctx.clock.iso(started),
    finishedAt: ctx.clock.iso(started + res.latencyMs),
    status: !res.value.ok ? 'failed' : changes.some((c) => c.decision === 'pending') ? 'review_required' : changes.length ? 'applied' : 'no_changes',
    remoteProducts: res.value.products.length,
    counts,
    error: res.value.ok ? null : res.value.message,
  }
  ctx.repo.syncRuns.insert(run)
  if (res.value.ok) supplier.lastSyncAt = run.finishedAt
  return run
}

function applyRemoval(ctx: CoreContext, c: SyncChange, actor: Actor) {
  const p = c.supplierProductId ? ctx.repo.products.get(c.supplierProductId) : undefined
  if (!p) return
  p.status = 'removed'
  p.lastSeenAt = ctx.clock.iso()
  for (const o of ctx.repo.offers.filter((x) => x.supplierProductId === p.id)) {
    o.enabled = false
    o.disabledReason = `Removed from ${ctx.repo.suppliers.get(p.supplierId)?.name ?? 'supplier'} catalog`
    o.updatedAt = ctx.clock.iso()
  }
  c.decision = 'applied'
  c.decidedAt = ctx.clock.iso()
  c.decidedBy = 'Auto-applied (safety): offers disabled'
  audit(ctx, { actor, action: 'catalog.product_removed', target: { type: 'supplier_product', id: p.id, label: p.name }, summary: `Upstream removal — ${c.impact.offerIds.length} offer(s) disabled`, severity: c.impact.offerIds.length ? 'warning' : 'info' })
}

export function decideChange(ctx: CoreContext, p: { changeId: string; decision: 'applied' | 'ignored'; actor: Actor }) {
  const c = ctx.repo.syncChanges.require(p.changeId)
  if (c.decision !== 'pending') throw conflict('already_decided', `Change already ${c.decision}`)
  if (p.decision === 'applied') {
    const now = ctx.clock.iso()
    if (c.kind === 'new') {
      const existing = c.supplierProductId ? ctx.repo.products.get(c.supplierProductId) : undefined
      if (existing) {
        existing.status = 'available'
        existing.cost = c.after!.cost!
        existing.lastSeenAt = now
      } else {
        ctx.repo.products.insert({
          id: ctx.ids.id('sp'),
          supplierId: c.supplierId,
          externalId: c.externalId,
          name: c.name,
          groupName: c.after?.groupName ?? 'Imported',
          cost: c.after!.cost!,
          previousCost: null,
          status: 'available',
          remoteFields: c.after?.fields ?? [],
          processingHint: '',
          firstSeenAt: now,
          lastSeenAt: now,
          costChangedAt: null,
        })
      }
    } else if (c.kind === 'price' && c.supplierProductId) {
      const prod = ctx.repo.products.require(c.supplierProductId)
      audit(ctx, { actor: p.actor, action: 'supplier.cost_changed', target: { type: 'supplier_product', id: prod.id, label: prod.name }, summary: `Supplier cost ${formatMoney(prod.cost)} → ${formatMoney(c.after!.cost!)}`, permission: 'suppliers.manage', changes: [{ field: 'cost', from: formatMoney(prod.cost), to: formatMoney(c.after!.cost!) }] })
      prod.previousCost = prod.cost
      prod.cost = c.after!.cost!
      prod.costChangedAt = now
    } else if (c.kind === 'fields' && c.supplierProductId) {
      ctx.repo.products.require(c.supplierProductId).remoteFields = c.after?.fields ?? []
    } else if (c.kind === 'warning' && c.after?.name && c.supplierProductId) {
      ctx.repo.products.require(c.supplierProductId).name = c.after.name
    }
  }
  c.decision = p.decision
  c.decidedAt = ctx.clock.iso()
  c.decidedBy = p.actor.name
  const run = ctx.repo.syncRuns.get(c.runId)
  if (run && !ctx.repo.syncChanges.find((x) => x.runId === run.id && x.decision === 'pending')) run.status = 'applied'
  return c
}
