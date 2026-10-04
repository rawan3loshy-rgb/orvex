/**
 * Shared building blocks for the developer area (Native API, keys, webhooks,
 * logs) and the DHRU screens. Feature-local — not part of the global kit.
 * Non-component helpers (constants, scopes, events, cURL builders) live in `./helpers`.
 */
import type { ReactNode } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import type { ApiKey, ApiLogEntry, ApiScope } from '@/types/installation'
import { Button, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ms } from '@/lib/format'
import { CRITICAL_MS, SLOW_MS, statusPhrase, statusTextCls } from './helpers'

/* ------------------------------------------------------------------------- */
/*  Types                                                                    */
/* ------------------------------------------------------------------------- */
export type LogRow = ApiLogEntry & { accountName: string | null; orderRef: string | null }

/* ------------------------------------------------------------------------- */
/*  HTTP method & status                                                     */
/* ------------------------------------------------------------------------- */
/** Reads graphite/steel, writes coral, destructive crimson. No blue. */
const METHOD_CLS: Record<string, string> = {
  GET: 'text-fg-2 bg-fg/[0.06] ring-fg/15',
  POST: 'text-accent-ink bg-accent/10 ring-accent/25',
  PUT: 'text-warning bg-warning/10 ring-warning/25',
  PATCH: 'text-warning bg-warning/10 ring-warning/25',
  DELETE: 'text-danger bg-danger/10 ring-danger/25',
}

export function MethodBadge({ method, size = 'sm', className }: { method: string; size?: 'xs' | 'sm'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] font-mono font-semibold tracking-[0.04em] ring-1 ring-inset',
        size === 'xs' ? 'h-[17px] min-w-[36px] px-1 text-[9.5px]' : 'h-5 min-w-[42px] px-1.5 text-[10.5px]',
        METHOD_CLS[method] ?? 'bg-fg/5 text-fg-2 ring-line',
        className,
      )}
    >
      {method}
    </span>
  )
}

export function StatusCode({ status, className, phrase }: { status: number | null; className?: string; phrase?: boolean }) {
  if (status == null) return <span className={cn('font-mono text-[12px] text-fg-3', className)}>—</span>
  const dot = status >= 500 ? 'bg-danger' : status >= 400 ? 'bg-warning' : 'bg-success'
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[12px] font-medium tabular', statusTextCls(status), className)}>
      <span className={cn('size-1.5 shrink-0 rounded-[2px]', dot)} />
      {status}
      {phrase && <span className="font-sans font-normal text-fg-3">{statusPhrase(status)}</span>}
    </span>
  )
}

export function LatencyBar({ value, max = 300, className }: { value: number; max?: number; className?: string }) {
  const ratio = Math.min(1, value / max)
  const critical = value > CRITICAL_MS
  const slow = value > SLOW_MS
  return (
    <span className={cn('inline-flex items-center justify-end gap-2', className)}>
      <span className="hidden h-[5px] w-12 overflow-hidden rounded-[2px] bg-fg/[0.06] md:block">
        <span className={cn('block h-full rounded-[2px]', critical ? 'bg-danger' : slow ? 'bg-accent' : 'bg-fg-2/45')} style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </span>
      <span className={cn('w-[46px] text-right font-mono text-[12px] tabular', critical ? 'text-danger' : slow ? 'text-accent-ink' : 'text-fg-2')}>{ms(value)}</span>
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/*  API keys                                                                 */
/* ------------------------------------------------------------------------- */
export function KeyId({ apiKey: k, className }: { apiKey: Pick<ApiKey, 'prefix' | 'last4'>; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline font-mono text-[11.5px] whitespace-nowrap text-fg-2', className)}>
      {k.prefix}
      <span className="tracking-[0.12em] text-fg-3/70">_••••</span>
      {k.last4}
    </span>
  )
}

export function EnvBadge({ env, className }: { env: 'live' | 'test'; className?: string }) {
  const live = env === 'live'
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[5px] px-1.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ring-1 ring-inset',
        live ? 'bg-accent/[0.08] text-accent-ink ring-accent/25' : 'bg-hatch bg-surface-2 text-fg-2 ring-line-strong',
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', live ? 'bg-accent' : 'border border-fg-3')} />
      {live ? 'Live' : 'Test'}
    </span>
  )
}

/** Compact scope chips, e.g. "services:read orders:write". */
export function ScopeChips({ scopes, className, max }: { scopes: ApiScope[]; className?: string; max?: number }) {
  const shown = max ? scopes.slice(0, max) : scopes
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {shown.map((s) => (
        <code key={s} className={cn('rounded-[5px] px-1.5 py-px font-mono text-[10.5px] whitespace-nowrap ring-1 ring-inset', s.endsWith(':write') || s === 'webhooks:manage' ? 'bg-accent/[0.07] text-accent-ink ring-accent/20' : 'bg-fg/[0.04] text-fg-2 ring-line')}>
          {s}
        </code>
      ))}
      {max && scopes.length > max && <span className="font-mono text-[10.5px] text-fg-3">+{scopes.length - max}</span>}
    </span>
  )
}

export function DhruChip({ className }: { className?: string }) {
  return <span className={cn('inline-flex h-5 items-center rounded-[5px] bg-fg/[0.05] px-1.5 font-mono text-[10px] font-semibold tracking-[0.06em] text-fg-2 uppercase ring-1 ring-line ring-inset', className)}>DHRU</span>
}

/* ------------------------------------------------------------------------- */
/*  Small layout pieces                                                      */
/* ------------------------------------------------------------------------- */
export function QueryError({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      className={className}
      compact
      icon={<TriangleAlert />}
      title="Couldn’t load this data"
      description={(error as { message?: string } | null)?.message ?? 'The installation API returned an error.'}
      action={
        onRetry && (
          <Button size="sm" variant="secondary" leading={<RotateCw />} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  )
}

/** Label/value cell for drawer stat grids (use inside a `gap-px bg-line` grid). */
export function Cell({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 bg-surface px-3.5 py-3', className)}>
      <div className="mono-label mb-1.5">{label}</div>
      <div className="min-w-0 truncate text-[13px] text-fg">{children}</div>
    </div>
  )
}

/** Hatched, dashed-border notice for things that really change demo state. */
export function LiveStateNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-dashed border-warning/45 bg-warning/[0.04] px-3.5 py-2.5 text-[12.5px] text-fg-2', className)}>
      <div className="pointer-events-none absolute inset-0 bg-hatch opacity-40" />
      <div className="relative flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <div>{children}</div>
      </div>
    </div>
  )
}

/** Headers table (name → value), monospace. */
export function HeaderTable({ headers, className }: { headers: Record<string, string>; className?: string }) {
  const entries = Object.entries(headers)
  if (!entries.length) return <p className="text-[12.5px] text-fg-3">No headers</p>
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line', className)}>
      <table className="w-full text-[12px]">
        <tbody className="divide-y divide-line">
          {entries.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="w-[38%] bg-surface-2/40 px-3 py-2 font-mono whitespace-nowrap text-fg-3">{k}</td>
              <td className="px-3 py-2 font-mono break-all text-fg">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
