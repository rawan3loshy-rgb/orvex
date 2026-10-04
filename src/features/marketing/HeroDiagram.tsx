import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CodeXml, Globe, Plug, Store, type LucideIcon } from 'lucide-react'
import { ServiceIcon } from '@/components/brand'
import { Dot } from '@/components/ui'
import { useMeasure } from '@/lib/useMeasure'
import { ms, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types/common'
import { EASE, ringArc, ringPoint, useAutoStep, useTicker } from './sharedUtils'
import { ICON_BUCKET, SUPPLIERS as ALL, svc, type SupplierKey } from './demo'
import { SupplierMark } from './SupplierMark'

/* ------------------------------------------------------------------ */
/*  Demo data (fictional GSM entities)                                  */
/* ------------------------------------------------------------------ */
const CHANNELS: { id: string; title: string; sub: string; icon: LucideIcon }[] = [
  { id: 'portal', title: 'ABC GSM', sub: 'reseller portal · Gold', icon: Store },
  { id: 'store', title: 'UnlockDesk storefront', sub: 'checkout · guest tracking', icon: Globe },
  { id: 'api', title: 'Partner integration', sub: 'Native API v1', icon: CodeXml },
  { id: 'dhru', title: 'Legacy DHRU client', sub: 'DHRU-compatible endpoint', icon: Plug },
]

/** Display order of the supplier column (featured order: Beta first, failover to Delta). */
const SUPPLIERS: { k: SupplierKey; sub: string }[] = [
  { k: 'beta', sub: 'DHRU Fusion · healthy' },
  { k: 'alpha', sub: 'DHRU Fusion · healthy' },
  { k: 'delta', sub: 'DHRU Fusion · degraded' },
  { k: 'gamma', sub: 'REST · healthy' },
  { k: 'kappa', sub: 'Manual fulfilment' },
]

const CATALOG = ['4040', '4001', '4006', '4012'].map((code, i) => {
  const s = svc(code)
  return { id: s.code, name: s.name, icon: s.icon, category: ICON_BUCKET[s.category], map: s.offers.map((o) => o.k), featured: i === 0 }
})

/** One featured order, told as events. Durations are per step. */
const SCRIPT: { type: string; tone: Tone; at: string; text: string }[] = [
  { type: 'order.created', tone: 'neutral', at: '10:14:03.112', text: 'ORD-9T1V6B · ABC GSM (reseller portal) · Samsung Network Unlock Code (NCK)' },
  { type: 'order.validated', tone: 'accent', at: '10:14:03.118', text: 'IMEI 352094117328416 · 15 digits ✓ Luhn ✓ · Gold price $9.00 · funds held' },
  { type: 'attempt.sent', tone: 'accent', at: '10:14:03.124', text: '→ Beta Unlock Source · offer P1 · DHRU Fusion #1288' },
  { type: 'attempt.rejected', tone: 'warning', at: '10:14:03.962', text: 'Beta: “Service temporarily disabled” · definitive · classified failover-safe' },
  { type: 'order.failover', tone: 'accent', at: '10:14:03.966', text: '→ Delta GSM Server · offer P2 · margin guard ✓ (cost $6.10 < price $9.00)' },
  { type: 'order.completed', tone: 'success', at: '11:02:41.530', text: 'NCK code delivered · $9.00 captured · supplier cost $6.10 booked' },
  { type: 'webhook.delivered', tone: 'success', at: '11:02:41.562', text: 'order.completed → ABC GSM · webhook-id msg_2Qx7… · 200 OK' },
]
const STEP_MS = (s: number) => (s === 3 ? 2300 : s === SCRIPT.length - 1 ? 2800 : 1600)

const TONE_TEXT: Record<Tone, string> = { neutral: 'text-fg-2 bg-fg/[0.06]', accent: 'text-accent-ink bg-accent/10', success: 'text-success bg-success/10', warning: 'text-warning bg-warning/12', danger: 'text-danger bg-danger/10', info: 'text-info bg-info/10' }
const TONE_BORDER: Record<Tone, string> = { neutral: 'border-line', accent: 'border-accent/60', success: 'border-success/45', warning: 'border-warning/55', danger: 'border-danger/45', info: 'border-info/40' }

/* ------------------------------------------------------------------ */
/*  Geometry (design space, scaled to fit)                             */
/* ------------------------------------------------------------------ */
const W = 1240
const H = 452
const MID = 262
const CH = { x: 98, w: 180, h: 54, ys: [160, 228, 296, 364] }
const API = { x: 340, w: 156, h: 122 }
const CORE = { x: 580, r: 44, dial: 84 }
const CAT = { x: 836, w: 236, h: 248 }
const SUP = { x: 1142, w: 180, h: 50, ys: [156, 209, 262, 315, 368] }

const STAGES = [
  { x: CH.x, label: 'Sales channels' },
  { x: API.x, label: 'Order intake' },
  { x: CORE.x, label: 'ORVEX Core' },
  { x: CAT.x, label: 'Catalog → offers' },
  { x: SUP.x, label: 'Suppliers' },
]

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `C${mx},${y1} ${mx},${y2} ${x2},${y2}`
}
const seg = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} ${curve(x1, y1, x2, y2)}`

const CH_R = CH.x + CH.w / 2
const API_L = API.x - API.w / 2
const API_R = API.x + API.w / 2
const CORE_L = CORE.x - CORE.dial
const CORE_R = CORE.x + CORE.dial
const CAT_L = CAT.x - CAT.w / 2
const CAT_R = CAT.x + CAT.w / 2
const SUP_L = SUP.x - SUP.w / 2

/** Visible links. */
const LINKS = [
  ...CH.ys.map((y, i) => ({ id: `c${i}`, d: seg(CH_R, y, API_L, MID) })),
  { id: 'a0', d: seg(API_R, MID, CORE_L, MID) },
  { id: 'e0', d: seg(CORE_R, MID, CAT_L, MID) },
  ...SUP.ys.map((y, k) => ({ id: `s${k}`, d: seg(CAT_R, MID, SUP_L, y) })),
]

/** Courier paths for the featured order (pass underneath the cards). */
const ROUTES: Record<string, string> = {
  in0: `M${CH_R},${CH.ys[0]} ${curve(CH_R, CH.ys[0]!, API_L, MID)} L${API_R},${MID} ${curve(API_R, MID, CORE_L, MID)}`,
  r0: `M${CORE_R},${MID} ${curve(CORE_R, MID, CAT_L, MID)} L${CAT_R},${MID} ${curve(CAT_R, MID, SUP_L, SUP.ys[0]!)}`,
  r2: `M${CORE_R},${MID} ${curve(CORE_R, MID, CAT_L, MID)} L${CAT_R},${MID} ${curve(CAT_R, MID, SUP_L, SUP.ys[2]!)}`,
}
const COURIER: Record<number, { route: keyof typeof ROUTES; reverse?: boolean; tone: 'accent' | 'success' }> = {
  0: { route: 'in0', tone: 'accent' },
  2: { route: 'r0', tone: 'accent' },
  4: { route: 'r2', tone: 'accent' },
  5: { route: 'r2', reverse: true, tone: 'success' },
  6: { route: 'in0', reverse: true, tone: 'success' },
}

/** Which links light up (and how) at each step. */
function linkState(id: string, step: number): { tone: 'accent' | 'success' | 'warning'; dashed?: boolean } | null {
  if ((id === 'c0' || id === 'a0') && step === 0) return { tone: 'accent' }
  if ((id === 'c0' || id === 'a0') && step === 6) return { tone: 'success' }
  if (id === 'e0' && (step === 2 || step === 4)) return { tone: 'accent' }
  if (id === 'e0' && step === 5) return { tone: 'success' }
  if (id === 's0' && step === 2) return { tone: 'accent' }
  if (id === 's0' && step >= 3) return { tone: 'warning', dashed: true }
  if (id === 's2' && step === 4) return { tone: 'accent' }
  if (id === 's2' && step === 5) return { tone: 'success' }
  return null
}

/* Ambient traffic: other resellers' orders on the other links. */
const PERIOD = 4.8
const TRAVEL = 0.8
const AMBIENT: { id: string; stage: number; wave: number }[] = [
  { id: 'c1', stage: 0, wave: 0 },
  { id: 'c2', stage: 0, wave: 1 },
  { id: 'c3', stage: 0, wave: 0.5 },
  { id: 'a0', stage: 1, wave: 0 },
  { id: 'a0', stage: 1, wave: 1 },
  { id: 'e0', stage: 2, wave: 0.5 },
  { id: 's1', stage: 3, wave: 0 },
  { id: 's3', stage: 3, wave: 1 },
  { id: 's4', stage: 3, wave: 0.5 },
]

function Packet({ pathId, begin }: { pathId: string; begin: number }) {
  const f = TRAVEL / PERIOD
  return (
    <g opacity={0}>
      <circle r={2.2} fill="var(--fg-3)" />
      <animateMotion dur={`${PERIOD}s`} begin={`${begin}s`} repeatCount="indefinite" keyPoints="0;1;1" keyTimes={`0;${f};1`} calcMode="spline" keySplines="0.45 0 0.25 1;0 0 1 1">
        <mpath href={`#${pathId}`} />
      </animateMotion>
      <animate attributeName="opacity" dur={`${PERIOD}s`} begin={`${begin}s`} repeatCount="indefinite" values="0;0.8;0.8;0;0" keyTimes={`0;${(f * 0.12).toFixed(4)};${(f * 0.86).toFixed(4)};${f.toFixed(4)};1`} />
    </g>
  )
}

/** The featured order's courier — starts the moment it mounts. */
function Courier({ pathId, reverse, color }: { pathId: string; reverse?: boolean; color: string }) {
  const motionRef = useRef<SVGElement>(null)
  const fadeRef = useRef<SVGElement>(null)
  useEffect(() => {
    ;(motionRef.current as SVGAnimationElement | null)?.beginElement?.()
    ;(fadeRef.current as SVGAnimationElement | null)?.beginElement?.()
  }, [])
  return (
    <g opacity={0}>
      <circle r={9} fill={color} opacity={0.16} />
      <circle r={3.8} fill={color} />
      <animateMotion ref={motionRef} dur="1.15s" begin="indefinite" fill="freeze" keyPoints={reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.25 1">
        <mpath href={`#${pathId}`} />
      </animateMotion>
      <animate ref={fadeRef} attributeName="opacity" dur="1.15s" begin="indefinite" fill="freeze" values="0;1;1;0" keyTimes="0;0.08;0.86;1" />
    </g>
  )
}

/** ORVEX Core — the brand ring at the centre of the topology. */
function CoreRing({ reduce }: { reduce: boolean }) {
  const [nx, ny] = ringPoint(CORE.r, -45)
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
  return (
    <g transform={`translate(${CORE.x} ${MID})`}>
      <circle r={CORE.dial} fill="var(--surface)" stroke="var(--line-strong)" />
      {ticks.map((d) => {
        const long = d % 45 === 0
        const [x1, y1] = ringPoint(CORE.dial - 3, d)
        const [x2, y2] = ringPoint(CORE.dial - (long ? 12 : 7), d)
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg)" strokeOpacity={long ? 0.32 : 0.12} />
      })}
      <motion.g animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}>
        <circle r={62} fill="none" stroke="var(--fg)" strokeOpacity={0.16} strokeDasharray="2 6" />
      </motion.g>
      <path d={ringArc(CORE.r)} fill="none" stroke="var(--fg)" strokeWidth={15} />
      {!reduce && (
        <circle cx={nx} cy={ny} r={11} fill="none" stroke="var(--accent)" strokeWidth={1.2}>
          <animate attributeName="r" values="11;30" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={nx} cy={ny} r={11} fill="var(--accent)" />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/*  HTML nodes laid over the SVG                                        */
/* ------------------------------------------------------------------ */
function Node({ x, y, w, h, className, children, delay = 0, tone = 'neutral' }: { x: number; y: number; w: number; h: number; className?: string; children: ReactNode; delay?: number; tone?: Tone }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25 + delay, ease: EASE }}
      className={cn('absolute rounded-xl border bg-surface shadow-card transition-[border-color] duration-300', TONE_BORDER[tone], className)}
      style={{ left: x - w / 2, top: y - h / 2, width: w, height: h }}
    >
      {children}
    </motion.div>
  )
}

function ApiNode({ live }: { live: boolean }) {
  const [state, setState] = useState({ latency: 84, rpm: 412 })
  const { ref } = useTicker<HTMLDivElement>(1700, true, () => {
    setState((s) => ({ latency: Math.round(62 + Math.random() * 70), rpm: Math.max(340, Math.min(480, s.rpm + Math.round((Math.random() - 0.45) * 24))) }))
  })
  return (
    <div ref={ref} className="flex h-full flex-col justify-between p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
          <CodeXml className="size-3.5 text-fg-3" />
          PlaceOrder
        </span>
        <span className="font-mono text-[9.5px] text-fg-3">1 command</span>
      </div>
      <div className={cn('rounded-md border px-2 py-1 font-mono text-[10px] text-fg-2 transition-colors duration-300', live ? 'border-accent/40 bg-accent/[0.06]' : 'border-line bg-bg-subtle')}>
        store · portal · api · dhru
      </div>
      <div className="truncate font-mono text-[10px] text-fg-3">idempotency · per account</div>
      <div className="flex items-center justify-between font-mono text-[10.5px] text-fg-3 tabular">
        <span className="flex items-center gap-1.5">
          <Dot tone="success" />
          <span className="text-success">201</span>
          <motion.span key={state.latency} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {ms(state.latency)}
          </motion.span>
        </span>
        <span>{num(state.rpm)}/h</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Desktop canvas                                                      */
/* ------------------------------------------------------------------ */
function DesktopCanvas({ step }: { step: number }) {
  const reduce = !!useReducedMotion()
  const uid = `h${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const scale = width ? width / W : 1
  const courier = COURIER[step]

  const supTone = (i: number): Tone => {
    if (i === 0) return step === 2 ? 'accent' : step >= 3 ? 'warning' : 'neutral'
    if (i === 2) return step === 4 ? 'accent' : step >= 5 ? 'success' : 'neutral'
    return 'neutral'
  }
  const supSub = (i: number) => {
    const s = SUPPLIERS[i]!
    if (i === 0 && step === 2) return 'attempt 1 · #1288'
    if (i === 0 && step >= 3) return 'rejected · failover-safe'
    if (i === 2 && step === 4) return 'attempt 2 · #2218'
    if (i === 2 && step >= 5) return 'code delivered ✓'
    return s.sub
  }
  const balance = step >= 5 ? '$9.00 captured' : step >= 1 ? '$9.00 held' : 'available $842.50'

  return (
    <div ref={ref} className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <div className={cn('absolute top-0 left-0 origin-top-left transition-opacity duration-300', width ? 'opacity-100' : 'opacity-0')} style={{ width: W, height: H, transform: `scale(${scale})` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            {Object.entries(ROUTES).map(([k, d]) => (
              <path key={k} id={`${uid}-${k}`} d={d} fill="none" />
            ))}
          </defs>

          {/* stage rail */}
          <line x1={CH.x} x2={SUP.x} y1={62} y2={62} stroke="var(--line)" />
          {STAGES.map((s, i) => (
            <g key={s.label}>
              <line x1={s.x} x2={s.x} y1={58} y2={66} stroke={i === 2 ? 'var(--accent)' : 'var(--line-strong)'} />
              <circle cx={s.x} cy={62} r={2.5} fill={i === 2 ? 'var(--accent)' : 'var(--bg)'} stroke={i === 2 ? 'var(--accent)' : 'var(--line-strong)'} />
            </g>
          ))}

          {/* links */}
          {LINKS.map((l, i) => {
            const st = linkState(l.id, step)
            const color = st?.tone === 'success' ? 'var(--success)' : st?.tone === 'warning' ? 'var(--warning)' : 'var(--accent)'
            return (
              <g key={l.id}>
                <motion.path
                  id={`${uid}-${l.id}`}
                  d={l.d}
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth={1.2}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.3 + i * 0.03, ease: EASE }}
                />
                <path d={l.d} fill="none" stroke={color} strokeWidth={1.8} strokeDasharray={st?.dashed ? '4 5' : undefined} className="transition-opacity duration-500" style={{ opacity: st ? 0.95 : 0 }} />
              </g>
            )
          })}

          <CoreRing reduce={reduce} />

          {!reduce && AMBIENT.map((a, i) => <Packet key={`${a.id}-${i}`} pathId={`${uid}-${a.id}`} begin={1.2 + a.wave * (PERIOD / 2) + a.stage * TRAVEL} />)}
          {!reduce && courier && <Courier key={`courier-${step}`} pathId={`${uid}-${courier.route}`} reverse={courier.reverse} color={courier.tone === 'success' ? 'var(--success)' : 'var(--accent)'} />}
        </svg>

        {/* stage labels */}
        {STAGES.map((s, i) => (
          <div key={s.label} className="absolute -translate-x-1/2 text-center whitespace-nowrap" style={{ left: s.x, top: 24 }}>
            <span className={cn('font-mono text-[10.5px] tracking-[0.08em] uppercase', i === 2 ? 'text-accent-ink' : 'text-fg-3')}>
              <span className="opacity-60">0{i + 1}</span> {s.label}
            </span>
          </div>
        ))}

        {/* resellers & shops */}
        {CHANNELS.map((c, i) => (
          <Node key={c.id} x={CH.x} y={CH.ys[i]!} w={CH.w} h={CH.h} delay={i * 0.04} tone={i === 0 ? (step === 0 ? 'accent' : step === 6 ? 'success' : 'neutral') : 'neutral'} className="flex items-center gap-2.5 px-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
              <c.icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-medium text-fg">{c.title}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-fg-3 tabular">{i === 0 ? (step === 6 ? 'webhook · 200 OK' : `wallet · ${balance}`) : c.sub}</div>
            </div>
          </Node>
        ))}

        {/* order intake */}
        <Node x={API.x} y={MID} w={API.w} h={API.h} delay={0.12} tone={step === 0 ? 'accent' : 'neutral'}>
          <ApiNode live={step === 0} />
        </Node>

        {/* core caption */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }} className="absolute -translate-x-1/2 text-center whitespace-nowrap" style={{ left: CORE.x, top: MID + CORE.dial + 14 }}>
          <div className="text-[13px] font-semibold tracking-[-0.01em] text-fg">ORVEX Core</div>
          <div className="mt-0.5 font-mono text-[10.5px] text-fg-3">validate · price · hold · route</div>
        </motion.div>

        {/* catalog → mapping */}
        <Node x={CAT.x} y={MID} w={CAT.w} h={CAT.h} delay={0.2} className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[12px] font-semibold text-fg">Catalog → offers</span>
            <span className="rounded bg-fg/[0.06] px-1.5 font-mono text-[10px] text-fg-3">54</span>
          </div>
          <div className="flex-1 space-y-0.5 p-1.5">
            {CATALOG.map((s) => {
              const hot = s.featured && step >= 2 && step <= 5
              return (
                <div key={s.id} className={cn('relative flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors duration-300', hot ? 'bg-accent/[0.07]' : '')}>
                  {s.featured && <span className={cn('absolute inset-y-1.5 left-0 w-[2px] rounded-full transition-colors duration-300', hot ? 'bg-accent' : 'bg-line-strong')} />}
                  <ServiceIcon icon={s.icon} category={s.category} size="sm" className="size-6 [&_svg]:size-3" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[11.5px] font-medium text-fg">{s.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 font-mono text-[9.5px] text-fg-3">
                      {s.id}
                      <span className="text-fg-3/60">·</span>
                      {s.map.map((p, j) => (
                        <span key={p} className="flex items-center gap-1">
                          {j > 0 && <span className="text-fg-3/70">→</span>}
                          <SupplierMark k={p} size="xs" className="size-3.5 rounded-[3px] text-[6.5px]" />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-fg-3">offers in priority order · 4 pricing tiers</div>
        </Node>

        {/* suppliers */}
        {SUPPLIERS.map((p, i) => (
          <Node key={p.k} x={SUP.x} y={SUP.ys[i]!} w={SUP.w} h={SUP.h} delay={0.3 + i * 0.04} tone={supTone(i)} className="flex items-center gap-2.5 px-2.5">
            <span title={ALL[p.k].name}>
              <SupplierMark k={p.k} size="sm" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-medium text-fg">{ALL[p.k].short}</div>
              <div className={cn('mt-0.5 truncate font-mono text-[10px] tabular', supTone(i) === 'warning' ? 'text-warning' : supTone(i) === 'success' ? 'text-success' : supTone(i) === 'accent' ? 'text-accent-ink' : 'text-fg-3')}>{supSub(i)}</div>
            </div>
            <Dot tone={ALL[p.k].health === 'degraded' ? 'warning' : 'success'} pulse={ALL[p.k].health === 'degraded'} />
          </Node>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile: the same flow, stacked vertically                          */
/* ------------------------------------------------------------------ */
function MiniRing() {
  const [nx, ny] = ringPoint(7, -45)
  return (
    <svg viewBox="-12 -12 24 24" className="size-7" aria-hidden>
      <path d={ringArc(7)} fill="none" stroke="var(--fg)" strokeWidth={2.6} />
      <circle cx={nx} cy={ny} r={2.1} fill="var(--accent)" />
    </svg>
  )
}

/** Row that is "live" at each step of the script. */
const MOBILE_ROW = [1, 2, 3, 4, 3, 2, 0]

function MobileFlow({ step }: { step: number }) {
  const reduce = useReducedMotion()
  const activeRow = MOBILE_ROW[step] ?? 0
  const tone = SCRIPT[step]!.tone
  const rows: { title: string; sub: string; visual: ReactNode }[] = [
    { title: 'Sales channels', sub: 'Storefront · reseller portal · API · DHRU', visual: <Store className="size-4 text-fg-3" /> },
    { title: 'Order intake', sub: 'One PlaceOrder command for every channel', visual: <CodeXml className="size-4 text-fg-3" /> },
    { title: 'ORVEX Core', sub: 'Validate IMEI · price per tier · hold · route', visual: <MiniRing /> },
    {
      title: 'Catalog → offers',
      sub: '54 services · offers in priority order',
      visual: (
        <div className="flex gap-0.5">
          {CATALOG.slice(0, 3).map((s) => (
            <ServiceIcon key={s.id} icon={s.icon} category={s.category} size="sm" className="size-5 rounded-[5px] [&_svg]:size-3" />
          ))}
        </div>
      ),
    },
    {
      title: 'Suppliers',
      sub: 'DHRU Fusion · REST · manual',
      visual: (
        <div className="flex gap-0.5">
          {SUPPLIERS.map((p) => (
            <SupplierMark key={p.k} k={p.k} size="xs" />
          ))}
        </div>
      ),
    },
  ]
  const ring = tone === 'success' ? 'border-success' : tone === 'warning' ? 'border-warning' : 'border-accent'
  return (
    <div className="relative mx-auto max-w-[560px] p-4 sm:py-6">
      <ol className="relative space-y-2.5">
        <span aria-hidden className="absolute top-6 bottom-6 left-[18.5px] w-px bg-line-strong" />
        {rows.map((r, i) => {
          const on = i === activeRow
          return (
            <li key={r.title} className="flex items-center gap-3">
              <span className={cn('relative z-[1] grid size-[38px] shrink-0 place-items-center rounded-xl border bg-surface font-mono text-[11px] tabular transition-colors duration-300', on ? 'border-transparent text-accent-ink' : 'border-line text-fg-3')}>
                {on && <motion.span layoutId="hero-mobile-active" className={cn('absolute -inset-px rounded-xl border-[1.5px] transition-colors duration-300', ring)} transition={reduce ? { duration: 0 } : { duration: 0.55, ease: EASE }} />}
                0{i + 1}
              </span>
              <div className={cn('flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300', on ? cn(TONE_BORDER[tone], 'bg-surface') : 'border-line bg-surface/80')}>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-fg">{r.title}</div>
                  <div className="truncate font-mono text-[10.5px] text-fg-3">{r.sub}</div>
                </div>
                <div className="shrink-0">{r.visual}</div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Event console (shared by both layouts)                             */
/* ------------------------------------------------------------------ */
function Console({ step, onPick }: { step: number; onPick: (i: number) => void }) {
  const ev = SCRIPT[step]!
  return (
    <div className="flex items-center gap-3 border-t border-line bg-surface/70 px-3 py-2.5 sm:px-4">
      <span className="hidden shrink-0 font-mono text-[11px] text-fg-3 tabular sm:inline">{ev.at}</span>
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2.5">
            <span className={cn('w-fit shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]', TONE_TEXT[ev.tone])}>{ev.type}</span>
            <span className="min-w-0 truncate font-mono text-[11.5px] text-fg-2">{ev.text}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex shrink-0 items-center gap-1" role="tablist" aria-label="Order events">
        {SCRIPT.map((e, i) => (
          <button
            key={e.type}
            type="button"
            role="tab"
            aria-selected={i === step}
            aria-label={e.type}
            onClick={() => onPick(i)}
            className={cn('h-1.5 rounded-full transition-[width,background-color] duration-300', i === step ? 'w-4 bg-accent' : i < step ? 'w-1.5 bg-fg/40' : 'w-1.5 bg-fg/15 hover:bg-fg/30')}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Framed panel                                                        */
/* ------------------------------------------------------------------ */
export function HeroDiagram() {
  const { ref, step, setStep } = useAutoStep<HTMLDivElement>(SCRIPT.length, STEP_MS)
  return (
    <div ref={ref} className="relative rounded-[22px] border border-line bg-surface/50 p-1.5 shadow-pop">
      <div className="overflow-hidden rounded-2xl border border-line bg-bg">
        <div className="flex h-10 items-center justify-between gap-3 border-b border-line px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Dot tone="success" pulse />
            <span className="text-[12.5px] font-medium text-fg">Order topology</span>
            <span className="hidden truncate font-mono text-[11px] text-fg-3 sm:inline">portal.unlockdesk-demo.com</span>
            <span className="hidden rounded border border-dashed border-line-strong px-1.5 font-mono text-[9.5px] tracking-wider text-fg-3 uppercase md:inline">Demo</span>
          </div>
          <div className="hidden items-center gap-4 font-mono text-[11px] text-fg-3 sm:flex">
            <span>10 suppliers</span>
            <span>54 services</span>
            <span>4 channels</span>
            <span className="text-warning">Delta degraded</span>
          </div>
        </div>
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-hatch opacity-60 [mask-image:radial-gradient(ellipse_at_center,transparent_35%,black_90%)]" />
          <div className="hidden px-3 pb-3 lg:block">
            <DesktopCanvas step={step} />
          </div>
          <div className="lg:hidden">
            <MobileFlow step={step} />
          </div>
        </div>
        <Console step={step} onPick={setStep} />
      </div>
    </div>
  )
}
