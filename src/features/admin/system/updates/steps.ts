/**
 * Simulated update sequence (prototype only — no Docker, no database changes
 * happen until `systemService.completeUpdate` records the result).
 *
 *   Preflight → Backup → Migration (expand-only) → Worker drain →
 *   Container swap → Health check → Complete
 */
import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, Container, DatabaseBackup, DatabaseZap, HeartPulse, PartyPopper, PauseCircle } from 'lucide-react'
import type { UpdateStepId } from '@/types/installation'
import type { Release } from '@/types/release'

export type LogTone = 'default' | 'muted' | 'ok' | 'warn' | 'accent'

export interface LogDef {
  /** Position inside the step, 0..1 */
  at: number
  text: string
  tone?: LogTone
}

export interface StepDef {
  id: UpdateStepId
  label: string
  /** Present-tense label while running. */
  active: string
  icon: LucideIcon
  /** Real duration of the simulated step in ms. */
  duration: number
  logs: LogDef[]
  detail: (p: number) => string
}

export interface RunParams {
  from: string
  to: string
  schemaFrom: string
  release: Release
  pendingMigrations: string[]
  strategy: string
  dbName: string
  dbSizeMb: number
  backupSizeMb: number
  containers: string[]
  incompatible: { id: string; name: string; coreRange: string }[]
  preflight: { label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[]
  /** Jobs waiting at suppliers (attempt.poll) — keep running across the update. */
  awaitingSupplier: number
  /** Jobs in the queue when the update starts. */
  queued: number
}

/** The prototype compresses a ~2–3 minute update into ~17 seconds. */
export const SPEED = 8

export const STEP_META: { id: UpdateStepId; label: string; icon: LucideIcon; summary: string }[] = [
  { id: 'preflight', label: 'Preflight', icon: ClipboardCheck, summary: 'Entitlement, upgrade path, disk, PostgreSQL range, extension compatibility' },
  { id: 'backup', label: 'Backup', icon: DatabaseBackup, summary: 'pg_dump of your database + config snapshot — always taken' },
  { id: 'migration', label: 'Migration', icon: DatabaseZap, summary: 'Expand-only: adds columns and tables, never drops — old code keeps working' },
  { id: 'worker_drain', label: 'Worker drain', icon: PauseCircle, summary: 'core-worker stops claiming jobs; in-flight attempts finish' },
  { id: 'container_swap', label: 'Container swap', icon: Container, summary: 'Signed images replace core-api, core-worker, core-scheduler' },
  { id: 'health_check', label: 'Health check', icon: HeartPulse, summary: 'Probes API, PostgreSQL, queue and webhooks; restores on failure' },
  { id: 'complete', label: 'Complete', icon: PartyPopper, summary: 'Recorded in update history; queue resumes' },
]

export const migrationVersion = (name: string) => name.split('_')[0] ?? name

export function buildSteps(p: RunParams): StepDef[] {
  const rel = p.release
  const backupId = `bkp_pre_${rel.version}`
  const mig = p.pendingMigrations
  const core = p.containers.filter((c) => c.startsWith('core-'))
  const gb = p.backupSizeMb / 1024
  const pass = p.preflight.filter((c) => c.status === 'pass').length
  const warn = p.preflight.filter((c) => c.status === 'warn').length
  const schemaTo = mig.length ? migrationVersion(mig[mig.length - 1]!) : p.schemaFrom
  const icon = (id: UpdateStepId) => STEP_META.find((s) => s.id === id)!.icon

  return [
    {
      id: 'preflight',
      label: 'Preflight',
      active: 'Running preflight checks',
      icon: icon('preflight'),
      duration: 1900,
      detail: (x) => `Check ${Math.min(p.preflight.length, Math.floor(x * p.preflight.length) + 1)} of ${p.preflight.length}`,
      logs: [
        { at: 0, text: `orvex update ${p.from} → ${p.to} (channel: ${rel.channel})`, tone: 'accent' },
        { at: 0.06, text: 'Acquiring update lock (pg_advisory_lock) … OK' },
        ...p.preflight.map((c, i) => ({ at: 0.12 + (i / Math.max(1, p.preflight.length)) * 0.7, text: `  ${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'} ${c.label} — ${c.detail}`, tone: (c.status === 'pass' ? 'muted' : 'warn') as LogTone })),
        ...p.incompatible.map((e) => ({ at: 0.86, text: `Extension ${e.id} declares ${e.coreRange} — will be disabled until a compatible version is installed`, tone: 'warn' as LogTone })),
        { at: 0.94, text: `Preflight: ${p.preflight.length} checks · ${pass} passed · ${warn} warning${warn === 1 ? '' : 's'}`, tone: 'ok' },
      ],
    },
    {
      id: 'backup',
      label: 'Backup',
      active: 'Creating backup',
      icon: icon('backup'),
      duration: 2800,
      detail: (x) => `pg_dump ${p.dbName} · ${(gb * x).toFixed(2)} of ${gb.toFixed(2)} GB`,
      logs: [
        { at: 0, text: `pg_dump --format=custom ${p.dbName} → /var/backups/orvex/${backupId}.dump` },
        { at: 0.32, text: `  … ${(gb * 0.33).toFixed(2)} GB written`, tone: 'muted' },
        { at: 0.64, text: `  … ${(gb * 0.68).toFixed(2)} GB written`, tone: 'muted' },
        { at: 0.86, text: `Backup written: ${backupId}.dump (${gb.toFixed(2)} GB) · checksum verified`, tone: 'ok' },
        { at: 0.94, text: `Snapshot .env, Caddyfile and extensions → ${backupId}.config.tar` },
      ],
    },
    {
      id: 'migration',
      label: 'Migration',
      active: 'Applying expand-only migrations',
      icon: icon('migration'),
      duration: 2900,
      detail: (x) => (mig.length ? `Migration ${Math.min(mig.length, Math.floor(x * mig.length) + 1)} of ${mig.length} · schema ${p.schemaFrom} → ${schemaTo}` : 'No schema changes in this release'),
      logs: mig.length
        ? [
            { at: 0, text: `Applying ${mig.length} migration${mig.length === 1 ? '' : 's'} (expand phase) — ${p.from} code keeps running against the new schema` },
            ...mig.map((m, i) => ({ at: 0.12 + (i / mig.length) * 0.7, text: `  ↳ ${m} … OK (${[38, 112, 61, 24][i] ?? 40} ms, additive)`, tone: 'muted' as LogTone })),
            { at: 0.88, text: 'No columns or tables dropped — contract step ships in a later release', tone: 'muted' },
            { at: 0.95, text: `Schema version ${p.schemaFrom} → ${schemaTo}`, tone: 'ok' },
          ]
        : [{ at: 0.1, text: 'No database migrations in this release', tone: 'muted' }],
    },
    {
      id: 'worker_drain',
      label: 'Worker drain',
      active: 'Draining core-worker',
      icon: icon('worker_drain'),
      duration: 2200,
      detail: (x) => (x < 0.5 ? 'core-worker and core-scheduler stop claiming jobs…' : 'Waiting for in-flight supplier attempts to finish…'),
      logs: [
        { at: 0.04, text: 'Signal SIGTERM → core-worker, core-scheduler (stop claiming new jobs)' },
        { at: 0.3, text: `Waiting for in-flight attempts to finish … 0 remaining`, tone: 'muted' },
        { at: 0.5, text: `${p.awaitingSupplier} supplier job${p.awaitingSupplier === 1 ? '' : 's'} awaiting async results stay in the queue (attempt.poll) — nothing is resent`, tone: 'muted' },
        { at: 0.72, text: `core-api keeps accepting orders — they wait as order.dispatch jobs (${p.queued} in queue)` },
        { at: 0.92, text: 'Workers drained', tone: 'ok' },
      ],
    },
    {
      id: 'container_swap',
      label: 'Container swap',
      active: 'Swapping containers',
      icon: icon('container_swap'),
      duration: 2700,
      detail: (x) => (x < 0.4 ? `Pulling registry.orvex.io/core:${rel.version}…` : `Restarting ${core.join(', ')}`),
      logs: [
        { at: 0, text: `docker pull registry.orvex.io/core:${rel.version} (${(rel.package.sizeBytes / 1024 / 1024).toFixed(1)} MB)` },
        { at: 0.18, text: `SHA-256 ${rel.package.sha256} … OK · signature verified (${rel.package.signedBy})`, tone: 'ok' },
        ...core.map((c, i) => ({ at: 0.36 + i * 0.16, text: `  ${c}: ${p.from} → ${rel.version} … healthy (${(1.6 + i * 0.5).toFixed(1)} s)`, tone: 'muted' as LogTone })),
        { at: 0.9, text: 'Caddy routed traffic to the new core-api once it passed its readiness probe' },
        { at: 0.96, text: `Previous images kept for rollback (core:${p.from})`, tone: 'muted' },
      ],
    },
    {
      id: 'health_check',
      label: 'Health check',
      active: 'Running health checks',
      icon: icon('health_check'),
      duration: 1900,
      detail: (x) => (x < 0.6 ? 'Probing core-api, PostgreSQL, job queue and webhooks…' : 'All probes passing'),
      logs: [
        { at: 0.08, text: 'GET /healthz → 200 · PostgreSQL SELECT 1 → OK', tone: 'ok' },
        { at: 0.36, text: 'Job queue resumed — core-worker claiming jobs again', tone: 'ok' },
        { at: 0.6, text: `Supplier drivers loaded · ${p.incompatible.length} extension${p.incompatible.length === 1 ? '' : 's'} disabled as incompatible` },
        { at: 0.84, text: `Version ${p.to} · schema ${schemaTo} · rollback point ${backupId} retained` },
      ],
    },
  ]
}

export const totalDuration = (steps: StepDef[]) => steps.reduce((a, s) => a + s.duration, 0)
