import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Boxes, Container, Database, FileCode, HardDrive, Layers, Lock, PlugZap, RotateCcw, Server } from 'lucide-react'
import { Badge, Button, Card, CardHeader, ConfirmDialog, CopyButton, DataTable, DemoTag, DescriptionList, Meter, MonoValue, Skeleton, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { useInstallation, useInstMutation } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { bytes, date, dateTime, num, relative } from '@/lib/format'
import type { InstallationInfo } from '@/types/installation'
import { withMinDuration } from '../health/useNow'

const PG_PROVIDERS = ['Self-hosted', 'Supabase', 'Neon', 'AWS RDS', 'Hetzner', 'Google Cloud SQL', 'Azure Database']

export function SystemTab() {
  const installation = useInstallation()
  const d = installation.data
  if (!d) return <SystemSkeleton />
  return (
    <div className="space-y-5">
      <InstallationCard d={d} />
      <DatabaseCard d={d} />
      <div className="grid gap-5 xl:grid-cols-2">
        <HostingCard d={d} />
        <QueueStorageCard d={d} />
      </div>
      <ContainersCard d={d} />
      <EnvCard d={d} />
      <DemoControls />
    </div>
  )
}

function InstallationCard({ d }: { d: InstallationInfo }) {
  return (
    <Card>
      <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Fact label="Installation ID">
          <MonoValue value={d.installationId} className="text-[13px] text-fg" />
        </Fact>
        <Fact label="Name">{d.name}</Fact>
        <Fact label="Environment">
          <Badge tone={d.environment === 'production' ? 'success' : 'warning'} dot>
            {d.environment === 'production' ? 'Production' : 'Staging'}
          </Badge>
        </Fact>
        <Fact label="ORVEX Core">
          <span className="font-mono">{d.version}</span>
        </Fact>
        <Fact label="Schema version">
          <span className="font-mono">{d.schemaVersion}</span>
        </Fact>
        <Fact label="Installed">{date(d.installedAt)}</Fact>
      </div>
    </Card>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mono-label">{label}</div>
      <div className="mt-1 truncate text-[13.5px] text-fg">{children}</div>
    </div>
  )
}

function DatabaseCard({ d }: { d: InstallationInfo }) {
  const db = d.database
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ms: number; at: number } | null>(null)
  const url = d.env.find((e) => e.key === 'DATABASE_URL')?.value ?? `postgres://••••••:••••••@${db.hostMasked}/${db.name}?sslmode=${db.sslMode}`

  const test = async () => {
    setTesting(true)
    await withMinDuration(Promise.resolve(), 1100)
    const ms = +(db.latencyMs + Math.random() * 0.6 - 0.2).toFixed(1)
    setResult({ ms, at: Date.now() })
    setTesting(false)
    toast.success('Database connection OK', `PostgreSQL ${db.version} · ${ms} ms round-trip · TLS ${db.sslMode} · pool ${db.pool.active}/${db.pool.max}`)
  }

  const poolTotal = db.pool.max
  return (
    <Card>
      <CardHeader
        icon={<Database />}
        title={
          <span className="flex items-center gap-2">
            PostgreSQL <StatusBadge status={db.status} />
          </span>
        }
        description="Your own database — orders, IMEI results, reseller ledgers and configuration all live here."
        actions={
          <Button variant="secondary" size="sm" loading={testing} leading={<PlugZap />} onClick={test}>
            Test connection
          </Button>
        }
      />
      <div className="mx-5 mb-4 rounded-xl border border-line bg-surface-2/50 p-4">
        <p className="text-[13px] font-medium text-fg">Configuration-driven via DATABASE_URL — any PostgreSQL-compatible service.</p>
        <p className="mt-0.5 text-[12.5px] text-fg-2">Core never provisions or hosts your data. Point DATABASE_URL at any PostgreSQL 14 – 17 and restart.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PG_PROVIDERS.map((p) => (
            <span key={p} className={cn('inline-flex h-6 items-center rounded-md border px-2 text-[11.5px]', db.provider.toLowerCase().includes(p.toLowerCase().split(' ')[0]!) ? 'border-accent/40 bg-accent/10 text-accent-ink' : 'border-line bg-surface text-fg-2')}>
              {p}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-lg border border-line bg-bg-subtle px-3 py-2">
          <Lock className="size-3.5 shrink-0 text-fg-3" />
          <span className="shrink-0 font-mono text-[11.5px] text-fg-3">DATABASE_URL=</span>
          <span className="truncate font-mono text-[11.5px] text-fg-2">{url}</span>
        </div>
      </div>
      <div className="px-5 pb-5">
        <DescriptionList
          columns={2}
          items={[
            { label: 'Engine', value: `${db.engine} ${db.version}` },
            { label: 'Host', value: <Tooltip content="Masked — the host is part of DATABASE_URL and never exposed by the API.">{db.hostMasked}</Tooltip>, mono: true },
            { label: 'Database', value: db.name, mono: true },
            { label: 'Provider', value: db.provider },
            { label: 'SSL mode', value: db.sslMode, mono: true },
            { label: 'Latency', value: result ? `${result.ms} ms · tested ${relative(result.at)}` : `${db.latencyMs} ms` },
            { label: 'Size', value: bytes(db.sizeMb * 1024 * 1024) },
            { label: 'Tables', value: num(db.tables) },
            { label: 'Schema version', value: d.schemaVersion, mono: true },
            { label: 'Last backup', value: relative(db.lastBackupAt), hint: dateTime(db.lastBackupAt) },
          ]}
        />
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="text-fg-2">Connection pool</span>
            <span className="text-fg-3 tabular">
              <span className="text-fg">{db.pool.active}</span> active · {db.pool.idle} idle · {db.pool.max} max
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-hatch shadow-[inset_0_0_0_1px_var(--line)]">
            <motion.span className="h-full bg-accent-2/80" initial={{ width: 0 }} animate={{ width: `${(db.pool.active / poolTotal) * 100}%` }} transition={{ duration: 0.8 }} />
            <motion.span className="h-full bg-accent-2/25" initial={{ width: 0 }} animate={{ width: `${(db.pool.idle / poolTotal) * 100}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
          </div>
        </div>
      </div>
    </Card>
  )
}

function HostingCard({ d }: { d: InstallationInfo }) {
  const r = d.runtime
  return (
    <Card className="h-full">
      <CardHeader icon={<Server />} title="Hosting" description="Your server — ORVEX Systems has no access to it." />
      <div className="px-5 pb-5">
        <DescriptionList
          items={[
            { label: 'Platform', value: r.platform },
            { label: 'Runtime', value: `Node.js ${r.node}` },
            { label: 'Operating system', value: r.os },
            { label: 'Reverse proxy', value: r.proxy },
            { label: 'CPU', value: `${r.cpuCores} cores` },
            { label: 'Memory', value: `${num(r.memoryMb / 1024)} GB` },
          ]}
        />
      </div>
    </Card>
  )
}

function QueueStorageCard({ d }: { d: InstallationInfo }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<Boxes />} title="Queue & storage" description="Drivers selected through environment variables." />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex items-start gap-3 rounded-xl border border-line p-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-2">
            <Layers className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-fg-3">Queue driver</p>
            <p className="text-[13.5px] font-medium text-fg">{d.queue.driver}</p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              {d.queue.workers} workers · unlock and server jobs live in your PostgreSQL — no extra infrastructure
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-line p-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-2">
            <HardDrive className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-fg-3">Storage driver</p>
            <p className="text-[13.5px] font-medium text-fg">{d.storage.driver}</p>
            <Meter className="mt-2.5" label="Used" value={d.storage.usedGb} max={d.storage.totalGb} unit=" GB" />
          </div>
        </div>
      </div>
    </Card>
  )
}

function ContainersCard({ d }: { d: InstallationInfo }) {
  type C = InstallationInfo['runtime']['containers'][number]
  const columns: Column<C>[] = [
    {
      key: 'name',
      header: 'Container',
      cell: (c) => (
        <span className="flex items-center gap-2 font-mono text-[12.5px] text-fg">
          <Container className="size-3.5 text-fg-3" />
          {c.name}
        </span>
      ),
    },
    { key: 'image', header: 'Image', cell: (c) => <span className="font-mono text-[12px] text-fg-2">{c.image}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => (
        <Badge tone={c.status === 'running' ? 'success' : c.status === 'restarting' ? 'warning' : 'danger'} dot pulse={c.status === 'running'}>
          {c.status === 'running' ? 'Running' : c.status === 'restarting' ? 'Restarting' : 'Stopped'}
        </Badge>
      ),
    },
    { key: 'uptime', header: 'Uptime', align: 'right', cell: (c) => <span className="font-mono text-[12px] text-fg-2">{c.uptime}</span> },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<Container />} title="Containers" description={`${d.runtime.platform} · docker-compose.yml in /opt/orvex`} />
      <DataTable columns={columns} rows={d.runtime.containers} rowKey={(c) => c.name} dense minWidth={560} />
    </Card>
  )
}

function EnvCard({ d }: { d: InstallationInfo }) {
  type E = InstallationInfo['env'][number]
  const secrets = d.env.filter((e) => e.secret).length
  const columns: Column<E>[] = [
    { key: 'key', header: 'Variable', width: 'w-[240px]', cell: (e) => <span className="font-mono text-[12px] font-medium text-fg">{e.key}</span> },
    {
      key: 'value',
      header: 'Value',
      cell: (e) =>
        e.secret ? (
          <span className="flex min-w-0 items-center gap-2">
            <Lock className="size-3.5 shrink-0 text-fg-3" />
            <span className="truncate font-mono text-[12px] tracking-wide text-fg-3">{e.value}</span>
            <Badge tone="neutral" variant="outline">
              secret
            </Badge>
          </span>
        ) : (
          <span className="group flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-[12px] text-fg-2">{e.value}</span>
            <CopyButton value={e.value} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
        ),
    },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<FileCode />}
        title="Environment"
        description={`${d.env.length} variables · ${secrets} secrets masked`}
        actions={
          <Badge tone="neutral" variant="outline">
            read-only
          </Badge>
        }
      />
      <div className="mx-5 mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-fg-3">
        Configuration comes from the environment (<span className="font-mono text-fg-2">.env</span> file / docker compose). Edit it on the server and restart the containers — secret values are never displayed or returned by the API.
      </div>
      <DataTable columns={columns} rows={d.env} rowKey={(e) => e.key} dense minWidth={560} />
    </Card>
  )
}

function DemoControls() {
  const [open, setOpen] = useState(false)
  const reset = useInstMutation(() => systemService.resetDemo(), {
    success: 'Demo data reset',
    onSuccess: () => setOpen(false),
  })
  return (
    <Card className="border-dashed">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
            Prototype controls <DemoTag />
          </p>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Restore the seeded demo state — ORVEX Core 2.4.1 with the 2.5.0 update pending, the GSM demo catalog, suppliers, resellers, users and settings.</p>
        </div>
        <Button variant="secondary" leading={<RotateCcw />} onClick={() => setOpen(true)}>
          Reset demo data
        </Button>
      </div>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => reset.mutate()} loading={reset.isPending} title="Reset demo data?" description="All changes made in this session — orders, reseller balances, settings, users and the simulated update — are replaced by the original seed." confirmLabel="Reset" tone="danger" />
    </Card>
  )
}

function SystemSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[88px] rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
    </div>
  )
}

