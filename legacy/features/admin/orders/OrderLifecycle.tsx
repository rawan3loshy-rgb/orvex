import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, CircleCheck, CirclePlus, CircleX, Hourglass, ListChecks, LoaderCircle, RotateCw, Route, Send, ShieldAlert, TimerOff, TriangleAlert, Undo2, Wallet, Webhook } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { cn } from '@/lib/cn'
import { duration, time, titleCase } from '@/lib/format'
import type { Tone } from '@/types/common'
import type { OrderDetail, OrderEventType, Provider, Service } from '@/types/installation'
import { isInFlight, span } from './lib'

interface Step {
  id: string
  type: OrderEventType | 'live' | 'ghost'
  title: string
  detail?: string
  at: string | null
  tone: Tone
  providerId?: string
  active?: boolean
  ghost?: boolean
  icon: LucideIcon
}

const ICON: Record<OrderEventType, LucideIcon> = {
  created: CirclePlus,
  validated: ListChecks,
  charged: Wallet,
  routed: Route,
  submitted: Send,
  accepted: CircleCheck,
  provider_timeout: TimerOff,
  provider_error: TriangleAlert,
  retry: RotateCw,
  processing: Hourglass,
  completed: BadgeCheck,
  failed: CircleX,
  refunded: Undo2,
  webhook_sent: Webhook,
}

const PROVIDER_EVENTS: Step['type'][] = ['submitted', 'accepted', 'provider_timeout', 'provider_error', 'retry']

/** Graphite for the path already travelled, coral only for the live step, status colours for outcomes. */
const NODE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg-2 ring-line-strong',
  accent: 'bg-accent/12 text-accent-ink ring-accent/40',
  success: 'bg-success/12 text-success ring-success/35',
  warning: 'bg-warning/12 text-warning ring-warning/35',
  danger: 'bg-danger/12 text-danger ring-danger/35',
  info: 'bg-info/12 text-info ring-info/35',
}

/** Display tone of a settled event: only terminal outcomes and supplier failures keep a colour. */
function settledTone(type: OrderEventType, tone: Tone, rejected: boolean): Tone {
  if (rejected) return 'danger'
  if (type === 'provider_error' || type === 'provider_timeout') return 'warning'
  if (type === 'completed') return 'success'
  if (type === 'failed') return 'danger'
  if (type === 'refunded') return tone === 'warning' ? 'warning' : 'neutral'
  return 'neutral'
}

/** Project the server's event log into display steps, adding a live "current step" for in-flight orders. */
export function buildSteps(order: OrderDetail, service?: Service): Step[] {
  const nowMs = Date.now()
  const steps: Step[] = order.events.map((e) => {
    const rejected = e.type === 'provider_error' && /rejected/i.test(e.title)
    return {
      id: e.id,
      type: e.type,
      title: e.title,
      // A refund issued just now is reported by the engine with a projected timestamp — pin it to the actual update.
      detail: e.type === 'refunded' && new Date(e.at).getTime() > nowMs ? 'Refund issued by an administrator' : e.detail,
      at: e.type === 'refunded' && new Date(e.at).getTime() > nowMs ? order.updatedAt : e.at,
      tone: settledTone(e.type, e.tone, rejected),
      providerId: e.providerId,
      icon: rejected ? CircleX : ICON[e.type],
    }
  })
  if (!isInFlight(order.status)) return steps

  const last = steps.at(-1)
  const lastAttempt = order.attempts.at(-1)
  if (order.status === 'created') {
    steps.push({ id: 'live-routing', type: 'live', title: 'Validating & routing', detail: `Checking input, then choosing a supplier · ${titleCase(service?.routingStrategy ?? 'priority')} strategy`, at: order.createdAt, tone: 'accent', active: true, icon: Route })
  } else if (order.attempts.length === 0) {
    const held = order.error?.code === 'held_for_review'
    steps.push({ id: 'live-hold', type: 'live', title: held ? 'Held for manual review' : 'Queued for routing', detail: order.error?.message ?? 'Waiting for an eligible supplier', at: order.updatedAt, tone: 'warning', active: true, icon: ShieldAlert })
  } else if (lastAttempt && lastAttempt.outcome !== 'success' && lastAttempt.outcome !== 'in_flight') {
    steps.push({ id: 'live-backoff', type: 'live', title: 'Fallback scheduled', detail: 'Backing off before the next supplier in the routing chain', at: lastAttempt.endedAt ?? order.updatedAt, tone: 'accent', active: true, icon: RotateCw })
  } else if (last && last.type === 'processing') {
    last.active = true
    last.tone = 'accent'
  } else {
    steps.push({ id: 'live-processing', type: 'live', title: 'Processing at supplier', detail: 'Waiting for the supplier result', at: order.updatedAt, tone: 'accent', active: true, icon: Hourglass })
  }
  steps.push({
    id: 'ghost-complete',
    type: 'ghost',
    title: service?.category === 'Codes' ? 'Code delivery' : service?.category === 'Unlocking' ? 'Unlock confirmation' : 'Result delivery',
    detail: service ? `Result delivered to the client — typically ${service.turnaround.min === service.turnaround.max ? duration(service.turnaround.max) : `${duration(service.turnaround.min)}–${duration(service.turnaround.max)}`}` : 'Result delivered to the client',
    at: null,
    tone: 'neutral',
    ghost: true,
    icon: BadgeCheck,
  })
  return steps
}

const msPart = (iso: string) => String(new Date(iso).getMilliseconds()).padStart(3, '0')

export function OrderLifecycle({ order, service, now }: { order: OrderDetail; service?: Service; now: number }) {
  const steps = useMemo(() => buildSteps(order, service), [order, service])
  const mountedAt = useRef(Date.now())
  const firstPaint = useRef(true)
  useEffect(() => {
    const t = setTimeout(() => (firstPaint.current = false), 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const prev = steps[i - 1]
        const next = steps[i + 1]
        const delta = prev?.at && s.at ? new Date(s.at).getTime() - new Date(prev.at).getTime() : null
        const showProvider = s.providerId && PROVIDER_EVENTS.includes(s.type)
        const stagger = firstPaint.current && Date.now() - mountedAt.current < 800
        return (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: stagger ? i * 0.035 : 0 }}
            className="relative flex gap-3.5 pb-6 last:pb-0"
          >
            {next && <span aria-hidden className={cn('absolute top-[34px] bottom-[6px] left-[13.5px] w-0 border-l', next.ghost ? 'border-dashed border-line-strong' : next.active ? 'border-accent' : 'border-accent-2/30')} />}
            <span
              className={cn(
                'relative z-[1] grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-3.5',
                s.ghost ? 'border border-dashed border-line-strong bg-surface text-fg-3' : cn('ring-1', NODE[s.tone]),
              )}
            >
              {s.active && <span className={cn('absolute inset-0 animate-pulse-ring rounded-full', s.tone === 'warning' ? 'bg-warning/40' : 'bg-accent/40')} />}
              {s.active ? <LoaderCircle className="animate-spin" /> : <s.icon />}
            </span>
            <div className="min-w-0 flex-1 pt-[3px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={cn('flex min-w-0 items-center gap-2 text-[13.5px] font-medium', s.ghost ? 'text-fg-3' : 'text-fg')}>
                  {showProvider && <ProviderMark id={s.providerId!} size="xs" className="translate-y-px" />}
                  <span className="min-w-0">{s.title}</span>
                  {s.active && s.at && <span className="shrink-0 font-mono text-[11.5px] font-normal text-accent-ink tabular">{span(now - new Date(s.at).getTime())}</span>}
                </p>
                {!s.ghost && s.at && (
                  <span className="flex shrink-0 items-center gap-2">
                    {delta != null && delta >= 0 && i > 0 && <span className="rounded-md bg-fg/[0.05] px-1.5 py-px font-mono text-[10.5px] text-fg-3 tabular">+{span(delta)}</span>}
                    <time dateTime={s.at} className="font-mono text-[11.5px] text-fg-2 tabular">
                      {time(s.at, true)}
                      <span className="text-fg-3/70">.{msPart(s.at)}</span>
                    </time>
                  </span>
                )}
              </div>
              {s.detail && <p className={cn('mt-0.5 text-[12.5px] leading-relaxed', s.tone === 'danger' && !s.ghost ? 'text-danger/85' : 'text-fg-3')}>{s.detail}</p>}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage rail — the order desk view of where an order is right now    */
/* ------------------------------------------------------------------ */
type StageState = 'done' | 'live' | 'held' | 'failed' | 'todo'

interface Stage {
  label: string
  sub: string
  state: StageState
}

export function stagesOf(order: OrderDetail, service?: Service, providers?: Provider[]): Stage[] {
  const s = order.status
  const short = (id: string | null | undefined) => (id ? (providers?.find((p) => p.id === id)?.shortName ?? id) : null)
  const routedTo = short(order.attempts.at(-1)?.providerId)
  const held = order.attempts.length === 0 && order.error?.code === 'held_for_review'
  const deliverLabel = service?.category === 'Codes' ? 'Code sent' : service?.category === 'Unlocking' ? 'Unlocked' : 'Delivered'

  // Index of the stage the order is at (or stopped at).
  const at = s === 'created' ? 1 : order.attempts.length === 0 ? 2 : isInFlight(s) || s === 'failed' || s === 'cancelled' ? 3 : 4
  const finalState: StageState = isInFlight(s) ? (held ? 'held' : 'live') : s === 'failed' || s === 'cancelled' ? 'failed' : 'done'

  const subs = [
    time(order.createdAt, true),
    s === 'created' ? 'Checking fields' : `${Object.keys(order.input).length} field${Object.keys(order.input).length === 1 ? '' : 's'} OK`,
    held ? 'Manual review' : order.attempts.length ? `${order.attempts.length} attempt${order.attempts.length === 1 ? '' : 's'}` : s === 'failed' ? 'No route' : s === 'cancelled' ? 'Cancelled' : 'Pending',
    routedTo ?? '—',
    order.completedAt && (s === 'success' || s === 'refunded') ? time(order.completedAt, true) : s === 'failed' ? 'Not delivered' : s === 'cancelled' ? 'Cancelled' : service ? `~${duration(service.turnaround.max)}` : '—',
  ]
  return ['Received', 'Validated', 'Routed', 'At supplier', deliverLabel].map((label, i) => ({
    label,
    sub: subs[i]!,
    state: i < at ? 'done' : i === at ? finalState : 'todo',
  }))
}

const BAR_CLS: Record<StageState, string> = {
  done: 'bg-accent-2/55',
  live: 'bg-accent',
  held: 'bg-warning',
  failed: 'bg-danger',
  todo: 'bg-surface-2 bg-hatch',
}

export function StageRail({ order, service, providers }: { order: OrderDetail; service?: Service; providers?: Provider[] }) {
  const stages = stagesOf(order, service, providers)
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Order progress">
      {stages.map((st) => (
        <li key={st.label} className="min-w-0" aria-current={st.state === 'live' || st.state === 'held' ? 'step' : undefined}>
          <span className={cn('relative block h-1 overflow-hidden rounded-full', BAR_CLS[st.state])}>
            {st.state === 'live' && <span className="absolute inset-0 animate-pulse bg-accent/60" />}
          </span>
          <span
            className={cn(
              'mt-2 block truncate text-[11.5px] font-medium sm:text-[12px]',
              st.state === 'live' ? 'text-accent-ink' : st.state === 'held' ? 'text-warning' : st.state === 'failed' ? 'text-danger' : st.state === 'done' ? 'text-fg' : 'text-fg-3',
            )}
          >
            {st.label}
          </span>
          <span className="block truncate font-mono text-[10.5px] text-fg-3 tabular">{st.sub}</span>
        </li>
      ))}
    </ol>
  )
}
