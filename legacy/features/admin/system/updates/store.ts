/**
 * Update-run simulation (prototype only).
 *
 * Lives in a module-level store so the run keeps progressing while the admin
 * minimises it or navigates away — like the real update, which runs on the
 * server, not in the browser. Nothing here touches the mock database: the
 * Update Center page commits the result through `systemService.completeUpdate`
 * once the simulated health check passes.
 */
import { create } from 'zustand'
import { duration } from '@/lib/format'
import { buildSteps, SPEED, totalDuration, type LogTone, type RunParams, type StepDef } from './steps'

export type RunStatus = 'idle' | 'confirm' | 'running' | 'committing' | 'complete' | 'failed'

export interface LogLine {
  id: number
  /** Simulated wall-clock timestamp (ms). */
  t: number
  text: string
  tone: LogTone
}

interface Scheduled extends Omit<LogLine, 'id' | 't'> {
  offset: number
}

interface RunState {
  status: RunStatus
  minimized: boolean
  params: RunParams | null
  steps: StepDef[]
  schedule: Scheduled[]
  startedAt: number
  elapsed: number
  logs: LogLine[]
  commitRequested: boolean
  durationSec: number
  error: string | null

  openConfirm: () => void
  dismiss: () => void
  start: (p: RunParams) => void
  minimize: () => void
  expand: () => void
  /** Returns true exactly once per run, so the page commits a single time. */
  claimCommit: () => boolean
  finish: () => void
  fail: (message: string) => void
}

let timer: ReturnType<typeof setInterval> | null = null
let seq = 1

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

export const useUpdateRun = create<RunState>((set, get) => {
  const tick = () => {
    const s = get()
    if (s.status !== 'running') return stopTimer()
    const elapsed = Date.now() - s.startedAt
    const total = totalDuration(s.steps)
    const due = s.schedule.filter((l) => l.offset <= elapsed)
    const logs = due.length ? [...s.logs, ...due.map((l) => ({ id: seq++, t: s.startedAt + l.offset * SPEED, text: l.text, tone: l.tone }))] : s.logs
    const schedule = due.length ? s.schedule.filter((l) => l.offset > elapsed) : s.schedule
    if (elapsed >= total) {
      stopTimer()
      set({ elapsed: total, logs, schedule, status: 'committing' })
      return
    }
    set({ elapsed, logs, schedule })
  }

  return {
    status: 'idle',
    minimized: false,
    params: null,
    steps: [],
    schedule: [],
    startedAt: 0,
    elapsed: 0,
    logs: [],
    commitRequested: false,
    durationSec: 0,
    error: null,

    openConfirm: () => {
      const s = get().status
      if (s === 'running' || s === 'committing') return set({ minimized: false })
      set({ status: 'confirm', minimized: false, error: null })
    },
    dismiss: () => {
      const s = get().status
      if (s === 'running' || s === 'committing') return set({ minimized: true })
      // Keep the last run's params/logs so the closing modal doesn't flash empty; `start` resets them.
      set({ status: 'idle', minimized: false })
    },
    start: (params) => {
      stopTimer()
      const steps = buildSteps(params)
      let acc = 0
      const schedule: Scheduled[] = []
      for (const st of steps) {
        for (const l of st.logs) schedule.push({ offset: acc + l.at * st.duration, text: l.text, tone: l.tone ?? 'default' })
        acc += st.duration
      }
      schedule.sort((a, b) => a.offset - b.offset)
      set({
        status: 'running',
        minimized: false,
        params,
        steps,
        schedule,
        startedAt: Date.now(),
        elapsed: 0,
        logs: [],
        commitRequested: false,
        durationSec: Math.round((acc * SPEED) / 1000),
        error: null,
      })
      timer = setInterval(tick, 90)
    },
    minimize: () => set({ minimized: true }),
    expand: () => set({ minimized: false }),
    claimCommit: () => {
      const s = get()
      if (s.status !== 'committing' || s.commitRequested) return false
      set({ commitRequested: true })
      return true
    },
    finish: () => {
      const s = get()
      const t = s.startedAt + s.elapsed * SPEED
      set({
        status: 'complete',
        logs: [...s.logs, { id: seq++, t: t + 400, text: `Update to ${s.params?.to} completed in ${duration(s.durationSec)} · recorded in update history`, tone: 'ok' }],
      })
    },
    fail: (message) => {
      const s = get()
      const t = s.startedAt + s.elapsed * SPEED
      set({ status: 'failed', error: message, logs: [...s.logs, { id: seq++, t, text: `Commit failed: ${message} — previous version kept`, tone: 'warn' }] })
    },
  }
})

/** Derived progress for the current run. */
export function runProgress(steps: StepDef[], elapsed: number, status: RunStatus) {
  const total = totalDuration(steps) || 1
  if (status === 'complete') return { index: steps.length, stepProgress: 1, overall: 1 }
  let acc = 0
  for (let i = 0; i < steps.length; i++) {
    const d = steps[i]!.duration
    if (elapsed < acc + d) return { index: i, stepProgress: (elapsed - acc) / d, overall: elapsed / total }
    acc += d
  }
  // committing: hold on the health check at 99%
  return { index: steps.length - 1, stepProgress: 1, overall: status === 'committing' ? 0.99 : 1 }
}
