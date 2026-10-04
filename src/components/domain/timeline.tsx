import type { LucideIcon } from 'lucide-react'
import {
  ArrowRightLeft,
  BadgeCheck,
  Ban,
  Bell,
  CircleCheck,
  CircleDollarSign,
  CircleHelp,
  CircleX,
  Clock,
  CreditCard,
  FileSearch,
  Landmark,
  Lock,
  LockOpen,
  Repeat2,
  Route,
  Send,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Wallet,
  Webhook,
} from 'lucide-react'
import type { OrderEvent, OrderEventType } from '@/types/installation'
import { time, dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

export const EVENT_ICON: Record<OrderEventType, LucideIcon> = {
  created: CircleDollarSign,
  payment_pending: CreditCard,
  payment_succeeded: CreditCard,
  payment_failed: CreditCard,
  wallet_funded: Wallet,
  hold_created: Lock,
  queued: Clock,
  routed: Route,
  attempt_sent: Send,
  attempt_accepted: BadgeCheck,
  attempt_rejected: CircleX,
  attempt_not_accepted: Ban,
  attempt_unknown: CircleHelp,
  failover: ArrowRightLeft,
  failover_blocked: ShieldAlert,
  margin_guard: ShieldCheck,
  processing: Clock,
  result_received: FileSearch,
  completed: CircleCheck,
  rejected: CircleX,
  cancelled: Ban,
  hold_released: LockOpen,
  ledger_settled: Landmark,
  needs_review: ShieldAlert,
  review_action: FileSearch,
  refund: Undo2,
  verification: FileSearch,
  notification: Bell,
  webhook: Webhook,
  idempotent_replay: Repeat2,
}

const TONE: Record<string, string> = {
  neutral: 'bg-surface-2 text-fg-2 ring-line',
  accent: 'bg-accent/10 text-accent-ink ring-accent/25',
  success: 'bg-success/10 text-success ring-success/25',
  warning: 'bg-warning/12 text-warning ring-warning/30',
  danger: 'bg-danger/10 text-danger ring-danger/25',
  info: 'bg-info/10 text-info ring-info/25',
}

/** Professional order timeline: one row per event, icon + tone by type, actor and linked record. */
export function OrderTimeline({ events, onRef, className, live }: { events: OrderEvent[]; onRef?: (ref: NonNullable<OrderEvent['ref']>) => void; className?: string; live?: boolean }) {
  return (
    <ol className={cn('relative', className)}>
      {events.map((e, i) => {
        const Icon = EVENT_ICON[e.type] ?? Clock
        const last = i === events.length - 1
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-line" />}
            <span className={cn('relative z-10 grid size-7 shrink-0 place-items-center rounded-full ring-1', TONE[e.tone] ?? TONE.neutral, last && live && 'animate-pulse')}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <div className="text-[13px] font-medium text-fg">{e.title}</div>
                <time className="shrink-0 font-mono text-[11px] text-fg-3 tabular" title={dateTime(e.at)} dateTime={e.at}>
                  {time(e.at, true)}
                </time>
              </div>
              {e.detail && <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-2">{e.detail}</div>}
              {(e.actor || e.ref) && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-fg-3">
                  {e.actor && <span>by {e.actor.name}</span>}
                  {e.ref && onRef && (
                    <button type="button" onClick={() => onRef(e.ref!)} className="font-medium text-accent-ink hover:underline">
                      View {e.ref.kind}
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
