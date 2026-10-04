/**
 * Shared bits for the Accounts screens (list + detail).
 * One Account model for every buyer — these helpers keep tier / kind / status
 * presentation identical across the list, the detail page and finance screens.
 * Non-component helpers (tier metadata, form constants, previews) live in `./helpers`.
 */
import type { ReactNode } from 'react'
import { CircleX, TriangleAlert } from 'lucide-react'
import type { Account } from '@/types/installation'
import { Badge, Button, StatusBadge, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { GUEST_META, TIER_META } from './helpers'

/** Account tier badge; guests show as "Guest" regardless of tier. */
export function TierBadge({ account, className }: { account: Pick<Account, 'tier' | 'kind'>; className?: string }) {
  const meta = account.kind === 'guest' ? GUEST_META : TIER_META[account.tier]
  const Icon = meta.icon
  return (
    <Badge tone="neutral" variant="outline" className={className} icon={<Icon />} title={meta.blurb}>
      {meta.label}
    </Badge>
  )
}

/** Pricing tier chip (Retail / Silver / Gold / Platinum) with the tier colour as a dot. */
export function PricingTierChip({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-fg-2', className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: color ?? 'var(--c6)' }} />
      {name}
    </span>
  )
}

/** Account status; frozen / pending / closed show their reason on hover. */
export function AccountStatus({ account, className }: { account: Pick<Account, 'status' | 'statusReason'>; className?: string }) {
  const badge = <StatusBadge status={account.status} className={className} />
  if (!account.statusReason) return badge
  return <Tooltip content={`Reason: ${account.statusReason}`}>{badge}</Tooltip>
}

export function LowBalanceFlag({ threshold, className }: { threshold?: ReactNode; className?: string }) {
  return (
    <Tooltip content={threshold ? <>Below the low-balance alert of {threshold}</> : 'Below the low-balance alert'}>
      <span className={cn('inline-flex items-center gap-1 text-[11.5px] font-medium text-warning', className)}>
        <TriangleAlert className="size-3.5" />
        Low
      </span>
    </Tooltip>
  )
}

export function LoadError({ what, onRetry, className }: { what: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div className="grid size-10 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
        <CircleX className="size-5" />
      </div>
      <div>
        <p className="text-[14px] font-semibold">Could not load {what}</p>
        <p className="mt-1 text-[12.5px] text-fg-3">The installation API did not answer. Your data is safe — try again.</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

/** Small labelled cell for wallet / summary strips. */
export function Figure({ label, value, sub, className, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string; tone?: 'warning' | 'danger' | 'success' }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mono-label">{label}</div>
      <div className={cn('mt-1.5 font-mono text-[19px] leading-none font-semibold tracking-[-0.01em] tabular', tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>{value}</div>
      {sub && <div className="mt-1.5 truncate text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  )
}
