import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'motion/react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EASE, ringArc, ringPoint } from './sharedUtils'

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1264px] px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn('relative scroll-mt-16 py-20 sm:py-28', className)}>
      {children}
    </section>
  )
}

/** Hairline that separates editorial sections — with registration ticks at both ends. */
export function SectionRule() {
  return (
    <Container>
      <div aria-hidden className="relative h-px w-full bg-line">
        <span className="absolute top-1/2 left-0 h-2 w-px -translate-y-1/2 bg-line-strong" />
        <span className="absolute top-1/2 right-0 h-2 w-px -translate-y-1/2 bg-line-strong" />
      </div>
    </Container>
  )
}

/** The ORVEX mark in miniature — open ring (currentColor) with the coral node. */
export function NodeGlyph({ className }: { className?: string }) {
  const [nx, ny] = ringPoint(5.4, -45)
  return (
    <svg viewBox="-8 -8 16 16" className={cn('size-3.5', className)} aria-hidden>
      <path d={ringArc(5.4)} fill="none" stroke="currentColor" strokeWidth={1.9} />
      <circle cx={nx} cy={ny} r={1.8} fill="var(--accent)" />
    </svg>
  )
}

export function Eyebrow({ index, label, className }: { index?: string; label: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 inline-flex items-center gap-2.5', className)}>
      <NodeGlyph className="text-fg-2" />
      {index && <span className="font-mono text-[11px] text-fg tabular">§{index}</span>}
      <span className="h-px w-6 bg-line-strong" />
      <span className="mono-label">{label}</span>
    </div>
  )
}

export function Reveal({ children, className, delay = 0, y = 14 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.65, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeader({
  index,
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  children,
}: {
  index?: string
  eyebrow: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  className?: string
  children?: ReactNode
}) {
  return (
    <Reveal className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      <Eyebrow index={index} label={eyebrow} />
      <h2 className="font-display text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] text-balance text-fg sm:text-[42px]">{title}</h2>
      {description && <p className={cn('mt-4 max-w-2xl text-[15.5px] leading-relaxed text-pretty text-fg-2 sm:text-[17px]', align === 'center' && 'mx-auto')}>{description}</p>}
      {children}
    </Reveal>
  )
}

/** Frame used around product mock-ups — a quiet "app chrome" with a path bar. */
export function MockFrame({ path, right, children, className, bodyClassName }: { path: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-line bg-surface shadow-pop', className)}>
      <div className="flex h-10 items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-3.5">
        <div className="flex min-w-0 items-center gap-2 text-fg-3">
          <span aria-hidden className="flex shrink-0 gap-1">
            <span className="size-1.5 rounded-full bg-fg/15" />
            <span className="size-1.5 rounded-full bg-fg/15" />
            <span className="size-1.5 rounded-full bg-fg/15" />
          </span>
          <Lock className="ml-1.5 size-3 shrink-0" />
          <span className="truncate font-mono text-[11.5px]">{path}</span>
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

/** Small numbered/iconed chip used in diagrams. */
export function Chip({ children, className, mono }: { children: ReactNode; className?: string; mono?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-surface-2/70 px-2 text-[11.5px] whitespace-nowrap text-fg-2 [&_svg]:size-3', mono && 'font-mono text-[11px]', className)}>
      {children}
    </span>
  )
}

/** Coral full stop — used to punctuate the tagline. */
export function SignalStop() {
  return <span className="text-accent-ink">.</span>
}

/** Counts up to a value the first time it scrolls into view. */
export function CountUp({ to, from = 0, format, duration = 1.4, className }: { to: number; from?: number; format: (v: number) => string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const [v, setV] = useState(from)
  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(from, to, { duration, ease: EASE, onUpdate: setV })
    return () => controls.stop()
  }, [inView, reduce, from, to, duration])
  return (
    <span ref={ref} className={className}>
      {format(reduce ? to : v)}
    </span>
  )
}

/**
 * Decorative ORVEX "dial": concentric hairline orbits, a calibrated tick ring and
 * the open ring with its signal node. Purely ornamental — sits behind content.
 */
export function RingMotif({ className, spin = true }: { className?: string; spin?: boolean }) {
  const reduce = useReducedMotion()
  const ticks = Array.from({ length: 120 }, (_, i) => i * 3)
  const [nx, ny] = ringPoint(180, -45)
  return (
    <svg viewBox="-320 -320 640 640" className={cn('pointer-events-none absolute', className)} aria-hidden>
      <circle r={300} fill="none" stroke="var(--fg)" strokeOpacity={0.06} />
      <circle r={240} fill="none" stroke="var(--fg)" strokeOpacity={0.05} strokeDasharray="1 6" />
      {ticks.map((deg) => {
        const long = deg % 30 === 0
        const [x1, y1] = ringPoint(300, deg)
        const [x2, y2] = ringPoint(long ? 284 : 292, deg)
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg)" strokeOpacity={long ? 0.14 : 0.07} />
      })}
      <path d={ringArc(180)} fill="none" stroke="var(--fg)" strokeOpacity={0.09} strokeWidth={1} />
      <motion.g animate={spin && !reduce ? { rotate: 360 } : undefined} transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}>
        <circle r={120} fill="none" stroke="var(--fg)" strokeOpacity={0.07} strokeDasharray="2 10" />
      </motion.g>
      <line x1={-320} x2={320} y1={0} y2={0} stroke="var(--fg)" strokeOpacity={0.04} />
      <line y1={-320} y2={320} x1={0} x2={0} stroke="var(--fg)" strokeOpacity={0.04} />
      <circle cx={nx} cy={ny} r={14} fill="none" stroke="var(--accent)" strokeOpacity={0.3} />
      <circle cx={nx} cy={ny} r={5} fill="var(--accent)" />
    </svg>
  )
}

/** Registration marks for technical panels (four corner crosshairs). */
export function CornerMarks({ className }: { className?: string }) {
  const m = 'absolute size-2.5 border-fg/25'
  return (
    <span aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <span className={cn(m, 'top-0 left-0 border-t border-l')} />
      <span className={cn(m, 'top-0 right-0 border-t border-r')} />
      <span className={cn(m, 'bottom-0 left-0 border-b border-l')} />
      <span className={cn(m, 'right-0 bottom-0 border-r border-b')} />
    </span>
  )
}
