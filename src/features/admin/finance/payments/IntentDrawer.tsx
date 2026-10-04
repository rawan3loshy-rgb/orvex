import { useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck, CreditCard, Repeat2, ShieldAlert } from 'lucide-react'
import type { PaymentMethodConfig, PaymentRow } from '@/types/installation'
import { financeService } from '@/services/installation'
import { useInstMutation } from '@/hooks/installation'
import { Guarded, Money, PermissionHint, SimulatedBadge } from '@/components/domain'
import { Badge, Button, DescriptionList, Drawer, EmptyState, Field, Input, MonoValue, Skeleton, StatusBadge, Timeline } from '@/components/ui'
import { dateTime, time } from '@/lib/format'
import { DemoZone } from '../shared'
import { METHOD_LABEL } from '../helpers'

interface GatewayEventResult {
  id?: string
  status?: string
  duplicateOf?: string | null
  type?: string
}

export function IntentDrawer({ intent, loading, methods, open, onClose }: { intent: PaymentRow | undefined; loading: boolean; methods: PaymentMethodConfig[] | undefined; open: boolean; onClose: () => void }) {
  const [cbReason, setCbReason] = useState('Cardholder dispute — item not received (simulated)')
  const [replayResult, setReplayResult] = useState<GatewayEventResult | null>(null)
  const confirm = useInstMutation((id: string) => financeService.confirmPayment(id), { success: (p) => `${p.ref} confirmed — wallet credited` })
  const chargeback = useInstMutation(({ id, reason }: { id: string; reason: string }) => financeService.chargeback(id, reason), { success: (c) => `Chargeback ${c.ref} opened (simulated)` })
  const replay = useInstMutation((id: string) => financeService.replayWebhook(id), { onSuccess: (r) => setReplayResult((r ?? {}) as GatewayEventResult) })

  const p = intent
  const method = methods?.find((m) => m.id === p?.method)
  const manual = p && (p.method === 'bank_transfer' || p.method === 'manual')
  const confirmable = p && manual && (p.status === 'pending' || p.status === 'requires_payment')

  return (
    <Drawer
      open={open}
      onClose={() => {
        setReplayResult(null)
        onClose()
      }}
      width="lg"
      icon={<CreditCard />}
      title={p ? p.ref : 'Payment'}
      description={p ? `${p.purpose === 'top_up' ? 'Wallet top-up' : 'Order payment'} · ${METHOD_LABEL[p.method] ?? p.method}` : undefined}
      actions={p && <StatusBadge status={p.status} />}
    >
      {loading && !p ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : !p ? (
        <EmptyState icon={<CreditCard />} title="Payment not found" description="The intent id in the link does not exist in this installation." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4 rounded-xl border border-line bg-surface-2/40 px-4 py-3.5">
            <div>
              <div className="mono-label">Amount</div>
              <div className="mt-1 font-mono text-[24px] font-semibold tabular">
                <Money value={p.amount} />
              </div>
            </div>
            <div className="text-right text-[12px] text-fg-3">
              {p.refundedTotal > 0 && (
                <div>
                  Refunded <Money value={p.refundedTotal} className="font-mono text-info" />
                </div>
              )}
              {p.chargebackId && <Badge tone="danger">Chargeback {p.chargebackId}</Badge>}
              {p.failureReason && <div className="text-danger">{p.failureReason}</div>}
            </div>
          </div>

          <DescriptionList
            items={[
              { label: 'Account', value: <Link to={`/admin/accounts/${p.accountId}`} className="text-accent-ink hover:underline">{p.accountName}</Link> },
              { label: 'Order', value: p.orderId ? <Link to={`/admin/orders/${p.orderId}`} className="font-mono text-accent-ink hover:underline">{p.orderRef ?? p.orderId}</Link> : '—' },
              { label: 'Method', value: METHOD_LABEL[p.method] ?? p.method },
              { label: 'Gateway', value: <span className="inline-flex items-center gap-2">{method?.gateway ?? '—'} <SimulatedBadge /></span> },
              { label: 'Gateway ref', value: <MonoValue value={p.gatewayRef} /> },
              {
                label: 'Ledger',
                value: p.ledgerTxId ? (
                  <Link to={`/admin/finance/ledger?accountId=${p.accountId}&kind=top_up`} className="font-mono text-accent-ink hover:underline" title="Top-up postings for this account">
                    {p.ledgerTxId}
                  </Link>
                ) : (
                  <span className="text-fg-3">Not funded yet</span>
                ),
                hint: p.ledgerTxId ? 'DR Gateway Clearing / CR Customer Available' : undefined,
              },
              { label: 'Created', value: dateTime(p.createdAt) },
              { label: 'Updated', value: dateTime(p.updatedAt) },
            ]}
          />

          {confirmable && (
            <div className="rounded-xl border border-line px-4 py-3.5">
              <div className="text-[13px] font-semibold">Awaiting confirmation</div>
              <p className="mt-0.5 text-[12px] text-fg-3">Confirm once the funds are visible on your bank statement. The wallet is credited by a single idempotent posting.</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <PermissionHint permission="payments.manage" />
                <Guarded permission="payments.manage">
                  {(allowed) => (
                    <Button size="sm" variant="accent" leading={<CircleCheck />} disabled={!allowed} loading={confirm.isPending} onClick={() => confirm.mutate(p.id)}>
                      Confirm {p.method === 'manual' ? 'manual payment' : 'bank transfer'}
                    </Button>
                  )}
                </Guarded>
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-[13px] font-semibold">Gateway events</div>
            {p.events.length === 0 ? (
              <p className="text-[12.5px] text-fg-3">No events recorded.</p>
            ) : (
              <Timeline
                items={p.events.map((e, i) => ({
                  id: `${i}`,
                  title: e.type.replace(/_/g, ' ').replace(/\./g, ' · '),
                  detail: e.detail,
                  time: time(e.at, true),
                  tone: e.type.includes('fail') || e.type.includes('chargeback') ? 'danger' : e.type.includes('duplicate') ? 'neutral' : e.type.includes('succeed') ? 'success' : 'info',
                }))}
              />
            )}
          </div>

          <DemoZone>
            <p className="mb-3 text-[12px] text-fg-3">Simulated gateway behaviour for the demo — no real processor is connected.</p>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium">Replay gateway webhook</div>
                  <p className="mt-0.5 text-xs text-fg-3">Re-sends the last processed event. Expected: recorded as a duplicate and ignored — the wallet is not credited twice.</p>
                </div>
                <Button size="sm" leading={<Repeat2 />} loading={replay.isPending} onClick={() => replay.mutate(p.id)}>
                  Replay webhook
                </Button>
              </div>
              {replayResult && (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px]">
                  Result: <StatusBadge status={replayResult.status ?? 'processed'} className="mx-1" />
                  {replayResult.status === 'duplicate_ignored' ? `duplicate of ${replayResult.duplicateOf ?? 'the original event'} — ledger posting is idempotent, nothing was posted.` : 'event handled.'}
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-dashed border-line pt-3 sm:flex-row sm:items-end">
                <Field label="Simulate chargeback" hint={p.status !== 'succeeded' ? 'Only succeeded payments can be charged back.' : p.chargebackId ? 'Already charged back.' : 'Posts DR Customer Available + DR Chargeback Fees ($15) / CR Gateway Clearing.'} className="flex-1">
                  <Input inputSize="sm" value={cbReason} onChange={(e) => setCbReason(e.target.value)} disabled={p.status !== 'succeeded' || !!p.chargebackId} />
                </Field>
                <Guarded permission="payments.manage">
                  {(allowed) => (
                    <Button size="sm" variant="danger" leading={<ShieldAlert />} disabled={!allowed || p.status !== 'succeeded' || !!p.chargebackId || !cbReason.trim()} loading={chargeback.isPending} onClick={() => chargeback.mutate({ id: p.id, reason: cbReason.trim() })}>
                      Simulate chargeback
                    </Button>
                  )}
                </Guarded>
              </div>
            </div>
          </DemoZone>
        </div>
      )}
    </Drawer>
  )
}
