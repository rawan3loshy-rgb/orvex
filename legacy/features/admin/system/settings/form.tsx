import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Card, CardHeader, Dot, Kbd, Skeleton } from '@/components/ui'
import { INST, useInstMutation, useSettings } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { cn } from '@/lib/cn'
import type { InstallationSettings } from '@/types/installation'

/* ------------------------------------------------------------------ */
/*  Dirty-state context (lets the page guard tab switches)             */
/* ------------------------------------------------------------------ */
export const DirtyContext = createContext<(dirty: boolean) => void>(() => undefined)

function useReportDirty(dirty: boolean) {
  const report = useContext(DirtyContext)
  useEffect(() => {
    report(dirty)
    return () => report(false)
  }, [dirty, report])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
}

/* ------------------------------------------------------------------ */
/*  Section form: draft over server state, diff, save, discard         */
/* ------------------------------------------------------------------ */
type Section = keyof InstallationSettings

export function useSectionForm<K extends Section>(section: K, label: string) {
  const settings = useSettings()
  const qc = useQueryClient()
  const server = settings.data?.[section] as InstallationSettings[K] | undefined
  const [draft, setDraft] = useState<InstallationSettings[K] | null>(null)
  const values = (draft ?? server) as InstallationSettings[K] | undefined

  const changed = useMemo(() => {
    if (!draft || !server) return [] as (keyof InstallationSettings[K])[]
    return (Object.keys(draft) as (keyof InstallationSettings[K])[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(server[k]))
  }, [draft, server])
  const dirty = changed.length > 0

  const mutation = useInstMutation((body: Partial<InstallationSettings[K]>) => systemService.updateSettings(section, body), {
    success: `${label} settings saved`,
    onSuccess: (next) => {
      // Seed the cache with the saved settings so the form never flashes stale values.
      qc.setQueryData([INST, 'settings'], next)
      setDraft(null)
    },
  })

  useReportDirty(dirty)

  const set = <F extends keyof InstallationSettings[K]>(field: F, value: InstallationSettings[K][F]) => {
    setDraft((prev) => {
      const base = (prev ?? server) as InstallationSettings[K]
      return { ...base, [field]: value } as InstallationSettings[K]
    })
  }

  const save = () => {
    if (!draft || !dirty) return
    const body = Object.fromEntries(changed.map((k) => [k, draft[k]])) as Partial<InstallationSettings[K]>
    mutation.mutate(body)
  }

  return {
    values,
    set,
    dirty,
    changed,
    isChanged: (k: keyof InstallationSettings[K]) => changed.includes(k),
    discard: () => setDraft(null),
    save,
    saving: mutation.isPending,
    loading: settings.isLoading,
    error: settings.isError,
  }
}

/* ------------------------------------------------------------------ */
/*  Layout primitives                                                  */
/* ------------------------------------------------------------------ */
export function SettingsCard({ title, description, icon, actions, children, className, footer }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; footer?: ReactNode }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} icon={icon} actions={actions} className="pb-4" />
      <div className="border-t border-line">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-line bg-surface-2/40 px-5 py-3 text-[12.5px] text-fg-3">{footer}</div>}
    </Card>
  )
}

export function SettingRow({ label, description, children, changed, htmlFor, className }: { label: ReactNode; description?: ReactNode; children: ReactNode; changed?: boolean; htmlFor?: string; className?: string }) {
  return (
    <div className={cn('grid gap-2.5 border-t border-line px-5 py-4 first:border-t-0 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-8', className)}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="flex items-center gap-2 text-[13px] font-medium text-fg">
          {label}
          <AnimatePresence>
            {changed && (
              <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="inline-flex items-center gap-1 text-[11px] font-normal text-warning">
                <Dot tone="warning" /> Modified
              </motion.span>
            )}
          </AnimatePresence>
        </label>
        {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{description}</p>}
      </div>
      <div className="min-w-0 md:pt-0.5">{children}</div>
    </div>
  )
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <div className="space-y-2 px-5 pt-5 pb-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-3 border-t border-line px-5 py-4 md:grid-cols-[260px_1fr] md:gap-8">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
      ))}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Sticky unsaved-changes bar                                         */
/* ------------------------------------------------------------------ */
export function SaveBar({ dirty, count, saving, invalid, onDiscard, onSave }: { dirty: boolean; count: number; saving: boolean; invalid?: boolean; onDiscard: () => void; onSave: () => void }) {
  useEffect(() => {
    if (!dirty) return
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!invalid && !saving) onSave()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [dirty, invalid, saving, onSave])

  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          className="sticky bottom-4 z-20 mt-5"
        >
          <div className="glass flex items-center justify-between gap-3 rounded-xl border border-line-strong py-2.5 pr-2.5 pl-4 shadow-pop">
            <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
              <Dot tone="warning" pulse />
              <span className="font-medium text-fg">Unsaved changes</span>
              <span className="hidden truncate text-fg-3 sm:inline">
                · {count} {count === 1 ? 'field' : 'fields'} changed{invalid ? ' · fix errors to save' : ''}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
                Discard
              </Button>
              <Button variant="primary" size="sm" loading={saving} disabled={invalid} onClick={onSave}>
                Save
                <Kbd className="ml-1 hidden border-transparent bg-bg/15 text-bg/80 md:inline-flex">⌘S</Kbd>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Small helper: number input that keeps numeric state. */
export function toInt(v: string, fallback = 0) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const URL_RE = /^https:\/\/[^\s/$.?#].[^\s]*$/i
