import { Info } from 'lucide-react'
import { Avatar, Badge, Card, CardHeader, DataTable, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { LogoMark } from '@/components/brand'
import { date, duration, time } from '@/lib/format'
import type { AdminUser, UpdateCenterState } from '@/types/installation'
import type { Release } from '@/types/release'
import { byLabel } from './lib'

type Row = UpdateCenterState['history'][number]

export function HistoryCard({ data, users, onNotes }: { data: UpdateCenterState | undefined; users: AdminUser[]; onNotes: (r: Release) => void }) {
  const releases = data?.releases ?? []
  const colorOf = (name: string) => users.find((u) => u.name === name)?.color
  const latestSuccess = data?.history.filter((h) => h.status === 'success').sort((a, b) => +new Date(b.installedAt) - +new Date(a.installedAt))[0]

  const columns: Column<Row>[] = [
    {
      key: 'version',
      header: 'Version',
      sortValue: (r) => r.version,
      cell: (r) => {
        const rel = releases.find((x) => x.version === r.version)
        return (
          <div className="flex items-center gap-2">
            {rel ? (
              <button type="button" onClick={() => onNotes(rel)} className="font-mono text-[12.5px] font-medium text-fg hover:text-accent-ink hover:underline">
                {r.version}
              </button>
            ) : (
              <span className="font-mono text-[12.5px] font-medium text-fg">{r.version}</span>
            )}
            {r === latestSuccess && r.version === data?.currentVersion && <Badge tone="neutral" variant="outline">Running</Badge>}
          </div>
        )
      },
    },
    {
      key: 'title',
      header: 'Release',
      hideBelow: 'lg',
      cell: (r) => <span className="text-fg-2">{releases.find((x) => x.version === r.version)?.title ?? '—'}</span>,
    },
    {
      key: 'installed',
      header: 'Installed',
      sortValue: (r) => +new Date(r.installedAt),
      cell: (r) => (
        <span className="tabular text-fg-2">
          {date(r.installedAt)} <span className="text-fg-3">{time(r.installedAt)}</span>
        </span>
      ),
    },
    { key: 'duration', header: 'Duration', align: 'right', sortValue: (r) => r.durationSec, cell: (r) => <span className="font-mono text-[12px] text-fg-2">{duration(r.durationSec)}</span> },
    {
      key: 'by',
      header: 'By',
      hideBelow: 'md',
      cell: (r) => (
        <span className="flex items-center gap-2 text-fg-2">
          {r.by.startsWith('ORVEX') ? <LogoMark className="size-5" /> : <Avatar name={r.by} color={colorOf(r.by)} size="xs" />}
          <span className="truncate">{byLabel(r.by)}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) =>
        r.status === 'rolled_back' ? (
          <Tooltip content={`Post-update health check failed — Core restored ${r.backupId} and the previous images automatically. No data was lost.`}>
            <span className="inline-flex items-center gap-1">
              <StatusBadge status="rolled_back" />
              <Info className="size-3.5 text-fg-3" />
            </span>
          </Tooltip>
        ) : (
          <StatusBadge status="success" label="Installed" />
        ),
    },
    { key: 'backup', header: 'Backup', hideBelow: 'sm', cell: (r) => <span className="font-mono text-[11.5px] text-fg-3">{r.backupId}</span> },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Update history" description="Every ORVEX Core update on this installation, with the backup taken before it." />
      <DataTable columns={columns} rows={data?.history} rowKey={(r) => `${r.version}-${r.installedAt}`} loading={!data} skeletonRows={5} defaultSort={{ key: 'installed', dir: 'desc' }} minWidth={560} rowClassName={(r) => (r.status === 'rolled_back' ? 'bg-warning/[0.03]' : undefined)} />
    </Card>
  )
}
