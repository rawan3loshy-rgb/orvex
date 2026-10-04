import { useEffect, useState } from 'react'
import { CloudDownload, RefreshCw } from 'lucide-react'
import { Badge, Button, PageHeader, Tooltip } from '@/components/ui'
import { useInstallation, useInstMutation, useOrderStats, useUpdates, useUsers } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { relative } from '@/lib/format'
import type { Release } from '@/types/release'
import { useNow, withMinDuration } from './health/useNow'
import { UpdateHero } from './updates/UpdateHero'
import { PreflightCard } from './updates/PreflightCard'
import { HowItWorks } from './updates/HowItWorks'
import { HistoryCard } from './updates/HistoryCard'
import { BackupsCard } from './updates/BackupsCard'
import { ReleasesCard } from './updates/ReleasesCard'
import { ReleaseNotesDrawer } from './updates/ReleaseNotesDrawer'
import { UpdateRunModal } from './updates/UpdateRunModal'
import { useUpdateRun } from './updates/store'
import type { RunParams } from './updates/steps'
import { maintainerOf } from './extensions/meta'

export default function UpdatesPage() {
  const updates = useUpdates()
  const installation = useInstallation()
  const users = useUsers()
  const orderStats = useOrderStats()
  const [notes, setNotes] = useState<Release | null>(null)
  useNow(30_000)
  const openConfirm = useUpdateRun((s) => s.openConfirm)
  const runStatus = useUpdateRun((s) => s.status)

  const data = updates.data

  const check = useInstMutation(() => withMinDuration(systemService.checkUpdates(), 900), {
    success: (d) => (d.available ? `ORVEX Core ${d.available.version} is available` : `ORVEX Core ${d.currentVersion} is up to date`),
  })

  /* Commit the simulated run once its health check has passed (exactly once). */
  const commit = useInstMutation((v: { version: string; durationSec: number }) => systemService.completeUpdate(v.version, v.durationSec), {
    success: (d) => `Update complete — ORVEX Core ${d.currentVersion} is live`,
    onSuccess: () => useUpdateRun.getState().finish(),
    onError: (e) => useUpdateRun.getState().fail(e.message),
  })
  useEffect(() => {
    if (runStatus !== 'committing') return
    const s = useUpdateRun.getState()
    if (s.params && s.claimCommit()) commit.mutate({ version: s.params.to, durationSec: s.durationSec })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus])

  const incompatible = (installation.data?.extensions ?? [])
    .filter((e) => !e.compatibleWithNext && e.status !== 'disabled')
    .map((e) => ({ id: e.id, name: e.name, coreRange: e.coreRange, author: maintainerOf(e.author) }))

  const prepare = (): RunParams | null => {
    if (!data?.available) return null
    const inst = installation.data
    return {
      from: data.currentVersion,
      to: data.available.version,
      schemaFrom: data.schemaVersion,
      release: data.available,
      dbName: inst?.database.name ?? 'service_platform',
      containers: inst?.runtime.containers.map((c) => c.name) ?? ['core-api', 'core-worker', 'core-scheduler'],
      incompatible,
      preflight: { total: data.preflight.length, pass: data.preflight.filter((p) => p.status === 'pass').length, warn: data.preflight.filter((p) => p.status === 'warn').length },
      backupSizeGb: 1.29,
      awaitingCallbacks: (orderStats.data?.processing ?? 0) + (orderStats.data?.pending ?? 0),
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CloudDownload />}
        title="Updates"
        description="Signed ORVEX Core releases from ORVEX Systems. Every update is backed up, verified, migrated and health-checked on your server — orders keep queueing throughout."
        actions={
          <>
            {data && <span className="hidden text-[12.5px] text-fg-3 md:inline">Checked {relative(data.lastCheckedAt)}</span>}
            {data && (
              <Tooltip content={`Releases are fetched from releases.orvex.io and verified on this server. Last checked ${relative(data.lastCheckedAt)}.`}>
                <Badge tone={data.channel === 'stable' ? 'success' : 'warning'} dot size="md">
                  {data.channel === 'stable' ? 'Stable' : 'Beta'} channel
                </Badge>
              </Tooltip>
            )}
            <Button variant="secondary" loading={check.isPending} leading={<RefreshCw />} onClick={() => check.mutate()}>
              Check for updates
            </Button>
          </>
        }
      />

      <UpdateHero data={data} checking={check.isPending} onCheck={() => check.mutate()} onUpdate={openConfirm} onNotes={setNotes} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PreflightCard data={data} incompatible={incompatible} onRerun={() => updates.refetch()} />
        </div>
        <div className="lg:col-span-2">
          <HowItWorks />
        </div>
      </div>

      <HistoryCard data={data} users={users.data ?? []} onNotes={setNotes} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BackupsCard data={data} installation={installation.data} />
        </div>
        <div className="lg:col-span-2">
          <ReleasesCard data={data} onNotes={setNotes} />
        </div>
      </div>

      <ReleaseNotesDrawer
        release={notes}
        currentVersion={data?.currentVersion}
        onClose={() => setNotes(null)}
        onInstall={
          notes && data?.available?.version === notes.version
            ? () => {
                setNotes(null)
                openConfirm()
              }
            : undefined
        }
      />
      <UpdateRunModal prepare={prepare} onViewNotes={setNotes} />
    </div>
  )
}
