import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Inbox } from 'lucide-react'
import { useProviders } from '@/hooks/installation'
import { Dot, Skeleton } from '@/components/ui'
import { ProviderMark } from '@/components/brand'
import { num } from '@/lib/format'
import { useMeasure } from '@/lib/useMeasure'
import type { Tone } from '@/types/common'
import type { OrderRow, Service } from '@/types/installation'
import { deriveQueue, queueStage, type QueueStage } from './ops'
import { deviceId, useNow } from './parts'

/** Fixed row height (border included) so the list can show exactly as many rows as fit. */
const ROW_H = 46
const MIN_ROWS = 4

const STAGE: Record<QueueStage, { label: string; tone: Tone }> = {
  validating: { label: 'Validating', tone: 'neutral' },
  held: { label: 'Held for review', tone: 'warning' },
  retry: { label: 'Retry scheduled', tone: 'warning' },
  awaiting: { label: 'Awaiting supplier', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'accent' },
}

/** 45s · 12m · 2h 05m */
function short(msec: number) {
  const s = Math.max(0, Math.round(msec / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/**
 * The oldest in-flight jobs (unlock queue, server jobs, codes awaiting a result).
 * The list area flexes to the height the hero row gives the Order Flow card and
 * renders only the rows that fit — never a half-clipped row.
 */
export function ProcessingQueue({ orders, services, loading }: { orders: OrderRow[]; services: Service[] | undefined; loading: boolean }) {
  const navigate = useNavigate()
  const providers = useProviders()
  const now = useNow(5000)
  const [ref, { height }] = useMeasure<HTMLDivElement>()
  const queue = useMemo(() => deriveQueue(orders), [orders])
  const svc = useMemo(() => new Map(services?.map((s) => [s.id, s]) ?? []), [services])
  const shortName = useMemo(() => new Map(providers.data?.map((p) => [p.id, p.shortName]) ?? []), [providers.data])

  // The list sits under a 1px top border.
  const fit = Math.max(1, Math.floor(((height || MIN_ROWS * ROW_H + 1) - 1) / ROW_H))
  const rows = queue.slice(0, fit)

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line">
      <div className="flex items-center gap-2 px-5 pt-3 pb-2">
        <span className="mono-label shrink-0">Processing queue</span>
        <span className="truncate text-[11px] text-fg-3 tabular">{loading ? '…' : `${num(queue.length)} in flight${queue.length > rows.length ? ` · oldest ${rows.length} shown` : queue.length ? ' · oldest first' : ''}`}</span>
        <span className="h-px min-w-4 flex-1 border-t border-dashed border-line-strong" />
        <Link to="/admin/orders?status=in_flight" className="flex shrink-0 items-center gap-1 text-[11.5px] text-fg-3 transition-colors hover:text-fg">
          All in flight <ArrowRight className="size-3" />
        </Link>
      </div>
      <div ref={ref} className="relative flex-1" style={{ minHeight: MIN_ROWS * ROW_H + 1 }}>
        <div className="absolute inset-0 overflow-hidden border-t border-line">
          {loading &&
            Array.from({ length: fit }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-5" style={{ height: ROW_H }}>
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          {!loading && queue.length === 0 && (
            <div className="grid h-full place-items-center px-5 text-center">
              <div className="flex flex-col items-center gap-2 text-[12.5px] text-fg-3">
                <Inbox className="size-4" />
                Queue is clear — every order has a result.
              </div>
            </div>
          )}
          {rows.map((o) => {
            const stage = queueStage(o)
            const s = svc.get(o.serviceId)
            const device = deviceId(o.input)
            const supplier = o.attempts.at(-1)?.providerId ?? null
            const wait = now - new Date(o.createdAt).getTime()
            const due = s ? new Date(o.createdAt).getTime() + s.turnaround.max * 1000 - now : null
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => navigate(`/admin/orders/${o.id}`)}
                style={{ height: ROW_H }}
                className="grid w-full grid-cols-[minmax(64px,auto)_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line px-5 text-left transition-colors hover:bg-surface-2/60 @min-[600px]:grid-cols-[112px_minmax(0,1fr)_minmax(0,128px)_84px]"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[12px] text-fg">#{o.number}</span>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-fg-3">
                    <Dot tone={STAGE[stage].tone} />
                    <span className="truncate">{STAGE[stage].label}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-fg">{o.serviceName}</span>
                  <span className="block truncate font-mono text-[11px] text-fg-3">
                    {device ?? '—'}
                    {supplier && <span className="font-sans @min-[600px]:hidden"> · {shortName.get(supplier) ?? o.providerName}</span>}
                  </span>
                </span>
                <span className="hidden min-w-0 items-center gap-2 text-[12px] text-fg-2 @min-[600px]:flex">
                  {supplier ? (
                    <>
                      <ProviderMark id={supplier} size="xs" />
                      <span className="truncate">{shortName.get(supplier) ?? o.providerName}</span>
                    </>
                  ) : (
                    <span className="truncate text-fg-3">{stage === 'held' ? 'Not routed yet' : '—'}</span>
                  )}
                </span>
                <span className="text-right tabular">
                  <span className="block text-[12px] text-fg">{short(wait)}</span>
                  <span className={`block text-[10.5px] ${due != null && due <= 0 && stage !== 'held' ? 'text-warning' : 'text-fg-3'}`}>
                    {stage === 'held' ? 'manual review' : due == null ? '—' : due > 0 ? `ETA ${short(due)}` : `overdue ${short(-due)}`}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
