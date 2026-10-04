/**
 * Update-run simulation store (prototype only).
 *
 * Module-level so the run keeps progressing while the operator minimises it or
 * navigates away — like a real update, which runs on the server. When the
 * simulated health check passes, the store calls the `commit` function given to
 * `start` (systemService.completeUpdate) exactly once.
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
  step: string
}

interface Scheduled extends Omit<LogLine, 'id' | 't'> {
  offset: number
}

type Commit = (durationSec: number) => Promise<void>

interface RunState {
  status: RunStatus
  minimized: boolean
  params: RunParams | null
  steps: StepDef[]
  schedule: Scheduled[]
  startedAt: number
  elapsed: number
  logs: LogLine[]
  durationSec: number
  error: string | null
  commit: Commit | null

  openConfirm: () => void
  dismiss: () => void
  start: (p: RunParams, commit: Commit) => void
  minimize: () => void
  expand: () => void
}

let timer: ReturnType<typeof setInterval> | null = null
let seq = 1

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

export const useUpdateRun = create<RunState>((set, get) => {
  const runCommit = async () => {
    const s = get()
    const t = s.startedAt + s.elapsed * SPEED
    const push = (text: string, tone: LogTone, dt = 0) => ({ id: seq++, t: t + dt, text, tone, step: 'complete' })
    set({ logs: [...s.logs, push('Recording release in update history (POST /admin/system/updates/complete)…', 'default')] })
    try {
      await s.commit?.(s.durationSec)
      const now = get()
      set({
        status: 'complete',
        logs: [...now.logs, push(`Update to ${now.params?.to} completed in ${duration(now.durationSec)} · recorded in update history`, 'ok', 600)],
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      const now = get()
      set({ status: 'failed', error: message, logs: [...now.logs, push(`Commit refused: ${message} — ${now.params?.from} keeps running`, 'warn', 400)] })
    }
  }

  const tick = () => {
    const s = get()
    if (s.status !== 'running') return stopTimer()
    const elapsed = Date.now() - s.startedAt
    const total = totalDuration(s.steps)
    const due = s.schedule.filter((l) => l.offset <= elapsed)
    const logs = due.length ? [...s.logs, ...due.map((l) => ({ id: seq++, t: s.startedAt + l.offset * SPEED, text: l.text, tone: l.tone, step: l.step }))] : s.logs
    const schedule = due.length ? s.schedule.filter((l) => l.offset > elapsed) : s.schedule
    if (elapsed >= total) {
      stopTimer()
      set({ elapsed: total, logs, schedule, status: 'committing' })
      void runCommit()
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
    durationSec: 0,
    error: null,
    commit: null,

    openConfirm: () => {
      const s = get().status
      if (s === 'running' || s === 'committing') return set({ minimized: false })
      set({ status: 'confirm', minimized: false, error: null })
    },
    dismiss: () => {
      const s = get().status
      if (s === 'running' || s === 'committing') return set({ minimized: true })
      set({ status: 'idle', minimized: false })
    },
    start: (params, commit) => {
      stopTimer()
      const steps = buildSteps(params)
      let acc = 0
      const schedule: Scheduled[] = []
      for (const st of steps) {
        for (const l of st.logs) schedule.push({ offset: acc + l.at * st.duration, text: l.text, tone: l.tone ?? 'default', step: st.id })
        acc += st.duration
      }
      schedule.sort((a, b) => a.offset - b.offset)
      set({ status: 'running', minimized: false, params, steps, schedule, startedAt: Date.now(), elapsed: 0, logs: [], durationSec: Math.round((acc * SPEED) / 1000), error: null, commit })
      timer = setInterval(tick, 90)
    },
    minimize: () => set({ minimized: true }),
    expand: () => set({ minimized: false }),
  }
})

/** Derived progress for the current run. Index === steps.length means the "Complete" step. */
export function runProgress(steps: StepDef[], elapsed: number, status: RunStatus) {
  const total = totalDuration(steps) || 1
  if (status === 'complete') return { index: steps.length + 1, stepProgress: 1, overall: 1 }
  if (status === 'committing' || status === 'failed') return { index: steps.length, stepProgress: 1, overall: 0.99 }
  let acc = 0
  for (let i = 0; i < steps.length; i++) {
    const d = steps[i]!.duration
    if (elapsed < acc + d) return { index: i, stepProgress: (elapsed - acc) / d, overall: (elapsed / total) * 0.98 }
    acc += d
  }
  return { index: steps.length, stepProgress: 1, overall: 0.98 }
}
