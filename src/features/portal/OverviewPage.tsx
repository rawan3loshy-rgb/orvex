import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Container,
  FileKey,
  FileText,
  KeyRound,
  Layers,
  LifeBuoy,
  MessagesSquare,
  Package,
  Plus,
  Receipt,
  Server,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import { TenantMark } from '@/components/brand'
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, Dot, EmptyState, PageHeader, Progress, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { useInvoices, useReleases, useTickets, useVendorInstallations, useVendorOverview } from '@/hooks/vendor'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { date, dateShort, money, plural, relative } from '@/lib/format'
import type { InstallationRef } from '@/types/vendor'
import {
  CardSkeleton,
  EnvBadge,
  Heartbeat,
  IconTile,
  NoteIcon,
  Reveal,
  Row,
  SignalRings,
  TopGlow,
} from './components/kit'
import {
  categoryLabel,
  cmpVersion,
  daysBetween,
  daysUntil,
  isOpenTicket,
  latestStable,
  periodProgress,
} from './components/kitUtils'

/* ------------------------------------------------------------------ */

function HeroCell({ to, icon, label, value, sub, highlight, loading }: { to: string; icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; highlight?: boolean; loading?: boolean }) {
  return (
    <Link to={to} className="group relative flex min-w-0 flex-col bg-surface px-5 pt-4 pb-4.5 transition-colors hover:bg-surface-2">
      {highlight && (
        <>
          <span aria-hidden className="absolute inset-0 bg-accent/[0.045]" />
          <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
        </>
      )}
      <div className="relative flex items-center justify-between gap-2">
        <span className={cn('flex items-center gap-1.5 text-[12px] font-medium [&_svg]:size-3.5', highlight ? 'text-accent-ink' : 'text-fg-3')}>
          {icon}
          {label}
        </span>
        <ArrowUpRight className="size-3.5 translate-x-[-2px] translate-y-[2px] text-fg-3 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
      </div>
      <div className="relative mt-2.5 min-w-0">{loading ? <Skeleton className="h-6 w-28" /> : value}</div>
      <div className="relative mt-1.5 flex min-h-5 min-w-0 items-center gap-1.5 text-[12px] text-fg-3">{loading ? <Skeleton className="h-3 w-24" /> : sub}</div>
    </Link>
  )
}

const bigValue = 'block truncate font-display text-[19px] leading-tight font-semibold tracking-[-0.02em] text-fg'

function InstallationRow({ inst, latest }: { inst: InstallationRef; latest?: string }) {
  const behind = latest ? cmpVersion(latest, inst.version) > 0 : false
  return (
    <div className="group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-surface-2/50 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="relative">
          <IconTile icon={<Server />} size="lg" tone={inst.environment === 'production' ? 'accent' : 'neutral'} />
          <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-surface">
            <Dot tone={inst.status === 'online' ? 'success' : inst.status === 'degraded' ? 'warning' : 'danger'} pulse={inst.status === 'online'} />
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">{inst.name}</p>
            <EnvBadge env={inst.environment} />
          </div>
          <p className="mt-0.5 truncate font-mono text-[12px] text-fg-2">{inst.domain}</p>
          <Heartbeat status={inst.status} at={inst.lastHeartbeatAt} className="mt-1 text-[12px]" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-5 pl-[58px] sm:justify-end sm:pl-0">
        <div className="sm:text-right">
          <p className="font-mono text-[13px] text-fg">v{inst.version}</p>
          {behind ? (
            <Link to="/account/updates" className="text-[11.5px] font-medium text-accent-ink hover:underline">
              {latest} available
            </Link>
          ) : (
            <p className="text-[11.5px] text-success">Up to date</p>
          )}
        </div>
        <Tooltip content={`Opens ${inst.domain}/admin — sign in with your installation account`}>
          <Button size="sm" variant="secondary" to="/admin/login" trailing={<ArrowUpRight />}>
            Open admin
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

function QuickAction({ icon, title, detail, to, onClick }: { icon: ReactNode; title: string; detail: string; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <IconTile icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-fg">{title}</p>
        <p className="truncate text-[12px] text-fg-3">{detail}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-fg-3 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
    </>
  )
  const cls = 'group flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-left shadow-card transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong hover:shadow-pop'
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/* ------------------------------------------------------------------ */

export default function OverviewPage() {
  const overview = useVendorOverview()
  const installs = useVendorInstallations()
  const invoices = useInvoices()
  const tickets = useTickets()
  const releases = useReleases()
  const session = useSession((s) => s.vendor)

  const o = overview.data
  const firstName = o?.account.firstName ?? session?.name.split(' ')[0] ?? 'there'
  const loading = overview.isLoading
  const installations = installs.data ?? o?.license.installations
  const prod = installations?.find((i) => i.environment === 'production') ?? installations?.[0]
  const latest = latestStable(releases.data)
  const latestVersion = latest?.version ?? o?.latestRelease.version
  const updateAvailable = !!(prod && latestVersion && cmpVersion(latestVersion, prod.version) > 0)
  const openTickets = tickets.data?.filter(isOpenTicket) ?? []
  const awaiting = openTickets.filter((t) => t.status === 'awaiting_customer')
  const recentInvoices = invoices.data?.slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).slice(0, 4)
  const openInvoice = invoices.data?.find((i) => i.status === 'open')
  const sub = o?.subscription
  const renewalDays = sub ? Math.max(0, daysUntil(sub.nextRenewalAt)) : 0
  const periodTotal = sub ? daysBetween(sub.currentPeriodStart, sub.currentPeriodEnd) : 0
  const periodPct = sub ? periodProgress(sub.currentPeriodStart, sub.currentPeriodEnd) : 0

  if (overview.isError) {
    return (
      <Card>
        <EmptyState
          icon={<TriangleAlert />}
          title="We couldn’t load your account"
          description="The account service didn’t respond. Your installations are not affected."
          action={
            <Button variant="secondary" onClick={() => overview.refetch()}>
              Try again
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <div>
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span className="inline-flex items-center gap-1.5">
                <TenantMark className="size-4 rounded-[5px] text-[9px]" /> {o?.account.company ?? 'UnlockDesk Demo Ltd.'}
              </span>
              <span className="text-line-strong">/</span>
              <span>{o ? `Customer since ${date(o.account.createdAt)}` : 'ORVEX account'}</span>
            </>
          }
          title={`Welcome back, ${firstName}.`}
          description="Your subscription, license, invoices, releases and support with ORVEX Systems. Orders, customer and reseller accounts, wallet balances and supplier credentials live only in your own installation — this portal has no access to them."
          actions={
            <>
              <Button variant="secondary" to="/account/support?new=1" leading={<LifeBuoy />}>
                Get help
              </Button>
              <Tooltip content="Your installation is a separate system with its own sign-in">
                <Button variant="primary" to="/admin/login" trailing={<ArrowUpRight />}>
                  Open installation admin
                </Button>
              </Tooltip>
            </>
          }
        />
      </Reveal>

      {/* Hero summary */}
      <Reveal delay={0.05}>
        <Card className="overflow-hidden">
          <TopGlow />
          <div className="grid grid-cols-1 gap-px bg-line min-[440px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <HeroCell
              to="/account/subscription"
              icon={<Layers />}
              label="Plan"
              loading={loading}
              value={<span className={bigValue}>{sub?.planName}</span>}
              sub={
                sub && (
                  <>
                    <StatusBadge status={sub.status} />
                    <span className="truncate capitalize">{sub.billingCycle}</span>
                  </>
                )
              }
            />
            <HeroCell
              to="/account/license"
              icon={<KeyRound />}
              label="License"
              loading={loading}
              value={<span className="block truncate font-mono text-[15px] leading-[1.6] font-medium tracking-tight text-fg">{o?.license.keyMasked.split('-').slice(0, 3).join('-')}</span>}
              sub={o && <span className="truncate">Updates until {date(o.license.updatesUntil)} · perpetual use</span>}
            />
            <HeroCell
              to="/account/installation"
              icon={<Server />}
              label="Installation"
              loading={loading || !prod}
              value={<span className="block truncate font-mono text-[14px] leading-[1.7] font-medium text-fg">{prod?.domain}</span>}
              sub={prod && <Heartbeat status={prod.status} at={prod.lastHeartbeatAt} label={false} className="text-[12px]" />}
            />
            <HeroCell
              to="/account/installation"
              icon={<Package />}
              label="Core version"
              loading={loading || !prod}
              value={<span className={bigValue}>{prod?.version}</span>}
              sub={prod && <span className="truncate">Schema {prod.schemaVersion} · {prod.updateChannel}</span>}
            />
            <HeroCell
              to="/account/updates"
              icon={<Sparkles />}
              label="Latest release"
              highlight={updateAvailable}
              loading={loading}
              value={
                <span className="flex items-center gap-2">
                  <span className={bigValue}>{latestVersion}</span>
                  {updateAvailable && (
                    <Badge tone="accent" variant="solid" className="h-4.5 px-1.5 text-[10px]">
                      New
                    </Badge>
                  )}
                </span>
              }
              sub={updateAvailable ? <span className="truncate font-medium text-accent-ink">Available for production</span> : <span className="truncate">All installations current</span>}
            />
            <HeroCell
              to="/account/subscription"
              icon={<CalendarClock />}
              label="Next renewal"
              loading={loading}
              value={<span className={bigValue}>{sub && date(sub.nextRenewalAt)}</span>}
              sub={
                sub && (
                  <span className="truncate">
                    <span className="font-medium text-fg-2 tabular">{money(sub.amount)}</span> · in {plural(renewalDays, 'day')}
                  </span>
                )
              }
            />
          </div>
          {updateAvailable && latest && prod && (
            <div className="relative flex flex-col gap-3 border-t border-line px-5 py-3.5 sm:flex-row sm:items-center">
              <span aria-hidden className="absolute inset-0 bg-accent/[0.035]" />
              <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
              <div className="relative flex min-w-0 flex-1 items-center gap-3">
                <IconTile size="sm" tone="accent" icon={<Sparkles />} />
                <p className="min-w-0 text-[13px] text-fg-2">
                  <span className="font-medium text-fg">
                    ORVEX Core {latest.version} is ready for {prod.name}.
                  </span>{' '}
                  <span className="text-fg-3">
                    {latest.title} · released {dateShort(latest.releasedAt)}
                    {latest.migration ? ` · migration ${latest.migration.from} → ${latest.migration.to}` : ''}
                  </span>
                </p>
              </div>
              <div className="relative flex shrink-0 items-center gap-1.5 pl-10 sm:pl-0">
                <Button size="sm" variant="ghost" to={`/account/releases#v${latest.version}`}>
                  Release notes
                </Button>
                <Button size="sm" variant="accent" to="/account/updates" trailing={<ArrowRight />}>
                  Review update
                </Button>
              </div>
            </div>
          )}
        </Card>
      </Reveal>

      {/* Installations + renewal */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Reveal delay={0.1} className="lg:col-span-2">
          {installations ? (
            <Card className="h-full overflow-hidden">
              <CardHeader
                icon={<Server />}
                title="Installations"
                description={`${plural(installations.length, 'installation')} bound to license ${o?.license.id ?? ''}`}
                actions={
                  <Button size="sm" variant="ghost" to="/account/installation" trailing={<ArrowRight />}>
                    Details
                  </Button>
                }
              />
              <div className="divide-y divide-line border-t border-line">
                {installations.map((i) => (
                  <InstallationRow key={i.id} inst={i} latest={latestVersion} />
                ))}
              </div>
              <CardFooter className="justify-start">
                <ShieldCheck className="size-3.5 shrink-0 text-success" />
                <span>Each installation runs on your infrastructure with its own database and admin users. We only receive license heartbeats (license ID, installation ID, version, domain) — never orders, balances or supplier credentials.</span>
              </CardFooter>
            </Card>
          ) : (
            <CardSkeleton rows={5} className="h-full" />
          )}
        </Reveal>

        <Reveal delay={0.14}>
          {sub ? (
            <Card className="flex h-full flex-col">
              <CardHeader
                icon={<CalendarClock />}
                title="Renewal"
                description={`${sub.planName} · billed ${sub.billingCycle}`}
                actions={<Badge tone={sub.autoRenew ? 'success' : 'warning'} dot>{sub.autoRenew ? 'Auto-renew' : 'Manual'}</Badge>}
              />
              <CardBody className="flex flex-1 flex-col gap-4">
                <div>
                  <p className="font-display text-[28px] leading-none font-semibold tracking-[-0.025em] text-fg tabular">{date(sub.nextRenewalAt)}</p>
                  <p className="mt-2 text-[12.5px] text-fg-3">
                    <span className="font-medium text-fg-2 tabular">{money(sub.amount)}</span> charged in {plural(renewalDays, 'day')}
                  </p>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-[11.5px] text-fg-3 tabular">
                    <span>{dateShort(sub.currentPeriodStart)}</span>
                    <span>
                      Day {Math.min(periodTotal, Math.round(periodPct * periodTotal))} of {periodTotal}
                    </span>
                    <span>{dateShort(sub.currentPeriodEnd)}</span>
                  </div>
                  <Progress value={periodPct * 100} />
                </div>
                <div className="divide-y divide-line rounded-lg border border-line px-3">
                  <Row label="Payment method">
                    {sub.paymentMethod.brand} •••• {sub.paymentMethod.last4}
                  </Row>
                  <Row label="Add-ons">{sub.addOns.map((a) => a.name).join(', ') || 'None'}</Row>
                </div>
                {openInvoice && (
                  <Link
                    to={`/account/invoices/${openInvoice.id}`}
                    className="group mt-auto flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2.5 transition-colors hover:bg-warning/[0.11]"
                  >
                    <Receipt className="size-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-fg">
                        {openInvoice.number} · {money(openInvoice.total)}
                      </p>
                      <p className="text-[11.5px] text-fg-3">{daysUntil(openInvoice.dueAt) < 0 ? `Overdue since ${date(openInvoice.dueAt)}` : `Due ${date(openInvoice.dueAt)} · ${relative(openInvoice.dueAt)}`}</p>
                    </div>
                    <span className="text-[12px] font-medium text-warning group-hover:underline">Pay</span>
                  </Link>
                )}
              </CardBody>
              <CardFooter>
                <Link to="/account/subscription" className="font-medium text-fg-2 hover:text-fg">
                  Manage subscription
                </Link>
                <Link to="/account/billing" className="hover:text-fg">
                  Billing details →
                </Link>
              </CardFooter>
            </Card>
          ) : (
            <CardSkeleton rows={6} className="h-full" />
          )}
        </Reveal>
      </div>

      {/* Invoices · Support · Release */}
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.18}>
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader
              icon={<FileText />}
              title="Recent invoices"
              description="Issued by ORVEX Systems"
              actions={
                <Button size="sm" variant="ghost" to="/account/invoices">
                  All
                </Button>
              }
            />
            <div className="flex-1 divide-y divide-line border-t border-line">
              {recentInvoices
                ? recentInvoices.map((inv) => (
                    <Link key={inv.id} to={`/account/invoices/${inv.id}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[12.5px] text-fg">{inv.number}</p>
                        <p className="truncate text-[12px] text-fg-3">
                          {date(inv.issuedAt)} · {inv.lines[0]?.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[13px] font-medium text-fg tabular">{money(inv.total)}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    </Link>
                  ))
                : Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.22}>
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader
              icon={<MessagesSquare />}
              title="Support"
              description={tickets.data ? `${plural(openTickets.length, 'open ticket')} · Priority support` : 'Loading tickets…'}
              actions={
                <Button size="sm" variant="ghost" to="/account/support?new=1" leading={<Plus />}>
                  New
                </Button>
              }
            />
            {awaiting.length > 0 && (
              <Link to={`/account/support/${awaiting[0]!.id}`} className="mx-5 mb-3 flex items-center gap-2 rounded-lg bg-warning/[0.08] px-3 py-2 text-[12.5px] text-warning transition-colors hover:bg-warning/[0.12]">
                <Dot tone="warning" pulse />
                <span className="min-w-0 flex-1 truncate">{awaiting.length === 1 ? 'Support is waiting for your reply' : `${awaiting.length} tickets are waiting for your reply`}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
            <div className="flex-1 divide-y divide-line border-t border-line">
              {!tickets.data ? (
                Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="space-y-1.5 px-5 py-3.5">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : openTickets.length === 0 ? (
                <EmptyState compact icon={<LifeBuoy />} title="No open tickets" description="Everything’s quiet. We’re here if you need us." />
              ) : (
                openTickets.slice(0, 3).map((t) => (
                  <Link key={t.id} to={`/account/support/${t.id}`} className="block px-5 py-3 transition-colors hover:bg-surface-2/60">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-[13px] font-medium text-fg">{t.subject}</p>
                      <StatusBadge status={t.status} className="shrink-0" />
                    </div>
                    <p className="mt-1 truncate text-[12px] text-fg-3">
                      <span className="font-mono">{t.id}</span> · {categoryLabel(t.category)} · updated {relative(t.updatedAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.26} className="md:col-span-2 xl:col-span-1">
          {latest ? (
            <Card className="relative flex h-full flex-col overflow-hidden">
              <SignalRings className="absolute -top-10 -right-20 h-48 w-80 text-fg-3 opacity-60 mask-fade-b" />
              <CardHeader
                icon={<Sparkles />}
                title={`ORVEX Core ${latest.version}`}
                description={`Latest stable · ${date(latest.releasedAt)}`}
                actions={
                  <Badge tone="accent" dot>
                    Latest
                  </Badge>
                }
              />
              <CardBody className="relative flex-1">
                <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{latest.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{latest.summary}</p>
                <ul className="mt-4 space-y-2.5">
                  {latest.notes.slice(0, 3).map((n, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <NoteIcon type={n.type} />
                      <span className="pt-0.5 text-[12.5px] text-fg-2">{n.text}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
              <CardFooter>
                <Link to={`/account/releases#v${latest.version}`} className="font-medium text-fg-2 hover:text-fg">
                  Read release notes
                </Link>
                <span className="tabular">{plural(latest.notes.length, 'change')}</span>
              </CardFooter>
            </Card>
          ) : (
            <CardSkeleton rows={5} className="h-full" />
          )}
        </Reveal>
      </div>

      {/* Quick actions */}
      <Reveal delay={0.3} className="mt-8">
        <h2 className="mb-3 text-[14px] font-semibold tracking-[-0.01em]">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            icon={<FileKey />}
            title="Download license file"
            detail={`${o?.license.id ?? 'LIC-4829-AX'}.lic · Ed25519 signed`}
            onClick={() => toast.success('Demo: license file generated', `${o?.license.id ?? 'LIC-4829-AX'}.lic is signed and ready to upload in Settings → License.`)}
          />
          <QuickAction icon={<Container />} title="Deployment package" detail="docker-compose.yml and .env template" to="/account/installation#deploy" />
          <QuickAction icon={<LifeBuoy />} title="Open a support ticket" detail="4-hour first response" to="/account/support?new=1" />
          <QuickAction icon={<UserPlus />} title="Invite a teammate" detail="Owner, Billing or Technical access" to="/account/settings#team" />
        </div>
      </Reveal>
    </div>
  )
}
