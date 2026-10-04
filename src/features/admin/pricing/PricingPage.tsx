import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Calculator, Pencil, Plus, ShieldAlert, Trash2, Users } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, PageHeader, SearchInput, Segmented, Select, Skeleton, Tooltip } from '@/components/ui'
import { Guarded, MarginGuardBadge, PriceSteps, useCan } from '@/components/domain'
import { useCategories, useInstMutation, usePriceMatrix, usePricing, useQuote, useServices } from '@/hooks/installation'
import { pricingService } from '@/services/installation'
import { formatBps, formatMoney, type Micros } from '@/core/money'
import type { PriceMatrixRow, PricingOverview } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, num } from '@/lib/format'
import { Callout, ErrorPanel } from '../catalog/kit'
import { METHOD_LABEL, ruleValueLabel } from '../services/detail/pricingLabels'
import { RuleDrawer } from './RuleDrawer'

type RuleRow = PricingOverview['rules'][number]
const GUARD_CELL: Record<string, string> = {
  ok: 'text-fg',
  low_margin: 'bg-warning/10 text-warning',
  negative_margin: 'bg-danger/12 text-danger font-semibold',
  no_cost: 'text-fg-3',
}

export default function PricingPage() {
  const [params, setParams] = useSearchParams()
  const guard = params.get('guard') ?? ''
  const pricing = usePricing()
  const [drawer, setDrawer] = useState<{ open: boolean; rule: RuleRow | null; tierId?: string }>({ open: false, rule: null })
  const [deleting, setDeleting] = useState<RuleRow | null>(null)
  const [sim, setSim] = useState<{ serviceId: string; tierId: string }>({ serviceId: '', tierId: '' })
  const can = useCan('pricing.manage')
  const del = useInstMutation((id: string) => pricingService.deleteRule(id), { success: 'Rule deleted — prices recalculated', onSuccess: () => setDeleting(null) })

  const tiers = pricing.data?.tiers ?? []
  const rulesByTier = useMemo(() => {
    const m = new Map<string, RuleRow[]>()
    const rank = { service: 0, category: 1, all: 2 } as const
    for (const r of pricing.data?.rules ?? []) m.set(r.tierId, [...(m.get(r.tierId) ?? []), r])
    for (const xs of m.values()) xs.sort((a, b) => rank[b.scope.kind] - rank[a.scope.kind] || a.scopeLabel.localeCompare(b.scopeLabel))
    return m
  }, [pricing.data])

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Tier rules turn supplier cost into prices. Prices are calculated live by one engine for every channel — never duplicated into the website. Orders snapshot the final price."
        actions={
          <Guarded permission="pricing.manage">
            {(ok) => (
              <Button variant="accent" leading={<Plus />} disabled={!ok} onClick={() => setDrawer({ open: true, rule: null })}>
                New rule
              </Button>
            )}
          </Guarded>
        }
      />

      {pricing.isError ? (
        <ErrorPanel error={pricing.error} onRetry={() => pricing.refetch()} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {pricing.isLoading
              ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
              : tiers.map((t) => {
                  const rs = rulesByTier.get(t.id) ?? []
                  const def = rs.find((r) => r.scope.kind === 'all')
                  return (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[14px] font-semibold">
                          <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                          {t.name}
                        </span>
                        {t.isDefault && <Badge tone="accent">default</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 min-h-[34px] text-[12px] text-fg-3">{t.description}</p>
                      <div className="mt-2 flex items-center justify-between text-[12px]">
                        <span className="inline-flex items-center gap-1 text-fg-2">
                          <Users className="size-3.5 text-fg-3" /> {num(t.accounts)} accounts
                        </span>
                        <span className="font-mono text-fg-2">{def ? ruleValueLabel(def) : t.isDefault ? 'list prices' : 'inherits default'}</span>
                      </div>
                      <div className="mt-1 text-[11.5px] text-fg-3">{rs.length} rules</div>
                    </Card>
                  )
                })}
          </div>

          <Card className="mb-5">
            <CardHeader title="Rules" description="Grouped by tier. Service rules override category rules, which override the tier default. A tier with no matching rule inherits the default tier." />
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-[920px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] text-fg-3">
                    <th className="py-2 pr-3 pl-5 font-medium">Scope</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                    <th className="px-3 py-2 font-medium">Rounding</th>
                    <th className="px-3 py-2 text-right font-medium">Min margin</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="py-2 pr-5 pl-3" />
                  </tr>
                </thead>
                <tbody>
                  {pricing.isLoading && (
                    <tr>
                      <td colSpan={8} className="p-5">
                        <Skeleton className="h-40" />
                      </td>
                    </tr>
                  )}
                  {tiers.map((t) => {
                    const rs = rulesByTier.get(t.id) ?? []
                    return [
                      <tr key={`h-${t.id}`} className="bg-surface-2/50">
                        <td colSpan={8} className="border-b border-line py-1.5 pr-5 pl-5">
                          <span className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-[12px] font-semibold">
                              <span className="size-2 rounded-full" style={{ background: t.color }} />
                              {t.name} <span className="font-normal text-fg-3">· {rs.length} rules</span>
                            </span>
                            {can && (
                              <button type="button" className="text-[11.5px] text-accent-ink hover:underline" onClick={() => setDrawer({ open: true, rule: null, tierId: t.id })}>
                                + rule
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>,
                      ...rs.map((r) => (
                        <tr key={r.id} className={cn('border-b border-line hover:bg-surface-2/40', !r.enabled && 'opacity-50')}>
                          <td className="py-2 pr-3 pl-5">
                            <span className="flex items-center gap-2">
                              <Badge tone="neutral" variant="outline">
                                {r.scope.kind}
                              </Badge>
                              {r.scope.kind === 'service' ? (
                                <Link to={`/admin/services/${r.scope.serviceId}?tab=pricing`} className="truncate hover:underline">
                                  {r.scopeLabel}
                                </Link>
                              ) : (
                                <span className="truncate">{r.scopeLabel}</span>
                              )}
                              {!r.enabled && <Badge tone="neutral">disabled</Badge>}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-fg-2">{METHOD_LABEL[r.method]}</td>
                          <td className="px-3 py-2 text-right font-mono">{r.method === 'cost_plus_percent' ? formatBps(r.value, r.value % 100 ? 1 : 0) : formatMoney(r.value as Micros)}</td>
                          <td className="px-3 py-2 text-fg-2">
                            {r.rounding.mode} to {formatMoney(r.rounding.increment)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-fg-2">{r.minMarginBps != null ? formatBps(r.minMarginBps, 0) : <span className="text-fg-3">8% default</span>}</td>
                          <td className="max-w-[240px] truncate px-3 py-2 text-fg-3" title={r.note}>
                            {r.note || '—'}
                          </td>
                          <td className="px-3 py-2 text-[11.5px] text-fg-3">
                            {r.updatedBy}
                            <div>{dateTime(r.updatedAt)}</div>
                          </td>
                          <td className="py-2 pr-5 pl-3">
                            <div className="flex justify-end gap-0.5">
                              <Guarded permission="pricing.manage">
                                {(ok) => (
                                  <Button size="xs" variant="ghost" icon disabled={!ok} onClick={() => setDrawer({ open: true, rule: r })} aria-label="Edit rule">
                                    <Pencil />
                                  </Button>
                                )}
                              </Guarded>
                              <Guarded permission="pricing.manage">
                                {(ok) => (
                                  <Button size="xs" variant="ghost" icon disabled={!ok} onClick={() => setDeleting(r)} aria-label="Delete rule">
                                    <Trash2 />
                                  </Button>
                                )}
                              </Guarded>
                            </div>
                          </td>
                        </tr>
                      )),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <PriceMatrix tiers={tiers} guard={guard} onGuard={(g) => setParams(g ? { guard: g } : {}, { replace: true })} onPick={(serviceId, tierId) => setSim({ serviceId, tierId })} />
            <Simulator tiers={tiers} value={sim} onChange={setSim} />
          </div>
        </>
      )}

      <RuleDrawer open={drawer.open} onClose={() => setDrawer({ open: false, rule: null })} rule={drawer.rule} tiers={tiers} defaultTierId={drawer.tierId} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
        tone="danger"
        title="Delete pricing rule?"
        description={deleting ? `${deleting.label}. Affected services fall back to the next matching rule (category → all → default tier). Placed orders keep their snapshotted price.` : ''}
        confirmLabel="Delete rule"
      />
    </div>
  )
}

function PriceMatrix({ tiers, guard, onGuard, onPick }: { tiers: PricingOverview['tiers']; guard: string; onGuard: (g: string) => void; onPick: (serviceId: string, tierId: string) => void }) {
  const categories = useCategories()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const q = usePriceMatrix({ guard: guard || undefined, search: search || undefined, categoryId: categoryId || undefined })
  return (
    <Card className="min-w-0">
      <CardHeader title="Price matrix" description="Services × tiers, calculated now. Click a price to explain it." icon={<ShieldAlert />} />
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search services…" className="w-full sm:w-56" />
        <Select inputSize="sm" className="w-44" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: '', label: 'All categories' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        <Segmented
          size="xs"
          className="ml-auto"
          value={guard}
          onChange={onGuard}
          items={[
            { value: '', label: 'All' },
            { value: 'negative_margin', label: 'Negative margin' },
            { value: 'low_margin', label: 'Low margin' },
          ]}
        />
      </div>
      <div className="max-h-[560px] overflow-auto border-t border-line">
        {q.isError ? (
          <ErrorPanel error={q.error} onRetry={() => q.refetch()} className="m-4" />
        ) : q.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : q.data?.length === 0 ? (
          <EmptyState compact icon={<ShieldAlert />} title={guard ? 'No services with this margin state' : 'No services match'} description={guard === 'negative_margin' ? 'Every tier price covers its supplier cost.' : undefined} />
        ) : (
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead className="sticky top-0 z-[1] bg-surface">
              <tr className="border-b border-line text-left text-[11.5px] text-fg-3">
                <th className="py-2 pr-3 pl-5 font-medium">Service</th>
                <th className="px-3 py-2 text-right font-medium">Ref. cost</th>
                {tiers.map((t) => (
                  <th key={t.id} className="px-3 py-2 text-right font-medium">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data?.map((row: PriceMatrixRow) => (
                <tr key={row.serviceId} className="border-b border-line last:border-0 hover:bg-surface-2/30">
                  <td className="py-1.5 pr-3 pl-5">
                    <Link to={`/admin/services/${row.serviceId}?tab=pricing`} className="block max-w-[260px] truncate font-medium hover:underline">
                      {row.name}
                    </Link>
                    <div className="text-[11px] text-fg-3">{row.categoryName}</div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg-3">{formatMoney(row.referenceCost)}</td>
                  {tiers.map((t) => {
                    const p = row.prices[t.id]
                    if (!p) return <td key={t.id} className="px-3 py-1.5 text-right text-fg-3">—</td>
                    return (
                      <td key={t.id} className="px-2 py-1 text-right">
                        <Tooltip content={`${t.name}: ${METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] ?? p.method}${p.inherited ? ' (inherited from default tier)' : ''} · margin ${formatBps(p.marginBps)}`}>
                          <button type="button" onClick={() => onPick(row.serviceId, t.id)} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-mono tabular transition-colors hover:ring-1 hover:ring-line-strong', GUARD_CELL[p.guard])}>
                            {p.inherited && <span className="text-[9px] text-fg-3">↳</span>}
                            {formatMoney(p.amount)}
                          </button>
                        </Tooltip>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-[11.5px] text-fg-3">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm bg-danger/40" /> negative margin
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm bg-warning/40" /> low margin
        </span>
        <span>↳ inherited from the default tier</span>
      </div>
    </Card>
  )
}

function Simulator({ tiers, value, onChange }: { tiers: PricingOverview['tiers']; value: { serviceId: string; tierId: string }; onChange: (v: { serviceId: string; tierId: string }) => void }) {
  const services = useServices()
  const serviceId = value.serviceId || 'svc_4011'
  const tierId = value.tierId || tiers.find((t) => !t.isDefault && t.name === 'Platinum')?.id || tiers[0]?.id || ''
  const q = useQuote(serviceId, tierId || undefined)
  return (
    <Card className="self-start xl:sticky xl:top-4">
      <CardHeader title="Why this price?" description="Pick a service and a tier — the engine explains every step." icon={<Calculator />} />
      <CardBody className="space-y-3">
        <Select value={serviceId} onChange={(e) => onChange({ serviceId: e.target.value, tierId })} options={(services.data ?? []).map((s) => ({ value: s.service.id, label: `${s.service.name} (#${s.service.code})` }))} />
        <Segmented className="w-full" value={tierId} onChange={(t) => onChange({ serviceId, tierId: t })} items={tiers.map((t) => ({ value: t.id, label: t.name }))} />
        {q.isLoading ? (
          <Skeleton className="h-52 rounded-lg" />
        ) : q.isError ? (
          <ErrorPanel error={q.error} onRetry={() => q.refetch()} />
        ) : q.data ? (
          <>
            <PriceSteps quote={q.data} />
            {q.data.guard === 'negative_margin' && (
              <Callout tone="danger" icon={<ShieldAlert />} title="Negative margin">
                The price is below the reference supplier cost. The margin guard will skip offers costing more than the order price — orders route to a cheaper offer if one is routable, otherwise the service is unavailable for this tier.
              </Callout>
            )}
            <div className="flex items-center justify-between">
              <MarginGuardBadge guard={q.data.guard} />
              <Link to={`/admin/services/${serviceId}?tab=pricing`} className="text-[12px] text-accent-ink hover:underline">
                Service pricing →
              </Link>
            </div>
          </>
        ) : null}
        <p className="text-[11.5px] text-fg-3">Price is calculated live, not stored on the service or the website. When an order is placed this exact quote is snapshotted on it.</p>
      </CardBody>
    </Card>
  )
}
