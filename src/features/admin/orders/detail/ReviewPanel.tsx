import { useState, type ReactNode } from 'react'
import { CircleCheck, FileSearch, Hash, Lock, ShieldAlert, SearchCheck, Undo2 } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, Segmented, Select, StatusBadge, Textarea } from '@/components/ui'
import { Guarded, Money, PermissionHint } from '@/components/domain'
import { useInstMutation } from '@/hooks/installation'
import { ordersService } from '@/services/installation'
import type { OrderDetail, OrderReview, ResultFieldDef } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, duration } from '@/lib/format'
import { age, useNow } from '../helpers'

type Action = 'confirm' | 'reference' | 'resolve' | null

const LOOKUP_TONE: Record<OrderReview['lookups'][number]['outcome'], { tone: 'success' | 'info' | 'danger' | 'warning' | 'neutral'; label: string }> = {
  found_completed: { tone: 'success', label: 'Found · completed' },
  found_processing: { tone: 'info', label: 'Found · processing' },
  found_rejected: { tone: 'danger', label: 'Found · rejected' },
  not_found: { tone: 'warning', label: 'Not found' },
  unreachable: { tone: 'neutral', label: 'Unreachable' },
}

const REASON_LABEL: Record<OrderReview['reason'], string> = {
  unknown_outcome: 'Unknown supplier outcome',
  conflicting_result: 'Conflicting result',
  manual_hold: 'Manual hold',
}

const ACTION_LABEL: Record<NonNullable<OrderReview['resolution']>['action'], string> = {
  lookup_supplier: 'Supplier lookup',
  confirm_not_received: 'Confirmed supplier did not receive',
  enter_supplier_reference: 'Supplier reference entered',
  resolve_completed: 'Resolved manually · completed',
  resolve_rejected: 'Resolved manually · rejected',
}

/** Needs Review workspace — shown at the top of the order while status === needs_review. */
export function ReviewPanel({ d, onFocusAttempt }: { d: OrderDetail; onFocusAttempt: (id: string) => void }) {
  const o = d.order
  const review = o.review!
  const now = useNow(1000)
  const attempt = o.attempts.find((a) => a.id === review.attemptId) ?? o.attempts.at(-1) ?? null
  const supplier = attempt ? (d.supplierNames[attempt.supplierId] ?? attempt.supplierId) : '—'
  const [action, setAction] = useState<Action>(null)

  const lookup = useInstMutation(() => ordersService.lookup(o.id), {
    success: (res) => {
      const last = res.order.review?.lookups.at(-1)
      return last ? `Lookup: ${LOOKUP_TONE[last.outcome].label}` : 'Lookup complete'
    },
    error: 'Lookup failed',
  })

  return (
    <section id="sec-review" className="relative overflow-hidden rounded-xl border border-danger/40 bg-surface shadow-card">
      <span className="absolute inset-y-0 left-0 w-1 bg-danger" />
      <div className="flex flex-col gap-4 bg-danger/[0.05] px-5 py-4 pl-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger ring-1 ring-danger/25">
            <ShieldAlert className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Supplier outcome is unknown</h2>
              <Badge tone="danger" dot pulse>
                Needs review · {age(review.openedAt, now)}
              </Badge>
              <Badge tone="neutral" variant="outline">
                {REASON_LABEL[review.reason]}
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-fg-2">
              Automatic failover is blocked to prevent duplicate supplier orders. The order was sent, but {supplier} never gave a definitive answer — it may or may not be fulfilling it. The customer sees “processing · under review”.
            </p>
            {review.message && <p className="mt-1.5 font-mono text-[12px] text-fg-3">{review.message}</p>}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Fact label="Funds held" value={<Money value={d.held} className="text-warning" />} hint={<span className="inline-flex items-center gap-1"><Lock className="size-3" /> until resolved</span>} />
          <Fact
            label={attempt ? `Attempt #${attempt.n}` : 'Attempt'}
            value={<span className="truncate text-[13px]">{supplier}</span>}
            hint={
              attempt ? (
                <button type="button" className="text-accent-ink hover:underline" onClick={() => onFocusAttempt(attempt.id)}>
                  {attempt.classification?.code ?? attempt.state} · view
                </button>
              ) : null
            }
          />
          <Fact label="Supplier ref" value={<span className="font-mono text-[12.5px]">{attempt?.externalRef ?? 'none'}</span>} hint={attempt ? `sent ${dateTime(attempt.sentAt)}` : undefined} />
        </div>
      </div>

      {review.lookups.length > 0 && (
        <div className="border-t border-line px-6 py-3">
          <div className="mono-label mb-2">Lookup history</div>
          <ol className="grid gap-1.5">
            {review.lookups.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                <span className="w-[110px] shrink-0 font-mono text-[11px] text-fg-3">{dateTime(l.at)}</span>
                <Badge tone={LOOKUP_TONE[l.outcome].tone} dot>
                  {LOOKUP_TONE[l.outcome].label}
                </Badge>
                <span className="min-w-0 text-fg-2">{l.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          icon={<SearchCheck />}
          title="Lookup supplier"
          consequence={`Asks ${supplier} for the order status. Completed or rejected resolves the order automatically; processing resumes polling. Nothing is resent.`}
          button={(allowed) => (
            <Button size="sm" variant="primary" disabled={!allowed} loading={lookup.isPending} onClick={() => lookup.mutate()}>
              Lookup supplier
            </Button>
          )}
        />
        <ActionCard
          icon={<Undo2 />}
          title="Confirm supplier did not receive"
          consequence="Marks the attempt confirmed-not-received. Then retry: failover to the next eligible offer is allowed · or cancel: the hold is released to the wallet."
          button={(allowed) => (
            <Button size="sm" variant="secondary" disabled={!allowed} onClick={() => setAction('confirm')}>
              Confirm not received…
            </Button>
          )}
        />
        <ActionCard
          icon={<Hash />}
          title="Enter supplier reference"
          consequence="Links the supplier’s own order reference to the attempt. The order returns to processing and ORVEX polls the supplier for the result."
          button={(allowed) => (
            <Button size="sm" variant="secondary" disabled={!allowed} onClick={() => setAction('reference')}>
              Enter reference…
            </Button>
          )}
        />
        <ActionCard
          icon={<CircleCheck />}
          title="Resolve manually"
          consequence="Record the outcome yourself. Completed captures the held funds and posts revenue + supplier cost; rejected releases the hold to the customer."
          button={(allowed) => (
            <Button size="sm" variant="secondary" disabled={!allowed} onClick={() => setAction('resolve')}>
              Resolve…
            </Button>
          )}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-2 text-[11.5px] text-fg-3">
        <span>Every review action requires a reason and is written to the audit log.</span>
        <PermissionHint permission="orders.review" />
      </div>

      <ConfirmNotReceivedModal open={action === 'confirm'} onClose={() => setAction(null)} orderId={o.id} supplier={supplier} />
      <ReferenceModal open={action === 'reference'} onClose={() => setAction(null)} orderId={o.id} supplier={supplier} />
      <ResolveModal open={action === 'resolve'} onClose={() => setAction(null)} orderId={o.id} schema={d.revision.resultSchema} held={d} />
    </section>
  )
}

function Fact({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-3.5 py-2.5 lg:min-w-[200px]">
      <div className="mono-label truncate">{label}</div>
      <div className="mt-1 truncate font-display text-[16px] font-semibold tracking-[-0.01em] tabular">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-fg-3">{hint}</div>}
    </div>
  )
}

function ActionCard({ icon, title, consequence, button }: { icon: ReactNode; title: string; consequence: string; button: (allowed: boolean) => ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 bg-surface px-5 py-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-fg [&_svg]:size-4 [&_svg]:text-fg-3">
        {icon}
        {title}
      </div>
      <p className="flex-1 text-[12px] leading-relaxed text-fg-3">{consequence}</p>
      <div>
        <Guarded permission="orders.review">{button}</Guarded>
      </div>
    </div>
  )
}

const reasonOk = (r: string) => r.trim().length >= 4

function ConfirmNotReceivedModal({ open, onClose, orderId, supplier }: { open: boolean; onClose: () => void; orderId: string; supplier: string }) {
  const [reason, setReason] = useState('')
  const [then, setThen] = useState<'retry' | 'cancel'>('retry')
  const m = useInstMutation(() => ordersService.confirmNotReceived(orderId, { reason: reason.trim(), then }), {
    success: then === 'retry' ? 'Confirmed — routing continues with the next offer' : 'Confirmed — order cancelled, hold released',
    onSuccess: () => {
      setReason('')
      onClose()
    },
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Undo2 />}
      title="Confirm supplier did not receive the order"
      description={`Only do this when ${supplier} has confirmed (e.g. via their panel or support) that they have no record of this order.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={then === 'cancel' ? 'danger' : 'primary'} disabled={!reasonOk(reason)} loading={m.isPending} onClick={() => m.mutate()}>
            {then === 'retry' ? 'Confirm & retry routing' : 'Confirm & cancel order'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Then">
          <Segmented
            size="sm"
            value={then}
            onChange={setThen}
            items={[
              { value: 'retry', label: 'Retry with next offer' },
              { value: 'cancel', label: 'Cancel & release hold' },
            ]}
          />
        </Field>
        <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-[12px] text-fg-2">
          {then === 'retry'
            ? 'The unknown attempt becomes failover-safe. The router continues down the priority chain (margin guard still applies); funds stay held for the new attempt.'
            : 'The order is cancelled and the full held amount is released back to the customer’s available balance.'}
        </p>
        <Field label="Reason" hint="Required · minimum 4 characters · recorded in the audit log" error={reason && !reasonOk(reason) ? 'At least 4 characters' : undefined}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`e.g. ${supplier} support confirmed no order with this reference`} />
        </Field>
      </div>
    </Modal>
  )
}

function ReferenceModal({ open, onClose, orderId, supplier }: { open: boolean; onClose: () => void; orderId: string; supplier: string }) {
  const [ref, setRef] = useState('')
  const [reason, setReason] = useState('')
  const m = useInstMutation(() => ordersService.enterReference(orderId, { externalRef: ref.trim(), reason: reason.trim() }), {
    success: 'Reference linked — polling the supplier',
    onSuccess: () => {
      setRef('')
      setReason('')
      onClose()
    },
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Hash />}
      title="Enter supplier reference"
      description={`Use the order reference shown in ${supplier}’s panel. The order goes back to processing and the result is fetched by polling.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ref.trim() || !reasonOk(reason)} loading={m.isPending} onClick={() => m.mutate()}>
            Link reference
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Supplier reference">
          <Input mono value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 88412093" autoFocus />
        </Field>
        <Field label="Reason" hint="Required · minimum 4 characters">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Found in supplier panel, order is in process" />
        </Field>
      </div>
    </Modal>
  )
}

function ResolveModal({ open, onClose, orderId, schema, held }: { open: boolean; onClose: () => void; orderId: string; schema: ResultFieldDef[]; held: OrderDetail }) {
  const [outcome, setOutcome] = useState<'completed' | 'rejected'>('completed')
  const [reason, setReason] = useState('')
  const [result, setResult] = useState<Record<string, string>>({})
  const m = useInstMutation(
    () => {
      const clean = Object.fromEntries(Object.entries(result).filter(([, v]) => v.trim() !== ''))
      return ordersService.resolve(orderId, { outcome, reason: reason.trim(), result: outcome === 'completed' && Object.keys(clean).length ? clean : undefined })
    },
    {
      success: outcome === 'completed' ? 'Resolved as completed — funds captured' : 'Resolved as rejected — hold released',
      onSuccess: () => {
        setReason('')
        setResult({})
        onClose()
      },
    },
  )
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<FileSearch />}
      title="Resolve manually"
      description="Use when you know the real outcome from outside ORVEX. This is a critical, audited action."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={outcome === 'rejected' ? 'danger' : 'primary'} disabled={!reasonOk(reason)} loading={m.isPending} onClick={() => m.mutate()}>
            {outcome === 'completed' ? 'Mark completed' : 'Mark rejected'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Outcome">
          <Segmented
            size="sm"
            value={outcome}
            onChange={setOutcome}
            items={[
              { value: 'completed', label: 'Completed' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </Field>
        <div className={cn('rounded-lg px-3 py-2 text-[12px]', outcome === 'completed' ? 'bg-success/[0.07] text-fg-2' : 'bg-danger/[0.06] text-fg-2')}>
          {outcome === 'completed' ? (
            <>
              The <Money value={held.held} /> hold is captured: revenue and supplier cost are posted to the ledger and the customer is notified with the result below.
            </>
          ) : (
            <>
              The <Money value={held.held} /> hold is released to the customer’s available balance. The order becomes rejected.
            </>
          )}
        </div>
        {outcome === 'completed' && schema.length > 0 && (
          <div>
            <div className="mono-label mb-2">Result fields · optional</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {schema.map((f) => (
                <ResultInput key={f.key} f={f} value={result[f.key] ?? ''} onChange={(v) => setResult((r) => ({ ...r, [f.key]: v }))} />
              ))}
            </div>
          </div>
        )}
        <Field label="Reason" hint="Required · minimum 4 characters · recorded in the audit log">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier emailed the result; verified against their panel" />
        </Field>
      </div>
    </Modal>
  )
}

function ResultInput({ f, value, onChange }: { f: ResultFieldDef; value: string; onChange: (v: string) => void }) {
  if (f.kind === 'boolean')
    return (
      <Field label={f.label} optional>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: '', label: '—' },
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
        />
      </Field>
    )
  if (f.kind === 'status' && f.tones)
    return (
      <Field label={f.label} optional>
        <Select value={value} onChange={(e) => onChange(e.target.value)} options={[{ value: '', label: '—' }, ...Object.keys(f.tones).map((k) => ({ value: k, label: k.replace(/_/g, ' ') }))]} />
      </Field>
    )
  return (
    <Field label={f.label} optional>
      <Input type={f.kind === 'date' ? 'date' : 'text'} mono={f.kind === 'code'} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

/** Summary of how a review was closed (shown after resolution, any status). */
export function ResolutionSummary({ review }: { review: OrderReview }) {
  if (!review.resolution) return null
  const r = review.resolution
  return (
    <section className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface px-5 py-3.5 shadow-card">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success ring-1 ring-success/20">
        <CircleCheck className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-semibold">Review resolved</span>
          <StatusBadge status="resolved" label={ACTION_LABEL[r.action]} />
          <span className="text-fg-3">
            by {r.by.name}
            {r.by.role ? ` (${r.by.role})` : ''} · {dateTime(review.resolvedAt)} · open for {review.resolvedAt ? duration((new Date(review.resolvedAt).getTime() - new Date(review.openedAt).getTime()) / 1000) : '—'}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] text-fg-2">“{r.reason}”</p>
        <p className="mt-0.5 text-[11.5px] text-fg-3">
          Opened {dateTime(review.openedAt)} · {REASON_LABEL[review.reason]} · {review.lookups.length} supplier lookup{review.lookups.length === 1 ? '' : 's'}
        </p>
      </div>
    </section>
  )
}
