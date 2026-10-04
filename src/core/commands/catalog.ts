/**
 * Catalog & pricing commands.
 *
 * Changing a service's fields publishes a new revision (orders keep the revision
 * they were placed with). Price changes edit pricing rules — nothing else stores
 * a price, so the storefront, portal, API and DHRU endpoint pick it up instantly.
 */
import { formatMoney, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { Actor, FieldDef, Offer, PricingRule, ResultFieldDef, Service } from '../domain'
import { conflict, invalid } from '../errors'
import { requirePermission } from '../services/access'
import { audit } from '../services/audit'
import { quote, quoteAllTiers } from '../services/pricing'
import { fieldType } from '../fields'

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function createService(
  ctx: CoreContext,
  p: { name: string; categoryId: string; processing: Service['processing']; turnaround: Service['turnaround']; summary: string; fields: FieldDef[]; resultSchema: ResultFieldDef[]; actor: Actor },
): Service {
  requirePermission(ctx, p.actor, 'catalog.manage')
  if (!p.name.trim()) throw invalid('Service name is required')
  ctx.repo.categories.require(p.categoryId)
  const now = ctx.clock.iso()
  const id = ctx.ids.id('svc')
  const n = ctx.repo.services.count() + 1
  const revId = ctx.ids.id('rev')
  ctx.repo.revisions.insert({ id: revId, serviceId: id, number: 1, fields: p.fields, resultSchema: p.resultSchema, note: 'Initial revision', createdAt: now, createdBy: p.actor.name })
  const category = ctx.repo.categories.require(p.categoryId)
  const svc: Service = {
    id,
    code: String(4000 + n),
    slug: slugify(p.name),
    name: p.name.trim(),
    categoryId: p.categoryId,
    packId: category.packId,
    status: 'draft',
    processing: p.processing,
    turnaround: p.turnaround,
    summary: p.summary,
    description: p.summary,
    icon: category.icon,
    tags: [],
    featured: false,
    revisionId: revId,
    revision: 1,
    visibility: { storefront: false, portal: false, api: false },
    whenUnavailable: 'show_unavailable',
    templateId: null,
    createdAt: now,
    updatedAt: now,
  }
  ctx.repo.services.insert(svc)
  audit(ctx, { actor: p.actor, action: 'service.created', target: { type: 'service', id, label: svc.name }, summary: 'Created service (draft)', permission: 'catalog.manage' })
  return svc
}

type ServicePatch = Partial<Pick<Service, 'name' | 'summary' | 'description' | 'status' | 'processing' | 'turnaround' | 'visibility' | 'whenUnavailable' | 'featured' | 'tags' | 'templateId' | 'categoryId'>>

export function updateService(ctx: CoreContext, p: { serviceId: string; patch: ServicePatch; actor: Actor }) {
  requirePermission(ctx, p.actor, 'catalog.manage')
  const s = ctx.repo.services.require(p.serviceId)
  const changes: { field: string; from: string; to: string }[] = []
  for (const [k, v] of Object.entries(p.patch)) {
    const before = (s as unknown as Record<string, unknown>)[k]
    if (JSON.stringify(before) !== JSON.stringify(v)) changes.push({ field: k, from: typeof before === 'object' ? JSON.stringify(before) : String(before), to: typeof v === 'object' ? JSON.stringify(v) : String(v) })
  }
  if (p.patch.status === 'active' && !ctx.repo.offers.find((o) => o.serviceId === s.id && o.enabled)) throw conflict('no_offers', 'Map at least one enabled supplier offer before activating')
  Object.assign(s, p.patch, { updatedAt: ctx.clock.iso() })
  if (changes.length) audit(ctx, { actor: p.actor, action: 'service.updated', target: { type: 'service', id: s.id, label: s.name }, summary: `Updated ${changes.map((c) => c.field).join(', ')}`, changes, permission: 'catalog.manage' })
  return s
}

/** Publish a new revision of the service's field schema / result schema. */
export function publishRevision(ctx: CoreContext, p: { serviceId: string; fields: FieldDef[]; resultSchema?: ResultFieldDef[]; note: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'catalog.manage')
  const s = ctx.repo.services.require(p.serviceId)
  const cur = ctx.repo.revisions.require(s.revisionId)
  for (const f of p.fields) {
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(f.key)) throw invalid(`Field key "${f.key}" must be snake_case`)
    fieldType(f.type)
  }
  if (new Set(p.fields.map((f) => f.key)).size !== p.fields.length) throw invalid('Field keys must be unique')
  const rev = ctx.repo.revisions.insert({ id: ctx.ids.id('rev'), serviceId: s.id, number: cur.number + 1, fields: p.fields, resultSchema: p.resultSchema ?? cur.resultSchema, note: p.note || 'Field schema updated', createdAt: ctx.clock.iso(), createdBy: p.actor.name })
  s.revisionId = rev.id
  s.revision = rev.number
  s.updatedAt = rev.createdAt
  audit(ctx, { actor: p.actor, action: 'service.revision_published', target: { type: 'service', id: s.id, label: s.name }, summary: `Published revision ${rev.number}: ${rev.note}`, changes: [{ field: 'fields', from: cur.fields.map((f) => f.key).join(', '), to: rev.fields.map((f) => f.key).join(', ') }], permission: 'catalog.manage' })
  return rev
}

/* ------------------------------------------------------------------------- */
/*  Offers                                                                   */
/* ------------------------------------------------------------------------- */
export function addOffer(ctx: CoreContext, p: { serviceId: string; supplierProductId: string; fieldMapping: Record<string, string>; maxCost: Micros | null; actor: Actor }): Offer {
  requirePermission(ctx, p.actor, 'catalog.manage')
  const s = ctx.repo.services.require(p.serviceId)
  const prod = ctx.repo.products.require(p.supplierProductId)
  if (prod.status === 'removed') throw conflict('product_removed', 'This supplier product was removed upstream')
  if (ctx.repo.offers.find((o) => o.serviceId === s.id && o.supplierProductId === prod.id)) throw conflict('duplicate_offer', 'This product is already an offer for the service')
  const priority = ctx.repo.offers.filter((o) => o.serviceId === s.id).length + 1
  const now = ctx.clock.iso()
  const offer = ctx.repo.offers.insert({ id: ctx.ids.id('off'), serviceId: s.id, supplierId: prod.supplierId, supplierProductId: prod.id, priority, enabled: true, disabledReason: null, fieldMapping: p.fieldMapping, maxCost: p.maxCost, config: {}, createdAt: now, updatedAt: now })
  audit(ctx, { actor: p.actor, action: 'offer.added', target: { type: 'service', id: s.id, label: s.name }, summary: `Added offer ${ctx.repo.suppliers.get(prod.supplierId)?.name} · ${prod.name} (priority ${priority}, cost ${formatMoney(prod.cost)})`, permission: 'catalog.manage' })
  return offer
}

export function updateOffer(ctx: CoreContext, p: { offerId: string; patch: Partial<Pick<Offer, 'enabled' | 'fieldMapping' | 'maxCost' | 'config'>>; actor: Actor }) {
  requirePermission(ctx, p.actor, 'catalog.manage')
  const o = ctx.repo.offers.require(p.offerId)
  if (p.patch.enabled && ctx.repo.products.get(o.supplierProductId)?.status === 'removed') throw conflict('product_removed', 'Cannot enable an offer whose product was removed upstream')
  Object.assign(o, p.patch, { updatedAt: ctx.clock.iso(), disabledReason: p.patch.enabled === false ? 'Disabled by operator' : p.patch.enabled ? null : o.disabledReason })
  audit(ctx, { actor: p.actor, action: 'offer.updated', target: { type: 'service', id: o.serviceId, label: ctx.repo.services.get(o.serviceId)?.name ?? o.serviceId }, summary: `Updated offer ${ctx.repo.suppliers.get(o.supplierId)?.name}`, permission: 'catalog.manage' })
  return o
}

export function reorderOffers(ctx: CoreContext, p: { serviceId: string; offerIds: string[]; actor: Actor }) {
  requirePermission(ctx, p.actor, 'catalog.manage')
  const offers = ctx.repo.offers.filter((o) => o.serviceId === p.serviceId)
  if (offers.length !== p.offerIds.length || offers.some((o) => !p.offerIds.includes(o.id))) throw invalid('Provide every offer of the service exactly once')
  const before = offers.sort((a, b) => a.priority - b.priority).map((o) => ctx.repo.suppliers.get(o.supplierId)?.name ?? o.supplierId)
  p.offerIds.forEach((id, i) => ctx.repo.offers.update(id, { priority: i + 1, updatedAt: ctx.clock.iso() }))
  const after = p.offerIds.map((id) => ctx.repo.suppliers.get(ctx.repo.offers.require(id).supplierId)?.name ?? id)
  audit(ctx, { actor: p.actor, action: 'routing.priority_changed', target: { type: 'service', id: p.serviceId, label: ctx.repo.services.get(p.serviceId)?.name ?? p.serviceId }, summary: 'Changed offer priority', changes: [{ field: 'priority', from: before.join(' → '), to: after.join(' → ') }], permission: 'catalog.manage' })
  return ctx.repo.offers.filter((o) => o.serviceId === p.serviceId).sort((a, b) => a.priority - b.priority)
}

export function removeOffer(ctx: CoreContext, p: { offerId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'catalog.manage')
  const o = ctx.repo.offers.require(p.offerId)
  ctx.repo.offers.remove(o.id)
  ctx.repo.offers
    .filter((x) => x.serviceId === o.serviceId)
    .sort((a, b) => a.priority - b.priority)
    .forEach((x, i) => (x.priority = i + 1))
  audit(ctx, { actor: p.actor, action: 'offer.removed', target: { type: 'service', id: o.serviceId, label: ctx.repo.services.get(o.serviceId)?.name ?? o.serviceId }, summary: `Removed offer ${ctx.repo.suppliers.get(o.supplierId)?.name}`, severity: 'notice', permission: 'catalog.manage' })
}

/* ------------------------------------------------------------------------- */
/*  Pricing rules                                                            */
/* ------------------------------------------------------------------------- */
type RuleInput = Omit<PricingRule, 'id' | 'updatedAt' | 'updatedBy'>

function affectedServices(ctx: CoreContext, rule: Pick<PricingRule, 'scope'>) {
  if (rule.scope.kind === 'service') return [rule.scope.serviceId]
  if (rule.scope.kind === 'category') {
    const cid = rule.scope.categoryId
    return ctx.repo.services.filter((s) => s.categoryId === cid).map((s) => s.id)
  }
  return ctx.repo.services.all().map((s) => s.id)
}

export function upsertPricingRule(ctx: CoreContext, p: { ruleId?: string | null; rule: RuleInput; reason?: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'pricing.manage')
  const r = p.rule
  if (r.method === 'cost_plus_percent' && (r.value < -5000 || r.value > 100_000)) throw invalid('Markup must be between -50% and 1000%')
  if ((r.method === 'fixed' || r.method === 'cost_plus_fixed') && r.value < 0) throw invalid('Amount must be positive')
  ctx.repo.tiers.require(r.tierId)
  const sample = affectedServices(ctx, r).slice(0, 25)
  const before = new Map(sample.map((sid) => [sid, quote(ctx, sid, r.tierId).amount]))
  let rule: PricingRule
  if (p.ruleId) {
    rule = ctx.repo.rules.update(p.ruleId, { ...r, updatedAt: ctx.clock.iso(), updatedBy: p.actor.name })
  } else {
    const dup = ctx.repo.rules.find((x) => x.tierId === r.tierId && JSON.stringify(x.scope) === JSON.stringify(r.scope))
    if (dup) throw conflict('duplicate_rule', 'A rule with the same tier and scope already exists — edit it instead')
    rule = ctx.repo.rules.insert({ ...r, id: ctx.ids.id('prl'), updatedAt: ctx.clock.iso(), updatedBy: p.actor.name })
  }
  const changes = sample
    .map((sid) => ({ sid, from: before.get(sid)!, to: quote(ctx, sid, r.tierId).amount }))
    .filter((c) => c.from !== c.to)
    .slice(0, 8)
    .map((c) => ({ field: `${ctx.repo.services.get(c.sid)?.name} (${ctx.repo.tiers.get(r.tierId)?.name})`, from: formatMoney(c.from), to: formatMoney(c.to) }))
  audit(ctx, { actor: p.actor, action: 'price.changed', target: { type: 'pricing_rule', id: rule.id, label: ctx.repo.tiers.get(r.tierId)?.name ?? r.tierId }, summary: `${p.ruleId ? 'Updated' : 'Created'} pricing rule${changes.length ? ` — ${changes.length} price${changes.length > 1 ? 's' : ''} changed` : ''}`, reason: p.reason ?? null, severity: 'notice', changes, permission: 'pricing.manage' })
  return rule
}

export function deletePricingRule(ctx: CoreContext, p: { ruleId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'pricing.manage')
  const rule = ctx.repo.rules.require(p.ruleId)
  ctx.repo.rules.remove(rule.id)
  audit(ctx, { actor: p.actor, action: 'price.rule_deleted', target: { type: 'pricing_rule', id: rule.id, label: ctx.repo.tiers.get(rule.tierId)?.name ?? rule.tierId }, summary: 'Deleted pricing rule', severity: 'notice', permission: 'pricing.manage' })
}

/** Convenience: set a fixed price for one service in one tier (creates or edits the service rule). */
export function setServicePrice(ctx: CoreContext, p: { serviceId: string; tierId: string; amount: Micros; reason?: string; actor: Actor }) {
  const existing = ctx.repo.rules.find((r) => r.tierId === p.tierId && r.scope.kind === 'service' && r.scope.serviceId === p.serviceId)
  return upsertPricingRule(ctx, {
    ruleId: existing?.id ?? null,
    rule: { tierId: p.tierId, scope: { kind: 'service', serviceId: p.serviceId }, method: 'fixed', value: p.amount, rounding: existing?.rounding ?? { increment: 10_000 as Micros, mode: 'nearest' }, minMarginBps: existing?.minMarginBps ?? null, enabled: true, note: existing?.note ?? 'Service list price' },
    reason: p.reason,
    actor: p.actor,
  })
}

export { quoteAllTiers }
