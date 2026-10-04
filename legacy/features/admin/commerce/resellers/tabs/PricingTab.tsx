import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Check, Tags } from 'lucide-react'
import { useInstMutation, usePrices, usePricingGroups, useServices } from '@/hooks/installation'
import { resellersService } from '@/services/installation'
import type { PriceRow, Reseller } from '@/types/installation'
import { Badge, Button, Card, CardFooter, CardHeader, DataTable, Skeleton, Switch, type Column } from '@/components/ui'
import { ServiceIcon } from '@/components/brand'
import { cn } from '@/lib/cn'
import { money, num, pct } from '@/lib/format'
import { discountLabel, groupStyle } from '../shared'

export function PricingTab({ reseller }: { reseller: Reseller }) {
  const groups = usePricingGroups()
  const services = useServices()
  const [groupId, setGroupId] = useState(reseller.pricingGroupId)
  const [onlyAllowed, setOnlyAllowed] = useState(reseller.allowedServiceIds !== 'all')
  useEffect(() => setGroupId(reseller.pricingGroupId), [reseller.pricingGroupId])

  const prices = usePrices(groupId)
  const group = groups.data?.find((g) => g.id === groupId)
  const dirty = groupId !== reseller.pricingGroupId
  const save = useInstMutation((body: Partial<Reseller>) => resellersService.update(reseller.id, body), { success: (r) => `${r.name} moved to ${groups.data?.find((g) => g.id === r.pricingGroupId)?.name ?? 'new group'}` })

  const iconOf = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s.icon])), [services.data])
  const rows = useMemo(() => {
    const all = prices.data ?? []
    if (!onlyAllowed || reseller.allowedServiceIds === 'all') return all
    const allowed = new Set(reseller.allowedServiceIds)
    return all.filter((p) => allowed.has(p.serviceId))
  }, [prices.data, onlyAllowed, reseller.allowedServiceIds])

  const avgDiscount = rows.length ? rows.reduce((a, r) => a + (1 - r.groupPrice / r.publicPrice) * 100, 0) / rows.length : 0

  const columns: Column<PriceRow>[] = [
    {
      key: 'service',
      header: 'Service',
      sortValue: (r) => r.serviceName,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <ServiceIcon icon={iconOf.get(r.serviceId) ?? 'box'} category={r.category} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-fg">{r.serviceName}</div>
            <div className="truncate text-[11px] text-fg-3">
              {r.category} · <span className="font-mono text-[10.5px]">{r.serviceId}</span>
            </div>
          </div>
        </div>
      ),
    },
    { key: 'public', header: 'Public price', align: 'right', sortValue: (r) => r.publicPrice, cell: (r) => <span className="text-fg-3 tabular">{money(r.publicPrice)}</span> },
    {
      key: 'price',
      header: 'Effective price',
      align: 'right',
      sortValue: (r) => r.groupPrice,
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          {r.overridden && (
            <Badge tone="info" variant="soft">
              Contract
            </Badge>
          )}
          <span className="font-medium text-fg tabular">{money(r.groupPrice)}</span>
        </span>
      ),
    },
    {
      key: 'discount',
      header: 'vs public',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.groupPrice / r.publicPrice,
      cell: (r) => {
        const d = (1 - r.groupPrice / r.publicPrice) * 100
        return <span className={cn('tabular', d > 0.05 ? 'text-success' : 'text-fg-3')}>{d > 0.05 ? `−${pct(d)}` : '—'}</span>
      },
    },
    { key: 'margin', header: 'Your margin', align: 'right', hideBelow: 'md', sortValue: (r) => r.marginPercent, cell: (r) => <span className={cn('tabular', r.marginPercent < 30 ? 'text-warning' : 'text-fg-2')}>{pct(r.marginPercent)}</span> },
  ]

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={<Tags />}
          title="Pricing group"
          description={`Decides what ${reseller.name} pays for every IMEI check, unlock and code. Group changes apply to new orders immediately; orders already placed keep their frozen price.`}
          actions={
            <Button size="sm" variant="ghost" to={`/admin/pricing?group=${groupId}`} trailing={<ArrowUpRight />}>
              Pricing engine
            </Button>
          }
        />
        <div className="grid gap-2.5 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
          {groups.isLoading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[112px] rounded-xl" />)
            : groups.data?.map((g) => {
                const on = g.id === groupId
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGroupId(g.id)}
                    className={cn('relative rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow]', on ? 'border-transparent' : 'border-line hover:border-line-strong hover:bg-surface-2/60')}
                    style={on ? { boxShadow: `0 0 0 1.5px ${g.color}, 0 0 0 5px color-mix(in oklab, ${g.color} 14%, transparent)`, background: `color-mix(in oklab, ${g.color} 5%, var(--surface))` } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                        <span className="size-2 rounded-full" style={{ background: g.color }} />
                        {g.name}
                      </span>
                      {on ? (
                        <span className="grid size-4.5 place-items-center rounded-full text-white" style={{ background: g.color }}>
                          <Check className="size-3" />
                        </span>
                      ) : g.id === reseller.pricingGroupId ? (
                        <span className="text-[11px] text-fg-3">current</span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-display text-[18px] font-semibold tracking-[-0.02em] tabular">{discountLabel(g.discountPercent)}</span>
                      {g.overrides.length > 0 && <span className="text-[11.5px] text-fg-3">+ {g.overrides.length} contract</span>}
                    </div>
                    <div className="mt-1 text-[11.5px] text-fg-3">
                      {num(g.resellersCount)} reseller{g.resellersCount === 1 ? '' : 's'}
                    </div>
                    {g.description && <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-fg-3">{g.description}</p>}
                  </button>
                )
              })}
        </div>
        {dirty && group && (
          <CardFooter className="bg-surface-2/40">
            <span>
              Move <span className="text-fg">{reseller.name}</span> to <span className="rounded px-1.5 py-0.5 text-[12px] font-medium" style={groupStyle(group.color)}>{group.name}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setGroupId(reseller.pricingGroupId)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" loading={save.isPending} onClick={() => save.mutate({ pricingGroupId: groupId })}>
                Apply group
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={dirty ? `Preview · ${group?.name ?? ''} prices` : 'Effective prices'}
          description={rows.length ? `${rows.length} services · average ${pct(avgDiscount)} below public price` : undefined}
          actions={
            reseller.allowedServiceIds !== 'all' && (
              <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
                Allowed only
                <Switch size="sm" checked={onlyAllowed} onChange={setOnlyAllowed} label="Show only allowed services" />
              </label>
            )
          }
        />
        <DataTable columns={columns} rows={prices.data ? rows : undefined} loading={prices.isLoading} rowKey={(r) => r.serviceId} dense minWidth={560} defaultSort={{ key: 'service', dir: 'asc' }} />
      </Card>
    </div>
  )
}
