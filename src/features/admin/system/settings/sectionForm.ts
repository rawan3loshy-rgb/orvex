/** Settings form state (draft over server state) and the field parsers/validators the settings screens share. */
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCan } from '@/components/domain'
import { INST, useInstMutation, useSettings } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import type { InstallationSettings } from '@/types/installation'

type Section = keyof InstallationSettings

/** Draft over server state for one settings section: diff, save (only changed fields), discard. */
export function useSectionForm<K extends Section>(section: K, label: string) {
  const settings = useSettings()
  const qc = useQueryClient()
  const server = settings.data?.[section] as InstallationSettings[K] | undefined
  const [draft, setDraft] = useState<InstallationSettings[K] | null>(null)
  const values = (draft ?? server) as InstallationSettings[K] | undefined
  const canEdit = useCan('system.manage')

  const changed = useMemo(() => {
    if (!draft || !server) return [] as (keyof InstallationSettings[K])[]
    return (Object.keys(draft) as (keyof InstallationSettings[K])[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(server[k]))
  }, [draft, server])
  const dirty = changed.length > 0

  const mutation = useInstMutation((body: Partial<InstallationSettings[K]>) => systemService.updateSettings(section, body), {
    success: `${label} settings saved`,
    onSuccess: (next) => {
      qc.setQueryData([INST, 'settings'], next)
      setDraft(null)
    },
  })

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const set = <F extends keyof InstallationSettings[K]>(field: F, value: InstallationSettings[K][F]) => {
    setDraft((prev) => ({ ...((prev ?? server) as InstallationSettings[K]), [field]: value }) as InstallationSettings[K])
  }

  const save = () => {
    if (!draft || !dirty) return
    mutation.mutate(Object.fromEntries(changed.map((k) => [k, draft[k]])) as Partial<InstallationSettings[K]>)
  }

  return {
    values,
    set,
    dirty,
    changed,
    canEdit,
    isChanged: (k: keyof InstallationSettings[K]) => changed.includes(k),
    discard: () => setDraft(null),
    save,
    saving: mutation.isPending,
    loading: settings.isLoading,
    error: settings.isError,
    retry: () => settings.refetch(),
  }
}

export function toInt(v: string, fallback = 0) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const URL_RE = /^https:\/\/[^\s/$.?#].[^\s]*$/i
