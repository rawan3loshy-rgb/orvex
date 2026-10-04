/**
 * Small building blocks shared by the vendor-portal screens
 * (account.orvex.io). Built on top of the shared kit — tokens only.
 */
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Card, Dot, Skeleton, statusLabel, statusTone } from '@/components/ui'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import type { Tone } from '@/types/common'
import type { ReleaseNote } from '@/types/release'
import type { InstallationRef, SupportTicket } from '@/types/vendor'
import { EASE, NOTE_META, PRIORITY_META, useNow } from './kitUtils'

/* ------------------------------------------------------------------ */
/*  Motion                                                             */
/* ------------------------------------------------------------------ */

/** Fade-and-rise entrance used to stagger page sections. */
export function Reveal({ children, delay = 0, className, y = 10, id }: { children: ReactNode; delay?: number; className?: string; y?: number; id?: string }) {
  return (
    <motion.div id={id} className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Versions & releases                                                */
/* ------------------------------------------------------------------ */

export function NoteIcon({ type, className }: { type: ReleaseNote['type']; className?: string }) {
  const m = NOTE_META[type]
  const Icon = m.icon
  return (
    <span
      className={cn('grid size-6 shrink-0 place-items-center rounded-md [&_svg]:size-3.5', className)}
      style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 13%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${m.color} 24%, transparent)` }}
      aria-hidden
    >
      <Icon />
    </span>
  )
}

export function NoteChip({ type, count, className }: { type: ReleaseNote['type']; count?: number; className?: string }) {
  const m = NOTE_META[type]
  const Icon = m.icon
  return (
    <span
      className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3', className)}
      style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 12%, transparent)` }}
    >
      <Icon />
      {m.label}
      {count != null && <span className="tabular opacity-70">{count}</span>}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Installations                                                      */
/* ------------------------------------------------------------------ */

export function EnvBadge({ env, className }: { env: InstallationRef['environment']; className?: string }) {
  const prod = env === 'production'
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[10px] font-medium tracking-[0.06em] whitespace-nowrap uppercase ring-1 ring-inset',
        prod ? 'bg-accent/10 text-accent-ink ring-accent/20' : 'bg-warning/10 text-warning ring-warning/25',
        className,
      )}
    >
      {prod ? 'Production' : 'Staging'}
    </span>
  )
}

/** Status dot + "seen 12 minutes ago" from the installation's last license heartbeat. */
export function Heartbeat({ status, at, className, label = true }: { status: string; at: string; className?: string; label?: boolean }) {
  useNow()
  return (
    <span className={cn('inline-flex items-center gap-2 text-[12.5px] whitespace-nowrap', className)}>
      <Dot tone={statusTone(status)} pulse={status === 'online'} />
      {label && <span className="font-medium text-fg-2">{statusLabel(status)}</span>}
      <span className="truncate text-fg-3">{label ? `· seen ${relative(at)}` : `Last seen ${relative(at)}`}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Tickets                                                            */
/* ------------------------------------------------------------------ */

export function PriorityBars({ priority, className }: { priority: SupportTicket['priority']; className?: string }) {
  const level = { low: 1, normal: 2, high: 3, urgent: 4 }[priority]
  const color = priority === 'urgent' ? 'bg-danger' : priority === 'high' ? 'bg-warning' : 'bg-fg-2'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-fg-2', className)}>
      <span className="flex h-3 items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className={cn('w-[3px] rounded-[1px]', b <= level ? color : 'bg-fg/12')} style={{ height: `${25 + b * 18.75}%` }} />
        ))}
      </span>
      {PRIORITY_META[priority].label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Surfaces                                                           */
/* ------------------------------------------------------------------ */

const calloutTone: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2/60',
  accent: 'border-accent/25 bg-accent/[0.06]',
  success: 'border-success/25 bg-success/[0.06]',
  warning: 'border-warning/30 bg-warning/[0.07]',
  danger: 'border-danger/25 bg-danger/[0.06]',
  info: 'border-info/25 bg-info/[0.06]',
}
const calloutIcon: Record<Tone, string> = {
  neutral: 'text-fg-3',
  accent: 'text-accent-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

export function Callout({ tone = 'neutral', icon, title, children, action, className }: { tone?: Tone; icon?: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3.5', calloutTone[tone], className)}>
      {icon && <span className={cn('mt-[3px] shrink-0 [&_svg]:size-4', calloutIcon[tone])}>{icon}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
          {title && <p className="font-medium text-fg">{title}</p>}
          {children && <div className={cn('text-fg-2', title ? 'mt-0.5 text-[12.5px]' : '')}>{children}</div>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}

const tileTone: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-fg-2',
  accent: 'border-accent/20 bg-accent/10 text-accent-ink',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-danger/20 bg-danger/10 text-danger',
  info: 'border-info/20 bg-info/10 text-info',
}

export function IconTile({ icon, tone = 'neutral', size = 'md', className }: { icon: ReactNode; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center border', size === 'sm' ? 'size-7 rounded-md [&_svg]:size-3.5' : size === 'lg' ? 'size-11 rounded-xl [&_svg]:size-5' : 'size-9 rounded-lg [&_svg]:size-4', tileTone[tone], className)}>
      {icon}
    </span>
  )
}

/**
 * Precise top-edge marker for a hero card: a short signal-coral tab aligned
 * with the card padding (no glow, no gradient wash).
 */
export function TopGlow({ className }: { className?: string }) {
  return <span aria-hidden className={cn('pointer-events-none absolute top-0 left-5 h-0.5 w-12 rounded-b-full bg-accent', className)} />
}

/**
 * Decorative concentric open rings echoing the ORVEX mark (an open ring with a
 * coral node where traffic leaves for a provider). Lines take `currentColor`;
 * only the node and its route line are coral.
 */
export function SignalRings({ className, count = 6, node = 2 }: { className?: string; count?: number; node?: number | null }) {
  const cx = 300
  const cy = 120
  const rad = (d: number) => (d * Math.PI) / 180
  const pt = (r: number, deg: number) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))] as const
  const radius = (i: number) => 30 + i * 26
  const nodeR = node != null ? radius(Math.min(node, count - 1)) : null
  const [nx, ny] = nodeR ? pt(nodeR, -45) : [0, 0]
  const [ex, ey] = pt(420, -45)
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={cn('pointer-events-none', className)} aria-hidden fill="none">
      {Array.from({ length: count }, (_, i) => {
        const r = radius(i)
        const [ax, ay] = pt(r, -15)
        const [bx, by] = pt(r, -75)
        return <path key={i} d={`M${ax.toFixed(2)} ${ay.toFixed(2)} A${r} ${r} 0 1 1 ${bx.toFixed(2)} ${by.toFixed(2)}`} stroke="currentColor" strokeOpacity={0.55 - i * (0.45 / count)} strokeWidth={1} />
      })}
      {nodeR && (
        <>
          <line x1={nx} y1={ny} x2={ex} y2={ey} stroke="var(--accent)" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 4" />
          <circle cx={nx} cy={ny} r={4.5} fill="var(--accent)" />
          <circle cx={nx} cy={ny} r={9} stroke="var(--accent)" strokeOpacity={0.3} />
        </>
      )}
    </svg>
  )
}

export function CardSkeleton({ rows = 3, className, header = true }: { rows?: number; className?: string; header?: boolean }) {
  return (
    <Card className={cn('p-5', className)}>
      {header && (
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn('h-3.5', i % 3 === 2 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </Card>
  )
}

/** Label/value row used inside cards. */
export function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2 text-[13px]', className)}>
      <span className="shrink-0 text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  )
}
