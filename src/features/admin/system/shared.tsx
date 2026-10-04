/**
 * Shared helpers for the System area (health, updates, license, installation,
 * extensions, settings, notifications, audit, roles, security).
 * Local to this feature folder — not part of the shared component kit.
 * Non-component helpers (hooks, health labels, formatting) live in `./helpers`.
 */
import type { ReactNode } from 'react'
import { CircleAlert, FlaskConical, RefreshCw } from 'lucide-react'
import { Button, Card, EmptyState, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types/installation'

const CALLOUT: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2/50',
  accent: 'border-accent/30 bg-accent/[0.05]',
  info: 'border-info/30 bg-info/[0.06]',
  success: 'border-success/30 bg-success/[0.06]',
  warning: 'border-warning/35 bg-warning/[0.07]',
  danger: 'border-danger/30 bg-danger/[0.06]',
}
const CALLOUT_ICON: Record<Tone, string> = {
  neutral: 'text-fg-3',
  accent: 'text-accent-ink',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

/** Inline banner for explanations and warnings. */
export function Callout({ tone = 'neutral', icon, title, children, action, className }: { tone?: Tone; icon?: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start', CALLOUT[tone], className)}>
      {icon && <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', CALLOUT_ICON[tone])}>{icon}</span>}
      <div className="min-w-0 flex-1 text-[13px]">
        {title && <p className="font-medium text-fg">{title}</p>}
        {children && <div className={cn('text-fg-2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** "Prototype representation" marker for screens that describe controls the prototype does not enforce. */
export function PrototypeNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border border-dashed border-line-strong bg-bg-subtle/60 px-4 py-3 text-[12.5px] text-fg-3', className)}>
      <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function QueryError({ title = 'Could not load this data', onRetry, className }: { title?: string; onRetry?: () => void; className?: string }) {
  return (
    <Card className={className}>
      <EmptyState
        icon={<CircleAlert />}
        title={title}
        description="The installation API did not answer. This is usually temporary."
        action={
          onRetry && (
            <Button variant="secondary" size="sm" leading={<RefreshCw />} onClick={onRetry}>
              Try again
            </Button>
          )
        }
      />
    </Card>
  )
}

export function CardSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn('p-5', className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </Card>
  )
}

/** Small fact tile: mono label + value. */
export function Fact({ label, value, sub, className, mono = true }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string; mono?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-line px-3.5 py-3', className)}>
      <div className="mono-label truncate">{label}</div>
      <div className={cn('mt-1 truncate text-[13px] text-fg', mono && 'font-mono')}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  )
}

/** Key/value row used in dense cards. */
export function KV({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="shrink-0 text-[12.5px] text-fg-3">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1 text-right text-[13px] text-fg" title={hint}>
        {children}
      </dd>
    </div>
  )
}

/** Toggle-style chip filter row (single value). */
export function ChipFilter<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; icon?: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors [&_svg]:size-3.5',
            value === it.value ? 'border-line-strong bg-surface-3 font-medium text-fg' : 'border-transparent text-fg-3 hover:bg-surface-2 hover:text-fg',
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}
