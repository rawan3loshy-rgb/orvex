import { Link } from 'react-router'
import { ArrowRight, ArrowUpRight, CalendarRange, CircleCheck, FlaskConical, GitBranch, LockKeyhole, MessagesSquare, RotateCcw, ShieldCheck, Sparkles, Timer } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, PageHeader, ProgressRing, Skeleton, Timeline, Tooltip } from '@/components/ui'
import { useReleases, useTickets, useVendorInstallations, useVendorLicense } from '@/hooks/vendor'
import { cn } from '@/lib/cn'
import { date, plural, relative } from '@/lib/format'
import type { Release } from '@/types/release'
import type { InstallationRef, SupportTicket } from '@/types/vendor'
import { CardSkeleton, EnvBadge, Heartbeat, IconTile, Reveal, TopGlow } from './components/kit'
import { cmpVersion, daysBetween, daysUntil, isOpenTicket, latestStable } from './components/kitUtils'
import { UpdateFlow } from './components/UpdateFlow'

function VersionPill({ v, tone }: { v: string; tone: 'muted' | 'accent' | 'success' }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center rounded-lg border px-2.5 font-mono text-[14px] font-medium tabular',
        tone === 'muted' && 'border-line bg-surface-2 text-fg-2',
        tone === 'accent' && 'border-accent/40 bg-accent/10 text-accent-ink',
        tone === 'success' && 'border-success/30 bg-success/10 text-success',
      )}
    >
      {v}
    </span>
  )
}

function InstallationUpdateCard({ inst, latest, ticket }: { inst: InstallationRef; latest: Release; ticket?: SupportTicket }) {
  const behind = cmpVersion(latest.version, inst.version) > 0
  return (
    <Card className={cn('relative flex h-full flex-col overflow-hidden', behind && 'border-accent/35')}>
      {behind && <TopGlow />}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{inst.name}</p>
            <EnvBadge env={inst.environment} />
          </div>
          <p className="mt-0.5 font-mono text-[12px] text-fg-2">{inst.domain}</p>
        </div>
        {behind ? (
          <Badge tone="accent" dot pulse>
            Update available
          </Badge>
        ) : (
          <Badge tone="success" icon={<CircleCheck />}>
            Up to date
          </Badge>
        )}
      </div>

      <div className="px-5 py-6">
        {behind ? (
          <div className="flex items-center gap-3">
            <VersionPill v={inst.version} tone="muted" />
            <svg aria-hidden className="h-2 min-w-10 flex-1 text-accent-ink" preserveAspectRatio="none" viewBox="0 0 100 2">
              <line x1="0" y1="1" x2="100" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" className="animate-dash" />
            </svg>
            <ArrowRight className="-ml-2 size-4 shrink-0 text-accent-ink" />
            <VersionPill v={latest.version} tone="accent" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <VersionPill v={inst.version} tone="success" />
            <p className="text-[12.5px] text-fg-3">Running the latest stable release.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px border-y border-line bg-line">
        <div className="bg-surface px-4 py-3">
          <p className="mono-label">Schema</p>
          <p className="mt-1 font-mono text-[13px] text-fg">
            {behind && latest.migration && latest.migration.from === inst.schemaVersion ? (
              <>
                {inst.schemaVersion} <span className="text-fg-3">→</span> <span className="text-accent-ink">{latest.migration.to}</span>
              </>
            ) : (
              inst.schemaVersion
            )}
          </p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="mono-label">Channel</p>
          <p className="mt-1 text-[13px] text-fg capitalize">{inst.updateChannel}</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="mono-label">Heartbeat</p>
          <p className="mt-1 truncate text-[13px] text-fg">{relative(inst.lastHeartbeatAt)}</p>
        </div>
      </div>

      <CardBody className="flex-1 space-y-3 pt-4">
        {behind ? (
          <>
            <p className="text-[13px] text-fg-2">
              <span className="font-medium text-fg">{latest.title}.</span> {plural(latest.notes.length, 'change')}
              {latest.migration ? `, ${plural(latest.migration.steps.length, 'migration step')}` : ''}
              {latest.requiresBackup ? ' · backup taken automatically' : ''}.
            </p>
            {ticket && (
              <Link to={`/account/support/${ticket.id}`} className="group flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2.5 transition-colors hover:bg-warning/[0.1]">
                <MessagesSquare className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-fg">Pre-flight note · {ticket.id}</p>
                  <p className="line-clamp-2 text-[12px] text-fg-3">{ticket.subject}</p>
                </div>
                <span className="shrink-0 text-[11.5px] font-medium text-warning group-hover:underline">{ticket.status === 'awaiting_customer' ? 'Reply' : 'View'}</span>
              </Link>
            )}
          </>
        ) : (
          <Heartbeat status={inst.status} at={inst.lastHeartbeatAt} />
        )}
      </CardBody>

      <CardFooter>
        {behind ? (
          <>
            <span className="flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" /> Requires sign-in to {inst.domain}/admin
            </span>
            <Button size="sm" variant="accent" to="/admin/system/updates" trailing={<ArrowUpRight />}>
              Open Update Center
            </Button>
          </>
        ) : (
          <>
            <span>Next check with the regular heartbeat</span>
            <Link to={`/account/releases#v${inst.version}`} className="hover:text-fg">
              Notes for {inst.version}
            </Link>
          </>
        )}
      </CardFooter>
    </Card>
  )
}

export default function UpdatesPage() {
  const installs = useVendorInstallations()
  const releases = useReleases()
  const license = useVendorLicense()
  const tickets = useTickets()

  const latest = latestStable(releases.data)
  const beta = releases.data?.filter((r) => r.channel === 'beta').sort((a, b) => cmpVersion(b.version, a.version))[0]
  const l = license.data
  const total = l ? daysBetween(l.activatedAt, l.updatesUntil) : 0
  const left = l ? Math.max(0, daysUntil(l.updatesUntil)) : 0
  const sinceActivation = l && releases.data ? releases.data.filter((r) => r.releasedAt >= l.activatedAt).length : 0
  const behindCount = latest ? (installs.data?.filter((i) => cmpVersion(latest.version, i.version) > 0).length ?? 0) : 0
  const updateTicket = (inst: InstallationRef) => tickets.data?.find((t) => t.category === 'Update' && t.installationId === inst.id && isOpenTicket(t))

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Updates"
          description="Release availability for each installation. Updates are pulled and applied from inside your installations — ORVEX never pushes code to your servers."
          actions={
            <>
              <Button variant="secondary" to="/account/releases">
                Release notes
              </Button>
              <Tooltip content="Opens your installation’s admin — requires your installation sign-in">
                <Button variant="primary" to="/admin/system/updates" trailing={<ArrowUpRight />}>
                  Open Update Center
                </Button>
              </Tooltip>
            </>
          }
        />
      </Reveal>

      {/* Entitlement */}
      <Reveal delay={0.05}>
        {l ? (
          <Card className="relative overflow-hidden">
            <TopGlow />
            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <ProgressRing value={total ? (left / total) * 100 : 0} size={76} stroke={6} tone="success">
                <span className="text-center leading-tight">
                  <span className="block font-display text-[17px] font-semibold">{left}</span>
                  <span className="block text-[9.5px] font-normal text-fg-3">days</span>
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-fg">Update entitlement active</h2>
                  <Badge tone="success" dot>
                    Included
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-fg-2">
                  Every Core {l.licensedVersion} release, security patch and migration until <span className="font-medium text-fg">{date(l.updatesUntil)}</span>. After that nothing stops: your installations keep operating on the version they run; only newer releases wait until you renew.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center md:w-[360px]">
                {[
                  { k: 'Licensed', v: l.licensedVersion },
                  { k: 'Since activation', v: plural(sinceActivation, 'release') },
                  { k: 'Pending', v: behindCount ? plural(behindCount, 'update') : 'None' },
                ].map((s) => (
                  <div key={s.k} className="bg-surface-2/60 px-3 py-2.5">
                    <p className="text-[11px] text-fg-3">{s.k}</p>
                    <p className="mt-0.5 truncate text-[13.5px] font-semibold text-fg">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <Skeleton className="h-[124px] rounded-xl" />
        )}
      </Reveal>

      {/* Per installation */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {installs.data && latest
          ? installs.data.map((i, idx) => (
              <Reveal key={i.id} delay={0.1 + idx * 0.05}>
                <InstallationUpdateCard inst={i} latest={latest} ticket={updateTicket(i)} />
              </Reveal>
            ))
          : Array.from({ length: 2 }, (_, i) => <CardSkeleton key={i} rows={7} />)}
      </div>

      {/* How updates work */}
      <Reveal delay={0.2} className="mt-5">
        <Card>
          <CardHeader icon={<ShieldCheck />} title="How updates are applied" description="Pulled by your installation, verified locally, applied on your schedule." />
          <CardBody className="pt-2 pb-6">
            <UpdateFlow migration={latest?.migration} />
          </CardBody>
          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
            {[
              { icon: <Timer />, t: 'Your schedule', d: 'Nothing installs automatically. Pick a quiet window — migrations are expand-only and workers are drained before the container swap, so API clients see at most a brief 503 + Retry-After.' },
              { icon: <LockKeyhole />, t: 'Outbound only', d: 'Installations fetch packages over HTTPS. No inbound access for ORVEX.' },
              { icon: <RotateCcw />, t: 'Safe rollback', d: 'A failed health check restores the pre-update snapshot automatically.' },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3 bg-surface px-5 py-4">
                <IconTile icon={f.icon} size="sm" />
                <div>
                  <p className="text-[13px] font-medium text-fg">{f.t}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      {/* Schedule + beta */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Reveal delay={0.25}>
          <Card className="h-full">
            <CardHeader icon={<CalendarRange />} title="Release schedule" description="What’s coming and how often" />
            <CardBody>
              {releases.data ? (
                <Timeline
                  items={[
                    ...(beta
                      ? [
                          {
                            id: 'beta',
                            title: `${beta.version} · ${beta.title}`,
                            detail: 'Available now on the beta channel.',
                            time: date(beta.releasedAt),
                            tone: 'warning' as const,
                            icon: <FlaskConical />,
                            active: true,
                          },
                        ]
                      : []),
                    {
                      id: 'next',
                      title: beta ? `${beta.version.split('-')[0]} stable` : 'Next minor release',
                      detail: 'Expected after a 4–6 week beta, typically mid-month.',
                      time: 'Nov 2026',
                      tone: 'accent' as const,
                      icon: <Sparkles />,
                    },
                    { id: 'patch', title: 'Patch releases', detail: 'As needed. Security fixes ship within 72 hours of disclosure.', tone: 'neutral' as const, icon: <ShieldCheck /> },
                    { id: 'minor', title: 'Minor releases', detail: 'Roughly every 4–6 weeks, always with signed packages and migration notes.', tone: 'neutral' as const, icon: <GitBranch /> },
                  ]}
                />
              ) : (
                <div className="space-y-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </Reveal>

        <Reveal delay={0.3}>
          <Card className="flex h-full flex-col">
            <CardHeader icon={<FlaskConical />} title="Beta channel" description="Included with Professional" actions={<Badge tone="warning">Opt-in</Badge>} />
            <CardBody className="flex-1 space-y-4">
              <p className="text-[13px] leading-relaxed text-fg-2">
                Preview upcoming features before they reach stable. Beta builds are signed and migrate forward to the next stable release — but we recommend them for staging only.
              </p>
              <ol className="space-y-2.5 text-[12.5px] text-fg-2">
                {['Sign in to your staging installation’s admin', 'Open System → Updates and set the channel to Beta', 'Install the beta from the Update Center as usual'].map((s, i) => (
                  <li key={s} className="flex gap-2.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line font-mono text-[10.5px] text-fg-3">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <p className="text-[12px] text-fg-3">All of your installations are on the stable channel today.</p>
            </CardBody>
            <CardFooter>
              {beta ? (
                <Link to={`/account/releases#v${beta.version}`} className="font-medium text-fg-2 hover:text-fg">
                  {beta.version} notes →
                </Link>
              ) : (
                <span>No beta right now</span>
              )}
              <Link to="/admin/login" className="hover:text-fg">
                Staging admin ↗
              </Link>
            </CardFooter>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}
