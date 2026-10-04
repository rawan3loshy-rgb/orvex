import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDashed,
  Cloud,
  Container,
  Cpu,
  Database,
  HardDrive,
  Layers,
  Lock,
  Puzzle,
  Rocket,
  Server,
  ShieldCheck,
  Timer,
  Variable,
} from 'lucide-react'
import { Badge, Card, CardHeader, Dot, PageHeader, ProgressRing, Skeleton, StatusBadge } from '@/components/ui'
import { useGoLive, useInstallation } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { date, dateTime, num, relative } from '@/lib/format'
import type { GoLiveItem, InstallationInfo } from '@/types/installation'
import type { ExtensionKind } from '@/types/extensions'
import { CardSkeleton, KV, QueryError } from './shared'

const KIND_LABEL: Record<ExtensionKind, string> = {
  'supplier-driver': 'Supplier drivers',
  'vertical-pack': 'Vertical packs',
  'payment-gateway': 'Payment gateways',
  'service-type': 'Service types',
  theme: 'Themes',
  'website-component': 'Website components',
  'business-rule': 'Business rules',
  module: 'Modules',
}

export default function InstallationPage() {
  const installation = useInstallation()
  const inst = installation.data

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Server />}
        eyebrow="System"
        title="Installation & go-live"
        description="This ORVEX installation runs on the customer’s own server with its own PostgreSQL. The vendor never holds operational data."
        actions={
          inst && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral" variant="outline" size="md">
                {inst.installationId}
              </Badge>
              <Badge tone={inst.environment === 'production' ? 'accent' : 'neutral'} size="md">
                {inst.environment}
              </Badge>
            </div>
          )
        }
      />

      {installation.isError && !inst ? (
        <QueryError onRetry={() => installation.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <DeploymentCard inst={inst} />
            <GoLiveCard />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <DatabaseCard inst={inst} />
            <RuntimeCard inst={inst} />
            <ExtensionsSummary inst={inst} />
          </div>

          <EnvCard inst={inst} />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Deployment model                                                   */
/* ------------------------------------------------------------------ */
function DeploymentCard({ inst }: { inst: InstallationInfo | undefined }) {
  if (!inst) return <CardSkeleton rows={8} />
  const c = (name: string) => inst.runtime.containers.find((x) => x.name === name)
  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<Layers />} title="Deployment model" description={`${inst.runtime.platform} · ${inst.runtime.os}`} actions={<Badge tone="neutral" variant="outline">{inst.deployment === 'self_hosted' ? 'Self-hosted' : 'Vendor-managed dedicated'}</Badge>} />
      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_200px]">
        {/* Customer server */}
        <div className="relative rounded-xl border border-line-strong bg-bg-subtle/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="mono-label flex items-center gap-1.5">
              <Server className="size-3.5" /> Customer server · {inst.domain}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-fg-3">
              <Lock className="size-3" /> data stays here
            </span>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <Node i={0} icon={<ShieldCheck />} name="Caddy" sub={`${inst.runtime.proxy} · HTTPS :443`} status={c('caddy')?.status} />
            <Arrow />
            <div className="grid gap-2 sm:grid-cols-3">
              <Node i={1} icon={<Server />} name="core-api" sub="Admin · portal · storefront · API v1 · DHRU" status={c('core-api')?.status} accent />
              <Node i={2} icon={<Layers />} name="core-worker" sub="Routing, supplier attempts, webhooks" status={c('core-worker')?.status} />
              <Node i={3} icon={<Timer />} name="core-scheduler" sub="Polls, retries, expiries, probes" status={c('core-scheduler')?.status} />
            </div>
            <Arrow />
            <Node i={4} icon={<Database />} name={`PostgreSQL ${inst.database.version}`} sub={`Orders, ledger, catalog, job queue · ${(inst.database.sizeMb / 1024).toFixed(1)} GB`} status={inst.database.status === 'connected' ? 'running' : 'stopped'} />
          </div>
          <p className="mt-3 text-[11.5px] text-fg-3">Modular monolith — one codebase, three processes. No Kafka, Redis or Kubernetes: the job queue is a PostgreSQL table.</p>
        </div>
        {/* Vendor side */}
        <div className="flex flex-col gap-2">
          <div className="relative flex items-center justify-center py-1 lg:hidden">
            <span className="h-6 border-l border-dashed border-line-strong" />
          </div>
          <div className="rounded-xl border border-dashed border-line-strong p-3.5">
            <span className="mono-label flex items-center gap-1.5">
              <Cloud className="size-3.5" /> ORVEX Systems
            </span>
            <ul className="mt-2.5 space-y-2 text-[12px]">
              <li>
                <p className="font-mono text-fg">license.orvex.io</p>
                <p className="text-fg-3">signed license check</p>
              </li>
              <li>
                <p className="font-mono text-fg">releases.orvex.io</p>
                <p className="text-fg-3">release manifests</p>
              </li>
              <li>
                <p className="font-mono text-fg">registry.orvex.io</p>
                <p className="text-fg-3">signed Core images</p>
              </li>
            </ul>
          </div>
          <div className="rounded-lg bg-surface-2/60 px-3 py-2 text-[11.5px] text-fg-3">
            <p className="flex items-center gap-1.5 font-medium text-fg-2">
              <ArrowUpRight className="size-3.5" /> Outbound only
            </p>
            The server initiates every connection. Nothing connects in; no orders, customers or ledger data are sent.
          </div>
        </div>
      </div>
      <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
        <div className="bg-surface p-4">
          <p className={cn('text-[13px] font-medium', inst.deployment === 'self_hosted' ? 'text-fg' : 'text-fg-2')}>Self-hosted {inst.deployment === 'self_hosted' && <Badge tone="accent" className="ml-1">this installation</Badge>}</p>
          <p className="mt-0.5 text-[12px] text-fg-3">Customer operates the server and PostgreSQL; ORVEX ships signed releases.</p>
        </div>
        <div className="bg-surface p-4">
          <p className={cn('text-[13px] font-medium', inst.deployment === 'managed_dedicated' ? 'text-fg' : 'text-fg-2')}>Vendor-managed dedicated {inst.deployment === 'managed_dedicated' && <Badge tone="accent" className="ml-1">this installation</Badge>}</p>
          <p className="mt-0.5 text-[12px] text-fg-3">Same software on a dedicated server per customer, operated for them — still single-tenant, still their data.</p>
        </div>
      </div>
    </Card>
  )
}

function Node({ icon, name, sub, status, accent, i }: { icon: ReactNode; name: string; sub: string; status?: string; accent?: boolean; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06, duration: 0.35 }}
      className={cn('relative flex items-center gap-3 rounded-lg border bg-surface px-3 py-2.5 shadow-card', accent ? 'border-accent/40' : 'border-line')}
    >
      <span className={cn('grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-3.5', accent ? 'bg-accent/10 text-accent-ink' : 'bg-surface-2 text-fg-2')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[12.5px] text-fg">{name}</p>
        <p className="truncate text-[11px] text-fg-3">{sub}</p>
      </div>
      {status && <Dot tone={status === 'running' ? 'success' : status === 'restarting' ? 'warning' : 'danger'} pulse={status === 'running'} />}
    </motion.div>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center text-fg-3">
      <ArrowDown className="size-3.5" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Go-live                                                            */
/* ------------------------------------------------------------------ */
function GoLiveCard() {
  const goLive = useGoLive()
  const items = goLive.data
  const checks = items?.filter((i) => i.id !== 'ready') ?? []
  const done = checks.filter((i) => i.done).length
  const ready = items?.find((i) => i.id === 'ready')
  return (
    <Card id="go-live" className="flex flex-col">
      <CardHeader
        icon={<Rocket />}
        title="Go-live checklist"
        description="Each item links to where it is configured."
        actions={
          items && (
            <ProgressRing value={(done / Math.max(1, checks.length)) * 100} size={40} tone={ready?.done ? 'success' : 'accent'}>
              <span className="font-mono text-[10.5px] tabular">
                {done}/{checks.length}
              </span>
            </ProgressRing>
          )
        }
      />
      <div className="flex-1 px-3 pb-3">
        {goLive.isError ? (
          <p className="px-2 py-6 text-center text-[12.5px] text-fg-3">Checklist unavailable.</p>
        ) : !items ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <ol className="space-y-0.5">
            {items.map((it, i) => (
              <GoLiveRow key={it.id} item={it} index={i} />
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}

function GoLiveRow({ item, index }: { item: GoLiveItem; index: number }) {
  const final = item.id === 'ready'
  return (
    <motion.li initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.025 }}>
      <Link to={item.href} className={cn('group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2', final && 'mt-1 border-t border-line pt-3')}>
        <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', item.done ? (final ? 'bg-success text-white' : 'bg-success/15 text-success') : 'text-fg-3')}>
          {item.done ? <Check className="size-3" strokeWidth={3} /> : <CircleDashed className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-[13px]', final ? 'font-semibold text-fg' : item.done ? 'text-fg' : 'font-medium text-fg')}>{item.label}</p>
          <p className="truncate text-[11.5px] text-fg-3">{item.detail}</p>
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </motion.li>
  )
}

/* ------------------------------------------------------------------ */
/*  Database / runtime / extensions / env                              */
/* ------------------------------------------------------------------ */
function DatabaseCard({ inst }: { inst: InstallationInfo | undefined }) {
  if (!inst) return <CardSkeleton />
  const db = inst.database
  return (
    <Card>
      <CardHeader icon={<Database />} title="Database" description={db.provider} actions={<StatusBadge status={db.status} />} />
      <dl className="px-5 pb-4">
        <KV label="Engine">
          {db.engine} {db.version}
        </KV>
        <KV label="Host">
          <span className="font-mono text-[12px]">{db.hostMasked}</span>
        </KV>
        <KV label="Database · SSL">
          <span className="font-mono text-[12px]">
            {db.name} · {db.sslMode}
          </span>
        </KV>
        <KV label="Latency">{db.latencyMs} ms</KV>
        <KV label="Pool">
          <span className="tabular">
            {db.pool.active} active · {db.pool.idle} idle · max {db.pool.max}
          </span>
        </KV>
        <KV label="Size">
          {(db.sizeMb / 1024).toFixed(2)} GB · {db.tables} tables
        </KV>
        <KV label="Last backup" hint={dateTime(db.lastBackupAt)}>
          {relative(db.lastBackupAt)}
        </KV>
        <KV label="Schema">{inst.schemaVersion}</KV>
      </dl>
    </Card>
  )
}

function RuntimeCard({ inst }: { inst: InstallationInfo | undefined }) {
  if (!inst) return <CardSkeleton />
  const r = inst.runtime
  return (
    <Card>
      <CardHeader icon={<Container />} title="Containers" description={`ORVEX Core ${inst.version} · installed ${date(inst.installedAt)}`} />
      <ul className="divide-y divide-line px-5">
        {r.containers.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-mono text-[12.5px] text-fg">{c.name}</p>
              <p className="truncate font-mono text-[11px] text-fg-3">{c.image}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[11px] text-fg-3">{c.uptime}</span>
              <StatusBadge status={c.status === 'running' ? 'running' : c.status} label={c.status} />
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
        <div className="flex items-center gap-2 bg-surface px-5 py-3 text-[12px] text-fg-2">
          <Cpu className="size-3.5 text-fg-3" /> {r.cpuCores} vCPU · {num(r.memoryMb / 1024)} GB
        </div>
        <div className="flex items-center gap-2 bg-surface px-5 py-3 text-[12px] text-fg-2">
          <HardDrive className="size-3.5 text-fg-3" /> {inst.storage.usedGb} / {inst.storage.totalGb} GB
        </div>
      </div>
      <p className="px-5 py-3 text-[11.5px] text-fg-3">
        Node {r.node} · queue: {inst.queue.driver} · {inst.queue.workers} workers
      </p>
    </Card>
  )
}

function ExtensionsSummary({ inst }: { inst: InstallationInfo | undefined }) {
  if (!inst) return <CardSkeleton />
  const byKind = new Map<string, number>()
  for (const e of inst.extensions) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1)
  const custom = inst.extensions.filter((e) => e.source === 'custom').length
  const enabled = inst.extensions.filter((e) => e.status === 'enabled').length
  return (
    <Card>
      <CardHeader icon={<Puzzle />} title="Extensions" description={`${enabled} of ${inst.extensions.length} enabled · ${custom} custom`} />
      <ul className="divide-y divide-line px-5">
        {[...byKind.entries()].map(([kind, n]) => (
          <li key={kind} className="flex items-center justify-between py-2.5 text-[13px]">
            <span className="text-fg-2">{KIND_LABEL[kind as ExtensionKind] ?? kind}</span>
            <span className="font-mono text-fg tabular">{n}</span>
          </li>
        ))}
      </ul>
      <div className="px-5 py-3">
        <Link to="/admin/system/extensions" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-ink hover:underline">
          Manage extensions <ArrowUpRight className="size-3.5" />
        </Link>
        <p className="mt-1 text-[11.5px] text-fg-3">Core + configuration + extensions = this installation. No forks.</p>
      </div>
    </Card>
  )
}

function EnvCard({ inst }: { inst: InstallationInfo | undefined }) {
  if (!inst) return <CardSkeleton rows={6} />
  return (
    <Card>
      <CardHeader icon={<Variable />} title="Environment" description="From /opt/orvex/.env on the server. Secrets are masked and never returned in clear by the API." />
      <div className="overflow-x-auto px-5 pb-4">
        <table className="w-full min-w-[520px] text-[12.5px]">
          <tbody>
            {inst.env.map((e) => (
              <tr key={e.key} className="border-b border-line last:border-0">
                <td className="w-[220px] py-2.5 pr-4 font-mono text-fg">{e.key}</td>
                <td className="py-2.5 font-mono text-fg-2">
                  <span className="break-all">{e.value}</span>
                </td>
                <td className="w-[90px] py-2.5 text-right">{e.secret ? <Badge tone="neutral" variant="outline" icon={<Lock />}>secret</Badge> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
