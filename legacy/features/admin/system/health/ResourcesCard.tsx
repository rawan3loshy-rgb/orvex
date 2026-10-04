import { Cpu, Database, HardDrive, MemoryStick } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardHeader, ProgressRing, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import type { HealthSnapshot, InstallationInfo } from '@/types/installation'
import { resourceTone } from './meta'

interface Res {
  key: string
  label: string
  icon: LucideIcon
  ratio: number
  value: string
  detail: string
}

export function ResourcesCard({ data, installation }: { data: HealthSnapshot | undefined; installation: InstallationInfo | undefined }) {
  const m = data?.metrics
  const items: Res[] = m
    ? [
        { key: 'cpu', label: 'CPU', icon: Cpu, ratio: m.cpu / 100, value: `${m.cpu.toFixed(0)}%`, detail: `across ${installation?.runtime.cpuCores ?? 8} vCPU` },
        { key: 'mem', label: 'Memory', icon: MemoryStick, ratio: m.memory.usedMb / m.memory.totalMb, value: `${(m.memory.usedMb / 1024).toFixed(1)} GB`, detail: `of ${num(m.memory.totalMb / 1024)} GB` },
        { key: 'disk', label: 'Disk', icon: HardDrive, ratio: m.disk.usedGb / m.disk.totalGb, value: `${m.disk.usedGb.toFixed(1)} GB`, detail: `of ${num(m.disk.totalGb)} GB · ${num(m.disk.totalGb - m.disk.usedGb)} GB free` },
        { key: 'db', label: 'DB connections', icon: Database, ratio: m.dbConnections.active / m.dbConnections.max, value: `${m.dbConnections.active}`, detail: `of ${m.dbConnections.max} pool max` },
      ]
    : []

  return (
    <Card>
      <CardHeader title="Resources" description={installation ? `${installation.runtime.platform} · ${installation.runtime.os}` : 'Host and database utilisation'} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl border-t border-line bg-line">
        {m
          ? items.map((r) => {
              const tone = resourceTone(r.ratio)
              return (
                <div key={r.key} className="flex items-center gap-3.5 bg-surface p-4 transition-colors hover:bg-surface-2/60">
                  <ProgressRing value={Math.max(2, r.ratio * 100)} size={52} stroke={4.5} tone={tone}>
                    <span className={cn('text-[11px]', tone === 'neutral' ? 'text-fg' : tone === 'warning' ? 'text-warning' : 'text-danger')}>{Math.round(r.ratio * 100)}%</span>
                  </ProgressRing>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12px] text-fg-3 [&_svg]:size-3.5">
                      <r.icon />
                      {r.label}
                    </div>
                    <div className="mt-0.5 font-display text-[17px] leading-tight font-semibold tracking-[-0.01em] text-fg tabular">{r.value}</div>
                    <div className="truncate text-[11.5px] text-fg-3">{r.detail}</div>
                  </div>
                </div>
              )
            })
          : Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3.5 bg-surface p-4">
                <Skeleton className="size-[52px] rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
      </div>
    </Card>
  )
}
