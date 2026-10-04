import { Box } from 'lucide-react'
import { cn } from '@/lib/cn'
import { brand } from '@/config/brand'
import { categoryColor, providerColor, SERVICE_ICONS } from './constants'

/**
 * ORVEX mark — an open ring (the platform) with a signal-coral node where
 * traffic leaves for a provider: Connect. Route. Fulfill.
 */
export function LogoMark({ className, mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      {!mono && <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" className="fill-[#171717] stroke-[rgb(244_244_242/0.1)] dark:fill-[#1c1e20]" />}
      <path d="M22.95 14.14A7.2 7.2 0 1 1 17.86 9.05" fill="none" stroke={mono ? 'currentColor' : '#f4f4f2'} strokeWidth="2.6" strokeLinecap="butt" />
      <circle cx="21.09" cy="10.91" r="2.2" fill={mono ? 'currentColor' : '#ff5a36'} />
    </svg>
  )
}

export function Logo({ className, suffix, size = 'md' }: { className?: string; suffix?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={size === 'sm' ? 'size-6' : size === 'lg' ? 'size-8' : 'size-7'} />
      <span className={cn('font-display font-wide font-[650] tracking-[0.06em] text-fg', size === 'sm' ? 'text-[14px]' : size === 'lg' ? 'text-[19px]' : 'text-[16px]')}>
        {brand.product}
        {suffix && <span className="ml-1.5 font-sans text-[0.82em] font-medium tracking-normal text-fg-3 [font-stretch:100%]">{suffix}</span>}
      </span>
    </span>
  )
}

/** The demo customer's own logo (installation branding — not ORVEX). */
export function TenantMark({ className, name = 'UnlockDesk' }: { className?: string; name?: string }) {
  return (
    <span className={cn('relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#0e7c66] font-display text-[12px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]', className)} aria-hidden>
      {name[0]}
      <span className="absolute right-[18%] bottom-[18%] size-[14%] rounded-full bg-[#7ee0c3]" />
    </span>
  )
}

const MONOGRAM: Record<string, string> = { prv_globalunlock: 'GU', prv_imeihub: 'IH', prv_gsmsolutions: 'GS', prv_mobileapi: 'MA', prv_devicenet: 'DS' }

function monogram(id: string, name?: string) {
  if (MONOGRAM[id]) return MONOGRAM[id]
  const words = (name ?? id.replace(/^prv_/, '')).split(/[\s_-]+/).filter(Boolean)
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2)).toUpperCase()
}

/** Provider glyph — two-letter monogram on a tinted tile. */
export function ProviderMark({ id, name, size = 'md', className }: { id: string; name?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const color = providerColor(id)
  const s = size === 'xs' ? 'size-5 text-[8.5px] rounded-[5px]' : size === 'sm' ? 'size-6 text-[9.5px] rounded-md' : size === 'lg' ? 'size-11 text-[15px] rounded-xl' : 'size-8 text-[11px] rounded-lg'
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center font-mono leading-none font-semibold tracking-[-0.02em]', s, className)}
      style={{ color, background: `color-mix(in oklab, ${color} 13%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 30%, transparent)` }}
      title={name}
      aria-hidden
    >
      {monogram(id, name)}
    </span>
  )
}

export function ServiceIcon({ icon, category, size = 'md', className }: { icon: string; category?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const Icon = SERVICE_ICONS[icon] ?? Box
  const color = category ? categoryColor(category) : 'var(--fg-2)'
  const s = size === 'sm' ? 'size-7 rounded-md [&_svg]:size-3.5' : size === 'lg' ? 'size-11 rounded-xl [&_svg]:size-5' : 'size-9 rounded-lg [&_svg]:size-4'
  return (
    <span className={cn('inline-grid shrink-0 place-items-center', s, className)} style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)` }} aria-hidden>
      <Icon />
    </span>
  )
}
