import { useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Activity, Boxes, ChartColumn, CloudDownload, KeyRound, Plug, PlugZap, Power, PowerOff, Puzzle, ScrollText, Webhook, Workflow, Zap } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Skeleton, StatusBadge, Tabs, Tooltip } from '@/components/ui'
import { useInstMutation, useProvider } from '@/hooks/installation'
import { providersService, type ConnectionTestResult } from '@/services/installation'
import { toast } from '@/stores/toast'
import { money, ms, num, pct, relative } from '@/lib/format'
import { ProviderFieldMapsTab, ProviderServicesTab } from './components/provider/CatalogTabs'
import { ConnectionTab, CredentialsTab } from './components/provider/ConnectionTab'
import { HealthTab, LogsTab, ProviderWebhooksTab, UsageTab } from './components/provider/OpsTabs'
import { BackLink, MetricStrip, balanceState } from './components/shared'

type TabKey = 'connection' | 'credentials' | 'services' | 'mappings' | 'health' | 'logs' | 'webhooks' | 'usage'
const TAB_KEYS: TabKey[] = ['connection', 'credentials', 'services', 'mappings', 'health', 'logs', 'webhooks', 'usage']

export default function ProviderDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as TabKey | null
  const tab: TabKey = raw && TAB_KEYS.includes(raw) ? raw : 'connection'
  const setTab = (t: string) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (t === 'connection') n.delete('tab')
        else n.set('tab', t)
        return n
      },
      { replace: true },
    )

  const q = useProvider(id)
  const p = q.data
  const [test, setTest] = useState<ConnectionTestResult | null>(null)
  const [testRun, setTestRun] = useState(0)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const runTest = useInstMutation(() => providersService.test(id!), {
    onMutate: () => {
      setTest(null)
      setTestRun((n) => n + 1)
    },
    onSuccess: (r) => {
      setTest(r)
      setTimeout(() => (r.ok ? toast.success('Connection healthy', r.message) : toast.error('Connection test failed', r.message)), 1800)
    },
  })
  const sync = useInstMutation(() => providersService.sync(id!), {
    success: (r) => `Service list synced · ${r.synced} mapped of ${r.remoteServices} supplier services`,
  })
  const setStatus = useInstMutation((status: 'operational' | 'disabled') => providersService.update(id!, { status }), {
    success: (d) => (d.status === 'disabled' ? `${d.shortName} disabled — skipped by routing` : `${d.shortName} re-enabled`),
    onSuccess: () => setConfirmDisable(false),
  })

  const startTest = () => {
    if (tab !== 'connection') setTab('connection')
    runTest.mutate()
  }

  if (q.isError) {
    return (
      <div>
        <BackLink to="/admin/providers">Providers</BackLink>
        <Card className="mt-6">
          <EmptyState icon={<PlugZap />} title="Supplier not found" description={`No supplier with ID ${id} is connected to this installation.`} action={<Button to="/admin/providers" variant="secondary">Back to providers</Button>} />
        </Card>
      </div>
    )
  }

  const tabs: { value: TabKey; label: string; icon: ReactNode; count?: number }[] = [
    { value: 'connection', label: 'Connection', icon: <Plug /> },
    { value: 'credentials', label: 'Credentials', icon: <KeyRound />, count: p?.credentials.length },
    { value: 'services', label: 'Services', icon: <Boxes />, count: p?.servicesCount },
    { value: 'mappings', label: 'Field maps', icon: <Workflow /> },
    { value: 'health', label: 'Health', icon: <Activity /> },
    { value: 'logs', label: 'Logs', icon: <ScrollText /> },
    { value: 'webhooks', label: 'Webhooks', icon: <Webhook /> },
    { value: 'usage', label: 'Usage', icon: <ChartColumn /> },
  ]

  const disabled = p?.status === 'disabled'
  const bal = p ? balanceState(p) : null

  return (
    <div>
      <BackLink to="/admin/providers">Providers</BackLink>

      <div className="mt-4 mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {p ? (
          <div className="flex min-w-0 items-start gap-4">
            <ProviderMark id={p.id} name={p.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.025em]">{p.name}</h1>
                <StatusBadge status={p.status} size="md" />
                {p.adapterId.startsWith('ext.') && (
                  <Badge variant="outline" icon={<Puzzle />} size="md">
                    Custom adapter
                  </Badge>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-[13px] text-fg-2">{p.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-fg-3">
                <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11.5px] text-fg-2">{p.adapterId}</span>
                <span>{p.protocol === 'SOAP / XML' ? 'DHRU-compatible XML' : p.protocol}</span>
                <span>·</span>
                <span>{p.region}</span>
                <span>·</span>
                <span>Connected {relative(p.connectedAt)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <Skeleton className="size-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        )}
        {p && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" leading={<Zap />} loading={runTest.isPending} onClick={startTest} disabled={disabled}>
              Test connection
            </Button>
            <Tooltip content={`Pull ${p.shortName}’s service list and prices · last synced ${relative(p.lastSyncAt)}`}>
              <Button variant="secondary" leading={<CloudDownload />} loading={sync.isPending} onClick={() => sync.mutate()} disabled={disabled}>
                Sync service list
              </Button>
            </Tooltip>
            {disabled ? (
              <Button variant="primary" leading={<Power />} loading={setStatus.isPending} onClick={() => setStatus.mutate('operational')}>
                Enable
              </Button>
            ) : (
              <Button variant="ghost" leading={<PowerOff />} className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmDisable(true)}>
                Disable
              </Button>
            )}
          </div>
        )}
      </div>

      <MetricStrip
        className="mb-6"
        cols="grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
        loading={!p}
        items={
          p
            ? [
                { label: 'Uptime · 30d', value: pct(p.uptime30d, 2), tone: p.uptime30d >= 99.9 ? 'success' : p.uptime30d >= 99 ? undefined : 'warning', sub: `Checked ${relative(p.lastCheckAt)}` },
                { label: 'Latency p50 / p95', value: `${num(p.latencyP50)} / ${num(p.latencyP95)}`, sub: `milliseconds · timeout ${ms(p.timeoutMs)}`, tone: p.latencyP50 > 600 ? 'warning' : undefined },
                { label: 'Success rate', value: pct(p.successRate), tone: p.successRate < 95 ? 'warning' : 'success', sub: 'Accepted ÷ attempts' },
                { label: 'Orders · 24h', value: num(p.orders24h), sub: 'Attempts incl. failovers' },
                { label: 'Services mapped', value: num(p.servicesCount), sub: `Rate limit ${num(p.rateLimit.requests)} req/${p.rateLimit.per === 'second' ? 's' : 'min'}` },
                { label: 'Supplier credit', value: money(p.balance), tone: bal?.tone === 'success' ? undefined : bal?.tone, sub: bal?.tone === 'success' ? `Alert below ${money(p.lowBalanceThreshold)}` : `${bal?.label} · ${money(p.lowBalanceThreshold)}` },
              ]
            : Array.from({ length: 6 }, () => ({ label: '—', value: '—' }))
        }
      />

      <Tabs items={tabs} value={tab} onChange={setTab} className="mb-6" />

      {p ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
            {tab === 'connection' && <ConnectionTab provider={p} test={test} testRun={testRun} testing={runTest.isPending} onTest={startTest} />}
            {tab === 'credentials' && <CredentialsTab provider={p} />}
            {tab === 'services' && <ProviderServicesTab provider={p} />}
            {tab === 'mappings' && <ProviderFieldMapsTab provider={p} />}
            {tab === 'health' && <HealthTab provider={p} />}
            {tab === 'logs' && <LogsTab provider={p} />}
            {tab === 'webhooks' && <ProviderWebhooksTab provider={p} />}
            {tab === 'usage' && <UsageTab provider={p} />}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      )}

      <ConfirmDialog
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={() => setStatus.mutate('disabled')}
        loading={setStatus.isPending}
        tone="danger"
        confirmLabel="Disable supplier"
        title={`Disable ${p?.name}?`}
        description={`Routing skips disabled suppliers immediately — ${p?.servicesCount ?? 0} mapped services fail over to their next supplier. In-flight unlock and code jobs at ${p?.shortName ?? 'the supplier'} still complete. Credentials and mappings are kept, so you can re-enable at any time.`}
      />
    </div>
  )
}
