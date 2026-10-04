import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, Ban, CircleCheck, CircleHelp, CircleX, Loader2, ShieldAlert, Smartphone, TriangleAlert } from 'lucide-react'
import { Badge, Segmented } from '@/components/ui'
import { money, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Container, Reveal, Section, SectionHeader } from './shared'
import { useAutoStep } from './sharedUtils'
import { HEALTH_LABEL, ROUTABLE, SUPPLIERS, svc } from './demo'
import { SupplierMark } from './SupplierMark'
import { brand } from '@/config/brand'

type TierKey = 'retail' | 'silver' | 'gold' | 'platinum'
const TIER_LABEL: Record<TierKey, string> = { retail: 'Retail', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }

/** Route plan for one service at one tier: what the RoutingEngine would do right now. */
function PlanCard() {
  const service = svc('4044')
  const [tier, setTier] = useState<TierKey>('platinum')
  const price = service.tiers[tier]
  const plan = useMemo(() => {
    const offers = service.offers.map((o, i) => {
      const s = SUPPLIERS[o.k]
      const reasons: string[] = []
      if (!ROUTABLE[s.health]) reasons.push(HEALTH_LABEL[s.health].toLowerCase())
      if (o.cost > price) reasons.push(`margin guard · cost ${money(o.cost)} > price ${money(price)}`)
      return { ...o, i, s, reasons }
    })
    // The first eligible offer is primary; later eligible ones are failovers.
    const primary = offers.findIndex((o) => o.reasons.length === 0)
    return offers.map((o) => ({ ...o, role: o.reasons.length ? 'skipped' : o.i === primary ? 'primary' : 'failover' }))
  }, [service, price])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-card">
      <div className="border-b border-line p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-fg">Route plan</div>
            <div className="truncate font-mono text-[11px] text-fg-3">
              {service.code} · {service.name}
            </div>
          </div>
          <Badge tone="neutral">Priority routing · V1</Badge>
        </div>
        <div className="no-scrollbar -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented size="sm" items={(Object.keys(TIER_LABEL) as TierKey[]).map((k) => ({ value: k, label: `${TIER_LABEL[k]} ${money(service.tiers[k])}` }))} value={tier} onChange={setTier} />
        </div>
        <p className="mt-3 min-h-[40px] text-[13px] leading-relaxed text-fg-2">Offers are tried strictly in priority order. Unroutable suppliers and offers that would sell below cost are skipped — switch the tier to see the margin guard react.</p>
      </div>
      <ol className="flex-1 space-y-1.5 p-3 sm:p-4">
        {plan.map((p) => {
          const skipped = p.role === 'skipped'
          const first = p.role === 'primary'
          return (
            <motion.li layout key={p.k} transition={{ type: 'spring', stiffness: 420, damping: 36 }} className={cn('relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-3', first ? 'border-accent/40 bg-accent/[0.05]' : 'border-line bg-surface', skipped && 'bg-hatch opacity-70')}>
              <span className={cn('w-5 font-mono text-[11px] tabular', first ? 'text-accent-ink' : 'text-fg-3')}>P{p.i + 1}</span>
              <SupplierMark k={p.k} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-[13px] font-medium text-fg', skipped && 'line-through decoration-fg-3')}>{p.s.name}</span>
                  {first && (
                    <Badge tone="accent" className="hidden sm:inline-flex">
                      Routes first
                    </Badge>
                  )}
                  {p.role === 'failover' && (
                    <Badge tone="neutral" className="hidden sm:inline-flex">
                      Failover
                    </Badge>
                  )}
                </div>
                <div className={cn('mt-0.5 truncate font-mono text-[10.5px]', skipped ? 'text-warning' : 'text-fg-3')}>
                  {skipped ? (
                    <span className="inline-flex items-center gap-1">
                      <ShieldAlert className="size-3" /> skipped · {p.reasons.join(' · ')}
                    </span>
                  ) : (
                    `${p.s.driver} · ${p.external}`
                  )}
                </div>
              </div>
              <span className="w-[92px] shrink-0 text-right font-mono text-[12px] text-fg tabular">
                {money(p.cost)}
                {!skipped && <span className="block text-[10.5px] text-success">{pct(((price - p.cost) / price) * 100, 0)} margin</span>}
              </span>
            </motion.li>
          )
        })}
      </ol>
      <div className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-fg-3 sm:px-5">No weighted, round-robin or scoring strategies in V1 — every routing decision can be explained in one sentence.</div>
    </div>
  )
}

type LaneState = 'standby' | 'trying' | 'rejected' | 'ok' | 'unknown' | 'blocked'
type Scenario = 'rejected' | 'timeout'

const LANES = ['beta', 'delta', 'alpha'] as const

const SCRIPTS: Record<Scenario, LaneState[][]> = {
  rejected: [
    ['standby', 'standby', 'standby'],
    ['trying', 'standby', 'standby'],
    ['rejected', 'standby', 'standby'],
    ['rejected', 'trying', 'standby'],
    ['rejected', 'ok', 'standby'],
    ['rejected', 'ok', 'standby'],
  ],
  timeout: [
    ['standby', 'standby', 'standby'],
    ['trying', 'standby', 'standby'],
    ['unknown', 'standby', 'standby'],
    ['unknown', 'blocked', 'blocked'],
    ['unknown', 'blocked', 'blocked'],
  ],
}

function LaneStatus({ state }: { state: LaneState }) {
  const map: Record<LaneState, { icon?: ReactNode; text: string; cls: string }> = {
    standby: { text: 'standby', cls: 'text-fg-3' },
    trying: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'placing order…', cls: 'text-accent-ink' },
    rejected: { icon: <CircleX className="size-3.5" />, text: 'rejected · failover-safe', cls: 'text-danger' },
    ok: { icon: <CircleCheck className="size-3.5" />, text: 'code delivered', cls: 'text-success' },
    unknown: { icon: <CircleHelp className="size-3.5" />, text: 'no reply in 45 s · UNKNOWN', cls: 'text-warning' },
    blocked: { icon: <Ban className="size-3.5" />, text: 'failover blocked', cls: 'text-fg-3' },
  }
  const m = map[state]
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={state} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }} className={cn('flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap', m.cls)}>
        {m.icon}
        <span className={cn(state === 'unknown' || state === 'rejected' ? 'hidden sm:inline' : '')}>{m.text}</span>
        {(state === 'unknown' || state === 'rejected') && <span className="sm:hidden">{state}</span>}
      </motion.span>
    </AnimatePresence>
  )
}

function FailoverCard() {
  const [scenario, setScenario] = useState<Scenario>('rejected')
  const script = SCRIPTS[scenario]
  const { ref, step, setStep } = useAutoStep<HTMLDivElement>(script.length, (s) => (s === 0 ? 900 : s === script.length - 1 ? 3000 : script[s]!.includes('trying') ? 1500 : 1200))
  const states = script[Math.min(step, script.length - 1)]!
  const done = states.includes('ok')
  const review = states.includes('blocked')

  return (
    <div ref={ref} className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg">Guarded failover</div>
          <div className="truncate font-mono text-[11px] text-fg-3">ORD-9T1V6B · ABC GSM · Gold {money(9)}</div>
        </div>
        <Segmented
          size="sm"
          value={scenario}
          onChange={(v) => {
            setScenario(v)
            setStep(0)
          }}
          items={[
            { value: 'rejected', label: 'P1 rejects' },
            { value: 'timeout', label: 'P1 times out' },
          ]}
        />
      </div>

      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-[12px] text-fg-2">
          <Smartphone className="size-3.5 shrink-0 text-fg-3" />
          <span className="truncate font-mono">IMEI 352094117328416 · SM-S918B</span>
          <span className="ml-auto hidden shrink-0 font-mono text-fg-3 sm:inline">4040 · NCK</span>
        </div>

        <div className="relative mt-3 space-y-3 pl-5">
          <div className="absolute top-2 bottom-2 left-[7px] w-px bg-line-strong" />
          {LANES.map((k, i) => {
            const st = states[i]!
            return (
              <div key={k} className="relative">
                <span
                  className={cn(
                    'absolute top-1/2 -left-5 size-[15px] -translate-y-1/2 rounded-full border-2 bg-surface transition-colors duration-300',
                    st === 'trying' ? 'border-accent' : st === 'rejected' ? 'border-danger' : st === 'unknown' ? 'border-warning' : st === 'ok' ? 'border-success bg-success' : 'border-line-strong',
                  )}
                />
                <motion.div
                  animate={{ scale: st === 'trying' ? 1.01 : 1 }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 transition-[border-color,background-color] duration-300',
                    st === 'trying' ? 'border-accent/55 bg-accent/[0.05]' : st === 'rejected' ? 'border-danger/30 bg-danger/[0.04]' : st === 'unknown' ? 'border-warning/40 bg-warning/[0.05]' : st === 'ok' ? 'border-success/35 bg-success/[0.06]' : st === 'blocked' ? 'border-line bg-hatch' : 'border-line bg-surface',
                  )}
                >
                  <SupplierMark k={k} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="mono-label">Offer P{i + 1}</div>
                    <div className="truncate text-[13px] font-medium text-fg">{SUPPLIERS[k].name}</div>
                  </div>
                  <LaneStatus state={st} />
                </motion.div>
                {st === 'trying' && <motion.div className="absolute inset-x-3 bottom-0 h-[2px] origin-left rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.4, ease: 'linear' }} />}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex justify-center text-fg-3">
          <ArrowDown className="size-4" />
        </div>
        <div className={cn('mt-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] transition-colors duration-300', done ? 'border-success/35 bg-success/[0.06] text-success' : review ? 'border-warning/40 bg-warning/[0.06] text-warning' : 'border-line text-fg-3')}>
          {done ? <CircleCheck className="mt-px size-3.5 shrink-0" /> : review ? <TriangleAlert className="mt-px size-3.5 shrink-0" /> : <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" />}
          <span className="min-w-0">
            {done
              ? 'Completed · $9.00 captured · supplier cost $6.10 · webhook order.completed'
              : review
                ? 'Needs Review — Beta may have accepted the order. $9.00 stays held; no second supplier order is placed until an operator resolves it.'
                : 'Waiting for a definitive supplier outcome…'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function RoutingSection() {
  return (
    <Section id="routing">
      <Container>
        <SectionHeader
          index="06"
          eyebrow="Routing & guarded failover"
          title="Fail over when it’s safe. Stop when it isn’t."
          description={`${brand.product} tries offers in priority order. A definitive rejection classified failover-safe moves the order to the next offer. A timeout or ambiguous reply after the request was sent is an UNKNOWN outcome: the order goes to Needs Review with funds held — never a duplicate supplier order.`}
        />
        <div className="mt-12 grid gap-4 lg:mt-14 lg:grid-cols-2">
          <Reveal>
            <PlanCard />
          </Reveal>
          <Reveal delay={0.08}>
            <FailoverCard />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
