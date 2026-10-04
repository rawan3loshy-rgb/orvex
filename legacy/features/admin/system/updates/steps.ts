import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, CloudDownload, DatabaseBackup, DatabaseZap, FileKey, HeartPulse, Package, PartyPopper, RotateCw } from 'lucide-react'
import type { UpdateStepId } from '@/types/installation'
import type { Release } from '@/types/release'
import { mb, migrationName, packageFile } from './lib'

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
  dbName: string
  containers: string[]
  incompatible: { id: string; name: string; coreRange: string }[]
  preflight: { total: number; pass: number; warn: number }
  backupSizeGb: number
  /** Orders already submitted to suppliers (processing + pending) — they keep running during the update. */
  awaitingCallbacks: number
}

/** Simulated wall-clock speed-up: the prototype compresses a ~2–3 minute update into ~18 seconds. */
export const SPEED = 8

export const STEP_ICONS: Record<UpdateStepId, LucideIcon> = {
  preparing: ClipboardCheck,
  backup: DatabaseBackup,
  download: CloudDownload,
  verify: FileKey,
  install: Package,
  migrate: DatabaseZap,
  restart: RotateCw,
  health: HeartPulse,
  complete: PartyPopper,
}

export function buildSteps(p: RunParams): StepDef[] {
  const rel = p.release
  const file = packageFile(rel)
  const size = rel.package.sizeBytes / 1024 / 1024
  const backupId = `bkp_pre_${rel.version.replace(/\./g, '')}`
  const mig = rel.migration
  const migSteps = mig?.steps ?? []
  const core = p.containers.filter((c) => c.startsWith('core-'))
  const gb = p.backupSizeGb

  return [
    {
      id: 'preparing',
      label: 'Preparing',
      active: 'Preparing update',
      icon: STEP_ICONS.preparing,
      duration: 1800,
      detail: (x) => (x < 0.45 ? 'Acquiring update lock and draining new submissions…' : 'Re-running pre-flight checks…'),
      logs: [
        { at: 0, text: `orvex update ${p.from} → ${p.to} (channel: ${rel.channel})`, tone: 'accent' },
        { at: 0.12, text: 'Acquiring update lock … OK' },
        { at: 0.26, text: 'Draining queue: pausing new submissions, waiting for jobs mid-submission … 0 remaining' },
        { at: 0.38, text: `${p.awaitingCallbacks} unlock / server jobs at suppliers keep running — their callbacks are buffered until restart`, tone: 'muted' },
        { at: 0.55, text: `Pre-flight: ${p.preflight.total} checks · ${p.preflight.pass} passed · ${p.preflight.warn} warning` },
        ...p.incompatible.map((e) => ({ at: 0.72, text: `Disabling extension ${e.id} (declares ${e.coreRange}, excludes ${p.to})`, tone: 'warn' as LogTone })),
        { at: 0.9, text: 'Maintenance mode ON — admin read-only, Reseller API answers 503 + Retry-After for writes' },
      ],
    },
    {
      id: 'backup',
      label: 'Backing up',
      active: 'Creating backup',
      icon: STEP_ICONS.backup,
      duration: 3000,
      detail: (x) => `pg_dump ${p.dbName} · ${(gb * x).toFixed(2)} GB of ${gb.toFixed(2)} GB`,
      logs: [
        { at: 0, text: `pg_dump ${p.dbName} → ${backupId}.sql.gz (${gb.toFixed(2)} GB)` },
        { at: 0.3, text: `  … ${(gb * 0.31).toFixed(2)} GB written`, tone: 'muted' },
        { at: 0.62, text: `  … ${(gb * 0.66).toFixed(2)} GB written`, tone: 'muted' },
        { at: 0.86, text: `Backup written: ${backupId}.sql.gz (${gb.toFixed(2)} GB) · sha256 8c1e…f02a`, tone: 'ok' },
        { at: 0.94, text: `Snapshot config, .env and extensions → ${backupId}.config.tar (184 KB)` },
      ],
    },
    {
      id: 'download',
      label: 'Downloading',
      active: 'Downloading release',
      icon: STEP_ICONS.download,
      duration: 2600,
      detail: (x) => `${file} · ${(size * x).toFixed(1)} of ${size.toFixed(1)} MB`,
      logs: [
        { at: 0, text: `GET https://releases.orvex.io/core/${rel.version}/manifest.json → 200` },
        { at: 0.08, text: `Downloading ${file} ${mb(rel.package.sizeBytes)}` },
        { at: 0.4, text: `  … ${(size * 0.38).toFixed(1)} MB / ${size.toFixed(1)} MB (21.4 MB/s)`, tone: 'muted' },
        { at: 0.75, text: `  … ${(size * 0.79).toFixed(1)} MB / ${size.toFixed(1)} MB (22.0 MB/s)`, tone: 'muted' },
        { at: 0.97, text: `Download complete · ${mb(rel.package.sizeBytes)} in 4.1 s`, tone: 'ok' },
      ],
    },
    {
      id: 'verify',
      label: 'Verifying',
      active: 'Verifying signature',
      icon: STEP_ICONS.verify,
      duration: 1600,
      detail: (x) => (x < 0.45 ? 'Checking SHA-256 digest…' : `Verifying Ed25519 signature (${rel.package.signedBy})…`),
      logs: [
        { at: 0.05, text: `SHA-256 ${rel.package.sha256} … OK`, tone: 'ok' },
        { at: 0.5, text: `Verifying Ed25519 signature … OK (${rel.package.signedBy})`, tone: 'ok' },
        { at: 0.85, text: 'Manifest trusted · image digests pinned', tone: 'muted' },
      ],
    },
    {
      id: 'install',
      label: 'Installing',
      active: 'Installing release',
      icon: STEP_ICONS.install,
      duration: 1600,
      detail: (x) => (x < 0.5 ? `Unpacking to /opt/orvex/releases/${rel.version}…` : `Loading images registry.orvex.io/core:${rel.version}…`),
      logs: [
        { at: 0.05, text: `Unpacking ${file} → /opt/orvex/releases/${rel.version}` },
        { at: 0.45, text: `Loading image registry.orvex.io/core:${rel.version} (digest pinned by signed manifest)` },
        { at: 0.8, text: 'Release staged · previous release kept for rollback', tone: 'ok' },
      ],
    },
    {
      id: 'migrate',
      label: 'Migrating',
      active: 'Running migrations',
      icon: STEP_ICONS.migrate,
      duration: 3200,
      detail: (x) => (migSteps.length ? `Migration ${mig!.from} → ${mig!.to} · step ${Math.min(migSteps.length, Math.floor(x * migSteps.length) + 1)} of ${migSteps.length}` : 'No schema changes in this release'),
      logs: mig
        ? [
            { at: 0, text: `Running database migrations ${mig.from} → ${mig.to} inside a transaction` },
            { at: 0.08, text: `Applying migration ${migrationName(mig.to, migSteps[0] ?? 'schema', 0)} …` },
            ...migSteps.map((s, i) => ({ at: 0.18 + (i / Math.max(1, migSteps.length)) * 0.66, text: `  ↳ ${s} … OK (${[42, 12, 1840, 960][i] ?? 30} ms)`, tone: 'muted' as LogTone })),
            { at: 0.88, text: `Applying migration ${migrationName(mig.to, migSteps[0] ?? 'schema', 0)} … OK`, tone: 'ok' },
            { at: 0.96, text: `Schema version ${mig.from} → ${mig.to}` },
          ]
        : [{ at: 0.1, text: 'No database migrations in this release', tone: 'muted' }],
    },
    {
      id: 'restart',
      label: 'Restarting',
      active: 'Restarting services',
      icon: STEP_ICONS.restart,
      duration: 2600,
      detail: () => `Restarting ${core.join(', ')}`,
      logs: [
        { at: 0.05, text: `Switching to release ${rel.version}` },
        { at: 0.18, text: `Restarting ${core.join(', ')}` },
        ...core.map((c, i) => ({ at: 0.4 + i * 0.17, text: `  ${c} … healthy (${(1.8 + i * 0.4).toFixed(1)} s)`, tone: 'muted' as LogTone })),
        { at: 0.9, text: 'Maintenance mode OFF — order intake resumed' },
        { at: 0.96, text: 'Replaying buffered supplier callbacks … OK', tone: 'ok' },
      ],
    },
    {
      id: 'health',
      label: 'Health check',
      active: 'Running health check',
      icon: STEP_ICONS.health,
      duration: 1800,
      detail: (x) => (x < 0.6 ? 'Probing Reseller API, database, order queue and webhooks…' : 'All probes passing — finalising'),
      logs: [
        { at: 0.1, text: 'Health check: Reseller API 200, DB OK, order queue OK', tone: 'ok' },
        { at: 0.45, text: `Webhook dispatcher OK · supplier adapters loaded · ${p.incompatible.length} extension${p.incompatible.length === 1 ? '' : 's'} disabled as incompatible` },
        { at: 0.75, text: `Version ${p.to} · schema ${mig?.to ?? p.schemaFrom} · rollback point ${backupId} retained` },
      ],
    },
  ]
}

export const totalDuration = (steps: StepDef[]) => steps.reduce((a, s) => a + s.duration, 0)
