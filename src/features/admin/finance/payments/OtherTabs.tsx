/** Payments page — Methods, Refunds and Chargebacks tabs. */
import { Link } from 'react-router'
import { CreditCard, Landmark, ShieldAlert, Undo2, Wallet } from 'lucide-react'
import { formatBps } from '@/core/money'
import type { Chargeback, PaymentMethodConfig, Refund } from '@/types/installation'
import { financeService } from '@/services/installation'
import { useChargebacks, useInstMutation, usePaymentMethods, useRefunds } from '@/hooks/installation'
import { Guarded, Money, PermissionHint, SimulatedBadge, useCan } from '@/components/domain'
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Skeleton, StatusBadge, Switch, type Column } from '@/components/ui'
import { dateTime } from '@/lib/format'
import { Explainer, LoadError } from '../shared'

const METHOD_ICON: Record<string, typeof CreditCard> = { card: CreditCard, paypal: Wallet, bank_transfer: Landmark, manual: Landmark }
const SETTLEMENT: Record<PaymentMethodConfig['settlement'], string> = { instant: 'Instant — webhook confirms', async: 'Async — confirmed later by webhook', manual_confirmation: 'Manual — finance confirms receipt' }

export function MethodsTab() {
  const q = usePaymentMethods()
  const can = useCan('payments.manage')
  const toggle = useInstMutation(({ id, enabled }: { id: string; enabled: boolean }) => financeService.setPaymentMethod(id, enabled), { success: (m) => `${m.name} ${m.enabled ? 'enabled' : 'disabled'}` })
  if (q.isError) return <Card><LoadError what="payment methods" onRetry={() => q.refetch()} /></Card>
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {q.isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)
          : q.data?.map((m) => {
              const Icon = METHOD_ICON[m.id] ?? CreditCard
              return (
                <Card key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold">{m.name}</span>
                          <SimulatedBadge />
                          {m.customerFacing ? <Badge tone="neutral">Customer-facing</Badge> : <Badge tone="neutral" variant="outline">Operator only</Badge>}
                        </div>
                        <div className="mt-0.5 text-[12px] text-fg-3">{m.gateway}</div>
                      </div>
                    </div>
                    <Guarded permission="payments.manage">
                      {(allowed) => <Switch checked={m.enabled} disabled={!allowed || !can || toggle.isPending} label={`Enable ${m.name}`} onChange={(v) => toggle.mutate({ id: m.id, enabled: v })} />}
                    </Guarded>
                  </div>
                  <dl className="mt-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-[12px]">
                    <div className="bg-surface px-3 py-2">
                      <dt className="text-fg-3">Fee</dt>
                      <dd className="mt-0.5 font-mono tabular">{m.fee.bps || m.fee.fixed ? <>{formatBps(m.fee.bps)} + <Money value={m.fee.fixed} /></> : 'None'}</dd>
                    </div>
                    <div className="bg-surface px-3 py-2">
                      <dt className="text-fg-3">Settlement</dt>
                      <dd className="mt-0.5">{SETTLEMENT[m.settlement]}</dd>
                    </div>
                  </dl>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-fg-3">{m.instructions}</p>
                </Card>
              )
            })}
      </div>
      <div className="flex justify-end">
        <PermissionHint permission="payments.manage" />
      </div>
      <Explainer title="No real gateway is connected">
        Every method is simulated in this prototype (“Demo Card Gateway”, “Demo PayPal (sandbox)”). The integration points are real: payment intents, signed gateway webhooks with duplicate detection, refunds and chargebacks all go through the same commands and ledger postings a production gateway driver would use.
      </Explainer>
    </div>
  )
}

type RefundRow = Refund & { orderRef: string | null; accountName: string }

export function RefundsTab() {
  const q = useRefunds()
  const columns: Column<RefundRow>[] = [
    { key: 'ref', header: 'Refund', cell: (r) => <div><div className="font-mono text-[12.5px] font-medium">{r.ref}</div><div className="text-[11px] text-fg-3">{dateTime(r.createdAt)}</div></div> },
    { key: 'order', header: 'Order', cell: (r) => (r.orderId ? <Link to={`/admin/orders/${r.orderId}`} className="font-mono text-[12.5px] text-accent-ink hover:underline">{r.orderRef ?? r.orderId}</Link> : <span className="text-fg-3">—</span>) },
    { key: 'account', header: 'Account', hideBelow: 'md', cell: (r) => <Link to={`/admin/accounts/${r.accountId}`} className="text-[12.5px] text-fg-2 hover:text-accent-ink hover:underline">{r.accountName}</Link> },
    { key: 'dest', header: 'Destination', hideBelow: 'sm', cell: (r) => <Badge tone="neutral" variant="outline">{r.destination === 'wallet' ? 'Wallet' : 'Original method'}</Badge> },
    { key: 'reason', header: 'Reason', hideBelow: 'lg', cell: (r) => <span className="line-clamp-1 max-w-[260px] text-[12.5px] text-fg-2" title={r.reason}>{r.reason}</span> },
    { key: 'actor', header: 'Actor', hideBelow: 'xl', cell: (r) => <span className="text-[12.5px] text-fg-2">{r.actor.name}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} className="font-mono text-[12.5px] font-medium" /> },
    { key: 'status', header: 'Status', align: 'right', hideBelow: 'sm', cell: (r) => <StatusBadge status={r.status} /> },
  ]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Explainer title="Capped">A refund can never exceed what was paid for the order, minus earlier refunds. The cap is enforced server-side.</Explainer>
        <Explainer title="Audited">Every refund records the operator, role and reason, and posts DR Refunds against the wallet or the original payment method.</Explainer>
        <Explainer title="Idempotent">Each request carries an idempotency key — a double-click or network retry returns the original refund instead of paying twice.</Explainer>
      </div>
      <Card className="overflow-hidden">
        <CardHeader icon={<Undo2 />} title="Refunds" description="Issued from an order or approved from a verification request." />
        {q.isError ? (
          <LoadError what="refunds" onRetry={() => q.refetch()} />
        ) : (
          <DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(r) => r.id} dense minWidth={760} empty={<EmptyState compact icon={<Undo2 />} title="No refunds yet" description="Refunds are issued from an order’s detail page." />} />
        )}
      </Card>
    </div>
  )
}

type ChargebackRow = Chargeback & { accountName: string; paymentRef: string }

export function ChargebacksTab({ onOpenIntent }: { onOpenIntent: (id: string) => void }) {
  const q = useChargebacks()
  const resolve = useInstMutation(({ id, outcome }: { id: string; outcome: 'won' | 'lost' }) => financeService.resolveChargeback(id, outcome), { success: (c) => `Chargeback ${c.ref} marked ${c.status}` })
  const columns: Column<ChargebackRow>[] = [
    { key: 'ref', header: 'Chargeback', cell: (c) => <div><div className="font-mono text-[12.5px] font-medium">{c.ref}</div><div className="text-[11px] text-fg-3">opened {dateTime(c.openedAt)}</div></div> },
    { key: 'payment', header: 'Payment', cell: (c) => <button type="button" className="font-mono text-[12.5px] text-accent-ink hover:underline" onClick={() => onOpenIntent(c.paymentIntentId)}>{c.paymentRef || c.paymentIntentId}</button> },
    { key: 'account', header: 'Account', hideBelow: 'md', cell: (c) => <Link to={`/admin/accounts/${c.accountId}`} className="text-[12.5px] text-fg-2 hover:text-accent-ink hover:underline">{c.accountName}</Link> },
    { key: 'reason', header: 'Reason', hideBelow: 'lg', cell: (c) => <span className="line-clamp-1 max-w-[240px] text-[12.5px] text-fg-2">{c.reason}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (c) => <Money value={c.amount} className="font-mono text-[12.5px]" /> },
    { key: 'fee', header: 'Fee', align: 'right', hideBelow: 'sm', cell: (c) => <Money value={c.fee} className="font-mono text-[12.5px] text-fg-2" /> },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) =>
        c.status === 'open' ? (
          <Guarded permission="payments.manage">
            {(allowed) => (
              <span className="inline-flex gap-1">
                <Button size="xs" variant="secondary" disabled={!allowed || resolve.isPending} onClick={() => resolve.mutate({ id: c.id, outcome: 'won' })}>
                  Won
                </Button>
                <Button size="xs" variant="ghost" disabled={!allowed || resolve.isPending} onClick={() => resolve.mutate({ id: c.id, outcome: 'lost' })}>
                  Lost
                </Button>
              </span>
            )}
          </Guarded>
        ) : (
          <span className="text-[11.5px] text-fg-3">{c.resolvedAt ? dateTime(c.resolvedAt) : ''}</span>
        ),
    },
  ]
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader icon={<ShieldAlert />} title="Chargebacks" description="Opening a chargeback reclaims the amount from the wallet plus the gateway fee. Won reverses the amount; lost keeps it." actions={<PermissionHint permission="payments.manage" />} />
        {q.isError ? (
          <LoadError what="chargebacks" onRetry={() => q.refetch()} />
        ) : (
          <DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(c) => c.id} dense minWidth={780} empty={<EmptyState compact icon={<ShieldAlert />} title="No chargebacks" description="Simulate one from a succeeded card payment (DEMO controls in the payment drawer)." />} />
        )}
      </Card>
    </div>
  )
}
