import { useState } from 'react'
import { useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ChevronDown, CircleDot, Database, FlaskConical, Package, Rss, Server, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Badge, Button, Card, CardBody, EmptyState, MonoValue, PageHeader, Segmented, Skeleton } from '@/components/ui'
import { useReleases, useVendorInstallations } from '@/hooks/vendor'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { bytes, date, relative } from '@/lib/format'
import type { Release, ReleaseNote } from '@/types/release'
import type { InstallationRef } from '@/types/vendor'
import { EnvBadge, NoteChip, NoteIcon, Reveal, TopGlow } from './components/kit'
import { cmpVersion, EASE, latestStable, NOTE_META, useHashScroll } from './components/kitUtils'

type Channel = 'all' | 'stable' | 'beta'
const NOTE_ORDER: ReleaseNote['type'][] = ['feature', 'improvement', 'security', 'fix']

function TechDetails({ r }: { r: Release }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
      <div className="bg-surface-2/50 p-4">
        <p className="mono-label mb-2.5 flex items-center gap-1.5">
          <Database className="size-3" /> Database migration
        </p>
        {r.migration ? (
          <>
            <div className="flex items-center gap-2 font-mono text-[13px]">
              <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-fg-2">{r.migration.from}</span>
              <ArrowRight className="size-3.5 text-fg-3" />
              <span className="rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-accent-ink">{r.migration.to}</span>
            </div>
            <ol className="mt-3 space-y-1.5">
              {r.migration.steps.map((s, i) => (
                <li key={s} className="flex gap-2 text-[12px] text-fg-2">
                  <span className="font-mono text-fg-3 tabular">{String(i + 1).padStart(2, '0')}</span>
                  {s}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-[12.5px] text-fg-3">No schema changes in this release.</p>
        )}
      </div>
      <div className="bg-surface-2/50 p-4">
        <p className="mono-label mb-2.5 flex items-center gap-1.5">
          <Server className="size-3" /> Compatibility
        </p>
        <dl className="space-y-2 text-[12.5px]">
          {[
            ['Node.js', r.compatibility.node],
            ['PostgreSQL', r.compatibility.postgres],
            ['Docker', r.compatibility.docker],
            ['Upgrade from', `≥ ${r.minUpgradeFrom}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-fg-3">{k}</dt>
              <dd className="font-mono text-fg">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.requiresBackup && <Badge>Backup required</Badge>}
          {r.breaking && (
            <Badge tone="danger" icon={<TriangleAlert />}>
              Breaking
            </Badge>
          )}
        </div>
      </div>
      <div className="min-w-0 bg-surface-2/50 p-4">
        <p className="mono-label mb-2.5 flex items-center gap-1.5">
          <Package className="size-3" /> Package
        </p>
        <dl className="space-y-2 text-[12.5px]">
          <div className="flex justify-between gap-3">
            <dt className="text-fg-3">Size</dt>
            <dd className="text-fg tabular">{bytes(r.package.sizeBytes)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-fg-3">SHA-256</dt>
            <dd className="min-w-0">
              <MonoValue value={r.package.sha256} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-fg-3">Signature</dt>
            <dd className="min-w-0">
              <MonoValue value={r.package.signature} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-fg-3">Signed by</dt>
            <dd className="truncate text-fg">{r.package.signedBy}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function ReleaseCard({ r, latest, installed, open, onToggle, last }: { r: Release; latest: boolean; installed: InstallationRef[]; open: boolean; onToggle: () => void; last: boolean }) {
  const groups = NOTE_ORDER.map((t) => ({ type: t, notes: r.notes.filter((n) => n.type === t) })).filter((g) => g.notes.length)
  const beta = r.channel === 'beta'
  return (
    <article id={`v${r.version}`} className={cn('relative scroll-mt-32 pl-9 sm:pl-11', last ? 'pb-0' : 'pb-6')}>
      <span
        aria-hidden
        className={cn(
          'absolute top-6 left-0 grid size-[23px] place-items-center rounded-full ring-1',
          latest ? 'bg-accent text-accent-fg ring-accent/40' : beta ? 'bg-warning/12 text-warning ring-warning/30' : 'bg-surface text-fg-3 ring-line-strong',
        )}
      >
        {latest && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/40" />}
        {beta ? <FlaskConical className="relative size-3" /> : <CircleDot className="relative size-3" />}
      </span>

      <Card className={cn('relative overflow-hidden', latest && 'border-accent/40 shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_30%,transparent),var(--shadow-card)]')}>
        {latest && <TopGlow />}
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-[20px] leading-none font-semibold tracking-tight text-fg">{r.version}</h3>
                {latest && (
                  <Badge tone="accent" variant="solid">
                    Latest stable
                  </Badge>
                )}
                {beta ? <Badge tone="warning">Beta</Badge> : !latest && <Badge>Stable</Badge>}
                {r.breaking && (
                  <Badge tone="danger" icon={<TriangleAlert />}>
                    Breaking
                  </Badge>
                )}
              </div>
              <p className="mt-2.5 text-[15px] font-semibold tracking-[-0.01em] text-fg">{r.title}</p>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-fg-2">{r.summary}</p>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-[12.5px] font-medium text-fg-2 tabular">{date(r.releasedAt)}</p>
              <p className="text-[12px] text-fg-3">{relative(r.releasedAt)}</p>
              {installed.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 sm:justify-end">
                  {installed.map((i) => (
                    <span key={i.id} className="inline-flex items-center gap-1 text-[11.5px] text-fg-3">
                      Running on <EnvBadge env={i.environment} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.type}>
                <NoteChip type={g.type} count={g.notes.length} />
                <ul className="mt-2.5 space-y-2">
                  {g.notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <NoteIcon type={n.type} className="size-5 rounded-[5px] [&_svg]:size-3" />
                      <span className="text-[13px] leading-snug text-fg-2">{n.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                <div className="pt-5">
                  <TechDetails r={r} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-2.5 sm:px-6">
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-2 transition-colors hover:text-fg" aria-expanded={open}>
            <ChevronDown className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')} />
            {open ? 'Hide technical details' : 'Migration, compatibility & signature'}
          </button>
          <div className="flex items-center gap-3 text-[12px] text-fg-3">
            {r.migration && (
              <span className="hidden font-mono sm:inline">
                schema {r.migration.from} → {r.migration.to}
              </span>
            )}
            <span className="tabular">{bytes(r.package.sizeBytes)}</span>
            <span className="inline-flex items-center gap-1 text-success">
              <ShieldCheck className="size-3.5" /> Signed
            </span>
          </div>
        </div>
      </Card>
    </article>
  )
}

export default function ReleasesPage() {
  const releases = useReleases()
  const installs = useVendorInstallations()
  const { hash } = useLocation()
  const [channel, setChannel] = useState<Channel>('all')
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  useHashScroll(!!releases.data)

  const latest = latestStable(releases.data)
  const sorted = releases.data?.slice().sort((a, b) => cmpVersion(b.version, a.version))
  const list = sorted?.filter((r) => channel === 'all' || r.channel === channel)
  const isOpen = (r: Release) => toggled[r.version] ?? (r.version === latest?.version || hash === `#v${r.version}`)
  const prod = installs.data?.find((i) => i.environment === 'production')
  const behind = !!(prod && latest && cmpVersion(latest.version, prod.version) > 0)
  const counts = { all: releases.data?.length, stable: releases.data?.filter((r) => r.channel === 'stable').length, beta: releases.data?.filter((r) => r.channel === 'beta').length }

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Releases"
          description="Every ORVEX Core release, signed by ORVEX Systems. Your installations download and verify packages themselves — this is the public record of what changed."
          actions={
            <>
              <Button variant="secondary" leading={<Rss />} onClick={() => toast.success('Subscribed to release notes', 'We’ll email alex@unlockdesk-demo.com when a new stable release ships.')}>
                Subscribe
              </Button>
              <Segmented
                size="sm"
                value={channel}
                onChange={setChannel}
                items={[
                  { value: 'all', label: 'All', count: counts.all },
                  { value: 'stable', label: 'Stable', count: counts.stable },
                  { value: 'beta', label: 'Beta', count: counts.beta },
                ]}
              />
            </>
          }
        />
      </Reveal>

      {behind && prod && latest && (
        <Reveal delay={0.04} className="mb-6">
          <div className="flex flex-col gap-3 rounded-xl border border-accent/25 bg-accent/[0.05] px-4 py-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-[13px] text-fg-2">
              <span className="font-medium text-fg">{prod.name}</span> runs <span className="font-mono">{prod.version}</span> — <span className="font-mono">{latest.version}</span> is available with {latest.notes.length} changes.
            </p>
            <Button size="sm" variant="accent" to="/account/updates" trailing={<ArrowRight />}>
              Update status
            </Button>
          </div>
        </Reveal>
      )}

      <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        {/* Version index */}
        <nav className="hidden lg:block">
          <div className="sticky top-32 space-y-0.5">
            <p className="mono-label mb-2 px-2">Versions</p>
            {list
              ? list.map((r) => {
                  const on = installs.data?.filter((i) => i.version === r.version) ?? []
                  return (
                    <a
                      key={r.version}
                      href={`#v${r.version}`}
                      onClick={(e) => {
                        e.preventDefault()
                        setToggled((t) => ({ ...t, [r.version]: true }))
                        document.getElementById(`v${r.version}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        history.replaceState(null, '', `#v${r.version}`)
                      }}
                      className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2"
                    >
                      <span className={cn('font-mono', r.version === latest?.version ? 'font-medium text-fg' : 'text-fg-2 group-hover:text-fg')}>{r.version}</span>
                      <span className="flex items-center gap-1">
                        {on.map((i) => (
                          <span key={i.id} title={`${i.name} runs ${r.version}`} className={cn('size-1.5 rounded-full', i.environment === 'production' ? 'bg-accent' : 'bg-warning')} />
                        ))}
                        {r.channel === 'beta' && <span className="font-mono text-[10px] text-warning">β</span>}
                      </span>
                    </a>
                  )
                })
              : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="my-2 h-3.5 w-24" />)}
            <div className="mt-4 space-y-1.5 border-t border-line px-2 pt-3 text-[11.5px] text-fg-3">
              <p className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-accent" /> Production
              </p>
              <p className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-warning" /> Staging
              </p>
            </div>
          </div>
        </nav>

        {/* Timeline */}
        <div className="min-w-0">
          {!list ? (
            <div className="space-y-5">
              {Array.from({ length: 3 }, (_, i) => (
                <Card key={i} className="ml-9 p-6 sm:ml-11">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="mt-4 h-4 w-72 max-w-full" />
                  <Skeleton className="mt-2 h-3.5 w-full" />
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : list.length === 0 ? (
            <Card>
              <CardBody className="pt-5">
                <EmptyState icon={<FlaskConical />} title="No releases on this channel" description="Beta builds appear here when a preview is published." />
              </CardBody>
            </Card>
          ) : (
            <div className="relative">
              <span aria-hidden className="absolute top-8 bottom-20 left-[11px] w-px bg-gradient-to-b from-line-strong via-line to-transparent" />
              {list.map((r, i) => (
                <Reveal key={r.version} delay={Math.min(i, 4) * 0.05}>
                  <ReleaseCard
                    r={r}
                    latest={r.version === latest?.version}
                    installed={installs.data?.filter((x) => x.version === r.version) ?? []}
                    open={isOpen(r)}
                    onToggle={() => setToggled((t) => ({ ...t, [r.version]: !isOpen(r) }))}
                    last={i === list.length - 1}
                  />
                </Reveal>
              ))}
              <p className="mt-6 pl-9 text-[12px] text-fg-3 sm:pl-11">
                Older releases (1.x) are archived. Legend: {NOTE_ORDER.map((t) => NOTE_META[t].label).join(' · ')}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
