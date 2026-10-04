import { useSearchParams } from 'react-router'
import { ArrowDownToLine, ArrowUpFromLine, Send, Webhook } from 'lucide-react'
import { useWebhooks } from '@/hooks/installation'
import { Button, KpiCard, PageHeader, Tabs } from '@/components/ui'
import { num } from '@/lib/format'
import { EndpointsTab } from './webhooks/EndpointsTab'
import { DeliveriesTab, type DeliveryFilters } from './webhooks/DeliveriesTab'
import { InboundTab } from './webhooks/InboundTab'

type Tab = 'endpoints' | 'deliveries' | 'inbound'
type EpStatus = 'all' | 'active' | 'failing' | 'disabled'

export default function WebhooksPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'inbound' ? 'inbound' : params.get('tab') === 'deliveries' ? 'deliveries' : 'endpoints'
  const epStatus = (['active', 'failing', 'disabled'].includes(params.get('status') ?? '') ? params.get('status') : 'all') as EpStatus
  const filters: DeliveryFilters = { endpointId: params.get('endpoint') ?? '', status: params.get('dstatus') ?? '', event: params.get('event') ?? '' }

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const hooks = useWebhooks()
  const all = hooks.data ?? []
  const delivered = all.reduce((a, w) => a + w.deliveries24h, 0)
  const failed = all.reduce((a, w) => a + w.failed24h, 0)
  const retrying = all.reduce((a, w) => a + w.retrying, 0)
  const failing = all.filter((w) => w.status === 'failing').length

  return (
    <div>
      <PageHeader
        icon={<Webhook />}
        title="Webhooks"
        description="Outbound events signed per Standard Webhooks (webhook-id · webhook-timestamp · webhook-signature) and inbound callbacks from suppliers and payment gateways."
        actions={
          <Button variant="secondary" to="/admin/developer/api#webhook-signatures">
            Signature docs
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Endpoints" value={num(all.length)} loading={hooks.isLoading} footer={`${num(all.filter((w) => !w.accountId).length)} installation-level`} />
        <KpiCard label="Deliveries · 24h" value={num(delivered)} loading={hooks.isLoading} icon={<Send />} footer="All endpoints" />
        <KpiCard label="Failed · retrying" value={`${num(failed)} · ${num(retrying)}`} loading={hooks.isLoading} footer="8 attempts over ~32 h" onClick={() => update({ tab: 'deliveries', dstatus: 'failed' })} />
        <KpiCard
          label="Failing endpoints"
          value={<span className={failing ? 'text-danger' : undefined}>{num(failing)}</span>}
          loading={hooks.isLoading}
          footer={failing ? 'Receiver returning errors' : 'All receivers healthy'}
          onClick={() => update({ tab: null, status: 'failing' })}
        />
      </div>

      <Tabs<Tab>
        className="mb-4"
        value={tab}
        onChange={(t) => update({ tab: t === 'endpoints' ? null : t })}
        items={[
          { value: 'endpoints', label: 'Outbound endpoints', icon: <ArrowUpFromLine />, count: all.length || undefined },
          { value: 'deliveries', label: 'Deliveries', icon: <Send /> },
          { value: 'inbound', label: 'Inbound', icon: <ArrowDownToLine /> },
        ]}
      />

      {tab === 'endpoints' && (
        <EndpointsTab status={epStatus} onStatus={(s) => update({ status: s === 'all' ? null : s })} onShowDeliveries={(endpointId, status) => update({ tab: 'deliveries', endpoint: endpointId, dstatus: status ?? null, status: null })} />
      )}
      {tab === 'deliveries' && (
        <DeliveriesTab
          filters={filters}
          onFilters={(f) => update({ ...(f.endpointId !== undefined && { endpoint: f.endpointId || null }), ...(f.status !== undefined && { dstatus: f.status || null }), ...(f.event !== undefined && { event: f.event || null }) })}
        />
      )}
      {tab === 'inbound' && <InboundTab />}
    </div>
  )
}
