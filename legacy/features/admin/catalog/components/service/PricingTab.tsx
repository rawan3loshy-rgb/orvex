import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Check, Pencil, Tags, X } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { Badge, Button, Card, CardBody, CardHeader, Input, Skeleton, Tooltip } from '@/components/ui'
import { useInstMutation, usePrices, usePricingGroups } from '@/hooks/installation'
import { servicesService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { money, num, pct } from '@/lib/format'
import type { PricingGroup, Provider, Service, ServiceMapping } from '@/types/installation'
import { Callout, MarginBar, PriorityChip, margin } from '../shared'

export function PricingTab({ service: s, mappings, providers }: { service: Service; mappings: ServiceMapping[]; providers: Map<string, Provider> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(s.price.toFixed(2))
  useEffect(() => {
    if (!editing) setDraft(s.price.toFixed(2))
  }, [s.price, editing])

  const enabled = mappings.filter((m) => m.enabled).sort((a, b) => a.priority - b.priority)
  const primaryCost = s.primaryCost
  const maxCost = enabled.length ? Math.max(...enabled.map((m) => m.cost)) : 0
  const p = Number(draft)
  const error = Number.isNaN(p) || p <= 0 ? 'Enter a price above $0' : p < primaryCost ? `Must be at least the primary supplier cost (${money(primaryCost)})` : undefined
  const warn = !error && p < maxCost ? `Below the most expensive fallback (${money(maxCost)}) — failovers to it would lose money.` : undefined
  const preview = margin(Number.isNaN(p) ? s.price : p, primaryCost)

  const save = useInstMutation((price: number) => servicesService.update(s.id, { price }), {
    success: (d) => `Public price set to ${money(d.price)}`,
    onSuccess: () => setEditing(false),
  })
  const groups = usePricingGroups()

  const scale = Math.max(s.price, p || 0, maxCost) * 1.08 || 1
  const current = margin(s.price, primaryCost)
  const ladder = enabled
    .slice()
    .sort((a, b) => a.cost - b.cost)
    .reduce<{ m: ServiceMapping; pos: number; row: number }[]>((acc, m) => {
      const pos = (m.cost / scale) * 100
      const prev = acc[acc.length - 1]
      acc.push({ m, pos, row: prev && pos - prev.pos < 7 ? 1 - prev.row : 0 })
      return acc
    }, [])

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader title="Public price" description="List price on the UnlockDesk website and for the Standard reseller group." />
          <CardBody>
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!error) save.mutate(+p.toFixed(2))
                }}
              >
                <div className="flex items-center gap-2">
                  <Input autoFocus inputSize="lg" leading={<span className="text-[15px]">$</span>} inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} invalid={!!error} className="max-w-[180px] font-display tabular" />
                  <Button type="submit" variant="primary" size="md" leading={<Check />} loading={save.isPending} disabled={!!error}>
                    Save
                  </Button>
                  <Button type="button" variant="ghost" size="md" icon onClick={() => setEditing(false)} aria-label="Cancel">
                    <X />
                  </Button>
                </div>
                {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : warn ? <p className="mt-2 text-[12px] text-warning">{warn}</p> : <p className="mt-2 text-[12px] text-fg-3">Applies to new orders immediately. Group discounts follow automatically.</p>}
              </form>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="font-display text-[40px] leading-none font-semibold tracking-[-0.035em] tabular">{money(s.price)}</div>
                  <div className="mt-2 text-[12.5px] text-fg-3">per order · USD</div>
                </div>
                <Button variant="secondary" size="sm" leading={<Pencil />} onClick={() => setEditing(true)}>
                  Edit price
                </Button>
              </div>
            )}
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div>
                <div className="text-[11.5px] text-fg-3">Supplier cost · P1</div>
                <div className="mt-0.5 text-[15px] font-semibold tabular">{primaryCost ? money(primaryCost) : '—'}</div>
              </div>
              <div>
                <div className="text-[11.5px] text-fg-3">Margin</div>
                <div className={cn('mt-0.5 text-[15px] font-semibold tabular', preview.abs < 0 ? 'text-danger' : 'text-success')}>{primaryCost ? money(preview.abs) : '—'}</div>
              </div>
              <div>
                <div className="text-[11.5px] text-fg-3">Margin / markup</div>
                <div className="mt-0.5 text-[15px] font-semibold tabular">{primaryCost ? `${pct(preview.pct, 0)} / ${pct(preview.markup, 0)}` : '—'}</div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cost ladder" description="Where each mapped supplier’s cost sits against the price you charge." />
          <CardBody>
            <div className="relative pt-7 pb-14">
              {/* track */}
              <div className="relative h-3 overflow-hidden rounded-full bg-fg/[0.06]">
                <motion.div className="absolute inset-y-0 left-0 rounded-full bg-success/25" initial={{ width: 0 }} animate={{ width: `${(s.price / scale) * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                <motion.div className="absolute inset-y-0 left-0 rounded-l-full bg-fg/25" initial={{ width: 0 }} animate={{ width: `${(Math.min(primaryCost, s.price) / scale) * 100}%` }} transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} />
              </div>
              {/* price marker */}
              <div className="absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(s.price / scale) * 100}%` }}>
                <span className="rounded-md bg-fg px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-bg tabular">Price {money(s.price)}</span>
                <span className="mt-0.5 h-6 w-px bg-fg/60" />
              </div>
              {/* provider markers (staggered when costs sit close together) */}
              {ladder.map(({ m, pos, row }, i) => (
                <div key={m.id} className="absolute top-[40px] -translate-x-1/2" style={{ left: `${pos}%` }}>
                  <Tooltip content={`${providers.get(m.providerId)?.name} · P${m.priority} · ${money(m.cost)} · margin ${money(s.price - m.cost)}`} placement="bottom">
                    <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="flex flex-col items-center">
                      <span className={cn('w-px bg-fg-3/60', row ? 'h-8' : 'h-2')} />
                      <ProviderMark id={m.providerId} name={providers.get(m.providerId)?.name} size="xs" />
                    </motion.span>
                  </Tooltip>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-fg-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-fg/25" /> P1 supplier cost
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-success/40" /> Margin {primaryCost ? `${money(current.abs)} (${pct(current.pct, 0)})` : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-px bg-fg-3" /> Supplier cost markers
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Cost per supplier" description="Margin if the order is fulfilled by each mapped supplier at the public price — failovers to pricier suppliers earn less." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-y border-line text-left text-[11.5px] text-fg-3">
                <th className="py-2.5 pr-4 pl-5 font-medium">Supplier</th>
                <th className="px-4 py-2.5 font-medium">Supplier service ID</th>
                <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                <th className="px-4 py-2.5 text-right font-medium">Margin</th>
                <th className="w-[200px] px-4 py-2.5 font-medium">Split</th>
                <th className="py-2.5 pr-5 pl-4 text-right font-medium">Markup</th>
              </tr>
            </thead>
            <tbody>
              {mappings
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((m) => {
                  const mm = margin(s.price, m.cost)
                  const cheapest = enabled.length > 1 && m.enabled && m.cost === Math.min(...enabled.map((x) => x.cost))
                  return (
                    <tr key={m.id} className={cn('border-b border-line last:border-0 hover:bg-surface-2/50', !m.enabled && 'opacity-55')}>
                      <td className="py-3 pr-4 pl-5">
                        <div className="flex items-center gap-2.5">
                          <ProviderMark id={m.providerId} size="sm" />
                          <span className="font-medium whitespace-nowrap">{providers.get(m.providerId)?.name}</span>
                          <PriorityChip priority={m.priority} />
                          {cheapest && <Badge tone="success">Cheapest</Badge>}
                          {!m.enabled && <Badge>Disabled</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-2">{m.externalId}</td>
                      <td className="px-4 py-3 text-right tabular">{money(m.cost)}</td>
                      <td className={cn('px-4 py-3 text-right font-medium tabular', mm.abs < 0 ? 'text-danger' : 'text-fg')}>
                        {money(mm.abs)} <span className="font-normal text-fg-3">· {pct(mm.pct, 0)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <MarginBar price={s.price} cost={m.cost} />
                      </td>
                      <td className="py-3 pr-5 pl-4 text-right text-fg-2 tabular">{pct(mm.markup, 0)}</td>
                    </tr>
                  )
                })}
              {!mappings.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[13px] text-fg-3">
                    No supplier mapped yet — there is no cost to compare.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          icon={<Tags />}
          title="Price per pricing group"
          description="What each reseller tier pays for this service, after group discounts and per-service overrides."
          actions={
            <Button size="sm" variant="ghost" to="/admin/pricing" trailing={<ArrowRight />}>
              Pricing groups
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-y border-line text-left text-[11.5px] text-fg-3">
                <th className="py-2.5 pr-4 pl-5 font-medium">Group</th>
                <th className="px-4 py-2.5 font-medium">Rule</th>
                <th className="px-4 py-2.5 text-right font-medium">Group price</th>
                <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                <th className="px-4 py-2.5 text-right font-medium">Margin</th>
                <th className="px-4 py-2.5 text-right font-medium">Margin %</th>
                <th className="py-2.5 pr-5 pl-4 text-right font-medium">Markup</th>
              </tr>
            </thead>
            <tbody>
              {groups.isLoading
                ? Array.from({ length: 4 }, (_, i) => (
                    <tr key={i} className="border-b border-line">
                      <td colSpan={7} className="px-5 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : groups.data?.map((g) => <GroupRow key={g.id} group={g} service={s} />)}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-3">
          <Callout tone="neutral" className="border-0 bg-transparent px-0 py-0">
            Overrides are managed on the <Link to="/admin/pricing" className="text-accent-ink hover:underline">Pricing</Link> page. Margins use the P1 supplier cost; fallbacks may earn less.
          </Callout>
        </div>
      </Card>
    </div>
  )
}

function GroupRow({ group: g, service: s }: { group: PricingGroup; service: Service }) {
  const prices = usePrices(g.id)
  const row = prices.data?.find((r) => r.serviceId === s.id)
  const override = g.overrides.find((o) => o.serviceId === s.id)
  const groupPrice = row?.groupPrice ?? override?.price ?? +(s.price * (1 - g.discountPercent / 100)).toFixed(2)
  const cost = row?.cost ?? s.primaryCost
  const m = margin(groupPrice, cost)
  return (
    <tr className="border-b border-line last:border-0 hover:bg-surface-2/50">
      <td className="py-3 pr-4 pl-5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: g.color }} />
          <span className="font-medium">{g.name}</span>
          {g.isDefault && <Badge>Default</Badge>}
          <span className="text-[11.5px] text-fg-3">{num(g.resellersCount)} resellers</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {override ? (
          <Badge variant="outline">Override</Badge>
        ) : g.discountPercent ? (
          <span className="text-fg-2">−{g.discountPercent}% of list</span>
        ) : (
          <span className="text-fg-3">List price</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-medium tabular">{prices.isLoading ? <Skeleton className="ml-auto h-4 w-12" /> : money(groupPrice)}</td>
      <td className="px-4 py-3 text-right text-fg-2 tabular">{cost ? money(cost) : '—'}</td>
      <td className={cn('px-4 py-3 text-right tabular', m.abs < 0 ? 'text-danger' : 'text-fg')}>{cost ? money(m.abs) : '—'}</td>
      <td className="px-4 py-3 text-right tabular">{cost ? <span className={cn(m.pct >= 40 ? 'text-success' : m.pct > 0 ? 'text-fg' : 'text-danger')}>{pct(m.pct)}</span> : '—'}</td>
      <td className="py-3 pr-5 pl-4 text-right text-fg-2 tabular">{cost ? pct(m.markup) : '—'}</td>
    </tr>
  )
}
