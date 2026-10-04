/**
 * WebhookService — outbound events signed per the Standard Webhooks spec.
 *
 *   webhook-id:        msg_…   (stable across retries; receivers de-duplicate on it)
 *   webhook-timestamp: unix seconds
 *   webhook-signature: v1,<base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`))>
 *
 * Retry schedule after a failed attempt: 5s, 5m, 30m, 2h, 5h, 10h, 10h
 * (8 attempts in total), then the delivery is marked failed and the operator
 * is notified. In the prototype the HMAC is simulated (deterministic digest)
 * and the POST never leaves the browser.
 */
import type { CoreContext } from '../ports'
import type { WebhookDelivery, WebhookEventType } from '../domain'
import { notify } from './notifications'

export const RETRY_SCHEDULE_SEC = [5, 300, 1800, 7200, 18000, 36000, 36000]
export const MAX_ATTEMPTS = RETRY_SCHEDULE_SEC.length + 1

/** Deterministic stand-in for HMAC-SHA256 → base64 (demo only). */
export function simulatedSignature(secret: string, content: string) {
  const bytes: number[] = []
  let h = 0x811c9dc5
  const s = `${secret}|${content}`
  for (let round = 0; bytes.length < 32; round++) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) + round
      h = Math.imul(h, 0x01000193) >>> 0
    }
    bytes.push(h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff, (h >>> 24) & 0xff)
  }
  const b64 = btoa(String.fromCharCode(...bytes.slice(0, 32)))
  return `v1,${b64}`
}

export interface EmitInput {
  event: WebhookEventType
  accountId: string | null
  orderId?: string | null
  data: unknown
  at?: number
  /** Deliver to this endpoint only (test events). */
  onlyEndpointId?: string
}

/** Fan an event out to every subscribed endpoint (the account's own + installation-level). */
export function emit(ctx: CoreContext, e: EmitInput): WebhookDelivery[] {
  const endpoints = ctx.repo.webhookEndpoints.filter(
    (w) =>
      e.onlyEndpointId ? w.id === e.onlyEndpointId : w.status !== 'disabled' && w.events.includes(e.event) && (w.accountId === null || (e.accountId !== null && w.accountId === e.accountId)),
  )
  const at = e.at ?? ctx.clock.now()
  const out: WebhookDelivery[] = []
  for (const w of endpoints) {
    const messageId = `msg_${ctx.ids.token(24)}`
    const ts = String(Math.floor(at / 1000))
    const payload = JSON.stringify({ type: e.event, timestamp: new Date(at).toISOString(), data: e.data }, null, 2)
    const d = ctx.repo.webhookDeliveries.insert({
      id: ctx.ids.id('whd'),
      endpointId: w.id,
      messageId,
      event: e.event,
      orderId: e.orderId ?? null,
      accountId: e.accountId,
      payload,
      headers: { 'webhook-id': messageId, 'webhook-timestamp': ts, 'webhook-signature': simulatedSignature(w.id, `${messageId}.${ts}.${payload}`) },
      status: 'pending',
      attempts: [],
      nextRetryAt: null,
      createdAt: new Date(at).toISOString(),
    })
    ctx.scheduler.schedule('webhook.deliver', { deliveryId: d.id }, at + 600)
    out.push(d)
  }
  return out
}

/** Job handler: perform one delivery attempt. */
export function deliver(ctx: CoreContext, deliveryId: string) {
  const d = ctx.repo.webhookDeliveries.get(deliveryId)
  if (!d || d.status === 'delivered' || d.status === 'failed') return
  const endpoint = ctx.repo.webhookEndpoints.get(d.endpointId)
  if (!endpoint) return
  const res = ctx.outbound.postWebhook(endpoint, d)
  const n = d.attempts.length + 1
  const ok = res.httpStatus != null && res.httpStatus >= 200 && res.httpStatus < 300
  d.attempts.push({ n, at: ctx.clock.iso(), httpStatus: res.httpStatus, latencyMs: res.latencyMs, error: res.error })
  if (ok) {
    d.status = 'delivered'
    d.nextRetryAt = null
    return
  }
  if (n >= MAX_ATTEMPTS) {
    d.status = 'failed'
    d.nextRetryAt = null
    if (endpoint.status === 'active') endpoint.status = 'failing'
    notify(ctx, { template: 'webhook.failing', vars: { url: endpoint.url, message: `delivery ${d.messageId} failed after ${n} attempts` } })
    return
  }
  const delay = RETRY_SCHEDULE_SEC[n - 1]! * 1000
  d.status = 'retrying'
  d.nextRetryAt = ctx.clock.iso(ctx.clock.now() + delay)
  ctx.scheduler.schedule('webhook.deliver', { deliveryId: d.id }, ctx.clock.now() + delay)
}

/** Manual replay: one immediate attempt with the same webhook-id (receivers de-duplicate). */
export function replay(ctx: CoreContext, deliveryId: string) {
  const d = ctx.repo.webhookDeliveries.require(deliveryId)
  const endpoint = ctx.repo.webhookEndpoints.require(d.endpointId)
  ctx.scheduler.cancel((j) => j.kind === 'webhook.deliver' && j.payload.deliveryId === d.id)
  const res = ctx.outbound.postWebhook(endpoint, d)
  const ok = res.httpStatus != null && res.httpStatus >= 200 && res.httpStatus < 300
  d.attempts.push({ n: d.attempts.length + 1, at: ctx.clock.iso(), httpStatus: res.httpStatus, latencyMs: res.latencyMs, error: res.error ?? (ok ? null : 'manual replay failed') })
  d.status = ok ? 'delivered' : 'failed'
  d.nextRetryAt = null
  return d
}
