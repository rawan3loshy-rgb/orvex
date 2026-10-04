import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BellRing, CornerDownRight, Lock, RefreshCw, TriangleAlert, Wallet, Webhook, type LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types/common'
import { Container, MockFrame, Reveal, Section, SectionHeader } from './shared'
import { EASE, useTicker } from './sharedUtils'

type RuleId = 'notify' | 'webhooks' | 'review' | 'balance' | 'sync'

const RULES: { id: RuleId; icon: LucideIcon; name: string; on: string; then: string }[] = [
  { id: 'notify', icon: BellRing, name: 'Notify customers', on: 'order.completed', then: 'Email, Telegram or WhatsApp — per account preference (simulated in the demo)' },
  { id: 'webhooks', icon: Webhook, name: 'Deliver signed webhooks', on: 'order.*', then: 'Standard Webhooks signature; retries keep the same webhook-id' },
  { id: 'review', icon: TriangleAlert, name: 'Page on Needs Review', on: 'order.needs_review', then: 'Telegram to the on-call operators with the order and attempt' },
  { id: 'balance', icon: Wallet, name: 'Supplier low-balance alerts', on: 'supplier.balance_low', then: 'Email + Telegram to Owners and Admins' },
  { id: 'sync', icon: RefreshCw, name: 'Review catalog changes', on: 'catalog.changed', then: 'Queue supplier cost and availability changes for approval' },
]

interface Ev {
  type: string
  tone: Tone
  detail: string
  rule?: RuleId
}

const SCRIPT: Ev[] = [
  { type: 'order.created', tone: 'neutral', detail: 'ORD-4M8D2X · iPhone 15 Carrier Check · storefront guest checkout' },
  { type: 'attempt.succeeded', tone: 'accent', detail: 'DHRU Supplier Alpha (offer P1) · result in 1.8 s' },
  { type: 'order.completed', tone: 'success', detail: 'ORD-4M8D2X · $3.50 captured · result + tracking link emailed', rule: 'notify' },
  { type: 'webhook.delivered', tone: 'success', detail: 'order.completed → ABC GSM · webhook-id msg_2Qx7… · 200 OK', rule: 'webhooks' },
  { type: 'attempt.rejected', tone: 'warning', detail: 'Beta Unlock Source · “service disabled” · definitive, failover-safe' },
  { type: 'order.failover', tone: 'accent', detail: 'ORD-9T1V6B → Delta GSM Server (offer P2) · margin guard ✓' },
  { type: 'attempt.unknown', tone: 'warning', detail: 'Delta GSM Server · no reply in 45 s after sending · ORD-2H5R8N' },
  { type: 'order.needs_review', tone: 'danger', detail: 'ORD-2H5R8N · $9.00 stays held · automatic failover blocked', rule: 'review' },
  { type: 'supplier.balance_low', tone: 'warning', detail: 'Zeta Device Data · $38.20 below the $50.00 threshold', rule: 'balance' },
  { type: 'catalog.changed', tone: 'neutral', detail: 'Beta Unlock Source · 2 cost changes queued for review', rule: 'sync' },
  { type: 'order.refunded', tone: 'info', detail: 'ORD-6C2W4K · $1.20 to wallet · capped at the captured amount, idempotent' },
]

const toneCls: Record<Tone, string> = {
  neutral: 'text-fg-2 bg-fg/[0.06]',
  accent: 'text-accent-ink bg-accent/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/12',
  danger: 'text-danger bg-danger/10',
  info: 'text-info bg-info/10',
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const stamp = (msTotal: number) => {
  const h = 9
  const m = 41 + Math.floor(msTotal / 60000)
  const s = Math.floor(msTotal / 1000) % 60
  return `${pad(h)}:${pad(m % 60)}:${pad(s)}.${pad(msTotal % 1000, 3)}`
}

function EventStream({ enabled }: { enabled: Record<RuleId, boolean> }) {
  const { ref, tick } = useTicker<HTMLDivElement>(1350)
  const clock = useRef(12_204)
  const [items, setItems] = useState(() =>
    SCRIPT.slice(0, 4)
      .map((e, i) => ({ ...e, key: i, at: stamp(12_204 + i * 1830) }))
      .reverse(),
  )
  useEffect(() => {
    if (!tick) return
    clock.current += 700 + Math.round(Math.random() * 2400)
    setItems((prev) => {
      const n = prev[0]!.key + 1
      const ev = SCRIPT[n % SCRIPT.length]!
      return [{ ...ev, key: n, at: stamp(clock.current) }, ...prev].slice(0, 8)
    })
  }, [tick])

  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      <div className="flex h-10 items-center justify-between border-b border-line bg-surface-2/50 px-3.5">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
          <span className="relative inline-flex size-1.5">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
            <span className="relative size-1.5 rounded-full bg-accent" />
          </span>
          Event stream
        </span>
        <span className="font-mono text-[11px] text-fg-3">orvex events tail</span>
      </div>
      <ul className="h-[372px] overflow-hidden px-2 py-2 [mask-image:linear-gradient(180deg,black_70%,transparent)]">
        <AnimatePresence initial={false}>
          {items.map((e) => {
            const off = e.rule ? !enabled[e.rule] : false
            return (
              <motion.li
                key={e.key}
                layout
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className={cn('flex flex-col gap-1 rounded-lg px-2.5 py-2 transition-opacity sm:flex-row sm:items-center sm:gap-3', off && 'opacity-45')}>
                  <span className="shrink-0 font-mono text-[10.5px] text-fg-3 tabular">{e.at}</span>
                  <span className={cn('w-fit shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]', off ? 'bg-fg/[0.05] text-fg-3 line-through' : toneCls[e.tone])}>{e.type}</span>
                  <span className="min-w-0 truncate text-[12px] text-fg-2">{off ? 'rule disabled — no action taken' : e.detail}</span>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}

export function AutomationSection() {
  const [enabled, setEnabled] = useState<Record<RuleId, boolean>>({ notify: true, webhooks: true, review: true, balance: true, sync: true })
  return (
    <Section id="automation">
      <Container>
        <SectionHeader
          index="07"
          eyebrow="Automation"
          title="Event-driven operations that know when to stop."
          description="Every order, payment and supplier change emits events. Automations react — notifying customers, signing webhooks, paging on-call, flagging low supplier balances — so your team only hears about what genuinely needs a human."
        />
        <div className="mt-12 grid items-start gap-4 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal>
            <MockFrame path="portal.unlockdesk-demo.com/admin/notifications/rules" right={<span className="font-mono text-[11px] text-fg-3">{Object.values(enabled).filter(Boolean).length} of 5 active</span>}>
              <ul>
                {RULES.map((r) => (
                  <li key={r.id} className="flex items-center gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border transition-colors', enabled[r.id] ? 'border-accent/30 bg-accent/10 text-accent-ink' : 'border-line bg-surface-2 text-fg-3')}>
                      <r.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-fg">{r.name}</div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-fg-3">
                        <span className="rounded bg-fg/[0.06] px-1.5 py-px font-mono text-[11px] text-fg-2">on {r.on}</span>
                        <CornerDownRight className="size-3 shrink-0" />
                        <span className="min-w-0">{r.then}</span>
                      </div>
                    </div>
                    <Switch checked={enabled[r.id]} onChange={(v) => setEnabled((e) => ({ ...e, [r.id]: v }))} label={r.name} />
                  </li>
                ))}
              </ul>
            </MockFrame>
            <p className="mt-3 flex items-start gap-2 px-1 text-[12.5px] leading-relaxed text-fg-3">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>Toggle an automation to see the stream react. Guarded failover, Needs Review and ledger holds are Core behaviour — not rules — and cannot be switched off.</span>
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <EventStream enabled={enabled} />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
