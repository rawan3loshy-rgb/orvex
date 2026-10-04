import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { initials, pct } from '@/lib/format'
import type { PricingGroup, Reseller } from '@/types/installation'

/* ------------------------------------------------------------------------- */
/*  Countries                                                                */
/* ------------------------------------------------------------------------- */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IT', name: 'Italy' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'ZA', name: 'South Africa' },
]

export const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }))

export function countryName(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code
}

export function CountryTag({ code, className, short }: { code: string; className?: string; short?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span className="inline-grid h-4 min-w-[22px] place-items-center rounded-[4px] border border-line bg-surface-2 px-1 font-mono text-[9.5px] font-medium text-fg-2">{code}</span>
      {!short && <span>{countryName(code)}</span>}
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/*  Shop marks                                                               */
/* ------------------------------------------------------------------------- */
/* Coral is reserved for actions and live state, so shop marks use the quieter chart hues. */
const PALETTE = ['var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

/** Stable colour for an entity id (shop marks, chips). */
export function colorFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]!
}

const AVATAR_SIZE = { xs: 'size-5 text-[8.5px]', sm: 'size-6 text-[9.5px]', md: 'size-8 text-[11px]', lg: 'size-10 text-[13px]' } as const

/** Monogram for a GSM shop / distributor — tinted, theme-safe in light and dark. */
export function ResellerAvatar({ reseller, size = 'md', className }: { reseller: Pick<Reseller, 'id' | 'name'>; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const color = colorFor(reseller.id)
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-mono leading-none font-semibold tracking-[-0.02em]', AVATAR_SIZE[size], className)}
      style={{
        color: `color-mix(in oklab, ${color} 80%, var(--fg))`,
        background: `color-mix(in oklab, ${color} 14%, var(--surface))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 32%, transparent)`,
      }}
      title={reseller.name}
      aria-hidden
    >
      {initials(reseller.name)}
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/*  Pricing groups                                                           */
/* ------------------------------------------------------------------------- */
export function groupStyle(color: string): CSSProperties {
  return {
    color: `color-mix(in oklab, ${color} 78%, var(--fg))`,
    background: `color-mix(in oklab, ${color} 12%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 26%, transparent)`,
  }
}

export function GroupChip({ group, className, size = 'sm' }: { group?: Pick<PricingGroup, 'name' | 'color'> | null; className?: string; size?: 'sm' | 'md' }) {
  if (!group) return <span className="text-fg-3">—</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap', size === 'sm' ? 'h-5 px-2 text-[11.5px]' : 'h-6 px-2.5 text-[12px]', className)} style={groupStyle(group.color)}>
      <span className="size-1.5 rounded-full" style={{ background: group.color }} />
      {group.name}
    </span>
  )
}

export function discountLabel(d: number) {
  if (d === 0) return 'List price'
  return d > 0 ? `−${d}%` : `+${Math.abs(d)}%`
}

/* ------------------------------------------------------------------------- */
/*  Balance & quality                                                        */
/* ------------------------------------------------------------------------- */
export const LOW_BALANCE = 100

export function isLowBalance(r: Pick<Reseller, 'status' | 'balance'>) {
  return r.status === 'active' && r.balance < LOW_BALANCE
}

export function successTone(v: number) {
  if (!v) return 'text-fg-3'
  if (v >= 97) return 'text-success'
  if (v >= 92) return 'text-fg'
  return 'text-warning'
}

export function SuccessRate({ value, className }: { value: number; className?: string }) {
  if (!value) return <span className={cn('text-fg-3', className)}>—</span>
  const bar = value >= 97 ? 'bg-success' : value >= 92 ? 'bg-accent-2/60' : 'bg-warning'
  return (
    <span className={cn('inline-flex items-center justify-end gap-2', className)}>
      <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-fg/[0.07] sm:block">
        <span className={cn('block h-full rounded-full', bar)} style={{ width: `${Math.max(4, (value - 80) * 5)}%` }} />
      </span>
      <span className={cn('tabular', successTone(value))}>{pct(value)}</span>
    </span>
  )
}

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
] as const
