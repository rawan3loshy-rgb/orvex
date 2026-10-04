import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button, Card, CardHeader, Dot, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'

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

export function SaveBar({ dirty, count, saving, invalid, canSave, onDiscard, onSave }: { dirty: boolean; count: number; saving: boolean; invalid?: boolean; canSave: boolean; onDiscard: () => void; onSave: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ type: 'spring', stiffness: 460, damping: 36 }} className="sticky bottom-4 z-20 mt-5">
          <div className="glass flex items-center justify-between gap-3 rounded-xl border border-line-strong py-2.5 pr-2.5 pl-4 shadow-pop">
            <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
              <Dot tone="warning" pulse />
              <span className="font-medium text-fg">Unsaved changes</span>
              <span className="hidden truncate text-fg-3 sm:inline">
                · {count} {count === 1 ? 'field' : 'fields'} changed{invalid ? ' · fix errors to save' : ''}
                {!canSave ? ' · your role cannot save (System administration)' : ''}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
                Discard
              </Button>
              <Button variant="primary" size="sm" loading={saving} disabled={invalid || !canSave} onClick={onSave}>
                Save
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
