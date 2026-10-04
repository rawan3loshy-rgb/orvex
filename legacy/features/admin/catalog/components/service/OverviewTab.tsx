import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Circle, CircleCheck, Globe, Pencil, Plug, Route, TriangleAlert } from 'lucide-react'
import { ProviderMark, categoryColor } from '@/components/brand'
import { Button, Card, CardBody, CardHeader, DescriptionList, ProgressRing, Switch } from '@/components/ui'
import { useInstMutation, useRoutingRules } from '@/hooks/installation'
import { servicesService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { date, money, relative } from '@/lib/format'
import type { Provider, Service, ServiceMapping } from '@/types/installation'
import { FlowConnector } from '../RoutingBits'
import { DELIVERY, ROLE_META, ROLES, STRATEGIES, effectiveChain, ruleInScope, turnaroundLabel } from '../shared'

export function OverviewTab({ service: s, mappings, providers, onTab, onEdit }: { service: Service; mappings: ServiceMapping[]; providers: Map<string, Provider>; onTab: (t: string) => void; onEdit: () => void }) {
  const rules = useRoutingRules()
  const chain = effectiveChain(mappings, s.routingStrategy, providers)
  const S = STRATEGIES[s.routingStrategy]
  const D = DELIVERY[s.delivery]
  const scopedRules = (rules.data ?? []).filter((r) => r.enabled && ruleInScope(r, s))
  const visibility = useInstMutation((v: Service['visibility']) => servicesService.update(s.id, { visibility: v }), {
    success: (d) => `Visibility updated · ${[d.visibility.website && 'website', d.visibility.api && 'API'].filter(Boolean).join(' & ') || 'hidden everywhere'}`,
  })

  const enabled = mappings.filter((m) => m.enabled)
  const checks = [
    { label: 'Input schema defined', ok: s.fields.length > 0, detail: s.fields.length ? `${s.fields.length} fields` : 'No fields yet', tab: 'fields' },
    { label: 'Supplier mapped', ok: enabled.length > 0, detail: enabled.length ? `${enabled.length} enabled` : 'Map a supplier', tab: 'mappings' },
    { label: 'Fallback configured', ok: enabled.length > 1, warn: enabled.length === 1, detail: enabled.length > 1 ? `${enabled.length - 1} fallback` : 'Single point of failure', tab: 'mappings' },
    { label: 'Price covers supplier cost', ok: s.price > 0 && s.primaryCost > 0 && s.price >= s.primaryCost, detail: s.primaryCost ? `${money(s.price - s.primaryCost)} margin` : 'No cost yet', tab: 'pricing' },
    { label: 'Published to a channel', ok: s.visibility.website || s.visibility.api, detail: s.visibility.website || s.visibility.api ? [s.visibility.website && 'Website', s.visibility.api && 'API'].filter(Boolean).join(' · ') : 'Hidden', tab: 'overview' },
    { label: 'Status active', ok: s.status === 'active', detail: s.status, tab: 'overview' },
  ]
  const passed = checks.filter((c) => c.ok).length
  const score = Math.round((passed / checks.length) * 100)

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader
            title="About this service"
            description="Shown on the UnlockDesk website, in the Reseller API catalog and on order confirmations."
            actions={
              <Button size="sm" variant="ghost" leading={<Pencil />} onClick={onEdit}>
                Edit
              </Button>
            }
          />
          <CardBody>
            <p className="max-w-2xl text-[13.5px] leading-relaxed text-fg-2">{s.description || <span className="text-fg-3 italic">No description yet.</span>}</p>
            <DescriptionList
              className="mt-5"
              columns={2}
              items={[
                {
                  label: 'Category',
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                      {s.category}
                    </span>
                  ),
                },
                {
                  label: 'Delivery',
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <D.icon className="size-3.5 text-fg-3" />
                      {D.label}
                    </span>
                  ),
                },
                { label: 'Expected turnaround', value: turnaroundLabel(s.turnaround), hint: s.delivery === 'instant' ? 'Result returned in the API response' : 'Supplier processing time — result via webhook' },
                {
                  label: 'Order input',
                  value: s.fields.length ? (
                    <span className="flex flex-wrap gap-1">
                      {s.fields.map((f) => (
                        <span key={f.key} className="rounded bg-surface-3 px-1.5 py-px font-mono text-[11.5px] text-fg-2" title={f.label}>
                          {f.key}
                        </span>
                      ))}
                    </span>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Slug', value: s.slug, mono: true },
                { label: 'Created', value: date(s.createdAt) },
                { label: 'Last updated', value: relative(s.updatedAt) },
              ]}
            />
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] text-fg-3">Tags</span>
              {s.tags.length ? (
                s.tags.map((t) => (
                  <span key={t} className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[11.5px] text-fg-2">
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-fg-3">—</span>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            icon={<Route />}
            title="Routing at a glance"
            description={`${S.label} strategy · ${chain.length} eligible supplier${chain.length === 1 ? '' : 's'} · Core tries up to three before failing and refunding the order.`}
            actions={
              <Button size="sm" variant="ghost" trailing={<ArrowRight />} onClick={() => onTab('mappings')}>
                Mapping editor
              </Button>
            }
          />
          <div className="border-t border-line bg-dots px-5 py-6">
            {chain.length ? (
              <div className="flex flex-col xl:flex-row xl:items-stretch">
                {chain.slice(0, 3).map((m, i) => {
                  const p = providers.get(m.providerId)
                  const role = ROLES[i]!
                  return (
                    <Fragment key={m.id}>
                      {i > 0 && <FlowConnector breakpoint="xl" color={ROLE_META[role].color} delay={i * 0.3} />}
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface p-3.5 shadow-card">
                        <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: ROLE_META[role].color }} />
                        <div className="mono-label" style={{ color: ROLE_META[role].ink }}>
                          {ROLE_META[role].label}
                        </div>
                        <div className="mt-2 flex items-center gap-2.5">
                          <ProviderMark id={m.providerId} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold">{p?.name}</div>
                            <div className="truncate font-mono text-[11px] text-fg-3">{p?.shortName ?? 'Supplier'} #{m.externalId}</div>
                          </div>
                          <span className="ml-auto text-[13px] font-medium tabular">{money(m.cost)}</span>
                        </div>
                      </motion.div>
                    </Fragment>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/[0.05] p-4 text-[13px]">
                <TriangleAlert className="size-4 text-warning" />
                No eligible supplier. Orders for this service would fail and be refunded.
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onTab('mappings')}>
                  Map a supplier
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Readiness" description={passed === checks.length ? 'Fully configured and live.' : `${checks.length - passed} item${checks.length - passed === 1 ? '' : 's'} need attention.`} actions={<ProgressRing value={score} tone={score === 100 ? 'success' : score >= 66 ? 'accent' : 'warning'}>{score}</ProgressRing>} />
          <CardBody className="pt-0">
            <ul className="space-y-0.5">
              {checks.map((c) => (
                <li key={c.label}>
                  <button type="button" onClick={() => onTab(c.tab)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2">
                    {c.ok ? <CircleCheck className="size-4 shrink-0 text-success" /> : c.warn ? <TriangleAlert className="size-4 shrink-0 text-warning" /> : <Circle className="size-4 shrink-0 text-fg-3" />}
                    <span className={cn('flex-1 text-[13px]', c.ok ? 'text-fg' : 'text-fg-2')}>{c.label}</span>
                    <span className="truncate text-[11.5px] text-fg-3 capitalize">{c.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Visibility" description="Where customers can order this service." />
          <CardBody className="space-y-2 pt-0">
            <VisibilityRow icon={<Globe />} label="Public website" hint="Listed on UnlockDesk with live price" checked={s.visibility.website} disabled={visibility.isPending} onChange={(v) => visibility.mutate({ ...s.visibility, website: v })} />
            <VisibilityRow icon={<Plug />} label="Reseller API" hint="Returned by GET /api/v1/services" checked={s.visibility.api} disabled={visibility.isPending} onChange={(v) => visibility.mutate({ ...s.visibility, api: v })} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Routing strategy" />
          <CardBody className="pt-0">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: S.color, background: `color-mix(in oklab, ${S.color} 12%, transparent)` }}>
                <S.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{S.label}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{S.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
              <span className="text-fg-3">
                {scopedRules.length} active rule{scopedRules.length === 1 ? '' : 's'} in scope ·{' '}
                <Link to="/admin/routing" className="text-accent-ink hover:underline">
                  view
                </Link>
              </span>
              <Button size="xs" variant="secondary" onClick={() => onTab('routing')}>
                Change
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function VisibilityRow({ icon, label, hint, checked, onChange, disabled }: { icon: ReactNode; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors', checked ? 'border-accent/25 bg-accent/[0.03]' : 'border-line')}>
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 [&_svg]:size-4', checked ? 'text-accent-ink' : 'text-fg-3')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="truncate text-[11.5px] text-fg-3">{hint}</div>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  )
}
