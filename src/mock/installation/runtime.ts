/**
 * Mock installation runtime — wires ORVEX Core to in-memory infrastructure.
 *
 *   CoreContext = MockRepositories + MockSupplierDrivers + MockPaymentGateway
 *               + MockOutboundHttp + MockScheduler + DemoClock + ids
 *
 * In production this is core-api + core-worker + PostgreSQL. Here it runs in
 * the browser: a job loop advances supplier attempts and webhook retries in
 * real time, and a small traffic generator keeps the demo alive.
 */
import { createRng, type Rng } from '@/lib/random'
import { createIdGenerator } from '@/core/ids'
import type { Actor } from '@/core/domain'
import type { Clock, CoreContext } from '@/core/ports'
import { runJob } from '@/core/commands/jobs'
import { completePayment } from '@/core/commands/payments'
import { createRepositories, type MockRepositories } from './store'
import { createMockDrivers, remoteOf, tickRemotes, type SimEnv } from './sim/drivers'
import { createMockGateway } from './sim/gateway'
import { createMockOutbound } from './sim/outbound'
import { MockScheduler } from './sim/scheduler'
import { createSimulationState, type SimulationState } from './sim/simulator'
import type { SystemState } from './data/systemState'
import type { ApiRuntime } from './api/native'

export class DemoClock implements Clock {
  private t: number | null = null
  now() {
    return this.t ?? Date.now()
  }
  iso(at?: number) {
    return new Date(at ?? this.now()).toISOString()
  }
  /** Seed replay runs on simulated time; live mode follows the wall clock. */
  set(t: number | null) {
    this.t = t
  }
  get simulated() {
    return this.t !== null
  }
}

export interface Sessions {
  /** Admin user the operator console acts as ("act as role" demo control). */
  adminUserId: string
  /** Reseller-portal member signed in. */
  portalMemberId: string
  /** Storefront customer signed in (null = guest). */
  storefrontAccountId: string | null
}

export interface ScenarioRef {
  id: string
  title: string
  description: string
  links: { label: string; href: string }[]
}

export interface Runtime extends ApiRuntime {
  sim: SimulationState
  env: SimEnv
  clock: DemoClock
  scheduler: MockScheduler
  sessions: Sessions
  system: SystemState
  scenarios: ScenarioRef[]
  seededAt: number
  live: boolean
}

export function createRuntime(seed: number): Runtime {
  const rng: Rng = createRng(seed)
  const clock = new DemoClock()
  const ids = createIdGenerator(rng)
  const repo: MockRepositories = createRepositories()
  const sim = createSimulationState()
  const scheduler = new MockScheduler(clock, ids)
  const failingHosts = new Set<string>()
  const rt = { live: false } as Runtime
  const env: SimEnv = { sim, rng, clock, ids, repo, live: () => rt.live }
  const ctx: CoreContext = {
    repo,
    drivers: createMockDrivers(env),
    gateway: createMockGateway({ ids, clock, rng }),
    outbound: createMockOutbound(rng, () => failingHosts),
    scheduler,
    clock,
    ids,
  }
  Object.assign(rt, { ctx, repo, rng, sim, env, clock, scheduler, sessions: { adminUserId: 'usr_alex', portalMemberId: 'mem_abcgsm_1', storefrontAccountId: null }, scenarios: [], seededAt: 0 })
  return rt
}

/** Run every job due up to `until`. In simulated time the clock follows each job. */
export function runJobs(rt: Runtime, until: number, max = 100_000): number {
  let n = 0
  for (;;) {
    const job = rt.scheduler.next(until)
    if (!job) break
    if (rt.clock.simulated) rt.clock.set(Math.max(rt.clock.now(), job.dueAt))
    try {
      if (job.kind === 'payment.settle') {
        completePayment(rt.ctx, { intentId: job.payload.intentId!, outcome: (job.payload.outcome as 'succeed' | 'fail' | 'pending') ?? 'succeed' })
      } else {
        runJob(rt.ctx, job, { verificationOutcome: (id) => supplierVerdict(rt, id) })
      }
    } catch (e) {
      console.warn(`[orvex:worker] job ${job.kind} failed`, e)
    }
    if (++n >= max) break
  }
  return n
}

/** Simulated supplier re-verification: when it confirms a faulty result, the supplier credits its own balance. */
function supplierVerdict(rt: Runtime, verificationId: string): boolean {
  const faulty = rt.sim.verificationFaulty
  const v = rt.repo.verifications.get(verificationId)
  const attempt = v && v.status === 'awaiting_supplier' ? rt.repo.orders.get(v.orderId)?.attempts.find((a) => a.state === 'succeeded') : undefined
  if (faulty && attempt) {
    const remote = remoteOf(rt.env, attempt.supplierId)
    remote.balance = (remote.balance + attempt.cost) as typeof remote.balance
  }
  return faulty
}

export function adminActor(rt: Runtime): Actor {
  const u = rt.repo.users.get(rt.sessions.adminUserId) ?? rt.repo.users.require('usr_alex')
  return { type: 'admin', id: u.id, name: u.name, role: rt.repo.roles.get(u.roleId)?.name }
}

export function memberActor(rt: Runtime): Actor {
  const m = rt.repo.members.require(rt.sessions.portalMemberId)
  return { type: 'member', id: m.id, name: `${m.name} (${rt.repo.accounts.get(m.accountId)?.name})`, role: m.role }
}

/** Live mode: process due jobs, advance remote suppliers, keep logs bounded. */
export function liveTick(rt: Runtime) {
  tickRemotes(rt.env)
  runJobs(rt, Date.now(), 500)
}

export function pruneLogs(rt: Runtime) {
  const cap = <T extends { id: string }>(c: { all(): T[]; remove(id: string): void }, max: number) => {
    const all = c.all()
    if (all.length <= max) return
    for (const x of all.slice(max)) c.remove(x.id)
  }
  cap(rt.repo.apiLogs, 2500)
  cap(rt.repo.driverCalls, 3000)
  cap(rt.repo.notifications, 2500)
  cap(rt.repo.webhookDeliveries, 2500)
  cap(rt.repo.inboundWebhooks, 1500)
}
