import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  BadgeCheck,
  CircleCheck,
  CodeXml,
  CreditCard,
  Database,
  DatabaseBackup,
  HeartPulse,
  Layers,
  OctagonAlert,
  PlugZap,
  RefreshCw,
  Server,
  Siren,
  Truck,
  TriangleAlert,
  Webhook,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, Dot, EmptyState, PageHeader, SectionTitle, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { HealthBadge } from '@/components/domain'
import { useHealth, useInstallation, useSuppliers } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { ago, dateTime, duration, num, plural } from '@/lib/format'
import type { HealthComponent, HealthView } from '@/types/installation'
import { QueryError } from './shared'
import { HEALTH_COLOR, HEALTH_LABEL, HEALTH_TONE, useNow, wait } from './helpers'

const COMPONENT_ICON: Record<string, LucideIcon> = {
  api: Server,
  worker: Layers,
  db: Database,
  suppliers: Truck,
  native: CodeXml,
  dhru: PlugZap,
  webhooks: Webhook,
  payments: CreditCard,
  license: BadgeCheck,
  backups: DatabaseBackup,
}

/** What each job kind in the PostgreSQL job table does. */
const JOB_KIND_META: Record<string, { label: string; detail: string }> = {
  'order.dispatch': { label: 'Order dispatch', detail: 'Route a queued order to the next eligible supplier offer' },
  'attempt.response': { label: 'Supplier response', detail: 'Process the answer to a submitted supplier attempt' },
  'attempt.poll': { label: 'Status poll', detail: 'Poll the supplier for async results (unlock codes, server jobs)' },
  'payment.settle': { label: 'Payment settle', detail: 'Settle a pending gateway payment (simulated gateway)' },
  'webhook.deliver': { label: 'Webhook delivery', detail: 'Deliver or retry a signed outbound webhook' },
  'verification.supplier_reply': { label: 'Verification reply', detail: 'Supplier answer to a verification request' },
  'supplier.probe': { label: 'Supplier probe', detail: 'Half-open circuit probe / health sample' },
  'order.expire_payment': { label: 'Payment expiry', detail: 'Cancel orders whose payment never arrived' },
}

const OVERALL_COPY: Record<HealthView['overall'], { title: string; lead: string }> = {
  healthy: { title: 'All systems operational', lead: 'Every Core component is responding — orders are accepted, routed to suppliers and fulfilled normally.' },
  attention: { title: 'Operational — items need attention', lead: 'Core is running and orders are flowing. Some integrations need a look; unhealthy suppliers are routed around.' },
  degraded: { title: 'Degraded performance', lead: 'Core is running, but one or more components are slower than usual. Orders keep queueing safely in PostgreSQL.' },
  down: { title: 'Service disruption', lead: 'One or more components are not responding. Order intake is protected by the job queue and resumes automatically.' },
}

export default function HealthPage() {
  const health = useHealth()
  const installation = useInstallation()
  const [checking, setChecking] = useState(false)
  const data = health.data

  const runChecks = async () => {
    if (checking) return
    setChecking(true)
    await Promise.all([health.refetch(), wait(1100)])
    setChecking(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<HeartPulse />}
        eyebrow="System"
        title="Health"
        description="Live health of this ORVEX installation — core-api, core-worker, PostgreSQL, the job queue and every integration. Probes run on your own server."
        actions={
          <Badge tone="success" dot pulse size="md">
            Auto-refresh · 8 s
          </Badge>
        }
      />

      {health.isError && !data ? (
        <QueryError title="Health endpoint unreachable" onRetry={() => health.refetch()} />
      ) : (
        <>
          <HealthHero data={data} checking={checking} onRun={runChecks} domain={installation.data?.domain} />

          <section>
            <SectionTitle title="Components" description="Each component is probed independently. Select one to open the area where it is managed." />
            <ComponentGrid components={data?.components} checking={checking} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <JobQueueCard data={data} driver={installation.data?.queue.driver} workers={installation.data?.queue.workers} />
            <SupplierConnectivityCard />
          </div>

          <IncidentsCard data={data} />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */
function HealthHero({ data, checking, onRun, domain }: { data: HealthView | undefined; checking: boolean; onRun: () => void; domain?: string }) {
  useNow(1000)
  if (!data) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-5">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-3.5 w-96 max-w-full" />
          </div>
        </div>
      </Card>
    )
  }
  const copy = OVERALL_COPY[data.overall]
  const color = HEALTH_COLOR[data.overall]
  const healthy = data.components.filter((c) => c.status === 'healthy').length
  const flagged = data.components.filter((c) => c.status !== 'healthy')
  const openIncidents = data.incidents.filter((i) => !i.resolvedAt).length
  const Icon = data.overall === 'down' ? OctagonAlert : data.overall === 'degraded' ? TriangleAlert : data.overall === 'attention' ? TriangleAlert : CircleCheck

  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 transition-colors duration-500" style={{ background: color }} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex min-w-0 items-start gap-4 p-5 sm:gap-5 sm:p-6">
          <StatusOrb color={color} checking={checking}>
            <Icon className="size-6" style={{ color }} />
          </StatusOrb>
          <div className="min-w-0 flex-1">
            <div className="mono-label flex flex-wrap items-center gap-x-2 gap-y-1">
              <Dot tone={HEALTH_TONE[data.overall]} pulse={!checking} />
              Installation status
              {domain && <span className="font-mono tracking-normal text-fg-3 normal-case">· {domain}</span>}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={checking ? 'checking' : copy.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="mt-2 font-display text-[24px] leading-tight font-semibold tracking-[-0.025em] text-fg sm:text-[27px]"
              >
                {checking ? 'Running health checks…' : copy.title}
              </motion.h2>
            </AnimatePresence>
            <p className="mt-1 max-w-xl text-[13.5px] text-fg-2">{checking ? `Probing ${plural(data.components.length, 'component')}…` : copy.lead}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
              <span className="text-fg-2">
                <span className="font-medium text-fg tabular">{healthy}</span>/{data.components.length} healthy
              </span>
              {flagged.length > 0 && <span>· {flagged.map((f) => f.name).join(', ')}</span>}
              <span>· checked {ago(data.checkedAt)} ago</span>
            </div>
            <div className="mt-4 max-w-md">
              <div className="flex gap-0.75 rounded-sm bg-hatch p-0.75 shadow-[inset_0_0_0_1px_var(--line)]">
                {data.components.map((c, i) => (
                  <Tooltip key={c.id} content={`${c.name} · ${HEALTH_LABEL[c.status]}`} className="flex-1">
                    <motion.span
                      className="block h-1.5 w-full rounded-[1.5px]"
                      style={{ background: HEALTH_COLOR[c.status] }}
                      animate={checking ? { opacity: [1, 0.2, 1] } : { opacity: c.status === 'healthy' ? 0.8 : 1 }}
                      transition={checking ? { duration: 0.9, repeat: Infinity, delay: i * 0.08 } : { duration: 0.3 }}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-5 border-t border-line bg-surface-2/40 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <dl className="grid grid-cols-3 divide-x divide-line">
            <HeroStat label="Jobs pending" value={num(data.queue.pending)} sub="PostgreSQL job table" keyMetric />
            <HeroStat label="Due now" value={num(data.queue.due)} sub={data.queue.due > 50 ? 'backlog building' : 'worker keeping up'} />
            <HeroStat label="Open incidents" value={num(openIncidents)} sub={`${data.incidents.length} in log`} />
          </dl>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="min-w-0 truncate font-mono text-[11px] text-fg-3 tabular">{checking ? 'probing…' : `last probe ${dateTime(data.checkedAt)}`}</span>
            <Button variant="secondary" size="sm" onClick={onRun} disabled={checking} leading={<RefreshCw className={cn(checking && 'animate-spin')} />}>
              {checking ? 'Checking…' : 'Run checks'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function HeroStat({ label, value, sub, keyMetric }: { label: string; value: string; sub: string; keyMetric?: boolean }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-4">
      <dt className="mono-label flex items-center gap-1.5 truncate">
        {keyMetric && <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-[1px] bg-accent" />}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-2 truncate font-display text-[22px] leading-none font-semibold tracking-[-0.02em] text-fg tabular sm:text-[24px]">{value}</dd>
      <dd className="mt-1.5 truncate text-[11.5px] text-fg-3">{sub}</dd>
    </div>
  )
}

function StatusOrb({ color, checking, children }: { color: string; checking: boolean; children: ReactNode }) {
  return (
    <div className="relative grid size-14 shrink-0 place-items-center sm:size-16">
      <svg aria-hidden viewBox="0 0 64 64" className="absolute inset-0 size-full">
        <circle cx="32" cy="32" r="31" fill="none" stroke={color} strokeOpacity={0.4} strokeWidth="1" strokeDasharray="1.5 3.5" />
      </svg>
      {checking && (
        <motion.svg aria-hidden viewBox="0 0 64 64" className="absolute inset-0 size-full" animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}>
          <circle cx="32" cy="32" r="31" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="34 161" />
        </motion.svg>
      )}
      <span className="absolute inset-1.5 rounded-full" style={{ background: `color-mix(in oklab, ${color} 10%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)` }} />
      <span className="relative">{children}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */
function ComponentGrid({ components, checking }: { components: HealthComponent[] | undefined; checking: boolean }) {
  if (!components) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-4 h-3.5 w-full" />
            <Skeleton className="mt-5 h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {components.map((c, i) => (
        <ComponentCard key={c.id} c={c} index={i} checking={checking} />
      ))}
    </div>
  )
}

function ComponentCard({ c, index, checking }: { c: HealthComponent; index: number; checking: boolean }) {
  const Icon = COMPONENT_ICON[c.id] ?? Server
  const color = HEALTH_COLOR[c.status]
  const calm = c.status === 'healthy'
  const body = (
    <>
      <AnimatePresence>
        {checking && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/2"
            style={{ background: 'linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent) 9%, transparent), transparent)' }}
            initial={{ left: '-50%', opacity: 0 }}
            animate={{ left: ['-50%', '110%'], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ left: { duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: index * 0.07 }, opacity: { duration: 0.2 } }}
          />
        )}
      </AnimatePresence>
      <span aria-hidden className="absolute top-0 left-4 h-0.5 w-8 rounded-b-sm" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4', calm && 'border border-line bg-surface-2 text-fg-2')}
            style={calm ? undefined : { color, background: `color-mix(in oklab, ${color} 10%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 24%, transparent)` }}
          >
            <Icon />
          </span>
          <p className="min-w-0 truncate text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{c.name}</p>
        </div>
        <StatusBadge status={c.status} label={HEALTH_LABEL[c.status]} noPulse={checking} />
      </div>
      <p className="mt-3 line-clamp-2 min-h-[38px] text-[12.5px] leading-relaxed text-fg-2">{c.summary}</p>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="truncate font-mono text-[12px] text-fg tabular">{c.metric}</span>
        {c.href && <ArrowUpRight className="size-3.5 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
    </>
  )
  const cls = 'group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow,transform] duration-200'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
      {c.href ? (
        <Link to={c.href} className={cn(cls, 'hover:-translate-y-px hover:border-line-strong hover:shadow-pop')}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Job queue                                                          */
/* ------------------------------------------------------------------ */
function JobQueueCard({ data, driver, workers }: { data: HealthView | undefined; driver?: string; workers?: number }) {
  const kinds = data ? Object.entries(data.queue.byKind).sort((a, b) => b[1] - a[1]) : []
  const max = Math.max(1, ...kinds.map(([, n]) => n))
  return (
    <Card id="jobs" className="scroll-mt-20">
      <CardHeader
        icon={<Layers />}
        title="Job queue"
        description={driver ? `${driver}${workers ? ` · ${workers} workers` : ''}` : 'PostgreSQL job table — no Redis, no Kafka'}
        actions={
          data && (
            <div className="flex items-center gap-1.5">
              <Badge tone="neutral" variant="outline">
                {num(data.queue.pending)} pending
              </Badge>
              <Badge tone={data.queue.due > 50 ? 'warning' : 'neutral'} variant="outline">
                {num(data.queue.due)} due
              </Badge>
            </div>
          )
        }
      />
      <div className="px-5 pb-5">
        {!data ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : kinds.length === 0 ? (
          <EmptyState compact icon={<CircleCheck />} title="Queue is empty" description="No jobs are scheduled. New orders enqueue an order.dispatch job immediately." />
        ) : (
          <ul className="divide-y divide-line">
            {kinds.map(([kind, n]) => {
              const meta = JOB_KIND_META[kind]
              return (
                <li key={kind} className="grid grid-cols-[minmax(0,1fr)_90px_40px] items-center gap-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_160px_48px]">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12.5px] text-fg">{kind}</p>
                    <p className="truncate text-[11.5px] text-fg-3">{meta?.detail ?? 'Background job'}</p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-fg/[0.07]">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                  <span className="text-right font-mono text-[12.5px] text-fg tabular">{num(n)}</span>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-fg-3">
          Jobs are rows claimed with <span className="font-mono">FOR UPDATE SKIP LOCKED</span>. Async supplier results (unlock codes) wait as <span className="font-mono">attempt.poll</span> jobs; an order whose
          outcome is unknown is never retried automatically — it goes to Needs Review.
        </p>
      </div>
    </Card>
  )
}

function SupplierConnectivityCard() {
  const suppliers = useSuppliers()
  const rows = suppliers.data
  return (
    <Card>
      <CardHeader
        icon={<Truck />}
        title="Supplier connectivity"
        description="Simulated supplier systems. An unhealthy supplier is routed around — it never marks Core unhealthy."
        actions={
          <Button variant="ghost" size="sm" to="/admin/suppliers" trailing={<ArrowUpRight />}>
            Suppliers
          </Button>
        }
      />
      <div className="px-5 pb-4">
        {suppliers.isError ? (
          <p className="py-6 text-center text-[12.5px] text-fg-3">Supplier list unavailable.</p>
        ) : !rows ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.supplier.id}>
                <Link to={`/admin/suppliers/${s.supplier.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-fg">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-fg">{s.supplier.name}</span>
                    <span className="block truncate font-mono text-[11px] text-fg-3">
                      {s.driver.name} · p50 {num(s.metrics.latencyP50 ?? 0)} ms
                    </span>
                  </span>
                  <HealthBadge health={s.health} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Incidents                                                          */
/* ------------------------------------------------------------------ */
function IncidentsCard({ data }: { data: HealthView | undefined }) {
  const now = useNow(30_000)
  const items = data ? [...data.incidents].sort((a, b) => Number(!!a.resolvedAt) - Number(!!b.resolvedAt) || +new Date(b.startedAt) - +new Date(a.startedAt)) : undefined
  return (
    <Card>
      <CardHeader icon={<Siren />} title="Incidents" description="Recorded on this installation. Supplier incidents are informational — orders fail over or wait for review." />
      <div className="px-5 pb-5">
        {!items ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState compact icon={<CircleCheck />} title="No incidents" description="Nothing has been recorded in the last 30 days." />
        ) : (
          <ol className="divide-y divide-line">
            {items.map((inc) => {
              const end = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : now
              const lasted = Math.max(60, (end - new Date(inc.startedAt).getTime()) / 1000)
              return (
                <li key={inc.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Dot tone={inc.resolvedAt ? 'success' : inc.status === 'investigating' ? 'danger' : 'warning'} pulse={!inc.resolvedAt} className="mt-1.5" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-fg">{inc.title}</p>
                      <p className="text-[12px] text-fg-3">
                        {inc.component} · started {dateTime(inc.startedAt)} · {inc.resolvedAt ? `lasted ${duration(lasted)}` : `ongoing for ${duration(lasted)}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={inc.status} className="self-start sm:self-auto" />
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </Card>
  )
}
