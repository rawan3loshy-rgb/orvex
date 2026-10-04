import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, Workflow } from 'lucide-react'
import { Button, Card, CardHeader, ConfirmDialog, Skeleton } from '@/components/ui'
import { useInstMutation, useServiceMappings } from '@/hooks/installation'
import { mappingsService, servicesService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import type { Service, ServiceMapping } from '@/types/installation'
import { MappingDrawer, type MappingDrawerState } from './MappingDrawer'
import { MappingFlow } from './MappingFlow'
import { DELIVERY, STRATEGIES, turnaroundLabel, useProviderMap } from './shared'

/**
 * Editable mapping flow for one service: reorder priority, toggle, edit,
 * add and remove provider mappings — all persisted through the services layer.
 */
export function ServiceMappingEditor({ service, title, description, className, headerExtra }: { service: Service; title?: ReactNode; description?: ReactNode; className?: string; headerExtra?: ReactNode }) {
  const q = useServiceMappings(service.id)
  const { map: providers, data: providerList } = useProviderMap()
  const [drawer, setDrawer] = useState<MappingDrawerState>(null)
  const [confirm, setConfirm] = useState<ServiceMapping | null>(null)
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({})

  const dropLocalEnabled = (id: string) =>
    setLocalEnabled((s) => {
      if (!(id in s)) return s
      const n = { ...s }
      delete n[id]
      return n
    })
  const reorder = useInstMutation((order: string[]) => servicesService.reorderMappings(service.id, order), {
    success: 'Supplier priority updated',
    onError: () => setLocalOrder(null),
  })
  const toggle = useInstMutation((v: { id: string; enabled: boolean }) => mappingsService.update(v.id, { enabled: v.enabled }), {
    success: (_, v) => (v.enabled ? 'Mapping enabled' : 'Mapping disabled — skipped by routing'),
    onError: (_e, v) => dropLocalEnabled(v.id),
  })

  // Keep optimistic state until the refetched server data agrees with it (no flicker back).
  useEffect(() => {
    if (!q.data) return
    if (localOrder) {
      const server = q.data
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map((m) => m.id)
      if (server.join() === localOrder.join()) setLocalOrder(null)
    }
    for (const m of q.data) if (m.id in localEnabled && localEnabled[m.id] === m.enabled) dropLocalEnabled(m.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data])
  const remove = useInstMutation((id: string) => mappingsService.remove(id), { success: 'Mapping removed', onSuccess: () => setConfirm(null) })

  const mappings = useMemo(() => {
    const base = (q.data ?? []).map((m) => (m.id in localEnabled ? { ...m, enabled: localEnabled[m.id]! } : m))
    if (!localOrder) return base
    return base.map((m) => ({ ...m, priority: localOrder.indexOf(m.id) + 1 || m.priority }))
  }, [q.data, localOrder, localEnabled])

  const unmapped = useMemo(() => (providerList ?? []).filter((p) => !mappings.some((m) => m.providerId === p.id)), [providerList, mappings])

  const move = (m: ServiceMapping, dir: -1 | 1) => {
    const ids = mappings
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((x) => x.id)
    const i = ids.indexOf(m.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    setLocalOrder(ids)
    reorder.mutate(ids)
  }

  const costs = mappings.filter((m) => m.enabled).map((m) => m.cost)
  const spread = costs.length > 1 ? Math.max(...costs) - Math.min(...costs) : 0

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader
        icon={<Workflow />}
        title={title ?? 'Supplier mappings'}
        description={description ?? `${service.name} is fulfilled by ${mappings.length || 'no'} supplier service${mappings.length === 1 ? '' : 's'}. Orders flow left to right; Core fails over down the chain.`}
        actions={
          <>
            {headerExtra}
            <Button size="sm" variant="secondary" leading={<Plus />} disabled={!unmapped.length} onClick={() => setDrawer({ mode: 'create', serviceId: service.id })}>
              <span className="hidden sm:inline">Add mapping</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-line bg-surface-2/40 px-5 py-2 text-[12px] text-fg-3">
        <span>
          Strategy <span className="font-medium text-fg">{STRATEGIES[service.routingStrategy].label}</span>
        </span>
        <span>
          Mapped <span className="font-medium text-fg tabular">{mappings.length}</span>
        </span>
        <span>
          Cost spread <span className="font-medium text-fg tabular">{costs.length > 1 ? money(spread) : '—'}</span>
        </span>
        <span>
          Public price <span className="font-medium text-fg tabular">{money(service.price)}</span>
        </span>
        <span>
          Cheapest supplier <span className="font-medium text-fg tabular">{costs.length ? money(Math.min(...costs)) : '—'}</span>
        </span>
        <span className="hidden sm:inline">
          {DELIVERY[service.delivery].label} <span className="font-medium text-fg tabular">{turnaroundLabel(service.turnaround)}</span>
        </span>
      </div>
      <div className="relative bg-dots px-4 py-7 sm:px-7 sm:py-9">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/0 via-surface/40 to-surface/0" />
        {q.isLoading || !providers.size ? (
          <FlowSkeleton />
        ) : (
          <MappingFlow
            service={service}
            mappings={mappings}
            providers={providers}
            editable
            busy={reorder.isPending || remove.isPending}
            unmapped={unmapped}
            onMove={move}
            onToggle={(m, enabled) => {
              setLocalEnabled((s) => ({ ...s, [m.id]: enabled }))
              toggle.mutate({ id: m.id, enabled })
            }}
            onEdit={(m) => setDrawer({ mode: 'edit', mapping: m })}
            onRemove={(m) => setConfirm(m)}
            onAdd={() => setDrawer({ mode: 'create', serviceId: service.id })}
          />
        )}
      </div>
      <MappingDrawer state={drawer} onClose={() => setDrawer(null)} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && remove.mutate(confirm.id)}
        loading={remove.isPending}
        tone="danger"
        confirmLabel="Remove mapping"
        title={`Remove ${providers.get(confirm?.providerId ?? '')?.name ?? 'supplier'}?`}
        description={`${service.name} orders will no longer be routed to ${providers.get(confirm?.providerId ?? '')?.shortName ?? 'this supplier'} (service #${confirm?.externalId ?? '—'}). Remaining suppliers are re-prioritised automatically.`}
      />
    </Card>
  )
}

export function FlowSkeleton() {
  return (
    <div className="grid items-center gap-8 md:grid-cols-[240px_100px_1fr] md:gap-14">
      <Skeleton className="h-[148px] rounded-xl" />
      <Skeleton className="mx-auto size-[92px] rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
      </div>
    </div>
  )
}
