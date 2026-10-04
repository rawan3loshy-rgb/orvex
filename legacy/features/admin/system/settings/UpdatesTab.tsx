import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { ArrowRight, CloudDownload, Lock, Radio, TriangleAlert } from 'lucide-react'
import { Badge, Button, Segmented, Select, Switch } from '@/components/ui'
import { useInstMutation, useSettings, useUpdates } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { toast } from '@/stores/toast'
import { relative } from '@/lib/format'
import { FormSkeleton, SettingRow, SettingsCard } from './form'

/**
 * Update preferences that the installation API doesn't model yet
 * (auto-check, maintenance window) are kept per browser for the prototype.
 */
interface UpdatePrefs {
  autoCheck: boolean
  window: string
  set: (p: Partial<Pick<UpdatePrefs, 'autoCheck' | 'window'>>) => void
}
const useUpdatePrefs = create<UpdatePrefs>()(
  persist((set) => ({ autoCheck: true, window: 'daily-0200', set: (p) => set(p) }), {
    name: 'orvex.update-prefs',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ autoCheck: s.autoCheck, window: s.window }),
  }),
)

const WINDOWS = [
  { value: 'none', label: 'Any time (manual updates only)' },
  { value: 'daily-0200', label: 'Daily · 02:00 – 04:00' },
  { value: 'sun-0100', label: 'Sundays · 01:00 – 05:00' },
  { value: 'sat-2200', label: 'Saturdays · 22:00 – 02:00' },
]

export function UpdatesTab() {
  const updates = useUpdates()
  const settings = useSettings()
  const prefs = useUpdatePrefs()
  const channel = useInstMutation((c: 'stable' | 'beta') => systemService.setUpdateChannel(c), {
    success: (d) => `Update channel set to ${d.channel}`,
  })
  const data = updates.data
  if (!data) return <FormSkeleton rows={4} />
  const tz = settings.data?.general.timezone ?? 'UTC'
  const current = channel.isPending ? (channel.variables ?? data.channel) : data.channel

  const savePref = (p: Partial<Pick<UpdatePrefs, 'autoCheck' | 'window'>>) => {
    prefs.set(p)
    toast.success('Update preferences saved')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
            <CloudDownload className="size-4" />
          </span>
          <div>
            <p className="text-[13.5px] font-medium text-fg">
              ORVEX Core <span className="font-mono">{data.currentVersion}</span>
              {data.available ? (
                <Badge tone="accent" dot className="ml-2">
                  {data.available.version} available
                </Badge>
              ) : (
                <Badge tone="success" dot className="ml-2">
                  Up to date
                </Badge>
              )}
            </p>
            <p className="text-[12px] text-fg-3">Schema {data.schemaVersion} · last checked {relative(data.lastCheckedAt)}</p>
          </div>
        </div>
        <Button variant="secondary" to="/admin/system/updates" trailing={<ArrowRight />}>
          Open Update Center
        </Button>
      </div>

      <SettingsCard icon={<Radio />} title="Release channel" description="Which signed ORVEX Core releases this installation is offered.">
        <SettingRow label="Channel" description="Stable is recommended for production. Beta builds preview the next minor version.">
          <div className="space-y-2.5">
            <Segmented
              size="md"
              value={current}
              onChange={(c) => c !== data.channel && channel.mutate(c)}
              items={[
                { value: 'stable', label: 'Stable' },
                { value: 'beta', label: 'Beta' },
              ]}
            />
            {current === 'beta' && (
              <p className="flex items-start gap-2 text-[12.5px] text-warning">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                This is a production installation — beta releases are listed for review but should be installed on a staging installation first.
              </p>
            )}
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Checks & maintenance" description="How and when updates are prepared. Updates are never installed without an admin starting them.">
        <SettingRow label="Check automatically" description="Query releases.orvex.io once a day and notify admins when a release is available.">
          <div className="flex items-center gap-3">
            <Switch checked={prefs.autoCheck} onChange={(v) => savePref({ autoCheck: v })} label="Check automatically" />
            <span className="text-[12.5px] text-fg-2">{prefs.autoCheck ? 'Daily at 03:00' : 'Manual checks only'}</span>
          </div>
        </SettingRow>
        <SettingRow label="Maintenance window" description={`Preferred time for updates and the ~20 s Reseller API write pause — pick your quietest hour for orders. Times in ${tz}.`}>
          <Select value={prefs.window} onChange={(e) => savePref({ window: e.target.value })} options={WINDOWS} className="max-w-xs" />
        </SettingRow>
        <SettingRow label="Pre-update backup" description="A full pg_dump — orders, results, reseller ledgers — and a configuration snapshot are taken before every update and kept as the rollback point.">
          <div className="flex items-center gap-3">
            <Switch checked onChange={() => toast.info('Backups are mandatory', 'Every update starts with a verified backup so it can roll back automatically.')} disabled label="Pre-update backup" />
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
              <Lock className="size-3.5 text-fg-3" /> Always required
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Automatic rollback" description="If the post-update health check fails, the backup and previous images are restored.">
          <Badge tone="success" dot>
            Enabled
          </Badge>
        </SettingRow>
      </SettingsCard>
    </div>
  )
}
