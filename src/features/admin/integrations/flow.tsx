/**
 * Shared presentation for the two API directions:
 *   Provider API (inbound)  — ORVEX consumes supplier APIs.
 *   Reseller API (outbound) — external businesses consume ORVEX's API.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ApiDirection = 'inbound' | 'outbound'

export interface FlowNode {
  title: string
  sub: ReactNode
  /** External system (dashed) vs. inside ORVEX (solid). */
  side: 'external' | 'orvex'
  mono?: boolean
}

/** Horizontal (vertical on phones) chain of systems a request or catalog passes through. */
export function ApiFlow({ nodes, className }: { nodes: FlowNode[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col gap-1.5 lg:flex-row lg:items-stretch lg:gap-0', className)}>
      {nodes.map((n, i) => (
        <li key={n.title} className="flex flex-col items-stretch lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06, duration: 0.3 }}
            className={cn(
              'relative min-w-0 flex-1 rounded-lg px-3 py-2.5 lg:h-full',
              n.side === 'external' ? 'border border-dashed border-line-strong bg-surface-2/40' : 'border border-line bg-surface shadow-card',
            )}
          >
            {n.side === 'orvex' && <span className="absolute top-2.5 bottom-2.5 left-0 w-[2px] rounded-full bg-accent" />}
            <div className="mono-label flex items-center gap-1.5">{n.side === 'external' ? 'External' : 'ORVEX'}</div>
            <div className="mt-0.5 text-[13px] leading-snug font-semibold text-fg">{n.title}</div>
            <div className={cn('mt-0.5 text-[11.5px] leading-snug text-fg-3', n.mono && 'font-mono')}>{n.sub}</div>
          </motion.div>
          {i < nodes.length - 1 && (
            <span aria-hidden className="flex shrink-0 items-center justify-center py-0.5 text-fg-3 lg:px-1.5 lg:py-0">
              <ArrowRight className="size-3.5 rotate-90 lg:rotate-0" />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

const DIRECTION = {
  inbound: { icon: ArrowDownToLine, kicker: 'Provider API · inbound', lead: 'ORVEX consumes supplier APIs.' },
  outbound: { icon: ArrowUpFromLine, kicker: 'Reseller API · outbound', lead: 'External businesses consume ORVEX’s API.' },
} as const

/** Page hero that states the API direction in one sentence and links to the other direction. */
export function DirectionHero({
  direction,
  title,
  description,
  actions,
  other,
  aside,
  children,
}: {
  direction: ApiDirection
  title: string
  description: ReactNode
  actions?: ReactNode
  other: { to: string; label: string; text: string }
  aside?: ReactNode
  children?: ReactNode
}) {
  const meta = DIRECTION[direction]
  const Icon = meta.icon
  const OtherIcon = direction === 'inbound' ? ArrowUpFromLine : ArrowDownToLine
  return (
    <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative mb-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,black_10%,transparent_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent/60 [mask-image:linear-gradient(90deg,transparent,black_30%,black_70%,transparent)]" />
      <div className="relative grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
            <span className={cn('grid size-6 place-items-center rounded-md border [&_svg]:size-3.5', direction === 'inbound' ? 'border-line-strong bg-surface-2 text-fg-2' : 'border-accent/35 bg-accent/[0.06] text-accent-ink')}>
              <Icon />
            </span>
            {meta.kicker}
          </div>
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.03em] text-fg">{title}</h1>
          <p className="mt-2 text-[15px] font-medium text-fg">{meta.lead}</p>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-fg-2">{description}</p>
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="grid gap-3 xl:w-[300px]">
          {aside}
          <Link to={other.to} className="group flex items-center gap-3 rounded-xl border border-line bg-surface/90 px-3.5 py-3 transition-colors hover:border-line-strong">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">
              <OtherIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-fg-3">The other direction</span>
              <span className="block text-[13px] font-medium text-fg">{other.label}</span>
              <span className="block truncate text-[11.5px] text-fg-3">{other.text}</span>
            </span>
            <ArrowUpRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
          </Link>
        </div>
      </div>
      {children && <div className="relative border-t border-line bg-bg-subtle/60 px-5 py-4 sm:px-7">{children}</div>}
    </motion.header>
  )
}
