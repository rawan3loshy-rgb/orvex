/** Account commands — one model for retail, reseller, business and API-only accounts. */
import { formatMoney, usd, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { Account, AccountMember, AccountTier, Actor, MemberRole } from '../domain'
import { conflict, invalid } from '../errors'
import { requirePermission } from '../services/access'
import { audit } from '../services/audit'
import { adjustWallet, walletBalance } from '../services/ledger'

const TIER_DEFAULTS: Record<AccountTier, Pick<Account, 'channels' | 'limits'>> = {
  retail: { channels: { storefront: true, portal: false, api: false, dhru: false }, limits: { ordersPerMinute: 10, dailyOrders: 50, maxConcurrent: 10, maxOrderValue: usd(250) } },
  reseller: { channels: { storefront: true, portal: true, api: true, dhru: true }, limits: { ordersPerMinute: 120, dailyOrders: 3000, maxConcurrent: 100, maxOrderValue: usd(500) } },
  business: { channels: { storefront: true, portal: true, api: false, dhru: false }, limits: { ordersPerMinute: 60, dailyOrders: 1000, maxConcurrent: 40, maxOrderValue: usd(500) } },
  api_only: { channels: { storefront: false, portal: true, api: true, dhru: true }, limits: { ordersPerMinute: 600, dailyOrders: 20000, maxConcurrent: 300, maxOrderValue: usd(500) } },
}

export function tierDefaults(tier: AccountTier) {
  return structuredClone(TIER_DEFAULTS[tier])
}

export function createAccount(ctx: CoreContext, p: { name: string; email: string; contactName: string; country: string; tier: AccountTier; pricingTierId: string; creditLimit: Micros; actor: Actor }): Account {
  requirePermission(ctx, p.actor, 'accounts.manage')
  if (!p.name.trim()) throw invalid('Account name is required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) throw invalid('Valid email required')
  if (ctx.repo.accounts.find((a) => a.email === p.email.toLowerCase() && a.kind === 'customer')) throw conflict('duplicate_email', 'An account with this email already exists')
  ctx.repo.tiers.require(p.pricingTierId)
  const now = ctx.clock.iso()
  const acct: Account = {
    id: ctx.ids.id('acc'),
    number: `AC-${10000 + ctx.repo.accounts.count() + 1}`,
    name: p.name.trim(),
    kind: 'customer',
    tier: p.tier,
    status: 'active',
    statusReason: null,
    pricingTierId: p.pricingTierId,
    creditLimit: p.creditLimit,
    email: p.email.toLowerCase(),
    contactName: p.contactName,
    phone: null,
    country: p.country,
    company: p.tier === 'retail' ? null : p.name.trim(),
    website: null,
    serviceAccess: { mode: 'all' },
    ...tierDefaults(p.tier),
    lowBalanceAlert: p.tier === 'retail' ? null : usd(100),
    tags: [],
    notes: '',
    createdAt: now,
    lastActiveAt: now,
  }
  ctx.repo.accounts.insert(acct)
  ctx.repo.members.insert({ id: ctx.ids.id('mem'), accountId: acct.id, name: p.contactName || p.name, email: acct.email, role: 'owner', mfa: false, status: 'invited', lastActiveAt: null, createdAt: now })
  audit(ctx, { actor: p.actor, action: 'account.created', target: { type: 'account', id: acct.id, label: acct.name }, summary: `Created ${p.tier.replace('_', '-')} account`, permission: 'accounts.manage' })
  return acct
}

/** Guest checkout: find or create a lightweight guest account for the email. */
export function ensureGuestAccount(ctx: CoreContext, email: string, defaultTierId: string): Account {
  const e = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw invalid('Enter a valid email address', { fields: { email: 'Enter a valid email address' } })
  const existing = ctx.repo.accounts.find((a) => a.email === e)
  if (existing) return existing
  const now = ctx.clock.iso()
  return ctx.repo.accounts.insert({
    id: ctx.ids.id('acc'),
    number: `GU-${20000 + ctx.repo.accounts.count() + 1}`,
    name: e,
    kind: 'guest',
    tier: 'retail',
    status: 'active',
    statusReason: null,
    pricingTierId: defaultTierId,
    creditLimit: 0 as Micros,
    email: e,
    contactName: '',
    phone: null,
    country: '—',
    company: null,
    website: null,
    serviceAccess: { mode: 'all' },
    channels: { storefront: true, portal: false, api: false, dhru: false },
    limits: { ordersPerMinute: 5, dailyOrders: 20, maxConcurrent: 5, maxOrderValue: usd(250) },
    lowBalanceAlert: null,
    tags: ['guest'],
    notes: 'Created by guest checkout',
    createdAt: now,
    lastActiveAt: now,
  })
}

type AccountPatch = Partial<Pick<Account, 'name' | 'tier' | 'pricingTierId' | 'creditLimit' | 'limits' | 'channels' | 'serviceAccess' | 'lowBalanceAlert' | 'notes' | 'email' | 'contactName' | 'phone' | 'country' | 'website'>>

export function updateAccount(ctx: CoreContext, p: { accountId: string; patch: AccountPatch; actor: Actor; reason?: string }) {
  requirePermission(ctx, p.actor, 'accounts.manage')
  const a = ctx.repo.accounts.require(p.accountId)
  const changes: { field: string; from: string; to: string }[] = []
  const show = (k: string, v: unknown) => (k === 'creditLimit' || k === 'lowBalanceAlert' ? formatMoney(v as Micros) : k === 'pricingTierId' ? (ctx.repo.tiers.get(v as string)?.name ?? String(v)) : typeof v === 'object' ? JSON.stringify(v) : String(v))
  for (const [k, v] of Object.entries(p.patch)) {
    const before = (a as unknown as Record<string, unknown>)[k]
    if (JSON.stringify(before) !== JSON.stringify(v)) changes.push({ field: k, from: show(k, before), to: show(k, v) })
  }
  Object.assign(a, p.patch)
  if (changes.length) {
    const sensitive = changes.some((c) => c.field === 'creditLimit' || c.field === 'pricingTierId')
    audit(ctx, { actor: p.actor, action: 'account.updated', target: { type: 'account', id: a.id, label: a.name }, summary: `Updated ${changes.map((c) => c.field).join(', ')}`, reason: p.reason ?? null, severity: sensitive ? 'notice' : 'info', changes, permission: 'accounts.manage' })
  }
  return a
}

export function setAccountStatus(ctx: CoreContext, p: { accountId: string; status: 'active' | 'frozen' | 'closed'; reason: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'accounts.manage')
  if (p.status !== 'active' && !p.reason.trim()) throw invalid('A reason is required to freeze or close an account')
  const a = ctx.repo.accounts.require(p.accountId)
  const from = a.status
  a.status = p.status
  a.statusReason = p.status === 'active' ? null : p.reason
  audit(ctx, { actor: p.actor, action: p.status === 'frozen' ? 'account.frozen' : p.status === 'active' ? 'account.unfrozen' : 'account.closed', target: { type: 'account', id: a.id, label: a.name }, summary: `${from} → ${p.status}`, reason: p.reason || null, severity: p.status === 'active' ? 'notice' : 'warning', changes: [{ field: 'status', from, to: p.status }], permission: 'accounts.manage' })
  return a
}

/** Manual ledger adjustment (goodwill credit or manual debit). */
export function adjustAccountWallet(ctx: CoreContext, p: { accountId: string; amount: Micros; reason: string; actor: Actor; idempotencyKey: string }) {
  requirePermission(ctx, p.actor, 'ledger.adjust')
  if (!p.reason.trim()) throw invalid('A reason is required for manual adjustments')
  if (p.amount === 0) throw invalid('Amount cannot be zero')
  const a = ctx.repo.accounts.require(p.accountId)
  if (p.amount < 0) {
    const bal = walletBalance(ctx, a.id)
    if (bal.spendable + p.amount < 0) throw conflict('would_exceed_credit', `Debit would exceed the credit limit (spendable ${formatMoney(bal.spendable)})`)
  }
  const tx = adjustWallet(ctx, { accountId: a.id, amount: p.amount, reason: p.reason, actor: p.actor, idempotencyKey: p.idempotencyKey })
  audit(ctx, { actor: p.actor, action: 'ledger.manual_adjustment', target: { type: 'account', id: a.id, label: a.name }, summary: `${p.amount > 0 ? 'Credited' : 'Debited'} ${formatMoney(Math.abs(p.amount) as Micros)} (${tx.ref})`, reason: p.reason, severity: 'critical', permission: 'ledger.adjust' })
  return tx
}

export function inviteMember(ctx: CoreContext, p: { accountId: string; name: string; email: string; role: MemberRole; actor: Actor }): AccountMember {
  if (p.actor.type === 'admin') requirePermission(ctx, p.actor, 'accounts.manage')
  const a = ctx.repo.accounts.require(p.accountId)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) throw invalid('Valid email required')
  if (ctx.repo.members.find((m) => m.accountId === a.id && m.email === p.email.toLowerCase())) throw conflict('duplicate_member', 'Already a member')
  const m = ctx.repo.members.insert({ id: ctx.ids.id('mem'), accountId: a.id, name: p.name || p.email, email: p.email.toLowerCase(), role: p.role, mfa: false, status: 'invited', lastActiveAt: null, createdAt: ctx.clock.iso() })
  audit(ctx, { actor: p.actor, action: 'account.member_invited', target: { type: 'account', id: a.id, label: a.name }, summary: `Invited ${m.email} as ${p.role}` })
  return m
}

export function updateMember(ctx: CoreContext, p: { memberId: string; patch: Partial<Pick<AccountMember, 'role' | 'status'>>; actor: Actor }) {
  const m = ctx.repo.members.require(p.memberId)
  if (p.actor.type === 'admin') requirePermission(ctx, p.actor, 'accounts.manage')
  if (m.role === 'owner' && p.patch.role && p.patch.role !== 'owner') {
    const owners = ctx.repo.members.count((x) => x.accountId === m.accountId && x.role === 'owner' && x.status !== 'disabled')
    if (owners <= 1) throw conflict('last_owner', 'An account needs at least one owner')
  }
  const changes = Object.entries(p.patch).map(([k, v]) => ({ field: k, from: String((m as unknown as Record<string, unknown>)[k]), to: String(v) }))
  Object.assign(m, p.patch)
  audit(ctx, { actor: p.actor, action: 'account.member_updated', target: { type: 'account', id: m.accountId, label: ctx.repo.accounts.get(m.accountId)?.name ?? m.accountId }, summary: `Updated member ${m.email}`, changes })
  return m
}
