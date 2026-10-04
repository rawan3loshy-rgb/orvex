/**
 * Storefront UI primitives — consumer-grade styling on the storefront's scoped
 * tokens (see lib/theme.ts). Admin kit components are not used for the public
 * site so the brand (radius, fonts, colours) stays fully customer-controlled.
 */
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Copy,
  KeyRound,
  LoaderCircle,
  Package,
  RadioTower,
  ScanBarcode,
  ScanText,
  Smartphone,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { formatMoney, type Micros } from '@/core/money'
import type { FieldCheck } from '@/core/fields'
import type { StoreServiceCard } from '@/types/installation'
import { cn } from '@/lib/cn'
import { SfLink } from './lib/store'
import { useStore } from './lib/storeContext'
import { publicStatusView, turnaroundLabel } from './lib/format'

/* ------------------------------------------------------------------------- */
/*  Layout                                                                   */
/* ------------------------------------------------------------------------- */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

export function Section({ className, children, tone = 'plain', id }: { className?: string; children: ReactNode; tone?: 'plain' | 'subtle'; id?: string }) {
  return (
    <section id={id} className={cn('py-12 sm:py-16', tone === 'subtle' && 'border-y border-line bg-bg-subtle', className)}>
      <Container>{children}</Container>
    </section>
  )
}

export function SectionHead({ eyebrow, title, subtitle, action, center, className }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; action?: ReactNode; center?: boolean; className?: string }) {
  return (
    <div className={cn('mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-9', center && 'flex-col items-center text-center', className)}>
      <div className={cn('max-w-2xl', center && 'mx-auto')}>
        {eyebrow && <div className="mb-2 text-[13px] font-semibold tracking-wide text-accent-ink uppercase">{eyebrow}</div>}
        <h2 className="sf-h text-[26px] leading-[1.15] font-semibold text-fg sm:text-[32px]">{title}</h2>
        {subtitle && <p className="mt-2.5 text-[15.5px] leading-relaxed text-fg-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export const cardCls = 'rounded-[var(--sf-r-lg)] border border-line bg-surface shadow-card'

/* ------------------------------------------------------------------------- */
/*  Buttons                                                                  */
/* ------------------------------------------------------------------------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'inverse' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

const btnVariant: Record<BtnVariant, string> = {
  primary: 'bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_8px_18px_-10px_var(--accent)] hover:brightness-[1.07] active:brightness-95',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-fg-2 hover:bg-surface-2 hover:text-fg',
  inverse: 'bg-accent-fg text-accent hover:opacity-90',
  danger: 'bg-danger text-white hover:brightness-110',
}
const btnSize: Record<BtnSize, string> = {
  sm: 'h-9 px-3.5 text-[14px] gap-1.5 [&_svg]:size-4',
  md: 'h-11 px-5 text-[15px] gap-2 [&_svg]:size-4',
  lg: 'h-[52px] px-6 text-[16px] gap-2 [&_svg]:size-[18px]',
}

export interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: BtnVariant
  size?: BtnSize
  href?: string
  loading?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  full?: boolean
  children?: ReactNode
}

export function Btn({ variant = 'primary', size = 'md', href, loading, leading, trailing, full, className, children, disabled, type = 'button', ...rest }: BtnProps) {
  const cls = cn(
    'inline-flex shrink-0 items-center justify-center rounded-[var(--sf-r)] font-semibold whitespace-nowrap transition-[filter,background-color,color,opacity] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    btnVariant[variant],
    btnSize[size],
    full && 'w-full',
    className,
  )
  const inner = (
    <>
      {loading ? <LoaderCircle className="animate-spin" /> : leading}
      {children}
      {trailing}
    </>
  )
  if (href && !disabled)
    return (
      <SfLink href={href} className={cls}>
        {inner}
      </SfLink>
    )
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {inner}
    </button>
  )
}

/* ------------------------------------------------------------------------- */
/*  Small display pieces                                                     */
/* ------------------------------------------------------------------------- */
type PillTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'progress'
const pillTone: Record<PillTone, string> = {
  neutral: 'bg-fg/[0.06] text-fg-2',
  brand: 'bg-accent/10 text-accent-ink',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/10 text-danger',
  progress: 'bg-accent/10 text-accent-ink',
}

export function Pill({ tone = 'neutral', children, className, icon, dot }: { tone?: PillTone; children: ReactNode; className?: string; icon?: ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] leading-none font-semibold whitespace-nowrap [&_svg]:size-3.5', pillTone[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full bg-current', tone === 'progress' && 'animate-pulse')} />}
      {icon}
      {children}
    </span>
  )
}

export function StatusPill({ status, detail, financial, className }: { status: string; detail: string | null; financial?: string; className?: string }) {
  const v = publicStatusView(status, detail, financial)
  return (
    <Pill tone={v.tone} dot className={className}>
      {v.label}
    </Pill>
  )
}

export function Price({ value, className, unavailable }: { value: Micros; className?: string; unavailable?: boolean }) {
  return <span className={cn('sf-h font-semibold tracking-[-0.02em] text-fg tabular-nums', unavailable && 'text-fg-3 line-through decoration-1', className)}>{formatMoney(value)}</span>
}

const ICONS: Record<string, LucideIcon> = {
  'scan-barcode': ScanBarcode,
  'radio-tower': RadioTower,
  smartphone: Smartphone,
  'badge-check': BadgeCheck,
  'key-round': KeyRound,
  'scan-text': ScanText,
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Package
  return <I className={className} aria-hidden />
}

export function IconTile({ name, className, size = 'md' }: { name: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-[var(--sf-r)] bg-accent/10 text-accent-ink', size === 'sm' ? 'size-9 [&_svg]:size-[18px]' : size === 'lg' ? 'size-14 [&_svg]:size-7' : 'size-11 [&_svg]:size-5', className)}>
      <CategoryIcon name={name} />
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-5 animate-spin text-accent-ink', className)} aria-hidden />
}

export function Skel({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[var(--sf-r-sm)] bg-fg/[0.07]', className)} />
}

export function SfCopyButton({ value, label = 'Copy', className, compact }: { value: string; label?: string; className?: string; compact?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).catch(() => undefined)
        setDone(true)
        window.setTimeout(() => setDone(false), 1600)
      }}
      className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-[var(--sf-r-sm)] border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg', compact && 'px-1.5 py-1', className)}
      aria-label={`${label} ${value}`}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {!compact && (done ? 'Copied' : label)}
    </button>
  )
}

export function Checks({ checks, className }: { checks: FieldCheck[]; className?: string }) {
  if (!checks.length) return null
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1', className)} aria-live="polite">
      {checks.map((c) => (
        <li key={c.label} className={cn('inline-flex items-center gap-1 text-[13px] font-medium transition-colors', c.ok ? 'text-success' : 'text-fg-3')}>
          {c.ok ? <Check className="size-3.5" strokeWidth={2.6} /> : <X className="size-3.5" />}
          {c.label}
        </li>
      ))}
    </ul>
  )
}

export const inputCls =
  'h-12 w-full rounded-[var(--sf-r)] border border-line-strong bg-surface px-3.5 text-[16px] text-fg placeholder:text-fg-3/80 transition-[border-color,box-shadow] outline-none focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)] aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_18%,transparent)] disabled:opacity-60'

export function FormField({ label, htmlFor, hint, error, optional, children, className }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: ReactNode; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[14px] font-semibold text-fg">
        {label}
        {optional && <span className="text-[12.5px] font-normal text-fg-3">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-err` : undefined} className="flex items-center gap-1.5 text-[13.5px] font-medium text-danger" role="alert">
          <TriangleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-fg-3">{hint}</p>
      ) : null}
    </div>
  )
}

export function Notice({ tone = 'neutral', icon, title, children, className }: { tone?: 'neutral' | 'brand' | 'warning' | 'danger' | 'success'; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t = {
    neutral: 'border-line bg-surface-2 text-fg-2',
    brand: 'border-accent/25 bg-accent/[0.06] text-fg-2',
    warning: 'border-warning/30 bg-warning/[0.08] text-fg-2',
    danger: 'border-danger/30 bg-danger/[0.06] text-fg-2',
    success: 'border-success/30 bg-success/[0.07] text-fg-2',
  }[tone]
  const ic = { neutral: 'text-fg-3', brand: 'text-accent-ink', warning: 'text-warning', danger: 'text-danger', success: 'text-success' }[tone]
  return (
    <div className={cn('flex gap-3 rounded-[var(--sf-r)] border p-3.5 text-[14px] leading-relaxed', t, className)}>
      {icon && <span className={cn('mt-0.5 shrink-0 [&_svg]:size-[18px]', ic)}>{icon}</span>}
      <div className="min-w-0">
        {title && <div className="font-semibold text-fg">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }: { title?: string; message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn(cardCls, 'flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-danger/10 text-danger">
        <TriangleAlert className="size-5" />
      </span>
      <div className="sf-h text-[18px] font-semibold">{title}</div>
      {message && <p className="max-w-md text-[14.5px] text-fg-3">{message}</p>}
      {onRetry && (
        <Btn variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Btn>
      )}
    </div>
  )
}

export function EmptyBlock({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-[var(--sf-r-lg)] border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      {icon && <span className="grid size-12 place-items-center rounded-full bg-accent/10 text-accent-ink [&_svg]:size-5">{icon}</span>}
      <div className="sf-h text-[18px] font-semibold">{title}</div>
      {body && <p className="max-w-md text-[14.5px] text-fg-3">{body}</p>}
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Service cards (price + availability always come from the API)            */
/* ------------------------------------------------------------------------- */
export function Turnaround({ card, className }: { card: Pick<StoreServiceCard, 'turnaround' | 'processing'>; className?: string }) {
  const fast = card.processing === 'instant' && card.turnaround.maxSec <= 300
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-3', className)}>
      {fast ? <Zap className="size-3.5 text-accent-2" /> : <Clock className="size-3.5" />}
      {turnaroundLabel(card.turnaround, card.processing)}
    </span>
  )
}

export function UnavailablePill() {
  return (
    <Pill tone="warning" icon={<TriangleAlert />}>
      Temporarily unavailable
    </Pill>
  )
}

export function ServiceCard({ card, showPrice = true }: { card: StoreServiceCard; showPrice?: boolean }) {
  const { to } = useStore()
  return (
    <SfLink
      href={to(`/site/services/${card.slug}`)}
      className={cn(cardCls, 'group relative flex h-full flex-col gap-4 p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop', !card.available && 'bg-surface-2/60')}
    >
      <div className="flex items-start justify-between gap-3">
        <IconTile name={card.icon} />
        {!card.available ? <UnavailablePill /> : card.featured ? <Pill tone="brand">Popular</Pill> : <span className="text-[12.5px] font-medium text-fg-3">{card.categoryName}</span>}
      </div>
      <div className="flex-1">
        <h3 className="sf-h text-[17px] leading-snug font-semibold text-fg">{card.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-fg-3">{card.summary}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <Turnaround card={card} />
        <span className="inline-flex items-center gap-2">
          {showPrice && <Price value={card.price} unavailable={!card.available} className="text-[18px]" />}
          <ArrowRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-ink" />
        </span>
      </div>
    </SfLink>
  )
}

export function ServiceRow({ card, showPrice = true }: { card: StoreServiceCard; showPrice?: boolean }) {
  const { to } = useStore()
  return (
    <SfLink href={to(`/site/services/${card.slug}`)} className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5">
      <IconTile name={card.icon} size="sm" className="hidden sm:grid" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-[15.5px] leading-snug font-semibold text-fg">{card.name}</h3>
          {!card.available && <UnavailablePill />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <p className="line-clamp-1 max-w-xl text-[13.5px] text-fg-3">{card.summary}</p>
          <Turnaround card={card} className="sm:hidden" />
        </div>
      </div>
      <Turnaround card={card} className="hidden w-36 shrink-0 sm:inline-flex" />
      {showPrice && <Price value={card.price} unavailable={!card.available} className="w-20 shrink-0 text-right text-[17px]" />}
      <ArrowRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-ink" />
    </SfLink>
  )
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(cardCls, 'flex flex-col gap-4 p-5')}>
          <Skel className="size-11" />
          <Skel className="h-5 w-3/4" />
          <Skel className="h-4 w-full" />
          <Skel className="h-4 w-2/3" />
          <div className="mt-2 flex justify-between border-t border-line pt-4">
            <Skel className="h-4 w-24" />
            <Skel className="h-5 w-14" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RowListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn(cardCls, 'divide-y divide-line')}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skel className="hidden size-9 sm:block" />
          <div className="flex-1 space-y-2">
            <Skel className="h-4 w-1/2" />
            <Skel className="h-3.5 w-3/4" />
          </div>
          <Skel className="h-5 w-14" />
        </div>
      ))}
    </div>
  )
}
