import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus, Tags, TriangleAlert } from 'lucide-react'
import { usePrices, usePricingGroups, useServices } from '@/hooks/installation'
import type { PricingGroup } from '@/types/installation'
import { Button, Card, CardBody, CardHeader, DemoTag, PageHeader, Skeleton, Stat } from '@/components/ui'
import { pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PricingModel } from './pricing/PricingModel'
import { GroupCard, NewGroupCard } from './pricing/GroupCard'
import { GroupModal } from './pricing/GroupModal'
import { DiscountEditor } from './pricing/DiscountEditor'
import { MarginChart } from './pricing/MarginChart'
import { PriceTable } from './pricing/PriceTable'
import { LOW_MARGIN, groupSummary, previewRow } from './pricing/shared'

export default function PricingPage() {
  const [params, setParams] = useSearchParams()
  const groups = usePricingGroups()
  const services = useServices()

  // Default to the Distributor group — it combines a discount with a contract price, so every resolution step shows.
  const groupId = params.get('group') ?? groups.data?.find((g) => g.name === 'Distributor')?.id ?? groups.data?.find((g) => g.id === 'grp_enterprise')?.id ?? groups.data?.[0]?.id
  const group = groups.data?.find((g) => g.id === groupId)
  const prices = usePrices(groupId)

  // Draft discount for the selected group (drives the live preview until saved).
  const [draftState, setDraftState] = useState<{ id: string; value: number } | null>(null)
  const draft = group ? (draftState?.id === group.id ? draftState.value : group.discountPercent) : 0
  const setDraft = (value: number) => group && setDraftState({ id: group.id, value })

  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; group: PricingGroup } | null>(null)

  const select = (id: string) => {
    setDraftState(null)
    const next = new URLSearchParams(params)
    next.set('group', id)
    setParams(next, { replace: true })
  }

  const iconOf = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s.icon])), [services.data])
  const previewing = !!group && !Number.isNaN(draft) && Math.abs(draft - group.discountPercent) > 0.001
  const baseRows = prices.data ?? []
  const rows = useMemo(() => (previewing ? baseRows.map((r) => previewRow(r, draft)) : baseRows), [baseRows, previewing, draft])
  const stats = groupSummary(rows, group)
  const sample = rows.find((r) => r.overridden) ?? rows.find((r) => r.serviceId === 'SVC-1001') ?? rows[0]
  const loadingPrices = prices.isLoading || !groupId

  return (
    <div>
      <PageHeader
        icon={<Tags />}
        title="Pricing engine"
        description="Every shop pays the public list price minus its group discount — Standard, Dealer, Distributor or Contract — unless a per-service contract price applies."
        actions={
          <Button variant="accent" leading={<Plus />} onClick={() => setModal({ mode: 'create' })}>
            New group
          </Button>
        }
      />

      <div className="space-y-6">
        <PricingModel group={previewing && group ? { ...group, discountPercent: draft } : group} sample={sample} />

        {/* Groups */}
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Pricing groups</h2>
              <p className="mt-0.5 text-[12.5px] text-fg-3">Select a group to inspect its margins and edit prices for IMEI checks, unlocks, server services and codes.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {groups.isLoading
              ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[156px] rounded-xl" />)
              : groups.data?.map((g, i) => <GroupCard key={g.id} group={g} index={i} selected={g.id === groupId} onSelect={() => select(g.id)} />)}
            <NewGroupCard onClick={() => setModal({ mode: 'create' })} />
          </div>
        </section>

        {/* Selected group */}
        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <DiscountEditor group={group} rows={baseRows} draft={draft} setDraft={setDraft} onEdit={() => group && setModal({ mode: 'edit', group })} />
          <Card className="min-w-0">
            <CardHeader title="Margin distribution" description={`${group?.name ?? '…'} group · supplier cost vs effective price, per service`} actions={<DemoTag />} />
            <CardBody>
              <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 border-b border-line pb-5 sm:grid-cols-4">
                {loadingPrices ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))
                ) : (
                  <>
                    <Stat label="Avg margin" value={pct(stats.avgMargin)} sub={`${pct(stats.avgMarkup, 0)} avg markup`} tone={stats.avgMargin < LOW_MARGIN ? 'warning' : undefined} />
                    <Stat
                      label="Lowest margin"
                      value={stats.lowest ? pct(stats.lowest.marginPercent) : '—'}
                      tone={stats.lowest && stats.lowest.marginPercent < LOW_MARGIN ? 'warning' : undefined}
                      sub={
                        stats.lowest ? (
                          <span className="inline-flex max-w-full items-center gap-1">
                            {stats.lowest.marginPercent < LOW_MARGIN && <TriangleAlert className="size-3 shrink-0 text-warning" />}
                            <span className="truncate">{stats.lowest.serviceName}</span>
                          </span>
                        ) : undefined
                      }
                    />
                    <Stat label="Contract prices" value={stats.overrides} sub={stats.overrides ? 'Fixed per-service prices' : 'Discount applies to all'} />
                    <Stat label={`Below ${LOW_MARGIN}%`} value={stats.lowMargin.length} tone={stats.lowMargin.length ? 'warning' : 'success'} sub={stats.belowCost.length ? `${stats.belowCost.length} below cost` : `of ${rows.length} services`} />
                  </>
                )}
              </div>
              <MarginChart rows={rows} loading={loadingPrices} />
            </CardBody>
          </Card>
        </section>

        <div className={cn('transition-opacity duration-200', prices.isPlaceholderData && 'pointer-events-none opacity-60')}>
          <PriceTable group={group} rows={prices.data ? rows : undefined} loading={loadingPrices} previewing={previewing} iconOf={iconOf} />
        </div>
      </div>

      <GroupModal open={modal !== null} onClose={() => setModal(null)} group={modal?.mode === 'edit' ? modal.group : null} onSaved={(g) => modal?.mode === 'create' && select(g.id)} />
    </div>
  )
}
