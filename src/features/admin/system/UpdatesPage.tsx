import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bug,
  CircleCheck,
  CircleX,
  CloudDownload,
  DatabaseBackup,
  DatabaseZap,
  FileText,
  History,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, Drawer, EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/ui'
import { Guarded, PermissionHint } from '@/components/domain'
import { INST, useHealth, useInstallation, useInstMutation, useUpdates } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { date, dateTime, duration, relative } from '@/lib/format'
import type { Tone } from '@/types/installation'
import type { Release, ReleaseNote } from '@/types/release'
import { UpdateRunModal } from './updates/UpdateRunModal'
import { useUpdateRun } from './updates/store'
import { STEP_META, type RunParams } from './updates/steps'
import { Callout, CardSkeleton, QueryError } from './shared'
import { TONE_TILE } from './helpers'

const NOTE_META: Record<ReleaseNote['type'], { label: string; icon: LucideIcon; tone: Tone }> = {
  feature: { label: 'New features', icon: Sparkles, tone: 'accent' },
  improvement: { label: 'Improvements', icon: Zap, tone: 'info' },
  security: { label: 'Security', icon: ShieldCheck, tone: 'success' },
  fix: { label: 'Fixes', icon: Bug, tone: 'neutral' },
}
const NOTE_ORDER: ReleaseNote['type'][] = ['feature', 'improvement', 'security', 'fix']

function splitNote(text: string) {
  const i = text.indexOf(' — ')
  return i === -1 ? { headline: text, detail: '' } : { headline: text.slice(0, i), detail: text.slice(i + 3) }
}

export default function UpdatesPage() {
  const updates = useUpdates()
  const installation = useInstallation()
  const health = useHealth()
  const qc = useQueryClient()
  const openConfirm = useUpdateRun((s) => s.openConfirm)
  const start = useUpdateRun((s) => s.start)
  const runStatus = useUpdateRun((s) => s.status)
  const [notes, setNotes] = useState<Release | null>(null)
  const check = useInstMutation(() => systemService.checkUpdates(), { success: 'Checked releases.orvex.io (simulated release server)' })

  const u = updates.data
  const extensions = installation.data?.extensions ?? []
  const incompatible = extensions.filter((e) => !e.compatibleWithNext && e.status === 'enabled')
  const preflightFail = u?.preflight.some((p) => p.status === 'fail') ?? false
  const blocked = u?.entitlement.blocked ?? false
  const running = runStatus === 'running' || runStatus === 'committing'

  const prepare = (): RunParams | null => {
    if (!u?.available || !installation.data) return null
    const inst = installation.data
    return {
      from: u.currentVersion,
      to: u.available.version,
      schemaFrom: u.migrationStatus.applied,
      release: u.available,
      pendingMigrations: u.migrationStatus.pending,
      strategy: u.migrationStatus.strategy,
      dbName: inst.database.name,
      dbSizeMb: inst.database.sizeMb,
      backupSizeMb: u.backups[0]?.sizeMb ?? Math.round(inst.database.sizeMb / 5),
      containers: inst.runtime.containers.map((c) => c.name),
      incompatible: incompatible.map((e) => ({ id: e.id, name: e.name, coreRange: e.coreRange })),
      preflight: u.preflight,
      awaitingSupplier: health.data?.queue.byKind['attempt.poll'] ?? 0,
      queued: health.data?.queue.pending ?? 0,
    }
  }

  const onStart = (p: RunParams) =>
    start(p, async (durationSec) => {
      await systemService.completeUpdate(p.to, durationSec)
      await qc.invalidateQueries({ queryKey: [INST] })
    })

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CloudDownload />}
        eyebrow="System"
        title="Updates"
        description="Signed ORVEX Core releases, installed on your server when you choose. Every update takes a backup first and uses expand-only migrations."
        actions={
          <div className="flex items-center gap-2">
            {u && (
              <Badge tone="neutral" variant="outline" size="md">
                Channel · {u.channel}
              </Badge>
            )}
            <Button variant="secondary" size="sm" leading={<RefreshCw className={cn(check.isPending && 'animate-spin')} />} loading={check.isPending} onClick={() => check.mutate()}>
              Check for updates
            </Button>
          </div>
        }
      />

      {updates.isError && !u ? (
        <QueryError onRetry={() => updates.refetch()} />
      ) : !u ? (
        <div className="space-y-4">
          <CardSkeleton rows={5} />
          <div className="grid gap-4 lg:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      ) : (
        <>
          {blocked ? (
            <Callout tone="warning" icon={<TriangleAlert />} title={`Operations continue on ${u.currentVersion}; renew to install new releases`} action={<Button variant="secondary" size="sm" to="/admin/system/license">License</Button>}>
              {u.entitlement.message} Orders, payments, the storefront, the reseller portal and both APIs keep working — only new releases are unavailable.
            </Callout>
          ) : (
            <Callout tone="neutral" icon={<BadgeCheck />}>
              {u.entitlement.message}. Last checked {relative(u.lastCheckedAt)}.
            </Callout>
          )}

          <UpdateHero
            current={u.currentVersion}
            schema={u.schemaVersion}
            release={u.available}
            blocked={blocked}
            preflightFail={preflightFail}
            running={running}
            incompatibleCount={incompatible.length}
            onInstall={openConfirm}
            onNotes={setNotes}
          />

          <StepsStrip />

          <div className="grid gap-4 lg:grid-cols-2">
            <PreflightCard checks={u.preflight} />
            <MigrationCard applied={u.migrationStatus.applied} pending={u.migrationStatus.pending} strategy={u.migrationStatus.strategy} hasRelease={!!u.available} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CompatibilityCard extensions={extensions} loading={!installation.data} next={u.available?.version} warning={u.preflight.find((p) => p.id === 'extensions')} />
            <BackupsCard backups={u.backups} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReleasesCard releases={u.releases} current={u.currentVersion} onOpen={setNotes} />
            <HistoryCard history={u.history} />
          </div>
        </>
      )}

      <ReleaseNotesDrawer release={notes} current={u?.currentVersion} onClose={() => setNotes(null)} />
      <UpdateRunModal prepare={prepare} onStart={onStart} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
function UpdateHero({ current, schema, release, blocked, preflightFail, running, incompatibleCount, onInstall, onNotes }: { current: string; schema: string; release: Release | null; blocked: boolean; preflightFail: boolean; running: boolean; incompatibleCount: number; onInstall: () => void; onNotes: (r: Release) => void }) {
  if (!release) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-success/10 text-success">
            <CircleCheck className="size-6" />
          </span>
          <div>
            <div className="mono-label">Installed</div>
            <h2 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.02em]">ORVEX Core {current} — up to date</h2>
            <p className="text-[13px] text-fg-3">Schema {schema}. No newer release on the stable channel.</p>
          </div>
        </div>
      </Card>
    )
  }
  const highlights = release.notes.slice(0, 4).map((n) => ({ ...n, ...splitNote(n.text) }))
  const reason = blocked ? 'Update entitlement ended — renew to install' : preflightFail ? 'A preflight check failed' : null
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-baseline gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2">
              <span className="mono-label">Installed</span>
              <span className="font-mono text-[15px] text-fg">{current}</span>
            </div>
            <ArrowRight className="size-4 text-fg-3" />
            <div className="flex items-baseline gap-2 rounded-xl border border-accent/40 bg-accent/[0.06] px-3 py-2">
              <span className="mono-label text-accent-ink">Available</span>
              <span className="font-mono text-[15px] font-medium text-fg">{release.version}</span>
            </div>
            <Badge tone="neutral" variant="outline">
              {release.channel} · released {date(release.releasedAt)}
            </Badge>
          </div>
          <h2 className="mt-4 font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[24px]">{release.title}</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] text-fg-2">{release.summary}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {highlights.map((h, i) => {
              const meta = NOTE_META[h.type]
              return (
                <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2.5 text-[12.5px]">
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md [&_svg]:size-3', TONE_TILE[meta.tone])}>
                    <meta.icon />
                  </span>
                  <span className="min-w-0 text-fg-2">
                    <span className="font-medium text-fg">{h.headline}</span>
                    {h.detail && <span className="text-fg-3"> — {h.detail}</span>}
                  </span>
                </motion.li>
              )
            })}
          </ul>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-line bg-surface-2/40 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <div className="space-y-2 text-[12.5px] text-fg-2">
            <p className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-fg-3" /> Signed by {release.package.signedBy}
            </p>
            <p className="flex items-center gap-2">
              <DatabaseBackup className="size-3.5 text-fg-3" /> Backup taken automatically before migrating
            </p>
            <p className="flex items-center gap-2">
              <DatabaseZap className="size-3.5 text-fg-3" /> Expand-only migrations · {release.breaking ? 'breaking changes' : 'no breaking changes'}
            </p>
            {incompatibleCount > 0 && (
              <p className="flex items-center gap-2 text-warning">
                <Puzzle className="size-3.5" /> {incompatibleCount} extension{incompatibleCount === 1 ? '' : 's'} not declared compatible
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Guarded permission="system.manage" className="w-full">
              {(allowed) => (
                <Button variant="accent" className="w-full" leading={<CloudDownload />} disabled={!allowed || blocked || preflightFail} onClick={onInstall} loading={running}>
                  {running ? 'Update running…' : `Back up & install ${release.version}`}
                </Button>
              )}
            </Guarded>
            <Button variant="ghost" size="sm" className="w-full" leading={<FileText />} onClick={() => onNotes(release)}>
              Full release notes
            </Button>
            {reason ? <p className="text-center text-[12px] text-warning">{reason}</p> : <PermissionHint permission="system.manage" className="w-full justify-center" />}
          </div>
        </div>
      </div>
    </Card>
  )
}

function StepsStrip() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold">How an update runs</h3>
        <span className="text-[12px] text-fg-3">Simulated in this prototype — no Docker or database changes happen until the result is recorded.</span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {STEP_META.map((s, i) => (
          <li key={s.id} className="relative rounded-xl border border-line bg-surface-2/40 p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-md border border-line bg-surface text-fg-2 [&_svg]:size-3.5">
                <s.icon />
              </span>
              <span className="font-mono text-[10.5px] text-fg-3">0{i + 1}</span>
            </div>
            <p className="mt-2 text-[13px] font-medium text-fg">{s.label}</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-fg-3">{s.summary}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function PreflightCard({ checks }: { checks: { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[] }) {
  const pass = checks.filter((c) => c.status === 'pass').length
  return (
    <Card>
      <CardHeader icon={<ShieldCheck />} title="Preflight checks" description="Re-run at the start of every update." actions={<Badge tone={checks.some((c) => c.status === 'fail') ? 'danger' : checks.some((c) => c.status === 'warn') ? 'warning' : 'success'}>{pass}/{checks.length} pass</Badge>} />
      <ul className="divide-y divide-line px-5 pb-3">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-3 py-2.5">
            {c.status === 'pass' ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : c.status === 'warn' ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />}
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-fg">{c.label}</p>
              <p className="text-[12px] text-fg-3">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function MigrationCard({ applied, pending, strategy, hasRelease }: { applied: string; pending: string[]; strategy: string; hasRelease: boolean }) {
  return (
    <Card>
      <CardHeader icon={<DatabaseZap />} title="Database migrations" description="Your PostgreSQL schema — upgraded in place, never reset." actions={<Badge tone="neutral" variant="outline">applied {applied}</Badge>} />
      <div className="space-y-4 px-5 pb-5">
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-3.5 py-3 text-[12.5px] text-fg-3">{hasRelease ? 'The available release has no schema changes.' : 'Schema is current — no pending migrations.'}</p>
        ) : (
          <ol className="space-y-1.5">
            {pending.map((m, i) => (
              <li key={m} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                <span className="font-mono text-[10.5px] text-fg-3">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{m}</span>
                <Badge tone="info" variant="soft">
                  expand
                </Badge>
              </li>
            ))}
          </ol>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-success/25 bg-success/[0.05] p-3">
            <p className="text-[12.5px] font-medium text-fg">Expand (this release)</p>
            <p className="mt-0.5 text-[12px] text-fg-3">Adds tables, columns and indexes. Running code ignores what it does not know — so old and new versions both work on the schema.</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[12.5px] font-medium text-fg">Contract (a later release)</p>
            <p className="mt-0.5 text-[12px] text-fg-3">Removes what is no longer used, only after every installation runs code that no longer reads it.</p>
          </div>
        </div>
        <p className="text-[12px] text-fg-3">{strategy}</p>
      </div>
    </Card>
  )
}

function CompatibilityCard({ extensions, loading, next, warning }: { extensions: { id: string; name: string; version: string; coreRange: string; compatibleWithNext: boolean; status: string; source: string }[]; loading: boolean; next?: string; warning?: { status: string; detail: string } }) {
  const sorted = [...extensions].sort((a, b) => Number(a.compatibleWithNext) - Number(b.compatibleWithNext))
  const bad = extensions.filter((e) => !e.compatibleWithNext).length
  return (
    <Card>
      <CardHeader
        icon={<Puzzle />}
        title="Extension compatibility"
        description={next ? `Declared Core ranges checked against ${next}` : 'Declared Core ranges'}
        actions={
          <Button variant="ghost" size="sm" to="/admin/system/extensions" trailing={<ArrowUpRight />}>
            Extensions
          </Button>
        }
      />
      <div className="px-5 pb-5">
        {warning && warning.status !== 'pass' && (
          <Callout tone="warning" icon={<TriangleAlert />} className="mb-3 p-3">
            {warning.detail}
          </Callout>
        )}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-fg">
                    {e.name} <span className="font-mono text-[11.5px] text-fg-3">v{e.version}</span>
                  </p>
                  <p className="font-mono text-[11px] text-fg-3">
                    core {e.coreRange} · {e.source}
                  </p>
                </div>
                {e.compatibleWithNext ? (
                  <Badge tone="success" variant="soft" icon={<CircleCheck />}>
                    Compatible
                  </Badge>
                ) : (
                  <Badge tone="warning" variant="soft" icon={<TriangleAlert />}>
                    Not declared
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading && <p className="mt-2 text-[12px] text-fg-3">{bad ? `${bad} extension${bad === 1 ? '' : 's'} will be disabled during the update until a compatible version ships. Core and configuration are unaffected.` : 'Every installed extension declares a compatible Core range.'}</p>}
      </div>
    </Card>
  )
}

function BackupsCard({ backups }: { backups: { id: string; createdAt: string; sizeMb: number; version: string; kind: string }[] }) {
  return (
    <Card>
      <CardHeader icon={<DatabaseBackup />} title="Backups" description="pg_dump of your database on your server — the vendor never receives a copy." />
      <div className="px-5 pb-5">
        {backups.length === 0 ? (
          <EmptyState compact icon={<DatabaseBackup />} title="No backups yet" />
        ) : (
          <ul className="divide-y divide-line">
            {backups.map((b, i) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] text-fg">{b.id}</p>
                  <p className="text-[11.5px] text-fg-3">
                    {dateTime(b.createdAt)} · {(b.sizeMb / 1024).toFixed(2)} GB · v{b.version}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {i === 0 && <Badge tone="success">latest</Badge>}
                  <Badge tone={b.kind === 'pre-update' ? 'accent' : 'neutral'} variant="outline">
                    {b.kind}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[12px] text-fg-3">Nightly scheduled dumps plus a pre-update dump before every migration. Restores are run from the server CLI.</p>
      </div>
    </Card>
  )
}

function ReleasesCard({ releases, current, onOpen }: { releases: Release[]; current: string; onOpen: (r: Release) => void }) {
  return (
    <Card>
      <CardHeader icon={<FileText />} title="Releases" description="Published by ORVEX Systems on releases.orvex.io (simulated)." />
      <ul className="divide-y divide-line px-2 pb-2">
        {releases.slice(0, 6).map((r) => (
          <li key={r.version}>
            <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] text-fg">
                  <span className="font-mono">{r.version}</span>
                  <span className="truncate text-fg-2">{r.title}</span>
                </p>
                <p className="text-[11.5px] text-fg-3">
                  {date(r.releasedAt)} · {r.notes.length} notes
                </p>
              </div>
              {r.version === current ? <Badge tone="success">installed</Badge> : <ArrowUpRight className="size-3.5 text-fg-3" />}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function HistoryCard({ history }: { history: { version: string; installedAt: string; durationSec: number; by: string; status: 'success' | 'rolled_back'; backupId: string }[] }) {
  return (
    <Card>
      <CardHeader icon={<History />} title="Update history" description="Every update on this installation, with its rollback point." />
      <div className="px-5 pb-5">
        {history.length === 0 ? (
          <EmptyState compact icon={<History />} title="No updates recorded" />
        ) : (
          <ol className="divide-y divide-line">
            {history.map((h, i) => (
              <li key={`${h.version}-${h.installedAt}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] text-fg">
                    <span className="font-mono">{h.version}</span> <span className="text-fg-3">· {h.by}</span>
                  </p>
                  <p className="text-[11.5px] text-fg-3">
                    {dateTime(h.installedAt)} · {duration(h.durationSec)} · backup <span className="font-mono">{h.backupId}</span>
                  </p>
                </div>
                <StatusBadge status={h.status === 'success' ? 'success' : 'warn'} label={h.status === 'success' ? 'Success' : 'Rolled back'} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}

function ReleaseNotesDrawer({ release, current, onClose }: { release: Release | null; current?: string; onClose: () => void }) {
  const [last, setLast] = useState<Release | null>(release)
  if (release && release !== last) setLast(release)
  const r = release ?? last
  return (
    <Drawer open={!!release} onClose={onClose} width="lg" icon={<FileText />} title={r ? `ORVEX Core ${r.version}` : ''} description={r ? `${r.title} · ${date(r.releasedAt)}` : undefined}>
      {r && (
        <div className="space-y-6">
          <p className="text-[13.5px] text-fg-2">{r.summary}</p>
          {NOTE_ORDER.map((type) => {
            const items = r.notes.filter((n) => n.type === type)
            if (!items.length) return null
            const meta = NOTE_META[type]
            return (
              <section key={type}>
                <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                  <span className={cn('grid size-5 place-items-center rounded-md [&_svg]:size-3', TONE_TILE[meta.tone])}>
                    <meta.icon />
                  </span>
                  {meta.label}
                </h3>
                <ul className="space-y-1.5">
                  {items.map((n, i) => {
                    const s = splitNote(n.text)
                    return (
                      <li key={i} className="text-[13px] text-fg-2">
                        <span className="font-medium text-fg">{s.headline}</span>
                        {s.detail && <span className="text-fg-3"> — {s.detail}</span>}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
          <section className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3 text-[12.5px]">
              <div className="mono-label">Package</div>
              <p className="mt-1 font-mono text-fg">{(r.package.sizeBytes / 1024 / 1024).toFixed(1)} MB · sha256 {r.package.sha256}</p>
              <p className="mt-0.5 text-fg-3">Signed by {r.package.signedBy}</p>
            </div>
            <div className="rounded-xl border border-line p-3 text-[12.5px]">
              <div className="mono-label">Requirements</div>
              <p className="mt-1 text-fg">Upgrade from ≥ {r.minUpgradeFrom}</p>
              <p className="mt-0.5 text-fg-3">
                PostgreSQL {r.compatibility.postgres} · Docker {r.compatibility.docker}
              </p>
            </div>
          </section>
          {current === r.version && <Badge tone="success">Installed on this server</Badge>}
        </div>
      )}
    </Drawer>
  )
}
