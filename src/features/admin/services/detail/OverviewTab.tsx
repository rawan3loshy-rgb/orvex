import type { ReactNode } from 'react'
import { ChevronRight, Code2, Eye, LayoutDashboard, Store } from 'lucide-react'
import { Badge, Card, CardBody, CardHeader, Segmented, Stat, Switch } from '@/components/ui'
import { Guarded, HealthBadge, MarginGuardBadge, Money, useCan } from '@/components/domain'
import { useInstMutation } from '@/hooks/installation'
import { catalogService } from '@/services/installation'
import type { Service, ServiceDetail } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, num } from '@/lib/format'
import { KV, SupplierMark } from '../../catalog/kit'
import { PROCESSING_HINT, PROCESSING_LABEL, turnaroundLabel } from '../../catalog/helpers'

export function OverviewTab({ d, onTab }: { d: ServiceDetail; onTab: (t: 'offers' | 'pricing' | 'fields') => void }) {
  const s = d.service
  const can = useCan('catalog.manage')
  const update = useInstMutation((patch: Partial<Service>) => catalogService.updateService(s.id, patch), { success: 'Service updated' })
  const vis = (k: keyof Service['visibility'], v: boolean) => update.mutate({ visibility: { ...s.visibility, [k]: v } })
  const completionRate = d.stats.orders30d ? Math.round((d.stats.completed30d / d.stats.orders30d) * 100) : null

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-4">
        <Card>
          <CardBody className="grid grid-cols-2 gap-5 pt-5 md:grid-cols-5">
            <Stat label="Orders 30d" value={num(d.stats.orders30d)} />
            <Stat label="Completed" value={num(d.stats.completed30d)} sub={completionRate != null ? `${completionRate}% of orders` : undefined} />
            <Stat label="Rejected" value={num(d.stats.rejected30d)} tone={d.stats.rejected30d ? 'warning' : undefined} />
            <Stat label="Revenue 30d" value={<Money value={d.stats.revenue30d} compact />} />
            <Stat label="Margin 30d" value={<Money value={d.stats.margin30d} compact />} tone={d.stats.margin30d < 0 ? 'danger' : 'success'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Summary" description="Shown on the storefront detail page, in the portal and in the API service list." />
          <CardBody>
            <p className="text-[13.5px] leading-relaxed text-fg">{s.summary}</p>
            {s.description && s.description !== s.summary && <p className="mt-2 text-[13px] leading-relaxed text-fg-2">{s.description}</p>}
            {s.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {s.tags.map((t) => (
                  <Badge key={t} tone="neutral" variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-x-8 border-t border-line pt-2 sm:grid-cols-2">
              <KV label="Processing">
                <span title={PROCESSING_HINT[s.processing]}>{PROCESSING_LABEL[s.processing]}</span>
              </KV>
              <KV label="Turnaround">{turnaroundLabel(s.turnaround)}</KV>
              <KV label="Category">{d.category.name}</KV>
              <KV label="Vertical pack">{s.packId ? `${s.packId.toUpperCase()} pack` : 'Core'}</KV>
              <KV label="Service code (API / DHRU id)" mono>
                {s.code}
              </KV>
              <KV label="Slug" mono>
                {s.slug}
              </KV>
              <KV label="Current revision">
                <button type="button" className="text-accent-ink hover:underline" onClick={() => onTab('fields')}>
                  v{d.revision.number} · {d.revision.fields.length} fields
                </button>
              </KV>
              <KV label="Updated">{dateTime(s.updatedAt)}</KV>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Routing chain"
            description="Priority order. Failover only after a definitive, failover-safe rejection — a timeout goes to review."
            actions={
              <button type="button" onClick={() => onTab('offers')} className="inline-flex items-center gap-0.5 text-[12.5px] text-accent-ink hover:underline">
                Manage offers <ChevronRight className="size-3.5" />
              </button>
            }
          />
          <CardBody className="space-y-1.5">
            {d.offers.length === 0 && <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-fg-3">No offers mapped yet.</div>}
            {d.offers.map((o, i) => (
              <div key={o.offer.id} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', o.routable ? 'border-line' : 'border-dashed border-line bg-surface-2/40')}>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-semibold', o.routable ? 'bg-fg text-bg' : 'bg-surface-3 text-fg-3')}>{i + 1}</span>
                <SupplierMark name={o.supplier.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{o.supplier.name}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{o.routable ? (o.product?.name ?? 'Product') : o.reasons.join(' · ')}</div>
                </div>
                <HealthBadge health={o.supplier.health} className="hidden sm:inline-flex" />
                <Money value={o.cost} className="w-16 text-right font-mono text-[12.5px]" />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader title="Visibility" description="Where the service can be ordered. Prices are resolved live per channel." icon={<Eye />} />
          <CardBody className="space-y-1">
            <VisRow icon={<Store />} label="Storefront" hint="Website catalog, search and checkout" checked={s.visibility.storefront} disabled={!can || update.isPending} onChange={(v) => vis('storefront', v)} />
            <VisRow icon={<LayoutDashboard />} label="Reseller portal" hint="Manual and bulk orders by accounts" checked={s.visibility.portal} disabled={!can || update.isPending} onChange={(v) => vis('portal', v)} />
            <VisRow icon={<Code2 />} label="API (native + DHRU)" hint="Listed in /v1/services and imeiservicelist" checked={s.visibility.api} disabled={!can || update.isPending} onChange={(v) => vis('api', v)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="When unavailable" description="What customers see while no offer can take an order." />
          <CardBody>
            <Guarded permission="catalog.manage" className="w-full">
              {(ok) => (
                <Segmented
                  className={cn('w-full', !ok && 'pointer-events-none opacity-60')}
                  value={s.whenUnavailable}
                  onChange={(v) => update.mutate({ whenUnavailable: v })}
                  items={[
                    { value: 'show_unavailable', label: 'Show as unavailable' },
                    { value: 'hide', label: 'Hide' },
                  ]}
                />
              )}
            </Guarded>
            <p className="mt-2 text-[12px] text-fg-3">{s.whenUnavailable === 'hide' ? 'Hidden from storefront and portal listings; direct links explain it is temporarily unavailable.' : 'Listed with an "Unavailable" label; ordering is disabled, no money is held.'}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Prices by tier"
            description="Calculated from rules + supplier cost."
            actions={
              <button type="button" onClick={() => onTab('pricing')} className="inline-flex items-center gap-0.5 text-[12.5px] text-accent-ink hover:underline">
                Why? <ChevronRight className="size-3.5" />
              </button>
            }
          />
          <CardBody className="divide-y divide-line pt-0">
            {d.quotes.map((q) => (
              <div key={q.tierId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{q.tierName}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{q.inheritedFrom ? `inherits ${q.inheritedFrom}` : q.ruleLabel.split(' · ').slice(1).join(' · ')}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {q.guard !== 'ok' && <MarginGuardBadge guard={q.guard} />}
                  <Money value={q.amount} className="font-mono text-[13px] font-medium" />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function VisRow({ icon, label, hint, checked, onChange, disabled }: { icon: ReactNode; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/50">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block truncate text-[11.5px] text-fg-3">{hint}</span>
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </label>
  )
}
