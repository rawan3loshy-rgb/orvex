import { useMemo } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Layers, Route } from 'lucide-react'
import { Card, CardHeader, EmptyState, Skeleton, Tooltip } from '@/components/ui'
import { ProviderMark } from '@/components/brand'
import { useOrders, useProviders } from '@/hooks/installation'
import { ago, num } from '@/lib/format'
import type { OrderRow } from '@/types/installation'
import { CATEGORY_SHORT } from './meta'
import { useNow } from './useNow'

interface Group {
  key: string
  providerId: string | null
  label: string
  processing: number
  pending: number
  total: number
  oldest: string
  categories: [string, number][]
}

/**
 * The order queue as an operator sees it: in-flight unlock, code and server
 * jobs grouped by the supplier they are waiting on.
 */
export function OrderQueueCard() {
  useNow(5000)
  const queue = useOrders({ status: 'in_flight', pageSize: 200 }, { live: true })
  const providers = useProviders()
  const items = queue.data?.items

  const { groups, routing, awaiting, oldest, max } = useMemo(() => {
    const list = items ?? []
    const byKey = new Map<string, { providerId: string | null; rows: OrderRow[] }>()
    const routingRows: OrderRow[] = []
    for (const o of list) {
      if (o.status === 'created' || !o.providerId) {
        routingRows.push(o)
        continue
      }
      const g = byKey.get(o.providerId) ?? { providerId: o.providerId, rows: [] }
      g.rows.push(o)
      byKey.set(o.providerId, g)
    }
    const out: Group[] = [...byKey.entries()].map(([key, g]) => {
      const cats = new Map<string, number>()
      for (const r of g.rows) cats.set(CATEGORY_SHORT[r.serviceCategory], (cats.get(CATEGORY_SHORT[r.serviceCategory]) ?? 0) + 1)
      const p = providers.data?.find((x) => x.id === g.providerId)
      return {
        key,
        providerId: g.providerId,
        label: p?.shortName ?? g.rows[0]?.providerName ?? key,
        processing: g.rows.filter((r) => r.status === 'processing').length,
        pending: g.rows.filter((r) => r.status === 'pending').length,
        total: g.rows.length,
        oldest: g.rows.reduce((a, r) => (r.createdAt < a ? r.createdAt : a), g.rows[0]!.createdAt),
        categories: [...cats.entries()].sort((a, b) => b[1] - a[1]),
      }
    })
    out.sort((a, b) => b.total - a.total)
    const waiting = list.filter((o) => o.status !== 'created' && o.providerId)
    return {
      groups: out,
      routing: routingRows.length,
      awaiting: waiting.length,
      oldest: waiting.reduce<string | null>((a, r) => (!a || r.createdAt < a ? r.createdAt : a), null),
      max: Math.max(1, ...out.map((g) => g.total)),
    }
  }, [items, providers.data])

  const total = queue.data?.total ?? 0

  return (
    <Card className="flex h-full flex-col">
      <CardHeader icon={<Layers />} title="Order queue" description="Unlock, code and server jobs waiting for supplier callbacks — grouped by supplier." />

      {/* Readout */}
      <dl className="mx-5 grid grid-cols-3 divide-x divide-line rounded-lg border border-line">
        <Readout label="In flight" value={items ? num(total) : null} />
        <Readout label="Awaiting callback" value={items ? num(awaiting) : null} />
        <Readout label="Oldest wait" value={items ? (oldest ? ago(oldest) : '—') : null} />
      </dl>

      <div className="flex-1 px-5 pt-4 pb-2">
        {!items ? (
          <div className="space-y-3.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="ml-auto h-2 w-40" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 && routing === 0 ? (
          <EmptyState compact icon={<Layers />} title="Queue is empty" description="No orders are waiting on a supplier right now. New unlock and server jobs appear here as soon as they are submitted." />
        ) : (
          <ul className="space-y-1">
            {routing > 0 && (
              <li className="flex items-center gap-3 py-1.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-fg-3">
                  <Route className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg-2">Being routed</span>
                <span className="font-mono text-[12px] text-fg tabular">{routing}</span>
              </li>
            )}
            {groups.map((g, i) => (
              <li key={g.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-1.5 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-center gap-2.5">
                  {g.providerId && <ProviderMark id={g.providerId} size="xs" />}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">{g.label}</p>
                    <p className="truncate font-mono text-[10.5px] text-fg-3">{g.categories.map(([c, n]) => `${c} ${n}`).join(' · ')}</p>
                  </div>
                </div>
                <Tooltip content={`${g.processing} processing · ${g.pending} queued at supplier · oldest ${ago(g.oldest)}`} className="order-3 col-span-2 sm:order-none sm:col-span-1">
                  <div className="flex h-2 w-full overflow-hidden rounded-[2px] bg-hatch shadow-[inset_0_0_0_1px_var(--line)]">
                    <motion.span className="h-full bg-accent-2/75" initial={{ width: 0 }} animate={{ width: `${(g.processing / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
                    <motion.span className="h-full bg-warning/70" initial={{ width: 0 }} animate={{ width: `${(g.pending / max) * 100}%` }} transition={{ duration: 0.6, delay: 0.08 + i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                </Tooltip>
                <span className="flex items-baseline justify-end gap-2 whitespace-nowrap">
                  <span className="font-mono text-[12.5px] font-medium text-fg tabular">{g.total}</span>
                  <span className="w-12 text-right font-mono text-[11px] text-fg-3 tabular">{ago(g.oldest)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-3 text-[12px] text-fg-3">
        <span className="flex items-center gap-3">
          <Legend className="bg-accent-2/75" label="Processing" />
          <Legend className="bg-warning/70" label="Queued at supplier" />
        </span>
        <Link to="/admin/orders" className="inline-flex shrink-0 items-center gap-1 font-medium text-accent-ink hover:underline">
          Orders <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}

function Readout({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 px-3 py-2.5 sm:px-4">
      <dt className="mono-label truncate">{label}</dt>
      <dd className="mt-1 truncate font-display text-[19px] leading-none font-semibold tracking-[-0.02em] text-fg tabular">{value ?? <Skeleton className="h-5 w-10" />}</dd>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-[2px] ${className}`} />
      {label}
    </span>
  )
}
