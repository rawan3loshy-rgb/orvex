import type { ReactNode } from 'react'
import { Globe, KeyRound, UserCog } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { Badge, CopyButton, Dot, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { OrderAttempt, OrderRow } from '@/types/installation'
import { OUTCOME, deviceContext, deviceOf, formatImei, isImei, luhnValid } from './lib'

/** Header pill that toggles polling for a live view. */
export function LivePill({ live, onToggle, interval = '5s' }: { live: boolean; onToggle: () => void; interval?: string }) {
  return (
    <Tooltip content={live ? `Auto-refreshing every ${interval}. Click to pause.` : 'Updates paused. Click to resume live refresh.'}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={live}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-[background-color,border-color,color] duration-150',
          live ? 'border-success/30 bg-success/[0.07] text-fg hover:bg-success/[0.11]' : 'border-line bg-surface text-fg-2 shadow-card hover:border-line-strong hover:text-fg',
        )}
      >
        <Dot tone={live ? 'success' : 'neutral'} pulse={live} />
        {live ? 'Live' : 'Paused'}
      </button>
    </Tooltip>
  )
}

/**
 * Supplier that fulfilled (or is fulfilling) an order. Pass `label` with the
 * provider's `shortName` for compact tables; the full name stays in the tooltip.
 */
export function ProviderCell({ order, label, compact }: { order: Pick<OrderRow, 'providerId' | 'providerName' | 'attempts' | 'status'>; label?: string; compact?: boolean }) {
  if (!order.providerId) {
    return <span className="text-[12.5px] text-fg-3">{order.status === 'created' ? 'Routing…' : order.status === 'pending' ? 'Not routed' : '—'}</span>
  }
  const failovers = order.attempts.length - 1
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ProviderMark id={order.providerId} name={order.providerName ?? undefined} size="xs" />
      <span className="truncate text-fg-2" title={order.providerName ?? undefined}>
        {label ?? order.providerName}
      </span>
      {failovers > 0 && (
        <Tooltip content={`Failed over ${failovers === 1 ? 'once' : `${failovers} times`} — ${order.attempts.length} suppliers attempted`}>
          <span className={cn('inline-flex shrink-0 items-center rounded-md bg-warning/10 px-1.5 font-mono text-[10px] leading-[18px] text-warning ring-1 ring-warning/20 ring-inset', compact && 'px-1')}>
            {compact ? `+${failovers}` : 'fallback'}
          </span>
        </Tooltip>
      )}
    </span>
  )
}

export function ClientCell({ order }: { order: Pick<OrderRow, 'resellerName' | 'channel'> }) {
  if (order.resellerName) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <KeyRound className="size-3.5 shrink-0 text-fg-3" />
        <span className="truncate text-fg-2">{order.resellerName}</span>
      </span>
    )
  }
  const Icon = order.channel === 'website' ? Globe : UserCog
  return (
    <span className="flex items-center gap-2 text-fg-2">
      <Icon className="size-3.5 shrink-0 text-fg-3" />
      {order.channel === 'website' ? 'Website' : 'Admin'}
    </span>
  )
}

/** Device identifier for order tables: grouped IMEI (or serial / MSISDN) plus model & network. */
export function DeviceCell({ input }: { input: Record<string, string> }) {
  const d = deviceOf(input)
  if (!d) return <span className="text-fg-3/60">—</span>
  const ctx = deviceContext(input)
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-mono text-[9.5px] tracking-wider text-fg-3 uppercase">{d.label}</span>
        <span className="font-mono text-[12px] text-fg tabular">{d.display}</span>
      </div>
      {ctx.length > 0 && <div className="truncate text-[11.5px] text-fg-3">{ctx.join(' · ')}</div>}
    </div>
  )
}

/** Large, grouped IMEI with Luhn status and copy (order detail). */
export function ImeiValue({ value, className, size = 'md' }: { value: string; className?: string; size?: 'md' | 'lg' }) {
  const imei = isImei(value)
  const ok = imei && luhnValid(value)
  return (
    <span className={cn('group inline-flex max-w-full items-center gap-2', className)}>
      <span className={cn('font-mono tracking-[0.04em] text-fg tabular', size === 'lg' ? 'text-[17px] font-medium' : 'text-[12.5px]')}>{imei ? formatImei(value) : value}</span>
      {imei && (
        <Tooltip content={ok ? 'Luhn check digit valid' : 'Luhn check digit does not match'}>
          <Badge tone={ok ? 'neutral' : 'warning'} className="font-mono text-[10px]">
            {ok ? 'LUHN ✓' : 'LUHN ✗'}
          </Badge>
        </Tooltip>
      )}
      <CopyButton value={imei ? value.replace(/\D/g, '') : value} label={imei ? 'Copy IMEI' : 'Copy'} className="size-5.5" />
    </span>
  )
}

export function OutcomeBadge({ outcome, className }: { outcome: OrderAttempt['outcome']; className?: string }) {
  const m = OUTCOME[outcome]
  return (
    <Badge tone={m.tone} dot pulse={outcome === 'in_flight'} className={className}>
      {m.label}
    </Badge>
  )
}

/** Small mono key/value line used in side panels. */
export function KV({ label, children, mono, className }: { label: ReactNode; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0', className)}>
      <dt className="shrink-0 text-[12.5px] text-fg-3">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right text-[13px] text-fg', mono && 'font-mono text-[12px]')}>{children}</dd>
    </div>
  )
}
