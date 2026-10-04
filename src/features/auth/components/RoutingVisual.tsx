import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BadgeCheck, FileKey } from 'lucide-react'
import { TenantMark } from '@/components/brand'
import { Dot } from '@/components/ui'
import { cn } from '@/lib/cn'

/* Design space */
const VW = 600
const VH = 520
const C = { x: 250, y: 270 }
const R = 54
const DIAL = 96
const ORBIT = 130
const SUP_X = 440

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]
const rad = (d: number) => (d * Math.PI) / 180
const pt = (r: number, d: number): [number, number] => [C.x + Math.cos(rad(d)) * r, C.y + Math.sin(rad(d)) * r]
const [NX, NY] = pt(R, -45)

/** Open ring with a gap at the top-right — the ORVEX mark. */
const ARC = (() => {
  const [sx, sy] = pt(R, -15)
  const [ex, ey] = pt(R, -75)
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${R} ${R} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`
})()

/** Sales channels — every one enters the same PlaceOrder command. */
const RESELLERS = [
  { name: 'Storefront', id: 'checkout', y: 160 },
  { name: 'ABC GSM', id: 'reseller portal', y: 230 },
  { name: 'Native API', id: 'POST /v1/orders', y: 300 },
  { name: 'DHRU client', id: 'placeimeiorder', y: 370 },
]

/** Demo suppliers (fictional — mirror the installation seed). */
const SUPPLIERS = [
  { id: 'alpha', mono: 'DA', color: 'var(--c2)', name: 'DHRU Supplier Alpha', sub: 'DHRU Fusion · healthy', y: 130 },
  { id: 'beta', mono: 'BU', color: 'var(--c3)', name: 'Beta Unlock Source', sub: 'DHRU Fusion · healthy', y: 200 },
  { id: 'gamma', mono: 'GC', color: 'var(--c4)', name: 'GammaCheck IMEI API', sub: 'REST · healthy', y: 270 },
  { id: 'delta', mono: 'DG', color: 'var(--c5)', name: 'Delta GSM Server', sub: 'DHRU Fusion · degraded', y: 340, degraded: true },
  { id: 'kappa', mono: 'KM', color: 'var(--c6)', name: 'Kappa Manual Desk', sub: 'Manual fulfilment', y: 410 },
]

/** Orders cycling through the router (DEMO data). */
const ORDERS: { ord: string; svc: string; from: number; to: number; note: string; review?: boolean }[] = [
  { ord: 'ORD-7K3P9Q', svc: 'IMEI Blacklist Check (GSMA)', from: 0, to: 2, note: 'priority 1 offer' },
  { ord: 'ORD-4M8D2X', svc: 'iPhone 15 Carrier Check', from: 1, to: 0, note: 'priority 1 offer' },
  { ord: 'ORD-9T1V6B', svc: 'Samsung Network Unlock Code (NCK)', from: 2, to: 1, note: 'failover after a failover-safe rejection' },
  { ord: 'ORD-2H5R8N', svc: 'Samsung Network Unlock Code (NCK)', from: 3, to: 3, note: 'timeout → Needs Review · funds held', review: true },
]

function SupplierMark({ mono, color, live }: { mono: string; color: string; live: boolean }) {
  return (
    <span
      className={cn('inline-grid size-6 shrink-0 place-items-center rounded-md font-mono text-[9.5px] font-semibold transition-shadow duration-500', live && 'ring-1 ring-accent ring-offset-2 ring-offset-bg-subtle')}
      style={{ color, background: `color-mix(in oklab, ${color} 13%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 30%, transparent)` }}
      aria-hidden
    >
      {mono}
    </span>
  )
}

const inPath = (y: number) => `M0,${y} C${(C.x - DIAL) * 0.6},${y} ${(C.x - DIAL) * 0.55},${C.y} ${C.x - DIAL},${C.y}`
const outPath = (y: number) => `M${NX.toFixed(1)},${NY.toFixed(1)} C${(NX + SUP_X) / 2 + 20},${NY.toFixed(1)} ${(NX + SUP_X) / 2},${y} ${SUP_X},${y}`

function Courier({ pathId, delay = 0 }: { pathId: string; delay?: number }) {
  const a = useRef<SVGElement>(null)
  const o = useRef<SVGElement>(null)
  useEffect(() => {
    ;(a.current as SVGAnimationElement | null)?.beginElementAt?.(delay)
    ;(o.current as SVGAnimationElement | null)?.beginElementAt?.(delay)
  }, [delay])
  return (
    <g opacity={0}>
      <circle r={8} fill="var(--accent)" opacity={0.18} />
      <circle r={3.4} fill="var(--accent)" />
      <animateMotion ref={a} dur="0.8s" begin="indefinite" fill="freeze" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.25 1">
        <mpath href={`#${pathId}`} />
      </animateMotion>
      <animate ref={o} attributeName="opacity" dur="0.8s" begin="indefinite" fill="freeze" values="0;1;1;0" keyTimes="0;0.1;0.85;1" />
    </g>
  )
}

const pctX = (x: number) => `${(x / VW) * 100}%`
const pctY = (y: number) => `${(y / VH) * 100}%`

/**
 * ORVEX brand visual: orders from every channel enter the ring, leave through
 * the coral node and go to the priority offer. A failover-safe rejection fails
 * over; a timeout is an UNKNOWN outcome and goes to Needs Review instead.
 */
export function RoutingVisual() {
  const reduce = !!useReducedMotion()
  const uid = `rv${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setStep((s) => (s + 1) % ORDERS.length), 2200)
    return () => clearInterval(t)
  }, [reduce])
  const o = ORDERS[step]!
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5)

  return (
    <div className="relative mx-auto w-full max-w-[600px]">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full overflow-visible" role="img" aria-label="Orders from every channel enter ORVEX Core and are routed to suppliers in priority order">
        <defs>
          {RESELLERS.map((r, i) => (
            <path key={r.id} id={`${uid}-in${i}`} d={inPath(r.y)} />
          ))}
          {SUPPLIERS.map((s, i) => (
            <path key={s.id} id={`${uid}-out${i}`} d={outPath(s.y)} />
          ))}
        </defs>

        {/* calibration */}
        <circle cx={C.x} cy={C.y} r={ORBIT + 60} fill="none" stroke="var(--fg)" strokeOpacity={0.05} />
        <motion.g animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}>
          <circle cx={C.x} cy={C.y} r={ORBIT} fill="none" stroke="var(--fg)" strokeOpacity={0.14} strokeDasharray="2 7" />
        </motion.g>
        <line x1={C.x} x2={C.x} y1={C.y - ORBIT - 60} y2={C.y + ORBIT + 60} stroke="var(--fg)" strokeOpacity={0.05} />

        {/* inbound */}
        {RESELLERS.map((r, i) => (
          <g key={r.id}>
            <path d={inPath(r.y)} fill="none" stroke="var(--line-strong)" strokeWidth={1.2} />
            <path d={inPath(r.y)} fill="none" stroke="var(--accent)" strokeWidth={1.6} className="transition-opacity duration-500" style={{ opacity: i === o.from ? 0.9 : 0 }} />
            <text x={4} y={r.y - 9} fill="var(--fg-3)" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.02em' }}>
              {r.name} · {r.id}
            </text>
          </g>
        ))}

        {/* outbound */}
        {SUPPLIERS.map((s, i) => {
          const live = i === o.to
          const hot = live && o.review ? 'var(--warning)' : 'var(--accent)'
          return (
            <g key={s.id}>
              <path d={outPath(s.y)} fill="none" stroke={s.degraded ? 'var(--warning)' : 'var(--line-strong)'} strokeOpacity={s.degraded ? 0.55 : 1} strokeDasharray={s.degraded ? '3 5' : undefined} strokeWidth={1.2} />
              <path d={outPath(s.y)} fill="none" stroke={hot} strokeWidth={1.8} strokeDasharray={live && o.review ? '4 4' : undefined} className="transition-opacity duration-500" style={{ opacity: live ? 0.95 : 0 }} />
              <circle cx={SUP_X} cy={s.y} r={3} fill={live ? hot : 'var(--bg)'} stroke={live ? hot : 'var(--line-strong)'} className="transition-[fill,stroke] duration-500" />
            </g>
          )
        })}

        {/* dial + ring */}
        <circle cx={C.x} cy={C.y} r={DIAL} fill="var(--surface)" stroke="var(--line-strong)" />
        {ticks.map((d) => {
          const long = d % 45 === 0
          const [x1, y1] = pt(DIAL - 3, d)
          const [x2, y2] = pt(DIAL - (long ? 13 : 7), d)
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg)" strokeOpacity={long ? 0.3 : 0.11} />
        })}
        <path d={ARC} fill="none" stroke="var(--fg)" strokeWidth={17} />
        {!reduce && (
          <circle cx={NX} cy={NY} r={13} fill="none" stroke="var(--accent)" strokeWidth={1.2}>
            <animate attributeName="r" values="13;34" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="2.2s" repeatCount="indefinite" />
          </circle>
        )}
        <circle cx={NX} cy={NY} r={13} fill="var(--accent)" />

        {!reduce && <Courier key={`in-${step}`} pathId={`${uid}-in${o.from}`} />}
        {!reduce && <Courier key={`out-${step}`} pathId={`${uid}-out${o.to}`} delay={0.75} />}
      </svg>

      {/* supplier labels */}
      {SUPPLIERS.map((s, i) => {
        const live = i === o.to
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 + i * 0.06, ease }}
            className="absolute flex -translate-y-1/2 items-center gap-2"
            style={{ left: `calc(${pctX(SUP_X)} + 10px)`, top: pctY(s.y) }}
          >
            <SupplierMark mono={s.mono} color={s.color} live={live} />
            <div className="leading-tight">
              <p className={cn('text-[12px] font-medium transition-colors duration-500', live ? 'text-fg' : 'text-fg-2')}>{s.name}</p>
              <p className={cn('font-mono text-[10px]', s.degraded ? 'text-warning' : 'text-fg-3')}>{s.sub}</p>
            </div>
          </motion.div>
        )
      })}

      {/* live order caption */}
      <div className="absolute -translate-x-1/2 text-center" style={{ left: pctX(C.x), top: pctY(C.y + DIAL + 18) }}>
        <p className="font-mono text-[10px] tracking-[0.12em] text-fg-3 uppercase">ORVEX Core · routing</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={o.ord} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.2 }} className="mt-1 font-mono text-[11px] leading-relaxed whitespace-nowrap">
            <p className="text-fg-2">
              {o.ord} · {o.svc}
            </p>
            <p className={o.review ? 'text-warning' : 'text-accent-ink'}>
              → {SUPPLIERS[o.to]!.name} · {o.note}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Product glimpses */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.1, ease }}
        className="absolute top-0 left-0 w-[236px] rounded-xl border border-line bg-surface p-3 shadow-pop"
      >
        <div className="flex items-center gap-2.5">
          <TenantMark className="size-7" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-fg">UnlockDesk Production</p>
            <p className="truncate font-mono text-[10.5px] text-fg-3">portal.unlockdesk-demo.com</p>
          </div>
          <Dot tone="success" pulse />
        </div>
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px]">
          <span className="font-mono text-fg-2">v2.4.1</span>
          <span className="inline-flex items-center gap-1 font-medium text-accent-ink">
            2.5.0 available <ArrowRight className="size-3" />
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.3, ease }}
        className="absolute right-0 bottom-0 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-pop"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-success/12 text-success">
          <FileKey className="size-3.5" />
        </span>
        <div>
          <p className="font-mono text-[11.5px] font-medium text-fg">LIC-4829-AX</p>
          <p className="flex items-center gap-1 text-[10.5px] text-fg-3">
            <BadgeCheck className="size-3 text-success" /> Ed25519 signature valid
          </p>
        </div>
      </motion.div>
    </div>
  )
}
