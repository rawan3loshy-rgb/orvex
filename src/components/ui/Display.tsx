import { useState, type ReactNode } from 'react'
import { Check, Copy, Eye, EyeOff, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import type { Tone } from '@/types/common'
import { Tooltip } from './Popover'
import { toast } from '@/stores/toast'

export function Avatar({ name, color, size = 'md', className }: { name: string; color?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const s = size === 'xs' ? 'size-5 text-[9px]' : size === 'sm' ? 'size-6 text-[10px]' : size === 'lg' ? 'size-10 text-sm' : 'size-8 text-[11px]'
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-[-0.01em]', s, className)}
      // Tinted rather than solid: readable in both themes for every chart colour (c2 flips light/dark).
      style={{
        color: `color-mix(in oklab, ${color ?? 'var(--c1)'} 72%, var(--fg))`,
        background: `color-mix(in oklab, ${color ?? 'var(--c1)'} 16%, var(--surface))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color ?? 'var(--c1)'} 32%, transparent)`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-line border-b-2 bg-surface-2 px-1 font-mono text-[10.5px] text-fg-2', className)}>{children}</kbd>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />
}

export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {icon && (
        <div className="relative mb-4">
          <div className="absolute -inset-2.5 rounded-2xl bg-hatch opacity-80 [mask-image:radial-gradient(closest-side,#000,transparent)]" />
          <div className="relative grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-fg-3 shadow-card [&_svg]:size-5">{icon}</div>
        </div>
      )}
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const barTone: Record<Tone, string> = { neutral: 'bg-fg-2/75', accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info' }

export function Progress({ value, max = 100, tone = 'accent', className, size = 'md' }: { value: number; max?: number; tone?: Tone; className?: string; size?: 'sm' | 'md' }) {
  const pctV = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-fg/[0.07]', size === 'sm' ? 'h-1' : 'h-1.5', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', barTone[tone])} style={{ width: `${pctV}%` }} />
    </div>
  )
}

export function Meter({ label, value, max, unit = '', className }: { label: ReactNode; value: number; max: number | null; unit?: string; className?: string }) {
  const ratio = max ? value / max : 0
  const tone: Tone = ratio > 1 ? 'danger' : ratio >= 0.9 ? 'warning' : 'neutral'
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-fg-2">{label}</span>
        <span className="tabular text-fg">
          {value}
          {unit}
          <span className="text-fg-3"> / {max == null ? 'Unlimited' : `${max}${unit}`}</span>
        </span>
      </div>
      <Progress value={max ? value : 8} max={max ?? 100} tone={max ? tone : 'neutral'} size="sm" />
    </div>
  )
}

export function ProgressRing({ value, size = 44, stroke = 4, tone = 'accent', children }: { value: number; size?: number; stroke?: number; tone?: Tone; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = `var(--${tone === 'neutral' ? 'fg-3' : tone})`
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value / 100))} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular">{children}</div>
    </div>
  )
}

export function PageHeader({ title, description, eyebrow, actions, children, className, icon }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon && <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface shadow-card [&_svg]:size-5">{icon}</div>}
          <div className="min-w-0">
            {eyebrow && <div className="mb-1.5 flex items-center gap-2 text-[12.5px] text-fg-3">{eyebrow}</div>}
            <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.025em] text-fg">{title}</h1>
            {description && <p className="mt-1 max-w-2xl text-[13.5px] text-fg-2">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function DescriptionList({ items, className, columns = 1 }: { items: { label: ReactNode; value: ReactNode; mono?: boolean; hint?: ReactNode }[]; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-8', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0 sm:[&:nth-last-child(-n+2)]:border-0">
          <dt className="shrink-0 text-[12.5px] text-fg-3">{it.label}</dt>
          <dd className={cn('min-w-0 truncate text-right text-[13px] text-fg', it.mono && 'font-mono text-[12px]')}>
            {it.value}
            {it.hint && <div className="text-[11.5px] text-fg-3">{it.hint}</div>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export interface TimelineItem {
  id: string
  title: ReactNode
  detail?: ReactNode
  time?: ReactNode
  tone?: Tone
  icon?: ReactNode
  active?: boolean
}

const tlDot: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-3 ring-line-strong',
  accent: 'bg-accent/15 text-accent-ink ring-accent/30',
  success: 'bg-success/15 text-success ring-success/30',
  warning: 'bg-warning/15 text-warning ring-warning/30',
  danger: 'bg-danger/15 text-danger ring-danger/30',
  info: 'bg-info/15 text-info ring-info/30',
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative', className)}>
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < items.length - 1 && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-line" />}
          <span className={cn('relative z-[1] grid size-[27px] shrink-0 place-items-center rounded-full ring-1 [&_svg]:size-3.5', tlDot[it.tone ?? 'neutral'])}>
            {it.active && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/40" />}
            {it.icon ?? <span className="size-1.5 rounded-full bg-current" />}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13px] font-medium text-fg">{it.title}</p>
              {it.time && <span className="font-mono text-[11px] text-fg-3 tabular">{it.time}</span>}
            </div>
            {it.detail && <div className="mt-0.5 text-[12.5px] text-fg-3">{it.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function CopyButton({ value, className, label }: { value: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Tooltip content={copied ? 'Copied' : (label ?? 'Copy')}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          navigator.clipboard?.writeText(value).catch(() => undefined)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        }}
        className={cn('grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg', className)}
        aria-label={label ?? 'Copy'}
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </Tooltip>
  )
}

/** Inline monospace value with copy affordance. */
export function MonoValue({ value, display, className, copy = true }: { value: string; display?: ReactNode; className?: string; copy?: boolean }) {
  return (
    <span className={cn('group inline-flex max-w-full items-center gap-1 font-mono text-[12px] text-fg-2', className)}>
      <span className="truncate">{display ?? value}</span>
      {copy && <CopyButton value={value} className="opacity-0 transition-opacity group-hover:opacity-100" />}
    </span>
  )
}

/**
 * Display for a stored secret. Secrets are write-only in Core: the API only
 * ever returns a masked value, so "reveal" explains rather than exposes.
 */
export function SecretField({ masked, label, className, revealable = false, value }: { masked: string; label?: string; className?: string; revealable?: boolean; value?: string }) {
  const [shown, setShown] = useState(false)
  return (
    <div className={cn('flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3', className)}>
      <Lock className="size-3.5 shrink-0 text-fg-3" />
      <span className="flex-1 truncate font-mono text-[12.5px] tracking-wide text-fg-2">{shown && value ? value : masked}</span>
      {revealable && value ? (
        <>
          <button type="button" onClick={() => setShown(!shown)} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={shown ? 'Hide' : 'Reveal'}>
            {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          <CopyButton value={value} />
        </>
      ) : (
        <Tooltip content={`${label ?? 'This secret'} is encrypted at rest and write-only. It cannot be revealed — replace it instead.`}>
          <button type="button" onClick={() => toast.info('Secrets are write-only', 'Stored credentials are encrypted (AES-256-GCM) and never returned by the API.')} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Why is this hidden?">
            <EyeOff className="size-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

const statTone: Record<Tone, string> = { neutral: '', accent: 'text-accent-ink', success: 'text-success', warning: 'text-warning', danger: 'text-danger', info: 'text-info' }

export function Stat({ label, value, sub, className, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string; tone?: Tone }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mono-label">{label}</div>
      <div className={cn('mt-1.5 font-display text-[22px] leading-none font-semibold tracking-[-0.02em] tabular', tone && statTone[tone])}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-fg-3">{sub}</div>}
    </div>
  )
}

export function SectionTitle({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Small "Demo data" marker so prototype figures are always explicit. */
export function DemoTag({ className }: { className?: string }) {
  return (
    <Tooltip content="Prototype: values come from the mock data layer and can be replaced by real APIs.">
      <span className={cn('inline-flex h-4.5 items-center rounded border border-dashed border-line-strong px-1.5 font-mono text-[9.5px] tracking-wider text-fg-3 uppercase', className)}>Demo</span>
    </Tooltip>
  )
}
