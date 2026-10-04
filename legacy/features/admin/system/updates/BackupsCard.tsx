import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DatabaseBackup, HardDrive, Plus } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CopyButton, EmptyState, Skeleton } from '@/components/ui'
import { bytes, dateTime, relative } from '@/lib/format'
import { toast } from '@/stores/toast'
import type { InstallationInfo, UpdateCenterState } from '@/types/installation'
import type { Tone } from '@/types/common'
import { withMinDuration } from '../health/useNow'

type Backup = UpdateCenterState['backups'][number]

const KIND: Record<Backup['kind'], { label: string; tone: Tone }> = {
  'pre-update': { label: 'Pre-update · rollback point', tone: 'info' },
  scheduled: { label: 'Nightly', tone: 'neutral' },
  manual: { label: 'Manual', tone: 'neutral' },
}

export function BackupsCard({ data, installation }: { data: UpdateCenterState | undefined; installation: InstallationInfo | undefined }) {
  const [local, setLocal] = useState<Backup[]>([])
  const [creating, setCreating] = useState(false)
  const list = data ? [...local, ...data.backups] : undefined
  const storage = installation?.storage.driver ?? 'installation storage'

  const create = async () => {
    setCreating(true)
    const now = new Date()
    const id = `bkp_manual_${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    await withMinDuration(Promise.resolve(), 1800)
    const b: Backup = { id, createdAt: now.toISOString(), sizeMb: 1_293, version: data?.currentVersion ?? '—', kind: 'manual' }
    setLocal((l) => [b, ...l])
    setCreating(false)
    toast.success('Backup created', `${id} · ${bytes(b.sizeMb * 1024 * 1024)} · stored on ${storage}`)
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader
        icon={<DatabaseBackup />}
        title="Backups"
        description={`Orders, results, reseller ledgers and configuration · nightly at 02:00 · 14 kept · ${storage}`}
        actions={
          <Button variant="secondary" size="sm" loading={creating} leading={<Plus />} onClick={create}>
            <span className="hidden sm:inline">Create backup now</span>
            <span className="sm:hidden">Backup</span>
          </Button>
        }
      />
      {!list ? (
        <div className="space-y-3 px-5 pb-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState compact icon={<HardDrive />} title="No backups yet" description="A backup is always created before an update." />
      ) : (
        <ul className="border-t border-line">
          <AnimatePresence initial={false}>
            {creating && (
              <motion.li key="creating" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-line bg-accent/[0.04]">
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent-ink">
                    <DatabaseBackup className="size-4 animate-pulse" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fg">Creating backup…</p>
                    <p className="font-mono text-[11.5px] text-fg-3">pg_dump {installation?.database.name ?? 'service_platform'} · streaming to {storage}</p>
                  </div>
                </div>
              </motion.li>
            )}
            {list.map((b) => (
              <motion.li key={b.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="group flex items-center gap-3 border-b border-line px-5 py-3 transition-colors last:border-b-0 hover:bg-surface-2/60">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-3">
                  <HardDrive className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono text-[12.5px] text-fg">{b.id}</span>
                    <Badge tone={KIND[b.kind].tone}>{KIND[b.kind].label}</Badge>
                  </div>
                  <p className="mt-0.5 text-[12px] text-fg-3">
                    {dateTime(b.createdAt)} · {relative(b.createdAt)} · Core {b.version}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[12px] text-fg-2 tabular">{bytes(b.sizeMb * 1024 * 1024)}</span>
                <CopyButton value={`docker compose exec core-api orvex backup restore ${b.id}`} label="Copy restore command" className="opacity-60 group-hover:opacity-100" />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}
