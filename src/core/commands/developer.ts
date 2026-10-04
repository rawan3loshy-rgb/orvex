/**
 * Developer commands — API keys and webhook endpoints.
 *
 * API key secrets are shown exactly once; only a hash is stored (the UI shows
 * the hash prefix to make that visible). Keys belong to accounts, so
 * idempotency, pricing and wallet are the account's — whichever key is used.
 */
import type { CoreContext } from '../ports'
import type { Actor, ApiKey, ApiScope, WebhookEndpoint, WebhookEventType } from '../domain'
import { conflict, forbidden, invalid } from '../errors'
import { fingerprint } from '../ids'
import { requirePermission } from '../services/access'
import { audit } from '../services/audit'
import { emit } from '../services/webhooks'

function authorizeAccountActor(ctx: CoreContext, actor: Actor, accountId: string) {
  if (actor.type === 'admin') return requirePermission(ctx, actor, 'developer.manage')
  if (actor.type === 'member') {
    const m = ctx.repo.members.get(actor.id)
    if (!m || m.accountId !== accountId) throw forbidden('not_a_member', 'Not a member of this account')
    if (!['owner', 'admin', 'developer'].includes(m.role)) throw forbidden('member_role', `The ${m.role} role cannot manage API access`)
    return
  }
  throw forbidden('permission_denied', 'Not allowed')
}

/** Simulated SHA-256 display hash of a secret (demo). */
export function displayHash(secret: string) {
  return `sha256:${fingerprint(secret)}${fingerprint(`${secret}#`)}${fingerprint(`#${secret}`)}`.slice(0, 31)
}

export function createApiKey(
  ctx: CoreContext,
  p: { accountId: string; name: string; environment: 'live' | 'test'; scopes: ApiScope[]; ipAllowlist: string[]; rateLimitPerMin: number; dhruCompat: boolean; expiresInDays: number | null; actor: Actor },
): { key: ApiKey; secret: string } {
  authorizeAccountActor(ctx, p.actor, p.accountId)
  const acct = ctx.repo.accounts.require(p.accountId)
  if (!acct.channels.api && !acct.channels.dhru) throw conflict('api_not_enabled', `API access is not enabled for ${acct.name}`)
  if (!p.name.trim()) throw invalid('Key name is required')
  if (!p.scopes.length) throw invalid('Select at least one scope')
  for (const ip of p.ipAllowlist) if (!/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip)) throw invalid(`Invalid IP or CIDR: ${ip}`)
  const body = ctx.ids.token(32)
  const prefix = `orx_${p.environment}_${ctx.ids.hex(4)}`
  const secret = `${prefix}_${body}`
  const now = ctx.clock.now()
  const key = ctx.repo.apiKeys.insert({
    id: ctx.ids.id('key'),
    accountId: acct.id,
    name: p.name.trim(),
    prefix,
    last4: body.slice(-4),
    hash: displayHash(secret),
    environment: p.environment,
    scopes: p.scopes,
    ipAllowlist: p.ipAllowlist,
    rateLimitPerMin: p.rateLimitPerMin,
    dhruCompat: p.dhruCompat && acct.channels.dhru,
    status: 'active',
    createdAt: ctx.clock.iso(now),
    createdBy: p.actor.name,
    lastUsedAt: null,
    expiresAt: p.expiresInDays ? ctx.clock.iso(now + p.expiresInDays * 86400_000) : null,
  })
  audit(ctx, { actor: p.actor, action: 'api_key.created', target: { type: 'account', id: acct.id, label: acct.name }, summary: `Created API key ${prefix}… (${p.scopes.join(', ')})`, severity: 'notice', permission: p.actor.type === 'admin' ? 'developer.manage' : null })
  return { key, secret }
}

export function revokeApiKey(ctx: CoreContext, p: { keyId: string; actor: Actor; reason?: string }) {
  const k = ctx.repo.apiKeys.require(p.keyId)
  authorizeAccountActor(ctx, p.actor, k.accountId)
  if (k.status === 'revoked') return k
  k.status = 'revoked'
  audit(ctx, { actor: p.actor, action: 'api_key.revoked', target: { type: 'account', id: k.accountId, label: ctx.repo.accounts.get(k.accountId)?.name ?? k.accountId }, summary: `Revoked API key ${k.prefix}…`, reason: p.reason ?? null, severity: 'warning' })
  return k
}

export function updateApiKey(ctx: CoreContext, p: { keyId: string; patch: Partial<Pick<ApiKey, 'name' | 'scopes' | 'ipAllowlist' | 'rateLimitPerMin' | 'dhruCompat'>>; actor: Actor }) {
  const k = ctx.repo.apiKeys.require(p.keyId)
  authorizeAccountActor(ctx, p.actor, k.accountId)
  const changes = Object.entries(p.patch).map(([f, v]) => ({ field: f, from: JSON.stringify((k as unknown as Record<string, unknown>)[f]), to: JSON.stringify(v) }))
  Object.assign(k, p.patch)
  audit(ctx, { actor: p.actor, action: 'api_key.updated', target: { type: 'account', id: k.accountId, label: ctx.repo.accounts.get(k.accountId)?.name ?? k.accountId }, summary: `Updated API key ${k.prefix}…`, changes })
  return k
}

export function createWebhookEndpoint(ctx: CoreContext, p: { accountId: string | null; url: string; description: string; events: WebhookEventType[]; actor: Actor }): { endpoint: WebhookEndpoint; secret: string } {
  if (p.accountId) authorizeAccountActor(ctx, p.actor, p.accountId)
  else requirePermission(ctx, p.actor, 'developer.manage')
  if (!/^https:\/\/[^\s]+$/.test(p.url)) throw invalid('Endpoint URL must be https://')
  if (!p.events.length) throw invalid('Subscribe to at least one event')
  if (p.accountId && p.events.includes('order.needs_review')) throw invalid('order.needs_review is an operator-only event')
  const secret = `whsec_${ctx.ids.token(32)}`
  const endpoint = ctx.repo.webhookEndpoints.insert({ id: ctx.ids.id('whe'), accountId: p.accountId, url: p.url, description: p.description, events: p.events, status: 'active', secretMasked: `whsec_••••••••${secret.slice(-4)}`, createdAt: ctx.clock.iso() })
  audit(ctx, { actor: p.actor, action: 'webhook.created', target: { type: 'webhook', id: endpoint.id, label: p.url }, summary: `Added webhook endpoint (${p.events.length} events)` })
  return { endpoint, secret }
}

export function updateWebhookEndpoint(ctx: CoreContext, p: { endpointId: string; patch: Partial<Pick<WebhookEndpoint, 'url' | 'description' | 'events' | 'status'>>; actor: Actor }) {
  const w = ctx.repo.webhookEndpoints.require(p.endpointId)
  if (w.accountId) authorizeAccountActor(ctx, p.actor, w.accountId)
  else requirePermission(ctx, p.actor, 'developer.manage')
  Object.assign(w, p.patch)
  audit(ctx, { actor: p.actor, action: 'webhook.updated', target: { type: 'webhook', id: w.id, label: w.url }, summary: `Updated webhook endpoint${p.patch.status ? ` (${p.patch.status})` : ''}` })
  return w
}

export function deleteWebhookEndpoint(ctx: CoreContext, p: { endpointId: string; actor: Actor }) {
  const w = ctx.repo.webhookEndpoints.require(p.endpointId)
  if (w.accountId) authorizeAccountActor(ctx, p.actor, w.accountId)
  else requirePermission(ctx, p.actor, 'developer.manage')
  ctx.repo.webhookEndpoints.remove(w.id)
  audit(ctx, { actor: p.actor, action: 'webhook.deleted', target: { type: 'webhook', id: w.id, label: w.url }, summary: 'Deleted webhook endpoint', severity: 'notice' })
}

export function sendTestWebhook(ctx: CoreContext, p: { endpointId: string; actor: Actor }) {
  const w = ctx.repo.webhookEndpoints.require(p.endpointId)
  if (w.accountId) authorizeAccountActor(ctx, p.actor, w.accountId)
  const [d] = emit(ctx, { event: w.events[0]!, accountId: w.accountId, onlyEndpointId: w.id, data: { test: true, message: 'Test event from ORVEX (simulated delivery)' } })
  return d ?? null
}
