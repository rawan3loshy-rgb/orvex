import { useMemo, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen,
  ChartColumn,
  Check,
  ChevronDown,
  CircleDollarSign,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  PackageX,
  Pencil,
  ReceiptText,
  Route,
  TrendingUp,
  Webhook,
  Workflow,
} from 'lucide-react'
import { ProviderMark, ServiceIcon, categoryColor } from '@/components/brand'
import { Button, Card, EmptyState, MenuLabel, Popover, Skeleton, StatusBadge, Tabs } from '@/components/ui'
import { useInstMutation, useService, useServiceMappings } from '@/hooks/installation'
import { servicesService } from '@/services/installation'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { money, num, pct, relative } from '@/lib/format'
import type { ServiceStatus } from '@/types/installation'
import { ServiceDetailsDrawer } from './components/ServiceForms'
import { AnalyticsTab, OrdersTab } from './components/service/ActivityTabs'
import { ApiSchemaTab, WebhooksTab } from './components/service/DocsTabs'
import { FieldsTab, ValidationTab } from './components/service/FieldsTab'
import { OverviewTab } from './components/service/OverviewTab'
import { PricingTab } from './components/service/PricingTab'
import { MappingsTab, RoutingTab } from './components/service/RoutingTab'
import { BackLink, DELIVERY, MetricStrip, SERVICE_STATUSES, STATUS_META, margin, turnaroundLabel, useProviderMap } from './components/shared'

type TabKey = 'overview' | 'pricing' | 'fields' | 'mappings' | 'routing' | 'api' | 'webhooks' | 'validation' | 'orders' | 'analytics'
const TAB_KEYS: TabKey[] = ['overview', 'pricing', 'fields', 'mappings', 'routing', 'api', 'webhooks', 'validation', 'orders', 'analytics']

export default function ServiceDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as TabKey | null
  const tab: TabKey = raw && TAB_KEYS.includes(raw) ? raw : 'overview'
  const setTab = (t: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (t === 'overview') n.delete('tab')
        else n.set('tab', t)
        return n
      },
      { replace: true },
    )

  const q = useService(id)
  const mq = useServiceMappings(id)
  const { map: providers } = useProviderMap()
  const [editing, setEditing] = useState(false)
  const s = q.data
  const mappings = useMemo(() => (mq.data ?? []).slice().sort((a, b) => a.priority - b.priority), [mq.data])

  const status = useInstMutation((st: ServiceStatus) => servicesService.update(id!, { status: st }), {
    success: (d) => `${d.name} is now ${STATUS_META[d.status].label.toLowerCase()}`,
  })

  if (q.isError) {
    return (
      <div>
        <BackLink to="/admin/services">Services</BackLink>
        <Card className="mt-6">
          <EmptyState icon={<PackageX />} title="Service not found" description={`No service with ID ${id} exists in this installation.`} action={<Button to="/admin/services" variant="secondary">Back to catalog</Button>} />
        </Card>
      </div>
    )
  }

  const primary = mappings.find((m) => m.enabled)
  const m = s ? margin(s.price, s.primaryCost) : null

  const tabs = [
    { value: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
    { value: 'pricing', label: 'Pricing', icon: <CircleDollarSign /> },
    { value: 'fields', label: 'Required fields', icon: <ListChecks />, count: s?.fields.length },
    { value: 'mappings', label: 'Supplier mappings', icon: <Workflow />, count: mq.data?.length },
    { value: 'routing', label: 'Routing', icon: <Route /> },
    { value: 'api', label: 'API schema', icon: <BookOpen /> },
    { value: 'webhooks', label: 'Webhooks', icon: <Webhook /> },
    { value: 'validation', label: 'Validation', icon: <FlaskConical /> },
    { value: 'orders', label: 'Orders', icon: <ReceiptText /> },
    { value: 'analytics', label: 'Analytics', icon: <ChartColumn /> },
  ] satisfies { value: TabKey; label: string; icon: ReactNode; count?: number }[]

  return (
    <div>
      <BackLink to="/admin/services">Service catalog</BackLink>

      {/* Header */}
      <div className="mt-4 mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {s ? (
          <div className="flex min-w-0 items-start gap-4">
            <ServiceIcon icon={s.icon} category={s.category} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.025em]">{s.name}</h1>
                <StatusBadge status={s.status} size="md" />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-fg-3">
                <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11.5px] text-fg-2">{s.id}</span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                  {s.category}
                </span>
                <span>·</span>
                <span>
                  {DELIVERY[s.delivery].label} · <span className="text-fg-2 tabular">{turnaroundLabel(s.turnaround)}</span> turnaround
                </span>
                {s.fields.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      Input
                      {s.fields.map((f) => (
                        <span key={f.key} className="rounded bg-surface-3 px-1 font-mono text-[11px] text-fg-2">
                          {f.key}
                        </span>
                      ))}
                    </span>
                  </>
                )}
                <span>·</span>
                <span>Updated {relative(s.updatedAt)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <Skeleton className="size-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
        )}
        {s && (
          <div className="flex flex-wrap items-center gap-2">
            <Popover
              placement="bottom-end"
              className="w-[300px]"
              trigger={({ toggle, open }) => (
                <Button variant="secondary" onClick={toggle} loading={status.isPending} trailing={<ChevronDown className={cn('transition-transform', open && 'rotate-180')} />}>
                  <span className="mr-0.5 text-fg-3">Status</span>
                  {STATUS_META[s.status].label}
                </Button>
              )}
            >
              {(close) => (
                <div>
                  <MenuLabel>Lifecycle</MenuLabel>
                  {SERVICE_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        close()
                        if (st === s.status) return
                        if (st === 'active' && !s.providersCount) toast.warning('No supplier mapped', 'The service is active but orders will fail until a supplier service is mapped.')
                        status.mutate(st)
                      }}
                      className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2', st === s.status && 'bg-surface-2')}
                    >
                      <span className="mt-0.5">
                        <StatusBadge status={st} noPulse />
                      </span>
                      <span className="min-w-0 flex-1 text-[12px] leading-snug text-fg-3">{STATUS_META[st].description}</span>
                      {st === s.status && <Check className="mt-0.5 size-4 shrink-0 text-accent-ink" />}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
            <Button variant="secondary" leading={<Pencil />} onClick={() => setEditing(true)}>
              Edit details
            </Button>
            <Button variant="primary" leading={<FlaskConical />} onClick={() => setTab('validation')} className="hidden sm:inline-flex">
              Test input
            </Button>
          </div>
        )}
      </div>

      {/* Key metrics */}
      <MetricStrip
        className="mb-6"
        loading={!s}
        items={[
          { label: 'Public price', value: s ? money(s.price) : '—', sub: 'Standard group · UnlockDesk website' },
          {
            label: 'Supplier cost',
            value: s?.primaryCost ? money(s.primaryCost) : '—',
            sub: primary ? (
              <span className="inline-flex items-center gap-1.5">
                <ProviderMark id={primary.providerId} size="xs" />
                {providers.get(primary.providerId)?.shortName ?? 'Primary'} · #{primary.externalId}
              </span>
            ) : (
              'No enabled mapping'
            ),
          },
          {
            label: 'Margin',
            icon: <TrendingUp />,
            value: s?.primaryCost && m ? money(m.abs) : '—',
            sub: s?.primaryCost && m ? `${pct(m.pct)} margin · ${pct(m.markup, 0)} markup` : 'Needs a provider cost',
            tone: m && s?.primaryCost ? (m.abs < 0 ? 'danger' : 'success') : undefined,
          },
          { label: 'Orders · 30d', value: s ? num(s.orders30d) : '—', sub: s?.orders30d ? `${num(Math.round(s.orders30d / 30))} per day avg` : 'No orders yet' },
          {
            label: 'Success rate',
            value: s?.orders30d ? pct(s.successRate30d) : '—',
            sub: 'Completed vs failed · 30d',
            tone: s?.orders30d ? (s.successRate30d >= 95 ? 'success' : s.successRate30d >= 90 ? 'warning' : 'danger') : undefined,
          },
        ]}
      />

      <Tabs items={tabs} value={tab} onChange={setTab} className="mb-6" />

      {s ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
            {tab === 'overview' && <OverviewTab service={s} mappings={mappings} providers={providers} onTab={setTab} onEdit={() => setEditing(true)} />}
            {tab === 'pricing' && <PricingTab service={s} mappings={mappings} providers={providers} />}
            {tab === 'fields' && <FieldsTab service={s} />}
            {tab === 'mappings' && <MappingsTab service={s} mappings={mappings} providers={providers} />}
            {tab === 'routing' && <RoutingTab service={s} mappings={mappings} providers={providers} />}
            {tab === 'api' && <ApiSchemaTab service={s} />}
            {tab === 'webhooks' && <WebhooksTab service={s} />}
            {tab === 'validation' && <ValidationTab service={s} />}
            {tab === 'orders' && <OrdersTab service={s} />}
            {tab === 'analytics' && <AnalyticsTab service={s} mappings={mappings} providers={providers} />}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-[320px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      )}

      {s && <ServiceDetailsDrawer service={s} open={editing} onClose={() => setEditing(false)} />}
    </div>
  )
}
