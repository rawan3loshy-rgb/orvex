import { Link } from 'react-router'
import { ArrowRight, Route, Workflow } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { Badge, Button, Card, CardHeader, DataTable, type Column } from '@/components/ui'
import { useInstMutation, useRoutingRules } from '@/hooks/installation'
import { servicesService } from '@/services/installation'
import { money, ms, pct, relative } from '@/lib/format'
import type { Provider, RoutingStrategy, Service, ServiceMapping } from '@/types/installation'
import { RoutingSimulator, StrategyCards, useStrategyPreview } from '../RoutingBits'
import { ServiceMappingEditor } from '../ServiceMappingEditor'
import { ActionPill, PriorityChip, STRATEGIES, conditionText, ruleInScope } from '../shared'

export function MappingsTab({ service: s, mappings, providers }: { service: Service; mappings: ServiceMapping[]; providers: Map<string, Provider> }) {
  const columns: Column<ServiceMapping>[] = [
    {
      key: 'provider',
      header: 'Supplier',
      sortValue: (m) => m.priority,
      cell: (m) => (
        <div className="flex items-center gap-2.5">
          <ProviderMark id={m.providerId} size="sm" />
          <span className="font-medium">{providers.get(m.providerId)?.name}</span>
          <PriorityChip priority={m.priority} />
          {!m.enabled && <Badge>Disabled</Badge>}
        </div>
      ),
    },
    {
      key: 'ext',
      header: 'Supplier service',
      cell: (m) => (
        <div className="min-w-0">
          <div className="font-mono text-[12px] text-fg">#{m.externalId}</div>
          <div className="truncate text-[11.5px] text-fg-3">{m.externalName}</div>
        </div>
      ),
    },
    { key: 'cost', header: 'Supplier cost', align: 'right', sortValue: (m) => m.cost, cell: (m) => money(m.cost) },
    { key: 'timeout', header: 'Timeout', align: 'right', hideBelow: 'md', sortValue: (m) => m.timeoutMs, cell: (m) => <span className="text-fg-2">{ms(m.timeoutMs)}</span> },
    { key: 'weight', header: 'Weight', align: 'right', hideBelow: 'lg', sortValue: (m) => m.weight, cell: (m) => <span className="text-fg-2">{m.weight}%</span> },
    { key: 'success', header: 'Success 30d', align: 'right', hideBelow: 'md', sortValue: (m) => m.successRate30d, cell: (m) => (m.successRate30d ? pct(m.successRate30d) : '—') },
    { key: 'lat', header: 'Avg latency', align: 'right', hideBelow: 'lg', sortValue: (m) => m.avgLatencyMs, cell: (m) => <span className="text-fg-2">{m.avgLatencyMs ? ms(m.avgLatencyMs) : '—'}</span> },
    { key: 'sync', header: 'Last synced', align: 'right', hideBelow: 'xl', cell: (m) => <span className="text-fg-3">{relative(m.lastSyncedAt)}</span> },
  ]
  return (
    <div className="space-y-5">
      <ServiceMappingEditor service={s} />
      <Card className="overflow-hidden">
        <CardHeader icon={<Workflow />} title="Mapping details" description="Supplier service IDs, timeouts and live performance per mapping." />
        <DataTable columns={columns} rows={mappings} rowKey={(m) => m.id} minWidth={720} dense empty={<div className="py-10 text-center text-[13px] text-fg-3">No mappings yet.</div>} />
      </Card>
    </div>
  )
}

export function RoutingTab({ service: s, mappings, providers }: { service: Service; mappings: ServiceMapping[]; providers: Map<string, Provider> }) {
  const rules = useRoutingRules()
  const scoped = (rules.data ?? []).filter((r) => ruleInScope(r, s))
  const preview = useStrategyPreview(mappings, providers)
  const update = useInstMutation((routingStrategy: RoutingStrategy) => servicesService.update(s.id, { routingStrategy }), {
    success: (d) => `Routing strategy set to ${STRATEGIES[d.routingStrategy].label}`,
  })
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={<Route />} title="Routing strategy" description="How the engine orders eligible suppliers for each new order. Rules below can still override it per order — by country, amount or supplier health." />
        <div className="px-5 pb-5">
          <StrategyCards value={s.routingStrategy} disabled={update.isPending} onChange={(v) => v !== s.routingStrategy && update.mutate(v)} preview={preview} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Rules in scope"
          description={`${scoped.length} routing rule${scoped.length === 1 ? '' : 's'} can apply to ${s.name}. Rules run top to bottom before the strategy.`}
          actions={
            <Button size="sm" variant="ghost" to="/admin/routing" trailing={<ArrowRight />}>
              Routing rules
            </Button>
          }
        />
        {scoped.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {scoped.map((r) => (
              <li key={r.id} className={r.enabled ? 'px-5 py-3' : 'px-5 py-3 opacity-55'}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-md bg-surface-3 font-mono text-[10.5px] text-fg-2">{r.order}</span>
                  <span className="text-[13px] font-medium">{r.name}</span>
                  {!r.enabled && <Badge>Disabled</Badge>}
                  <span className="ml-auto text-[11.5px] text-fg-3 tabular">{r.hits24h} hits · 24h</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
                  <span className="text-[11.5px] text-fg-3">when</span>
                  {r.conditions.map((c, i) => (
                    <span key={i} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
                      {conditionText(c)}
                    </span>
                  ))}
                  <ArrowRight className="size-3 text-fg-3" />
                  <ActionPill action={r.action} providers={providers} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-line px-5 py-6 text-[13px] text-fg-3">
            No routing rules target this service. <Link to="/admin/routing" className="text-accent-ink hover:underline">Create one</Link> to prefer or exclude suppliers by carrier country, supplier health or order amount.
          </p>
        )}
      </Card>

      <RoutingSimulator defaultServiceId={s.id} lockService title="Simulate an order" description={`Dry-run the engine for ${s.name}. Try an EU carrier country, an APAC country, a high-value amount or a strategy override.`} />
    </div>
  )
}
