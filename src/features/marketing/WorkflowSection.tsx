import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CircleCheck, CircleX, Coins, RotateCcw, Route, ScanBarcode, Send, Shuffle, Store, Webhook, type LucideIcon } from 'lucide-react'
import { LogoMark } from '@/components/brand'
import { Button, DemoTag, StatusBadge } from '@/components/ui'
import { useMeasure } from '@/lib/useMeasure'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import type { Tone } from '@/types/common'
import { Container, Reveal, Section, SectionHeader } from './shared'
import { EASE, useAutoStep } from './sharedUtils'
import { SupplierMark } from './SupplierMark'
import { brand } from '@/config/brand'

const STEPS: { title: string; detail: string; t: string; icon: LucideIcon; tone?: Tone }[] = [
  { title: 'ABC GSM places an order', detail: 'A technician at ABC GSM orders “Samsung Network Unlock Code (NCK)” in the reseller portal. The portal calls the same PlaceOrder command as the storefront, the Native API and the DHRU endpoint.', t: '+0ms', icon: Send },
  { title: 'Input validated', detail: 'IMEI 352094117328416 has 15 digits and passes the Luhn check; model SM-S918B is in the GSM pack’s model list for this service revision.', t: '+4ms', icon: ScanBarcode },
  { title: 'Priced and held', detail: 'Gold tier rule: cost of the priority offer ($6.92) + 30%, rounded up → $9.00. The ledger moves $9.00 from ABC GSM’s available wallet to held.', t: '+6ms', icon: Coins },
  { title: 'Sent to Beta Unlock Source', detail: 'Offer P1 for this service, via the DHRU Fusion driver (HTTP form-POST, product #1288).', t: '+9ms', icon: Route },
  { title: 'Beta rejects the order', detail: '“Service temporarily disabled” — a definitive rejection the driver classifies as failover-safe. Had Beta timed out instead, the order would have gone to Needs Review with funds held.', t: '+842ms', icon: CircleX, tone: 'warning' },
  { title: 'Guarded failover to Delta GSM Server', detail: 'Offer P2 passes the margin guard (cost $6.10 < price $9.00). Same order, same held funds — a second attempt, not a second order.', t: '+846ms', icon: Shuffle },
  { title: 'Code delivered · funds captured', detail: 'Delta returns the NCK code. Settlement captures $9.00 to revenue and books $6.10 cost of sales against Delta’s prepaid balance — margin $2.90.', t: '+48m 38s', icon: CircleCheck, tone: 'success' },
  { title: 'ABC GSM is notified', detail: 'A signed order.completed webhook (webhook-id msg_2Qx7…) is accepted with 200 OK, and the technician gets the code by email.', t: '+48m 38s', icon: Webhook, tone: 'success' },
]

type NodeId = 'reseller' | 'core' | 'alpha' | 'beta'

const POS_WIDE: Record<NodeId, [number, number]> = { reseller: [0.15, 0.5], core: [0.47, 0.5], alpha: [0.83, 0.24], beta: [0.83, 0.76] }
const POS_NARROW: Record<NodeId, [number, number]> = { reseller: [0.5, 0.11], core: [0.5, 0.42], alpha: [0.26, 0.8], beta: [0.74, 0.8] }

const PACKETS: Record<number, { from: NodeId; to: NodeId; tone: 'accent' | 'success' }> = {
  0: { from: 'reseller', to: 'core', tone: 'accent' },
  3: { from: 'core', to: 'alpha', tone: 'accent' },
  5: { from: 'core', to: 'beta', tone: 'accent' },
  6: { from: 'beta', to: 'core', tone: 'success' },
  7: { from: 'core', to: 'reseller', tone: 'success' },
}

const CORE_STATUS = ['PlaceOrder…', 'IMEI ✓ · Luhn ✓', `Gold · ${money(9)} held`, 'offer P1 → Beta', 'rejected · failover-safe', 'failover → Delta (P2)', `${money(9)} captured ✓`, 'webhook sent ✓']

function FlowNode({ x, y, icon, title, sub, tone = 'neutral', active, wide }: { x: number; y: number; icon: ReactNode; title: string; sub: string; tone?: Tone; active?: boolean; wide: boolean }) {
  const toneCls: Record<Tone, string> = {
    neutral: 'border-line',
    accent: 'border-accent/60',
    success: 'border-success/40',
    warning: 'border-warning/45',
    danger: 'border-danger/40',
    info: 'border-info/40',
  }
  const subCls: Record<Tone, string> = { neutral: 'text-fg-3', accent: 'text-accent-ink', success: 'text-success', warning: 'text-warning', danger: 'text-danger', info: 'text-info' }
  return (
    <motion.div
      className={cn('absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 shadow-card transition-[border-color,box-shadow] duration-300', toneCls[tone], wide ? 'w-[186px]' : 'w-[150px]')}
      style={{ left: x, top: y }}
      animate={{ scale: active ? 1.03 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[12.5px] font-semibold text-fg">{title}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={sub} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }} className={cn('mt-0.5 truncate font-mono text-[10.5px]', subCls[tone])}>
            {sub}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function FlowCanvas({ step }: { step: number }) {
  const reduce = useReducedMotion()
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const wide = width >= 560
  const height = wide ? 330 : 420
  const P = wide ? POS_WIDE : POS_NARROW
  const at = (id: NodeId) => ({ x: P[id][0] * width, y: P[id][1] * height })
  const edges: [NodeId, NodeId][] = [
    ['reseller', 'core'],
    ['core', 'alpha'],
    ['core', 'beta'],
  ]
  const packet = PACKETS[step]

  const edgeActive = (a: NodeId, b: NodeId) => {
    if (a === 'reseller') return step === 0 || step === 7
    if (b === 'alpha') return step === 3 || step === 4
    return step === 5 || step === 6
  }

  const alphaTone: Tone = step === 3 ? 'accent' : step >= 4 ? 'warning' : 'neutral'
  const betaTone: Tone = step === 5 ? 'accent' : step >= 6 ? 'success' : 'neutral'
  const coreTone: Tone = step === 4 ? 'warning' : step >= 6 ? 'success' : 'accent'
  const resellerTone: Tone = step === 7 ? 'success' : step === 0 ? 'accent' : 'neutral'

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <>
          <svg width={width} height={height} className="absolute inset-0" aria-hidden>
            {edges.map(([a, b]) => {
              const A = at(a)
              const B = at(b)
              const on = edgeActive(a, b)
              const warn = b === 'alpha' && step >= 4
              const ok = (b === 'beta' && step === 6) || (a === 'reseller' && step === 7)
              return (
                <g key={`${a}-${b}`}>
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--line-strong)" strokeWidth={1.2} />
                  <line
                    x1={A.x}
                    y1={A.y}
                    x2={B.x}
                    y2={B.y}
                    stroke={warn ? 'var(--warning)' : ok ? 'var(--success)' : 'var(--accent)'}
                    strokeWidth={1.5}
                    strokeDasharray="4 6"
                    className={cn('transition-opacity duration-300', !reduce && 'animate-dash')}
                    opacity={on || warn ? (warn && !on ? 0.35 : 0.9) : 0}
                  />
                </g>
              )
            })}
          </svg>

          <AnimatePresence>
            {packet && !reduce && (
              <motion.span
                key={`pk-${step}`}
                className={cn('absolute z-[3] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full', packet.tone === 'success' ? 'bg-success' : 'bg-accent')}
                style={{ boxShadow: `0 0 0 5px color-mix(in oklab, var(--${packet.tone}) 20%, transparent)` }}
                initial={{ left: at(packet.from).x, top: at(packet.from).y, opacity: 0 }}
                animate={{ left: at(packet.to).x, top: at(packet.to).y, opacity: [0, 1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: EASE, opacity: { duration: 1, times: [0, 0.15, 0.8, 1] } }}
              />
            )}
          </AnimatePresence>

          <FlowNode
            wide={wide}
            {...at('reseller')}
            tone={resellerTone}
            active={step === 0 || step === 7}
            icon={
              <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
                <Store className="size-4" />
              </span>
            }
            title="ABC GSM"
            sub={step === 7 ? '200 OK · received' : step === 0 ? 'reseller portal' : step >= 6 ? `${money(9)} captured` : step >= 2 ? `${money(9)} held` : 'Gold tier'}
          />
          <FlowNode wide={wide} {...at('core')} tone={coreTone} active={[1, 2, 4].includes(step)} icon={<LogoMark className="size-8" />} title={brand.coreProduct} sub={CORE_STATUS[step]!} />
          <FlowNode wide={wide} {...at('alpha')} tone={alphaTone} active={step === 3} icon={<SupplierMark k="beta" size="md" />} title="Beta Unlock Source" sub={step < 3 ? 'offer P1 · standby' : step === 3 ? 'placing #1288…' : 'rejected · failover-safe'} />
          <FlowNode wide={wide} {...at('beta')} tone={betaTone} active={step === 5} icon={<SupplierMark k="delta" size="md" />} title="Delta GSM Server" sub={step < 5 ? 'offer P2 · standby' : step === 5 ? 'placing #2218…' : 'code delivered ✓'} />
        </>
      )}
    </div>
  )
}

export function WorkflowSection() {
  const { ref, step, setStep } = useAutoStep<HTMLDivElement>(STEPS.length, (s) => (s === STEPS.length - 1 ? 3400 : s === 4 ? 2300 : 1600))
  const status = step <= 1 ? 'queued' : step <= 5 ? 'processing' : 'completed'

  return (
    <Section id="workflow" className="bg-bg-subtle/50">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />
      <Container>
        <SectionHeader
          index="15"
          eyebrow="Example workflow"
          title="Follow one order through the platform."
          description="A reseller orders a Samsung unlock code. Here’s everything that happens next — including a supplier rejection that fails over safely, and the ledger postings that make the money add up."
        />
        <div ref={ref} className="mt-12 grid items-start gap-4 lg:mt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Reveal>
            <ol className="rounded-2xl border border-line bg-surface p-2 shadow-card">
              {STEPS.map((s, i) => {
                const state = i < step ? 'done' : i === step ? 'active' : 'todo'
                const toneText = s.tone === 'warning' ? 'text-warning' : s.tone === 'success' ? 'text-success' : 'text-accent-ink'
                return (
                  <li key={s.title}>
                    <button type="button" onClick={() => setStep(i)} className={cn('relative flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', state === 'active' ? 'bg-surface-2' : 'hover:bg-surface-2/50')}>
                      {i < STEPS.length - 1 && <span className={cn('absolute top-[38px] bottom-[-6px] left-[26px] w-px transition-colors duration-300', i < step ? 'bg-accent/50' : 'bg-line')} />}
                      <span
                        className={cn(
                          'relative z-[1] grid size-7 shrink-0 place-items-center rounded-full border transition-colors duration-300',
                          state === 'done' ? 'border-line bg-surface-3 text-fg-2' : state === 'active' ? cn('border-current bg-surface', toneText) : 'border-line bg-surface text-fg-3',
                        )}
                      >
                        {state === 'active' && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-current opacity-30" />}
                        <s.icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={cn('text-[13.5px] font-medium transition-colors', state === 'todo' ? 'text-fg-3' : 'text-fg')}>{s.title}</span>
                          <span className="shrink-0 font-mono text-[10.5px] text-fg-3 tabular">{s.t}</span>
                        </span>
                        <AnimatePresence initial={false}>
                          {state === 'active' && (
                            <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="block overflow-hidden">
                              <span className="block pt-1 text-[12.5px] leading-relaxed text-fg-2">{s.detail}</span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </Reveal>

          <Reveal delay={0.08} className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[12.5px] font-medium text-fg">ORD-9T1V6B</span>
                  <StatusBadge status={status} />
                  <DemoTag className="hidden sm:inline-flex" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11.5px] text-fg-3 tabular">{STEPS[step]!.t}</span>
                  <Button variant="ghost" size="xs" leading={<RotateCcw />} onClick={() => setStep(0)}>
                    Replay
                  </Button>
                </div>
              </div>
              <div className="relative bg-bg-subtle/40 px-3 sm:px-4">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-hatch [mask-image:radial-gradient(ellipse_at_center,transparent_40%,black_95%)]" />
                <FlowCanvas step={step} />
              </div>
              <div className="grid grid-cols-2 border-t border-line text-[12px] sm:grid-cols-4">
                {[
                  ['Service', 'Samsung NCK (4040)'],
                  ['IMEI', '352094117328416'],
                  ['Funds', step >= 6 ? `${money(9)} captured` : step >= 2 ? `${money(9)} held` : '—'],
                  ['Supplier', step >= 5 ? 'Delta (P2)' : step >= 3 ? 'Beta (P1)' : '—'],
                ].map(([k, v], i) => (
                  <div key={k} className={cn('min-w-0 border-line px-4 py-3', i % 2 === 0 && 'border-r', i < 2 && 'border-b sm:border-b-0', i === 1 && 'sm:border-r', i === 2 && 'sm:border-r')}>
                    <div className="mono-label">{k}</div>
                    <div className={cn('mt-1 truncate font-medium text-fg', k === 'IMEI' && 'font-mono text-[11.5px]')}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
