/**
 * DEMO / SIMULATION API — clearly separate from the product API.
 * Controls supplier behaviour, payments, traffic, sessions ("act as"), license
 * state and fast-forwarding of the job queue. Nothing here exists in production.
 */
import type { MockRoute } from '@/api/mockRouter'
import type { Micros } from '@/core/money'
import { supplierHealth } from '@/core/services/supplier'
import { refreshBalance } from '@/core/commands/suppliers'
import type { DemoState } from '@/types/installation'
import { runJobs, type Runtime } from '../runtime'
import { remoteOf } from '../sim/drivers'
import { DEMO_IMEIS } from '../sim/results'
import { setBehaviour, SIM_BEHAVIOURS, type SimBehaviour } from '../sim/simulator'
import { resetRuntime } from '../boot'
import { r } from './util'

function state(rt: Runtime): DemoState {
  const next = rt.scheduler.peek()
  return {
    sessions: rt.sessions,
    rules: rt.sim.rules,
    behaviours: SIM_BEHAVIOURS,
    traffic: rt.sim.traffic,
    nextPayment: rt.sim.nextPayment,
    verificationFaulty: rt.sim.verificationFaulty,
    scenarios: rt.scenarios,
    demoImeis: DEMO_IMEIS.map(({ imei, story }) => ({ imei, story })),
    users: rt.repo.users.filter((u) => u.status === 'active').map((u) => ({ id: u.id, name: u.name, role: rt.repo.roles.get(u.roleId)?.name ?? u.roleId })),
    members: rt.repo.members
      .filter((m) => m.status === 'active' && ['reseller', 'business', 'api_only'].includes(rt.repo.accounts.get(m.accountId)?.tier ?? ''))
      .map((m) => ({ id: m.id, name: m.name, role: m.role, accountId: m.accountId, accountName: rt.repo.accounts.get(m.accountId)?.name ?? '' })),
    customers: rt.repo.accounts.filter((a) => a.tier === 'retail' && a.kind === 'customer' && a.status === 'active').slice(0, 12).map((a) => ({ id: a.id, name: a.name, email: a.email })),
    suppliers: rt.repo.suppliers.all().map((s) => {
      const remote = remoteOf(rt.env, s.id)
      return { id: s.id, name: s.name, health: supplierHealth(rt.ctx, s), remoteBalance: remote.balance, credentialsValid: remote.credentialsValid, maintenance: remote.maintenance }
    }),
    jobs: { pending: rt.scheduler.pending().length, next: next ? { kind: next.kind, dueAt: next.dueAt } : null },
    seededAt: rt.seededAt,
    licenseStatus: rt.system.license.status,
  }
}

export const demoRoutes: MockRoute[] = [
  r('GET', '/demo/state', (rt) => state(rt)),
  r<{ supplierId: string; behaviour: string; remaining?: number | null; received?: boolean }>('POST', '/demo/supplier-behaviour', (rt, { body }) => {
    setBehaviour(rt.sim, body.supplierId, body.behaviour as SimBehaviour, body.remaining ?? 1, rt.clock.iso(), { received: body.received })
    return state(rt)
  }),
  r('POST', '/demo/supplier-behaviour/clear', (rt) => {
    rt.sim.rules = []
    return state(rt)
  }),
  r<{ supplierId: string; credentialsValid?: boolean; maintenance?: boolean; balanceDelta?: Micros }>('POST', '/demo/supplier-state', (rt, { body }) => {
    const remote = remoteOf(rt.env, body.supplierId)
    if (body.credentialsValid !== undefined) remote.credentialsValid = !!body.credentialsValid
    if (body.maintenance !== undefined) remote.maintenance = !!body.maintenance
    if (body.balanceDelta) remote.balance = (remote.balance + body.balanceDelta) as Micros
    refreshBalance(rt.ctx, { supplierId: body.supplierId })
    return state(rt)
  }),
  r<Partial<Runtime['sim']['traffic']>>('POST', '/demo/traffic', (rt, { body }) => {
    rt.sim.traffic = { enabled: body.enabled ?? rt.sim.traffic.enabled, perMinute: body.perMinute ?? rt.sim.traffic.perMinute }
    return state(rt)
  }),
  r<{ outcome: Runtime['sim']['nextPayment'] }>('POST', '/demo/payment-outcome', (rt, { body }) => {
    rt.sim.nextPayment = body.outcome
    return state(rt)
  }),
  r<{ faulty: boolean }>('POST', '/demo/verification-outcome', (rt, { body }) => {
    rt.sim.verificationFaulty = !!body.faulty
    return state(rt)
  }),
  r<{ minutes?: number }>('POST', '/demo/fast-forward', (rt, { body }) => {
    const minutes = Math.min(24 * 60, Math.max(1, Number(body.minutes ?? 60)))
    const now = Date.now()
    const until = now + minutes * 60_000
    let ran = 0
    for (let i = 0; i < 12; i++) {
      for (const remote of Object.values(rt.sim.remote)) for (const ro of Object.values(remote.orders)) if (ro.completeAt > now && ro.completeAt <= until) ro.completeAt = now
      let moved = false
      for (const j of rt.scheduler.jobs) {
        if (j.dueAt > now && j.dueAt <= until) {
          j.dueAt = now
          moved = true
        }
      }
      rt.scheduler.jobs.sort((a, b) => a.dueAt - b.dueAt)
      ran += runJobs(rt, Date.now())
      if (!moved) break
    }
    return { ran, minutes, state: state(rt) }
  }),
  r<{ userId: string }>('POST', '/demo/act-as', (rt, { body }) => {
    rt.repo.users.require(body.userId)
    rt.sessions.adminUserId = body.userId
    return state(rt)
  }),
  r<{ memberId: string }>('POST', '/demo/portal-member', (rt, { body }) => {
    rt.repo.members.require(body.memberId)
    rt.sessions.portalMemberId = body.memberId
    return state(rt)
  }),
  r<{ accountId?: string | null }>('POST', '/demo/storefront-customer', (rt, { body }) => {
    rt.sessions.storefrontAccountId = body.accountId ?? null
    return state(rt)
  }),
  r<{ status: 'active' | 'updates_expired' }>('POST', '/demo/license', (rt, { body }) => {
    rt.system.license.status = body.status
    rt.system.updates.preflight = rt.system.updates.preflight.map((p) => (p.id === 'entitlement' ? { ...p, status: body.status === 'updates_expired' ? 'fail' : 'pass', detail: body.status === 'updates_expired' ? `Update entitlement ended ${rt.system.license.updatesUntil.slice(0, 10)} — operations continue on ${rt.system.updates.currentVersion}` : `Updates included until ${rt.system.license.updatesUntil.slice(0, 10)}` } : p))
    return state(rt)
  }),
  r('POST', '/demo/reset', async () => {
    const rt = await resetRuntime()
    return state(rt)
  }),
]
