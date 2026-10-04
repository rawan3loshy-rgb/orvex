import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Ban, CircleCheck, CircleX, Clock, LifeBuoy, MessageSquareWarning, ShieldCheck, Undo2 } from 'lucide-react'
import { Badge, Button, Card, CardHeader, ConfirmDialog, CopyButton, EmptyState, Field, Modal, Select, Skeleton, StatusBadge, Textarea, Timeline, type TimelineItem } from '@/components/ui'
import { ChannelBadge, Money, ResultView } from '@/components/domain'
import { useInstMutation, usePortalOrder } from '@/hooks/installation'
import { portalService } from '@/services/installation'
import { sub } from '@/core/money'
import type { PortalOrder, VerificationReason } from '@/types/installation'
import type { Tone } from '@/types/common'
import { dateTime, duration, time, titleCase } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ErrorCard, InfoRow, PortalStatus, Reveal } from '../kit'
import { MONEY_STATE, STATUS_DETAIL, usePortalSession } from '../kitUtils'

const TONES: Tone[] = ['neutral', 'accent', 'success', 'warning', 'danger', 'info']
const asTone = (t: string): Tone => (TONES.includes(t as Tone) ? (t as Tone) : 'neutral')

const REASONS: { value: VerificationReason; label: string }[] = [
  { value: 'code_not_working', label: 'The code doesn’t work' },
  { value: 'wrong_result', label: 'The result looks wrong' },
  { value: 'result_missing', label: 'The result is missing' },
  { value: 'other', label: 'Something else' },
]

export default function OrderDetailPage() {
  const { ref } = useParams()
  const order = usePortalOrder(ref)
  const { can } = usePortalSession()

  if (order.error)
    return (
      <div>
        <BackLink />
        <ErrorCard error={order.error} onRetry={() => order.refetch()} />
      </div>
    )
  if (!order.data)
    return (
      <div className="space-y-4">
        <BackLink />
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[260px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
      </div>
    )

  const o = order.data
  return (
    <div>
      <BackLink />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
            <span className="inline-flex items-center gap-1 font-mono text-fg-2">
              {o.ref}
              <CopyButton value={o.ref} label="Copy order reference" />
            </span>
            <span>·</span>
            <span>{dateTime(o.createdAt)}</span>
            <ChannelBadge channel={o.channel} />
          </div>
          <h1 className="font-display text-[24px] leading-tight font-semibold tracking-[-0.025em] sm:text-[26px]">{o.serviceName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <PortalStatus status={o.status} detail={o.statusDetail} />
          <Money value={o.price} className="font-display text-[22px] font-semibold" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Reveal>
            <StatusHero order={o} canCancel={can.order} />
          </Reveal>
          {o.result && (
            <Reveal delay={0.04}>
              <ResultView result={o.result} schema={o.resultSchema} />
            </Reveal>
          )}
          <Card>
            <CardHeader title="Timeline" description="What happened to this order, step by step" />
            <div className="px-5 pb-5">
              <Timeline items={timelineItems(o)} />
            </div>
          </Card>
          <Aftercare order={o} />
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Details" />
            <dl className="px-5 pb-3">
              {Object.entries(o.input).map(([k, v]) => (
                <InfoRow key={k} label={titleCase(k)} mono>
                  <span className="inline-flex items-center gap-1">
                    {v}
                    <CopyButton value={v} />
                  </span>
                </InfoRow>
              ))}
              <InfoRow label="Your reference">{o.clientReference ?? <span className="text-fg-3">—</span>}</InfoRow>
              <InfoRow label="Service code" mono>
                {o.serviceCode}
              </InfoRow>
              <InfoRow label="Placed">{dateTime(o.createdAt)}</InfoRow>
              {o.completedAt && <InfoRow label="Finished">{dateTime(o.completedAt)}</InfoRow>}
              {o.completedAt && <InfoRow label="Took">{duration((new Date(o.completedAt).getTime() - new Date(o.createdAt).getTime()) / 1000)}</InfoRow>}
            </dl>
          </Card>
          <MoneyCard order={o} />
        </div>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/portal/orders" className="mb-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-3 hover:text-fg">
      <ArrowLeft className="size-3.5" /> All orders
    </Link>
  )
}

function timelineItems(o: PortalOrder): TimelineItem[] {
  const items: TimelineItem[] = o.timeline.map((e, i) => ({ id: `${i}`, title: e.title, detail: e.detail, time: time(e.at, true), tone: asTone(e.tone) }))
  const open = o.status === 'queued' || o.status === 'processing'
  if (open) items.push({ id: 'now', title: o.statusDetail === 'under_review' ? 'Being verified' : 'Working on it', detail: 'This page updates automatically.', tone: 'accent', active: true, icon: <Clock /> })
  return items
}

function StatusHero({ order: o, canCancel }: { order: PortalOrder; canCancel: boolean }) {
  const [confirm, setConfirm] = useState(false)
  const cancel = useInstMutation(() => portalService.cancel(o.ref), { success: 'Order cancelled — funds released', onSuccess: () => setConfirm(false) })

  let tone: Tone = 'accent'
  let icon = <Clock className="size-5" />
  let title = 'Processing'
  let copy = 'Your order is being processed. Funds are reserved in your wallet and charged only when it completes.'
  if (o.status === 'queued') {
    title = 'Queued'
    copy = 'Your order is in the queue and will start in a moment. You can still cancel it — the reserved funds go straight back to your balance.'
  } else if (o.status === 'processing' && o.statusDetail && STATUS_DETAIL[o.statusDetail]) {
    title = STATUS_DETAIL[o.statusDetail].label
    copy = STATUS_DETAIL[o.statusDetail].copy
    if (o.statusDetail === 'under_review') icon = <ShieldCheck className="size-5" />
  } else if (o.status === 'completed') {
    tone = 'success'
    icon = <CircleCheck className="size-5" />
    title = 'Completed'
    copy = o.result ? o.result.summary : 'Your order is complete.'
  } else if (o.status === 'rejected') {
    tone = 'danger'
    icon = <CircleX className="size-5" />
    title = 'Rejected'
    copy = `${o.rejection?.message ?? 'This order could not be completed.'} You were not charged — the reserved funds went back to your available balance.`
  } else if (o.status === 'cancelled') {
    tone = 'neutral'
    icon = <Ban className="size-5" />
    title = 'Cancelled'
    copy = 'This order was cancelled before processing. You were not charged.'
  }
  const toneCls: Record<Tone, string> = {
    accent: 'bg-accent/10 text-accent-ink',
    success: 'bg-success/12 text-success',
    danger: 'bg-danger/10 text-danger',
    neutral: 'bg-surface-2 text-fg-2',
    warning: 'bg-warning/12 text-warning',
    info: 'bg-info/10 text-info',
  }
  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <span className={cn('relative grid size-11 shrink-0 place-items-center rounded-xl', toneCls[tone])}>
          {(o.status === 'processing' || o.status === 'queued') && <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-accent/20" />}
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{copy}</p>
          {o.rejection && <p className="mt-2 font-mono text-[11.5px] text-fg-3">Code: {o.rejection.code}</p>}
        </div>
        {o.status === 'queued' && canCancel && (
          <Button variant="secondary" size="sm" leading={<Ban />} onClick={() => setConfirm(true)} className="self-start">
            Cancel order
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => cancel.mutate()}
        loading={cancel.isPending}
        tone="danger"
        title={`Cancel ${o.ref}?`}
        description={<>The order hasn’t started yet. <Money value={o.price} /> goes back to your available balance immediately.</>}
        confirmLabel="Cancel order"
      />
    </Card>
  )
}

function MoneyCard({ order: o }: { order: PortalOrder }) {
  const st = MONEY_STATE[o.financialStatus] ?? MONEY_STATE.none!
  const refunds = o.timeline.filter((e) => /refund/i.test(e.title))
  return (
    <Card>
      <CardHeader title="Payment" description="Paid from your wallet" />
      <dl className="px-5 pb-3">
        <InfoRow label="Price">
          <Money value={o.price} className="font-medium" />
        </InfoRow>
        <InfoRow label="Funds">
          <Badge tone={st.tone} dot title={st.hint}>
            {st.label}
          </Badge>
        </InfoRow>
        {o.refundedTotal > 0 && (
          <>
            <InfoRow label="Refunded">
              <Money value={o.refundedTotal} className="text-success" />
            </InfoRow>
            <InfoRow label="Net charged">
              <Money value={sub(o.price, o.refundedTotal)} />
            </InfoRow>
          </>
        )}
      </dl>
      <p className="border-t border-line px-5 py-3 text-[11.5px] text-fg-3">{st.hint}.</p>
      {refunds.length > 0 && (
        <div className="border-t border-line px-5 py-3">
          <div className="mb-2 mono-label">Refunds</div>
          <ul className="space-y-2">
            {refunds.map((r, i) => (
              <li key={i} className="flex gap-2 text-[12.5px]">
                <Undo2 className="mt-0.5 size-3.5 shrink-0 text-info" />
                <div>
                  <div className="font-medium">{r.title}</div>
                  {r.detail && <div className="text-fg-3">{r.detail}</div>}
                  <div className="text-[11px] text-fg-3">{dateTime(r.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Aftercare({ order: o }: { order: PortalOrder }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<VerificationReason>('code_not_working')
  const [message, setMessage] = useState('')
  const verify = useInstMutation((b: { reason: string; message: string }) => portalService.verify(o.ref, b), {
    success: (v) => `Request ${v.ref} sent to UnlockDesk support`,
    onSuccess: () => {
      setOpen(false)
      setMessage('')
    },
  })
  const hasOpen = o.verifications.some((v) => v.status === 'open' || v.status === 'awaiting_supplier')
  const canReport = (o.status === 'completed' || o.status === 'rejected') && !hasOpen
  if (o.status !== 'completed' && o.status !== 'rejected' && !o.verifications.length) return null

  return (
    <Card>
      <CardHeader
        icon={<LifeBuoy />}
        title="Problem with this order?"
        description="If a result doesn’t work, tell us — UnlockDesk checks it and refunds to your wallet when the claim is approved."
        actions={
          canReport && (
            <Button size="sm" variant="secondary" leading={<MessageSquareWarning />} onClick={() => setOpen(true)}>
              Report a problem
            </Button>
          )
        }
      />
      {o.verifications.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line">
          {o.verifications.map((v) => (
            <li key={v.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-fg-2">{v.ref}</span>
                  <span className="text-[12.5px] font-medium">{REASONS.find((r) => r.value === v.reason)?.label ?? v.reason}</span>
                </div>
                <StatusBadge status={v.status} />
              </div>
              {v.message && <p className="mt-1 text-[12.5px] text-fg-2">“{v.message}”</p>}
              {v.resolution && (
                <p className="mt-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px] text-fg-2">
                  {v.resolution.action === 'refund_approved' ? 'Refund approved' : v.resolution.action === 'result_corrected' ? 'Result corrected' : 'Not approved'}
                  {v.resolution.note ? ` — ${v.resolution.note}` : ''}
                </p>
              )}
              <p className="mt-1 text-[11px] text-fg-3">Opened {dateTime(v.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact title="No reports for this order" description="Reports are reviewed by the UnlockDesk team, usually within one business day." />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon={<MessageSquareWarning />}
        title={`Report a problem · ${o.ref}`}
        description="Describe what went wrong. Your order and its result are attached automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={verify.isPending} disabled={message.trim().length < 5} onClick={() => verify.mutate({ reason, message: message.trim() })}>
              Send report
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What’s wrong?" htmlFor="v_reason">
            <Select id="v_reason" value={reason} onChange={(e) => setReason(e.target.value as VerificationReason)} options={REASONS} />
          </Field>
          <Field label="Details" hint="E.g. the exact message the phone shows. At least 5 characters." htmlFor="v_msg">
            <Textarea id="v_msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="The phone says “Network unlock unsuccessful” after entering the code." />
          </Field>
        </div>
      </Modal>
    </Card>
  )
}
