/** Supplier commands — connection lifecycle, health operations, prepaid balance. */
import { formatMoney, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { Actor, DriverId, ErrorMapping, Supplier } from '../domain'
import { invalid } from '../errors'
import { requirePermission } from '../services/access'
import { audit } from '../services/audit'
import { notify } from '../services/notifications'
import { supplierTopUp } from '../services/ledger'
import { decideChange, runSync } from '../services/catalogSync'

const mask = (v: string) => (v.length <= 6 ? '••••••' : `${v.slice(0, 3)}${'•'.repeat(Math.min(16, v.length - 7))}${v.slice(-4)}`)

export interface ConnectSupplierInput {
  name: string
  driver: DriverId
  url: string
  username: string | null
  credentials: { key: string; label: string; value: string }[]
  actor: Actor
}

export function connectSupplier(ctx: CoreContext, p: ConnectSupplierInput): Supplier {
  requirePermission(ctx, p.actor, 'suppliers.manage')
  if (!p.name.trim()) throw invalid('Supplier name is required')
  if (!/^https:\/\//.test(p.url)) throw invalid('Supplier URL must use https://')
  const now = ctx.clock.iso()
  const s: Supplier = {
    id: ctx.ids.id('sup'),
    name: p.name.trim(),
    code: p.name.trim().slice(0, 3).toUpperCase(),
    driver: p.driver,
    connection: { url: p.url, username: p.username, credentials: p.credentials.map((c) => ({ key: c.key, label: c.label, masked: mask(c.value), updatedAt: now })), environment: 'simulated' },
    enabled: true,
    maintenance: { active: false, until: null, note: '' },
    circuit: { state: 'closed', consecutiveFailures: 0, threshold: 5, openedAt: null, cooldownSec: 120 },
    auth: { status: 'ok', checkedAt: now, message: null },
    reportedBalance: 0 as Micros,
    balanceCheckedAt: now,
    lowBalanceThreshold: 100_000_000 as Micros,
    timeoutMs: 12_000,
    rateLimit: { requests: 20, perSeconds: 1 },
    errorMappings: [],
    callback: { url: null, signing: 'none' },
    region: '—',
    notes: '',
    color: 'var(--c6)',
    connectedAt: now,
    lastSyncAt: null,
    profile: { successRate: 0.97, latencyMs: 600, jitter: 0.4 },
  }
  ctx.repo.suppliers.insert(s)
  audit(ctx, { actor: p.actor, action: 'supplier.connected', target: { type: 'supplier', id: s.id, label: s.name }, summary: `Connected ${s.name} (${p.driver})`, severity: 'notice', permission: 'suppliers.manage' })
  return s
}

export function updateCredentials(ctx: CoreContext, p: { supplierId: string; credentials: { key: string; value: string }[]; actor: Actor }) {
  requirePermission(ctx, p.actor, 'suppliers.credentials')
  const s = ctx.repo.suppliers.require(p.supplierId)
  const now = ctx.clock.iso()
  for (const c of p.credentials) {
    if (!c.value.trim()) continue
    const cred = s.connection.credentials.find((x) => x.key === c.key)
    if (cred) {
      cred.masked = mask(c.value)
      cred.updatedAt = now
    }
  }
  audit(ctx, { actor: p.actor, action: 'supplier.credentials_changed', target: { type: 'supplier', id: s.id, label: s.name }, summary: `Replaced ${p.credentials.filter((c) => c.value.trim()).map((c) => c.key).join(', ')} (values never logged)`, severity: 'critical', permission: 'suppliers.credentials' })
  return s
}

export function testConnection(ctx: CoreContext, p: { supplierId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'suppliers.manage')
  const s = ctx.repo.suppliers.require(p.supplierId)
  const res = ctx.drivers.get(s.driver).testConnection(s)
  ctx.repo.driverCalls.insert(res.call)
  const authStep = res.value.steps.find((x) => x.label.toLowerCase().includes('auth'))
  if (authStep) {
    const was = s.auth.status
    s.auth = { status: authStep.ok ? 'ok' : 'failed', checkedAt: ctx.clock.iso(), message: authStep.ok ? null : res.value.message }
    if (authStep.ok && was === 'failed') {
      s.circuit = { ...s.circuit, state: 'half_open', consecutiveFailures: 0 }
      audit(ctx, { actor: p.actor, action: 'supplier.auth_restored', target: { type: 'supplier', id: s.id, label: s.name }, summary: 'Authentication restored — circuit half-open for a probe order', severity: 'notice' })
    }
  }
  return res.value
}

export function refreshBalance(ctx: CoreContext, p: { supplierId: string }) {
  const s = ctx.repo.suppliers.require(p.supplierId)
  const res = ctx.drivers.get(s.driver).getBalance(s)
  ctx.repo.driverCalls.insert(res.call)
  if (res.value.ok && res.value.balance != null) {
    const wasLow = s.reportedBalance < s.lowBalanceThreshold
    s.reportedBalance = res.value.balance
    s.balanceCheckedAt = ctx.clock.iso()
    if (!wasLow && s.reportedBalance < s.lowBalanceThreshold) notify(ctx, { template: 'supplier.low_balance', supplierId: s.id, vars: { balance: formatMoney(s.reportedBalance), threshold: formatMoney(s.lowBalanceThreshold) } })
  }
  return res.value
}

export function syncSupplierCatalog(ctx: CoreContext, p: { supplierId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'suppliers.manage')
  const run = runSync(ctx, p.supplierId, p.actor, 'manual')
  audit(ctx, { actor: p.actor, action: 'supplier.catalog_synced', target: { type: 'supplier', id: p.supplierId, label: ctx.repo.suppliers.require(p.supplierId).name }, summary: `Catalog sync: ${run.counts.new} new, ${run.counts.price} price, ${run.counts.removed} removed, ${run.counts.fields} field, ${run.counts.warning} warnings`, permission: 'suppliers.manage' })
  return run
}

export function decideSyncChanges(ctx: CoreContext, p: { changeIds: string[]; decision: 'applied' | 'ignored'; actor: Actor }) {
  requirePermission(ctx, p.actor, 'suppliers.manage')
  return p.changeIds.map((id) => decideChange(ctx, { changeId: id, decision: p.decision, actor: p.actor }))
}

export function setMaintenance(ctx: CoreContext, p: { supplierId: string; active: boolean; until: string | null; note: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'suppliers.manage')
  const s = ctx.repo.suppliers.require(p.supplierId)
  s.maintenance = { active: p.active, until: p.active ? p.until : null, note: p.active ? p.note : '' }
  audit(ctx, { actor: p.actor, action: p.active ? 'supplier.maintenance_on' : 'supplier.maintenance_off', target: { type: 'supplier', id: s.id, label: s.name }, summary: p.active ? `Maintenance until ${p.until ?? 'further notice'}` : 'Maintenance ended', reason: p.note || null, permission: 'suppliers.manage' })
  return s
}

export function resetCircuit(ctx: CoreContext, p: { supplierId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'suppliers.manage')
  const s = ctx.repo.suppliers.require(p.supplierId)
  s.circuit = { ...s.circuit, state: 'half_open', consecutiveFailures: 0 }
  audit(ctx, { actor: p.actor, action: 'supplier.circuit_reset', target: { type: 'supplier', id: s.id, label: s.name }, summary: 'Circuit set to half-open — next order is a probe', severity: 'notice', permission: 'suppliers.manage' })
  return s
}

export function updateSupplierSettings(ctx: CoreContext, p: { supplierId: string; patch: { timeoutMs?: number; lowBalanceThreshold?: Micros; rateLimit?: Supplier['rateLimit']; errorMappings?: ErrorMapping[]; enabled?: boolean; notes?: string }; actor: Actor }) {
  requirePermission(ctx, p.actor, 'suppliers.manage')
  const s = ctx.repo.suppliers.require(p.supplierId)
  const changes: { field: string; from: string; to: string }[] = []
  if (p.patch.timeoutMs != null && p.patch.timeoutMs !== s.timeoutMs) changes.push({ field: 'timeout', from: `${s.timeoutMs} ms`, to: `${p.patch.timeoutMs} ms` })
  if (p.patch.enabled != null && p.patch.enabled !== s.enabled) changes.push({ field: 'enabled', from: String(s.enabled), to: String(p.patch.enabled) })
  if (p.patch.lowBalanceThreshold != null && p.patch.lowBalanceThreshold !== s.lowBalanceThreshold) changes.push({ field: 'low balance threshold', from: formatMoney(s.lowBalanceThreshold), to: formatMoney(p.patch.lowBalanceThreshold) })
  Object.assign(s, Object.fromEntries(Object.entries(p.patch).filter(([, v]) => v !== undefined)))
  audit(ctx, { actor: p.actor, action: 'supplier.updated', target: { type: 'supplier', id: s.id, label: s.name }, summary: 'Updated supplier settings', changes, permission: 'suppliers.manage' })
  return s
}

/**
 * Record a payment to a supplier for prepaid credit: DR Supplier Prepaid / CR Bank.
 * The supplier credits our account on its side; the next getBalance reflects it.
 */
export function topUpSupplier(ctx: CoreContext, p: { supplierId: string; amount: Micros; actor: Actor; idempotencyKey: string }) {
  requirePermission(ctx, p.actor, 'ledger.adjust')
  if (p.amount <= 0) throw invalid('Amount must be positive')
  const s = ctx.repo.suppliers.require(p.supplierId)
  const tx = supplierTopUp(ctx, { supplierId: s.id, amount: p.amount, actor: p.actor, idempotencyKey: p.idempotencyKey, note: `Prepaid top-up · ${s.name}` })
  audit(ctx, { actor: p.actor, action: 'supplier.topped_up', target: { type: 'supplier', id: s.id, label: s.name }, summary: `Prepaid top-up ${formatMoney(p.amount)} (${tx.ref})`, severity: 'notice', permission: 'ledger.adjust' })
  return tx
}
