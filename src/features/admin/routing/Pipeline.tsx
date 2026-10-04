import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Ban, CircleCheck, CircleHelp, CircleX, Hourglass, Inbox, RotateCcw, Send, ShieldAlert, SkipForward, Wallet } from 'lucide-react'
import { Button, Segmented } from '@/components/ui'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
interface Node {
  icon: ReactNode
  title: string
  detail: string
  tone: Tone
  /** Connector label leading into this node. */
  via?: string
}

type ScenarioId = 'success' | 'failover' | 'not_accepted' | 'terminal' | 'timeout' | 'margin'

const placed = (price = '$3.50', tier = 'Retail'): Node => ({ icon: <Wallet />, title: 'Order placed', detail: `${tier} price ${price} quoted, snapshotted and held in the wallet`, tone: 'neutral' })

const SCENARIOS: Record<ScenarioId, { label: string; summary: string; nodes: Node[] }> = {
  success: {
    label: 'Success',
    summary: 'P1 accepts and returns a result. The hold is captured; supplier cost is booked.',
    nodes: [
      placed(),
      { icon: <Send />, title: 'P1 · Alpha', detail: 'Routable, cost $0.72 ≤ price → submit()', tone: 'accent' },
      { icon: <CircleCheck />, title: 'Accepted → success', detail: 'Result normalised to the service result schema', tone: 'success', via: 'response' },
      { icon: <CircleCheck />, title: 'Completed', detail: 'Hold captured · cost $0.72 · margin $2.78', tone: 'success' },
    ],
  },
  failover: {
    label: 'Rejected (failover-safe)',
    summary: 'A mapped supplier error proves P1 did not process the order — routing continues with P2.',
    nodes: [
      placed(),
      { icon: <Send />, title: 'P1 · Alpha', detail: 'submit()', tone: 'accent' },
      { icon: <SkipForward />, title: 'Rejected · failover-safe', detail: '"Service temporarily disabled" matches an error mapping', tone: 'warning', via: 'definitive answer' },
      { icon: <Send />, title: 'P2 · Beta', detail: 'Next offer in priority order → submit()', tone: 'accent', via: 'failover' },
      { icon: <CircleCheck />, title: 'Completed', detail: 'Captured · cost $0.85 (Beta)', tone: 'success' },
    ],
  },
  not_accepted: {
    label: 'Not accepted',
    summary: 'Rate limit, insufficient supplier funds, auth failure or connection refused: the supplier provably did not take the order.',
    nodes: [
      placed(),
      { icon: <Send />, title: 'P1 · Zeta', detail: 'submit()', tone: 'accent' },
      { icon: <Ban />, title: 'Not accepted', detail: 'Insufficient supplier funds — nothing was ordered', tone: 'warning', via: 'refused' },
      { icon: <Send />, title: 'P2 · Gamma', detail: 'Next offer → submit()', tone: 'accent', via: 'failover' },
      { icon: <CircleCheck />, title: 'Completed', detail: 'Captured · cost from Gamma', tone: 'success' },
    ],
  },
  terminal: {
    label: 'Rejected (terminal)',
    summary: 'A correct "no" (bad input, not eligible). Another supplier would answer the same — no failover.',
    nodes: [
      placed(),
      { icon: <Send />, title: 'P1 · Alpha', detail: 'submit()', tone: 'accent' },
      { icon: <CircleX />, title: 'Rejected · terminal', detail: '"Device not found in carrier database" — unmapped → terminal', tone: 'danger', via: 'definitive answer' },
      { icon: <RotateCcw />, title: 'Rejected', detail: 'Hold released to the customer; no supplier cost', tone: 'danger' },
    ],
  },
  timeout: {
    label: 'Timeout (UNKNOWN)',
    summary: 'The request was sent but no usable answer came back. The supplier may have processed it — failing over could order (and pay) twice.',
    nodes: [
      placed(),
      { icon: <Send />, title: 'P1 · Delta', detail: 'submit() sent', tone: 'accent' },
      { icon: <Hourglass />, title: 'No response in 12 s', detail: 'Timeout after the request left ORVEX', tone: 'warning', via: 'waiting…' },
      { icon: <CircleHelp />, title: 'UNKNOWN', detail: 'Failover BLOCKED — P2 is not tried', tone: 'danger', via: 'classify' },
      { icon: <Inbox />, title: 'needs_review', detail: 'Hold kept · operator looks up the order at the supplier, then confirms, retries or resolves', tone: 'danger' },
    ],
  },
  margin: {
    label: 'Margin guard',
    summary: 'Scenario F: Motorola IMEI Check, Platinum contract $0.40. Gamma now costs $0.46 — routing it would lose money.',
    nodes: [
      placed('$0.40', 'Platinum'),
      { icon: <ShieldAlert />, title: 'P1 · Gamma skipped', detail: 'Cost $0.46 > order price $0.40 (margin guard)', tone: 'warning' },
      { icon: <Send />, title: 'P2 · Beta', detail: 'Cost $0.38 ≤ $0.40 → submit()', tone: 'accent', via: 'next offer' },
      { icon: <CircleCheck />, title: 'Completed', detail: 'Captured · margin $0.02 (fix the contract price!)', tone: 'success' },
    ],
  },
}

const TONE: Record<Tone, string> = {
  neutral: 'border-line bg-surface text-fg-2',
  accent: 'border-accent/40 bg-accent/[0.06] text-accent-ink',
  success: 'border-success/40 bg-success/[0.07] text-success',
  warning: 'border-warning/40 bg-warning/[0.08] text-warning',
  danger: 'border-danger/40 bg-danger/[0.07] text-danger',
}

export function Pipeline() {
  const [id, setId] = useState<ScenarioId>('timeout')
  const [step, setStep] = useState(0)
  const [run, setRun] = useState(0)
  const sc = SCENARIOS[id]

  // A new scenario or a replay starts from the first node (reset during render, not in the effect).
  const [playing, setPlaying] = useState({ id, run })
  if (playing.id !== id || playing.run !== run) {
    setPlaying({ id, run })
    setStep(0)
  }

  useEffect(() => {
    let i = 0
    const t = setInterval(() => {
      i++
      setStep(i)
      if (i >= sc.nodes.length) clearInterval(t)
    }, 750)
    return () => clearInterval(t)
  }, [id, run, sc.nodes.length])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented size="xs" value={id} onChange={setId} items={(Object.keys(SCENARIOS) as ScenarioId[]).map((k) => ({ value: k, label: SCENARIOS[k].label }))} />
        </div>
        <Button size="xs" variant="ghost" leading={<RotateCcw />} onClick={() => setRun((r) => r + 1)}>
          Replay
        </Button>
      </div>
      <div className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-stretch">
        {sc.nodes.map((n, i) => {
          const shown = i < step
          return (
            <Fragment key={`${id}-${run}-${i}`}>
              {i > 0 && (
                <div className="relative flex shrink-0 items-center justify-center py-1 lg:w-14 lg:flex-col lg:py-0">
                  <div className="relative h-6 w-px bg-line lg:h-px lg:w-full">
                    {shown && <motion.span className="absolute inset-0 origin-top bg-accent/70 lg:origin-left" initial={{ scaleY: 0, scaleX: 1 }} animate={{ scaleY: 1 }} transition={{ duration: 0.35 }} />}
                  </div>
                  {n.via && <span className={cn('absolute left-4 text-[10px] whitespace-nowrap lg:static lg:mt-1 lg:left-auto', shown ? 'text-fg-3' : 'text-transparent')}>{n.via}</span>}
                  <ArrowRight className={cn('absolute hidden size-3 lg:right-0 lg:block', shown ? 'text-accent-ink' : 'text-line-strong')} style={{ top: 'calc(50% - 6px)' }} />
                </div>
              )}
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0.25, y: 4 }}
                  animate={{ opacity: shown ? 1 : 0.25, y: shown ? 0 : 4 }}
                  transition={{ duration: 0.3 }}
                  className={cn('min-w-0 flex-1 rounded-xl border p-3 transition-colors', shown ? TONE[n.tone] : 'border-dashed border-line bg-transparent text-fg-3')}
                >
                  <div className="flex items-center gap-2 [&_svg]:size-4">
                    {n.icon}
                    <span className={cn('text-[12.5px] font-semibold', shown && n.tone === 'neutral' && 'text-fg')}>{n.title}</span>
                  </div>
                  <div className="mt-1 text-[11.5px] leading-snug text-fg-2">{n.detail}</div>
                </motion.div>
              </AnimatePresence>
            </Fragment>
          )
        })}
      </div>
      <p className={cn('mt-3 text-[12.5px] transition-opacity', step >= sc.nodes.length ? 'text-fg-2 opacity-100' : 'opacity-0')}>{sc.summary}</p>
    </div>
  )
}
