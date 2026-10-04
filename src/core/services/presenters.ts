/**
 * External representations (native API v1, webhooks, storefront tracking).
 *
 * Money crosses the API as a decimal string (`"0.94"`) — never a float.
 * `needs_review` is an operator concept: customers see `processing` with
 * `status_detail: "under_review"` so they are informed without internal detail.
 */
import { CENT, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { Account, Order, OrderStatus, Service } from '../domain'
import { inputSchema } from '../fields'

export const apiMoney = (m: Micros | null | undefined) => (m == null ? null : { amount: (m / 1_000_000).toFixed(m % CENT ? 4 : 2), currency: 'USD' })

export type PublicOrderStatus = Exclude<OrderStatus, 'needs_review'>

export function publicStatus(o: Order): { status: PublicOrderStatus; detail: string | null } {
  if (o.status === 'needs_review') return { status: 'processing', detail: 'under_review' }
  if (o.status === 'processing' && o.attempts.some((a) => a.state === 'accepted')) return { status: 'processing', detail: 'at_supplier' }
  return { status: o.status, detail: null }
}

export function apiOrder(ctx: CoreContext, o: Order) {
  const svc = ctx.repo.services.get(o.serviceId)
  const ps = publicStatus(o)
  return {
    id: o.ref,
    object: 'order',
    status: ps.status,
    status_detail: ps.detail,
    financial_status: o.financialStatus,
    service: { id: svc?.code ?? o.serviceId, name: o.serviceName, revision: o.serviceRevision },
    input: o.input,
    price: apiMoney(o.price.amount),
    refunded: apiMoney(o.refundedTotal),
    result: o.result ? { summary: o.result.summary, fields: o.result.fields } : null,
    rejection: o.rejection,
    client_reference: o.clientReference,
    channel: o.channel,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    completed_at: o.completedAt,
  }
}

export function apiService(ctx: CoreContext, s: Service, price: Micros | null, available: boolean) {
  const rev = ctx.repo.revisions.get(s.revisionId)
  return {
    id: s.code,
    object: 'service',
    name: s.name,
    category: ctx.repo.categories.get(s.categoryId)?.name ?? null,
    processing: s.processing,
    turnaround: { min_seconds: s.turnaround.minSec, max_seconds: s.turnaround.maxSec },
    price: apiMoney(price),
    available,
    revision: s.revision,
    input_schema: rev ? inputSchema(rev.fields) : null,
    result_fields: rev?.resultSchema.map((f) => ({ key: f.key, label: f.label, kind: f.kind })) ?? [],
  }
}

export function apiAccountSummary(a: Account, balance: { available: Micros; held: Micros; creditLimit: Micros }, tierName: string) {
  return {
    id: a.number,
    object: 'account',
    name: a.name,
    tier: a.tier,
    pricing_tier: tierName,
    status: a.status,
    balance: { available: apiMoney(balance.available), held: apiMoney(balance.held), credit_limit: apiMoney(balance.creditLimit) },
  }
}
