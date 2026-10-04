import { ChevronRight, Radio } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date } from '@/lib/format'
import type { UpdateCenterState } from '@/types/installation'
import type { Release } from '@/types/release'
import { compareVersions } from './lib'

export function ReleasesCard({ data, onNotes }: { data: UpdateCenterState | undefined; onNotes: (r: Release) => void }) {
  const list = (data?.releases ?? [])
    .filter((r) => r.channel === 'stable' || data?.channel === 'beta')
    .slice()
    .sort((a, b) => compareVersions(b.version, a.version) || +new Date(b.releasedAt) - +new Date(a.releasedAt))
    .slice(0, 6)

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader
        icon={<Radio />}
        title="Releases"
        description={data ? `Following the ${data.channel} channel` : 'Loading…'}
        actions={
          <Button variant="ghost" size="sm" to="/admin/settings?tab=updates">
            Channel
          </Button>
        }
      />
      <ul className="border-t border-line">
        {!data
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} className="px-5 py-3">
                <Skeleton className="h-4 w-2/3" />
              </li>
            ))
          : list.map((r) => {
              const installed = r.version === data.currentVersion
              const available = r.version === data.available?.version
              const newer = compareVersions(r.version, data.currentVersion) > 0
              return (
                <li key={r.version} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => onNotes(r)} className="group flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-2/60">
                    <span className={cn('w-[92px] shrink-0 font-mono text-[12.5px]', newer || installed ? 'font-medium text-fg' : 'text-fg-2')}>{r.version}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-fg">{r.title}</p>
                      <p className="text-[11.5px] text-fg-3">{date(r.releasedAt)}</p>
                    </div>
                    {installed && <Badge tone="success">Installed</Badge>}
                    {available && <Badge tone="accent">Available</Badge>}
                    {r.channel === 'beta' && <Badge tone="warning">Beta</Badge>}
                    <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </li>
              )
            })}
      </ul>
      {data?.channel === 'beta' && (
        <p className="border-t border-line px-5 py-3 text-[12px] text-fg-3">Beta builds are offered for staging installations only — this production installation installs stable releases.</p>
      )}
    </Card>
  )
}
