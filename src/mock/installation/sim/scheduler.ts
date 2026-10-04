/**
 * In-memory job queue (stands in for the PostgreSQL `jobs` table with leases).
 * `runDue` executes due jobs in time order; jobs scheduled by handlers that are
 * already due run in the same pass.
 */
import type { Clock, Scheduler } from '@/core/ports'
import type { Job } from '@/core/domain'
import type { IdGenerator } from '@/core/ids'

export class MockScheduler implements Scheduler {
  jobs: Job[] = []
  constructor(
    private clock: Clock,
    private ids: IdGenerator,
  ) {}

  schedule(kind: Job['kind'], payload: Record<string, string>, dueAt: number): Job {
    const job: Job = { id: this.ids.id('job'), kind, payload, dueAt, createdAt: this.clock.now() }
    // Keep sorted by dueAt (binary insert).
    let lo = 0
    let hi = this.jobs.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.jobs[mid]!.dueAt <= dueAt) lo = mid + 1
      else hi = mid
    }
    this.jobs.splice(lo, 0, job)
    return job
  }

  cancel(pred: (job: Job) => boolean) {
    const before = this.jobs.length
    this.jobs = this.jobs.filter((j) => !pred(j))
    return before - this.jobs.length
  }

  pending() {
    return this.jobs
  }

  /** Pop the next job due at or before `until`. */
  next(until: number): Job | null {
    const j = this.jobs[0]
    if (!j || j.dueAt > until) return null
    this.jobs.shift()
    return j
  }

  peek(): Job | null {
    return this.jobs[0] ?? null
  }
}
