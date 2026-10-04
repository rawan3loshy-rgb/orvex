import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, CircleCheck, FileText, Layers, LoaderCircle, Maximize2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, duration, relative } from '@/lib/format'
import type { UpdateCenterState } from '@/types/installation'
import type { Release } from '@/types/release'
import { byLabel, highlights, mb, NOTE_META } from './lib'
import { runProgress, useUpdateRun } from './store'

export function UpdateHero({
  data,
  checking,
  onCheck,
  onUpdate,
  onNotes,
}: {
  data: UpdateCenterState | undefined
  checking: boolean
  onCheck: () => void
  onUpdate: () => void
  onNotes: (r: Release) => void
}) {
  const status = useUpdateRun((s) => s.status)
  if (!data) return <HeroSkeleton />
  if (status === 'running' || status === 'committing') return <InProgressHero />
  if (data.available) return <AvailableHero data={data} release={data.available} onUpdate={onUpdate} onNotes={onNotes} />
  return <UpToDateHero data={data} checking={checking} onCheck={onCheck} onNotes={onNotes} />
}

function VersionTile({ label, version, sub, highlight }: { label: string; version: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cn('relative min-w-0 overflow-hidden rounded-xl border px-4 py-3', highlight ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface-2/50')}>
      {highlight && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
      <div className={cn('mono-label', highlight && 'text-accent-ink')}>{label}</div>
      <div className={cn('mt-1 font-display text-[30px] leading-none font-semibold tracking-[-0.03em] tabular', highlight ? 'text-fg' : 'text-fg-2')}>{version}</div>
      <div className="mt-1.5 font-mono text-[11.5px] text-fg-3">{sub}</div>
    </div>
  )
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-3.5 py-2.5">
      <dt className="mono-label truncate">{label}</dt>
      <dd className="mt-1 truncate font-mono text-[12px] text-fg">{children}</dd>
    </div>
  )
}

function AvailableHero({ data, release, onUpdate, onNotes }: { data: UpdateCenterState; release: Release; onUpdate: () => void; onNotes: (r: Release) => void }) {
  const items = highlights(release)
  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" dot pulse size="md">
              New version available
            </Badge>
            <span className="text-[12.5px] text-fg-3">
              Released {date(release.releasedAt)} · {release.channel} channel
            </span>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <VersionTile label="Running" version={data.currentVersion} sub={`schema ${data.schemaVersion}`} />
            <motion.span initial={{ x: -6, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="grid size-8 place-items-center rounded-full border border-line bg-surface text-fg-3">
              <ArrowRight className="size-4" />
            </motion.span>
            <VersionTile label="ORVEX Core" version={release.version} sub={release.migration ? `schema ${release.migration.to}` : `schema ${data.schemaVersion}`} highlight />
          </div>

          <h2 className="mt-5 font-display text-[21px] leading-snug font-semibold tracking-[-0.02em] text-fg">{release.title}</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{release.summary}</p>

          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            <Spec label="Package">{mb(release.package.sizeBytes)}</Spec>
            <Spec label="Signature">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3 shrink-0 text-success" />
                Ed25519
              </span>
            </Spec>
            <Spec label="Migration">{release.migration ? `${release.migration.from} → ${release.migration.to}` : 'none'}</Spec>
            <Spec label="Backup">{release.requiresBackup ? 'automatic' : 'optional'}</Spec>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="accent" size="lg" leading={<ShieldCheck />} onClick={onUpdate}>
              Backup & Update
            </Button>
            <Button variant="secondary" size="lg" leading={<FileText />} onClick={() => onNotes(release)}>
              Release notes
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-fg-3">
            Signed by {release.package.signedBy} · est. 2–3 min · ~20 s Reseller API write pause
          </p>
        </div>

        <div className="flex min-w-0 flex-col border-t border-line bg-surface-2/40 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <div className="mono-label">What’s new in {release.version}</div>
          <ol className="mt-3 flex-1 divide-y divide-line">
            {items.map((n, i) => (
              <motion.li key={n.text} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className="flex items-start gap-3 py-2.5 first:pt-0">
                <span className="mt-0.5 w-5 shrink-0 font-mono text-[11px] text-fg-3 tabular">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-fg">
                    {n.headline}
                    <span className="ml-2 font-mono text-[10px] tracking-[0.08em] text-fg-3 uppercase">{NOTE_META[n.type].label}</span>
                  </p>
                  {n.detail && <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{n.detail}</p>}
                </div>
              </motion.li>
            ))}
          </ol>
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-[12px] text-fg-2">
            <Layers className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
            <span>Orders keep queueing during the update — unlock and server jobs already at suppliers continue, and their callbacks are buffered and replayed after restart.</span>
          </div>
          <button type="button" onClick={() => onNotes(release)} className="mt-3 self-start text-[12.5px] font-medium text-accent-ink hover:underline">
            Full notes, migration & signature →
          </button>
        </div>
      </div>
    </Card>
  )
}

function UpToDateHero({ data, checking, onCheck, onNotes }: { data: UpdateCenterState; checking: boolean; onCheck: () => void; onNotes: (r: Release) => void }) {
  const current = data.releases.find((r) => r.version === data.currentVersion)
  const last = data.history.slice().sort((a, b) => +new Date(b.installedAt) - +new Date(a.installedAt))[0]
  const recent = last && last.version === data.currentVersion && Date.now() - new Date(last.installedAt).getTime() < 14 * 86400_000
  return (
    <Card className="overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-success" />
      <div className="relative flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 20 }} className="relative grid size-14 shrink-0 place-items-center rounded-full bg-success/10 text-success ring-1 ring-success/30">
            <CircleCheck className="size-7" />
          </motion.span>
          <div className="min-w-0">
            <div className="mono-label">Update Center</div>
            <h2 className="mt-1 font-display text-[24px] leading-tight font-semibold tracking-[-0.025em] text-fg sm:text-[26px]">You’re up to date</h2>
            <p className="mt-1 text-[13.5px] text-fg-2">
              ORVEX Core <span className="font-mono text-fg">{data.currentVersion}</span> · schema <span className="font-mono text-fg">{data.schemaVersion}</span> · {data.channel} channel
              {current ? ` · “${current.title}”` : ''}
            </p>
            <p className="mt-1.5 text-[12.5px] text-fg-3">
              Last checked {relative(data.lastCheckedAt)}
              {recent && last ? ` · installed ${relative(last.installedAt)} by ${byLabel(last.by)} in ${duration(last.durationSec)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {current && (
            <Button variant="secondary" leading={<FileText />} onClick={() => onNotes(current)}>
              {recent ? 'View what’s new' : 'Release notes'}
            </Button>
          )}
          <Button variant="primary" loading={checking} leading={<RefreshCw />} onClick={onCheck}>
            Check for updates
          </Button>
        </div>
      </div>
    </Card>
  )
}

function InProgressHero() {
  const { steps, elapsed, status, params, expand } = useUpdateRun()
  const { index, overall } = runProgress(steps, elapsed, status)
  return (
    <Card className="overflow-hidden">
      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-ink ring-1 ring-accent/30">
            <LoaderCircle className="size-7 animate-spin" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mono-label">Update in progress</div>
            <h2 className="mt-1 font-display text-[24px] leading-tight font-semibold tracking-[-0.025em] text-fg">
              ORVEX Core {params?.from} → {params?.to}
            </h2>
            <p className="mt-1 text-[13.5px] text-fg-2">
              Step {Math.min(index + 1, steps.length)} of {steps.length} · {status === 'committing' ? 'Recording result…' : steps[index]?.active}
            </p>
            <div className="mt-3 flex max-w-md items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hatch shadow-[inset_0_0_0_1px_var(--line)]">
                <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${overall * 100}%` }} />
              </div>
              <span className="w-9 text-right font-mono text-[11.5px] text-fg-2 tabular">{Math.floor(overall * 100)}%</span>
            </div>
          </div>
        </div>
        <Button variant="secondary" leading={<Maximize2 />} onClick={expand}>
          Show progress
        </Button>
      </div>
    </Card>
  )
}

function HeroSkeleton() {
  return (
    <Card className="p-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-5 w-48 rounded-full" />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Skeleton className="h-[86px] rounded-xl" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-[86px] rounded-xl" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-40 rounded-[10px]" />
            <Skeleton className="h-11 w-36 rounded-[10px]" />
          </div>
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </Card>
  )
}
