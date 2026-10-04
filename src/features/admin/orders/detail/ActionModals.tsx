import { useState } from 'react'
import { Ban, Undo2 } from 'lucide-react'
import { Button, Field, Input, Modal, Segmented, Textarea } from '@/components/ui'
import { FinancialBadge, Money, OrderStatusBadge } from '@/components/domain'
import { formatMoney, parseMoney } from '@/core/money'
import { useInstMutation } from '@/hooks/installation'
import { ordersService } from '@/services/installation'
import type { OrderDetail } from '@/types/installation'
import { cn } from '@/lib/cn'
import { newIdempotencyKey } from '../helpers'

export function CancelModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: OrderDetail }) {
  const [reason, setReason] = useState('')
  // Clear the reason every time the modal opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setReason('')
  }
  const m = useInstMutation(() => ordersService.cancel(d.order.id, reason.trim() || 'Cancelled by operator'), {
    success: (r) => `Order ${r.ref} cancelled`,
    error: 'Could not cancel',
    onSuccess: onClose,
  })
  const awaiting = d.order.status === 'awaiting_payment'
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<Ban />}
      title={`Cancel ${d.order.ref}?`}
      description={awaiting ? 'The order has not been paid yet. The pending payment intent is cancelled; no money moves.' : 'The order has not reached a supplier yet. The held amount is released back to the customer’s available balance.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep order
          </Button>
          <Button variant="danger" loading={m.isPending} disabled={reason.trim().length < 3} onClick={() => m.mutate()}>
            Cancel order
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {!awaiting && d.held > 0 && (
          <div className="rounded-lg bg-surface-2/60 px-3 py-2 text-[12.5px] text-fg-2">
            Releases <Money value={d.held} className="font-medium text-fg" /> · financial status becomes <FinancialBadge status="released" />
          </div>
        )}
        <Field label="Reason" hint="Recorded on the order timeline and in the audit log">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked to cancel before processing" autoFocus />
        </Field>
      </div>
    </Modal>
  )
}

export function RefundModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: OrderDetail }) {
  const canOriginal = d.payment?.status === 'succeeded'
  const [amount, setAmount] = useState('')
  const [destination, setDestination] = useState<'wallet' | 'original_method'>('wallet')
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(() => newIdempotencyKey('rfd'))

  // one idempotency key per modal session — a double click or retry can never refund twice
  // (seeded during render when the modal opens, not in an effect)
  const [wasOpen, setWasOpen] = useState<boolean | null>(null)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAmount(formatMoney(d.refundable, { precise: true }).replace('$', ''))
      setDestination('wallet')
      setReason('')
      setKey(newIdempotencyKey('rfd'))
    }
  }

  const parsed = parseMoney(amount)
  const over = parsed != null && parsed > d.refundable
  const valid = parsed != null && parsed > 0 && !over && reason.trim().length > 0
  const full = parsed != null && parsed === d.refundable && d.order.refundedTotal + parsed >= d.order.price.amount

  const m = useInstMutation(() => ordersService.refund(d.order.id, { amount: parsed!, destination, reason: reason.trim(), idempotencyKey: key }), {
    success: (r) => `Refund ${r.ref} issued · ${formatMoney(r.amount)}`,
    error: 'Refund failed',
    onSuccess: onClose,
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Undo2 />}
      title={`Refund ${d.order.ref}`}
      description="Refunds are capped at the captured amount minus earlier refunds and are idempotent."
      footer={
        <>
          <span className="mr-auto hidden font-mono text-[11px] text-fg-3 sm:inline" title="Generated once when this dialog opened">
            Idempotency-Key {key}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>
            Refund {parsed != null && parsed > 0 ? formatMoney(parsed) : ''}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-[12px]">
          <div className="bg-surface px-3 py-2">
            <div className="text-fg-3">Captured</div>
            <Money value={d.order.price.amount} className="font-mono text-[13px] font-medium" />
          </div>
          <div className="bg-surface px-3 py-2">
            <div className="text-fg-3">Already refunded</div>
            <Money value={d.order.refundedTotal} className="font-mono text-[13px] font-medium" />
          </div>
          <div className="bg-surface px-3 py-2">
            <div className="text-fg-3">Refundable</div>
            <Money value={d.refundable} className="font-mono text-[13px] font-medium text-success" />
          </div>
        </div>
        <Field
          label="Amount"
          error={over ? `Cannot exceed the refundable ${formatMoney(d.refundable)}` : amount && parsed == null ? 'Enter an amount like 12.50' : undefined}
          action={
            <button type="button" className="text-[12px] font-medium text-accent-ink hover:underline" onClick={() => setAmount(formatMoney(d.refundable).replace('$', ''))}>
              Max
            </button>
          }
        >
          <Input mono value={amount} onChange={(e) => setAmount(e.target.value)} leading={<span className="text-[13px]">$</span>} invalid={over} />
        </Field>
        <Field label="Destination" hint={canOriginal ? undefined : 'Paid from the wallet — only a wallet refund is possible.'}>
          <Segmented
            size="sm"
            value={destination}
            onChange={setDestination}
            items={[
              { value: 'wallet', label: 'Customer wallet' },
              { value: 'original_method', label: canOriginal ? `Original method (${d.payment!.method.replace('_', ' ')})` : 'Original method', disabled: !canOriginal },
            ]}
          />
        </Field>
        <Field label="Reason" hint="Required · shown on the order timeline and the customer notification">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Result delayed beyond the promised turnaround" />
        </Field>
        <div className={cn('rounded-lg border border-line px-3.5 py-2.5 text-[12px] leading-relaxed text-fg-2')}>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            Fulfilment stays <OrderStatusBadge status={d.order.status} /> · financial becomes <FinancialBadge status={full ? 'refunded' : 'partially_refunded'} />
          </div>
          Ledger: DR Refunds (contra-revenue) · CR {destination === 'wallet' ? 'Customer Available (wallet credited instantly)' : 'Gateway Clearing (returned via the simulated gateway)'}. Refunding never changes the fulfilment status.
        </div>
      </div>
    </Modal>
  )
}
