import { useState } from 'react'
import { BadgeCheck, CircleX, ExternalLink, FileSearch, Repeat2, Send, Undo2 } from 'lucide-react'
import { Badge, Button, Drawer, Field, Input, Segmented, Skeleton, StatusBadge, Textarea } from '@/components/ui'
import { FinancialBadge, Guarded, Money, OrderStatusBadge, PermissionHint, ResultView } from '@/components/domain'
import { formatMoney, parseMoney } from '@/core/money'
import { useInstMutation, useOrder } from '@/hooks/installation'
import { verificationsService, type VerificationRow } from '@/services/installation'
import { cn } from '@/lib/cn'
import { dateTime } from '@/lib/format'

const REASON: Record<string, string> = {
  code_not_working: 'Code not working',
  wrong_result: 'Wrong result',
  result_missing: 'Result missing',
  other: 'Other',
}

const isCredit = (s: string) => /credit/i.test(s)

export function VerificationDrawer({ row, open, onClose, onOpenOrder }: { row: VerificationRow | null; open: boolean; onClose: () => void; onOpenOrder: (ref: string) => void }) {
  const v = row?.verification
  const order = useOrder(open ? row?.orderId : undefined)
  const d = order.data
  const closed = v?.status === 'approved' || v?.status === 'rejected'
  const remaining = row ? Math.max(0, row.price - row.refunded) : 0
  const canOriginal = d?.payment?.status === 'succeeded'

  const [amount, setAmount] = useState('')
  const [destination, setDestination] = useState<'wallet' | 'original_method'>('wallet')
  const [note, setNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  // Re-seed the form for each verification shown (adjusted during render, not in an effect).
  const [seededFor, setSeededFor] = useState<string | undefined | null>(null)
  if (seededFor !== v?.id) {
    setSeededFor(v?.id)
    if (row) {
      setAmount(formatMoney(Math.max(0, row.price - row.refunded) as never).replace('$', ''))
      setDestination('wallet')
      setNote('')
      setRejectNote('')
    }
  }

  const id = v?.id ?? ''
  const recheck = useInstMutation(() => verificationsService.recheck(id), { success: 'Supplier rechecked' })
  const request = useInstMutation(() => verificationsService.requestSupplier(id), { success: 'Verification requested from the supplier' })
  const parsed = parseMoney(amount)
  const over = parsed != null && parsed > remaining
  const approve = useInstMutation(() => verificationsService.approve(id, { amount: parsed!, destination, note: note.trim() }), { success: (r) => `${r.ref} approved · refund issued` })
  const reject = useInstMutation(() => verificationsService.reject(id, rejectNote.trim()), { success: (r) => `${r.ref} rejected` })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      icon={<FileSearch />}
      title={
        v ? (
          <span className="flex items-center gap-2">
            <span className="font-mono">{v.ref}</span>
            <StatusBadge status={v.status} />
          </span>
        ) : (
          'Verification'
        )
      }
      description={row ? `${REASON[row.verification.reason] ?? row.verification.reason} · opened ${dateTime(row.verification.createdAt)}` : undefined}
    >
      {row && v && (
        <div className="grid gap-5">
          {/* Order summary */}
          <section className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-medium">{row.orderRef}</span>
                {d && <OrderStatusBadge status={d.order.status} />}
                {d && <FinancialBadge status={d.order.financialStatus} />}
              </div>
              <Button size="xs" variant="ghost" trailing={<ExternalLink />} onClick={() => onOpenOrder(row.orderRef || row.orderId)}>
                Open order
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-[12.5px]">
              <Item k="Service" v={row.serviceName} />
              <Item k="Account" v={row.accountName} />
              <Item k="Supplier" v={row.supplierName || '—'} />
              <Item k="Supplier ticket" v={<span className="font-mono">{v.supplierTicket ?? '—'}</span>} />
              <Item k="Price" v={<Money value={row.price} className="font-mono" />} />
              <Item k="Refunded" v={<Money value={row.refunded} className="font-mono" />} />
            </dl>
          </section>

          {/* Result */}
          <section>
            <div className="mono-label mb-2">Delivered result</div>
            {order.isLoading ? <Skeleton className="h-[120px] rounded-xl" /> : d?.order.result ? <ResultView result={d.order.result} schema={d.revision.resultSchema} /> : <div className="text-[12.5px] text-fg-3">{row.result ?? 'No result on record.'}</div>}
          </section>

          {/* Customer message */}
          <section>
            <div className="mono-label mb-2">Customer message</div>
            <blockquote className="rounded-lg border-l-2 border-accent bg-surface-2/50 px-3.5 py-2.5 text-[13px] text-fg-2">“{v.message}”</blockquote>
          </section>

          {/* Events */}
          <section>
            <div className="mono-label mb-2">History</div>
            <ol className="relative">
              {v.events.map((e, i) => {
                const credit = isCredit(e.title) || isCredit(e.detail)
                return (
                  <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < v.events.length - 1 && <span className="absolute top-5 bottom-0 left-[7px] w-px bg-line" />}
                    <span className={cn('relative z-10 mt-1 size-[15px] shrink-0 rounded-full ring-1', credit ? 'bg-success/20 ring-success/40' : 'bg-surface-2 ring-line-strong')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-[12.5px] font-medium">
                          {e.title}
                          {credit && (
                            <Badge tone="success" className="ml-2">
                              Supplier credit
                            </Badge>
                          )}
                        </span>
                        <span className="font-mono text-[11px] text-fg-3">{dateTime(e.at)}</span>
                      </div>
                      {e.detail && <div className="mt-0.5 text-[12px] text-fg-2">{e.detail}</div>}
                      <div className="mt-0.5 text-[11px] text-fg-3">by {e.actor.name}</div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* Resolution */}
          {v.resolution && (
            <section className={cn('rounded-lg border px-4 py-3 text-[12.5px]', v.resolution.action === 'rejected' ? 'border-line bg-surface-2/50' : 'border-success/30 bg-success/[0.05]')}>
              <div className="flex items-center gap-2 font-medium">
                {v.resolution.action === 'rejected' ? <CircleX className="size-4 text-fg-3" /> : <BadgeCheck className="size-4 text-success" />}
                {v.resolution.action === 'refund_approved' ? 'Refund approved' : v.resolution.action === 'rejected' ? 'Rejected' : 'Result corrected'}
                <span className="font-normal text-fg-3">
                  by {v.resolution.by.name} · {dateTime(v.resolution.at)}
                </span>
              </div>
              {v.resolution.note && <p className="mt-1 text-fg-2">{v.resolution.note}</p>}
            </section>
          )}

          {/* Actions */}
          {!closed && (
            <section className="grid gap-4 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Guarded permission="orders.review">
                  {(allowed) => (
                    <Button size="sm" variant="secondary" leading={<Repeat2 />} disabled={!allowed} loading={recheck.isPending} onClick={() => recheck.mutate()}>
                      Recheck supplier
                    </Button>
                  )}
                </Guarded>
                {v.status === 'open' && (
                  <Guarded permission="orders.review">
                    {(allowed) => (
                      <Button size="sm" variant="secondary" leading={<Send />} disabled={!allowed} loading={request.isPending} onClick={() => request.mutate()}>
                        Request supplier verification
                      </Button>
                    )}
                  </Guarded>
                )}
              </div>
              <p className="-mt-2 text-[11.5px] text-fg-3">Recheck asks the supplier for the order status again (no new order). A supplier verification opens a ticket; if the supplier confirms the fault, it credits the cost back (posted as a supplier credit).</p>

              <div className="border-t border-line pt-4">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                  <Undo2 className="size-4 text-fg-3" /> Approve refund
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Amount" error={over ? `Max ${formatMoney(remaining as never)}` : amount && parsed == null ? 'Invalid amount' : undefined} hint={`Default = price − refunded (${formatMoney(remaining as never)})`}>
                    <Input mono value={amount} onChange={(e) => setAmount(e.target.value)} leading={<span className="text-[13px]">$</span>} invalid={over} />
                  </Field>
                  <Field label="Destination" hint={d && !canOriginal ? 'Paid from wallet — wallet only' : undefined}>
                    <Segmented
                      size="sm"
                      value={destination}
                      onChange={setDestination}
                      items={[
                        { value: 'wallet', label: 'Wallet' },
                        { value: 'original_method', label: 'Original method', disabled: !canOriginal },
                      ]}
                    />
                  </Field>
                </div>
                <Field label="Note" className="mt-3" hint="Shown to the customer with the refund">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier confirmed the code was invalid" className="min-h-16" />
                </Field>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <PermissionHint permission="refunds.create" />
                  <Guarded permission="refunds.create">
                    {(allowed) => (
                      <Button size="sm" variant="primary" disabled={!allowed || parsed == null || parsed <= 0 || over} loading={approve.isPending} onClick={() => approve.mutate()}>
                        Approve & refund {parsed != null && parsed > 0 ? formatMoney(parsed) : ''}
                      </Button>
                    )}
                  </Guarded>
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                  <CircleX className="size-4 text-fg-3" /> Reject request
                </div>
                <Field label="Note" hint="Required — explain why the result stands">
                  <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="e.g. Recheck returned the same verified result" className="min-h-16" />
                </Field>
                <div className="mt-3 flex justify-end">
                  <Guarded permission="orders.review">
                    {(allowed) => (
                      <Button size="sm" variant="danger" disabled={!allowed || !rejectNote.trim()} loading={reject.isPending} onClick={() => reject.mutate()}>
                        Reject request
                      </Button>
                    )}
                  </Guarded>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </Drawer>
  )
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-fg-3">{k}</dt>
      <dd className="truncate">{v}</dd>
    </div>
  )
}
