/**
 * Reseller portal building blocks (UnlockDesk Partner Portal).
 * Built on the shared ORVEX kit — tokens only, no hard-coded surfaces.
 */
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, Box, KeyRound, Lock, RadioTower, RefreshCw, ScanBarcode, ScanText, Smartphone, TriangleAlert } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/ui'
import type { MemberRole } from '@/types/installation'
import { cn } from '@/lib/cn'
import { EASE, ROLE_LABEL, STATUS_DETAIL, type Capability } from './kitUtils'

/** Fade-and-rise entrance for page sections. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: EASE }}>
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Session & roles                                                    */
/* ------------------------------------------------------------------ */

const CAP_COPY: Record<Capability, { title: string; roles: string }> = {
  order: { title: 'Your role can’t place orders', roles: 'Owner, Admin or Orderer' },
  finance: { title: 'Wallet details are limited to finance roles', roles: 'Owner, Admin or Finance' },
  api: { title: 'API access is limited to technical roles', roles: 'Owner, Admin or Developer' },
  members: { title: 'Only owners and admins can manage members', roles: 'Owner or Admin' },
}

/** Friendly "not for your role" panel (the API refuses these actions too). */
export function NoAccess({ need, role, className }: { need: Capability; role?: MemberRole; className?: string }) {
  const c = CAP_COPY[need]
  return (
    <Card className={cn('border-dashed', className)}>
      <EmptyState
        icon={<Lock />}
        title={c.title}
        description={
          <>
            You’re signed in as <span className="font-medium text-fg-2">{role ? ROLE_LABEL[role] : 'a member'}</span>. This needs the {c.roles} role — ask an account owner, or switch member with the DEMO switcher in the header.
          </>
        }
      />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Query states                                                       */
/* ------------------------------------------------------------------ */

export function ErrorCard({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong'
  return (
    <Card className={className}>
      <EmptyState
        compact
        icon={<TriangleAlert />}
        title="We couldn’t load this"
        description={msg}
        action={
          onRetry && (
            <Button size="sm" leading={<RefreshCw />} onClick={onRetry}>
              Try again
            </Button>
          )
        }
      />
    </Card>
  )
}

export function CardSkeleton({ className, rows = 3 }: { className?: string; rows?: number }) {
  return (
    <Card className={cn('space-y-3 p-5', className)}>
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i % 2 ? 'w-2/3' : 'w-full')} />
      ))}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Order status (customer-facing)                                     */
/* ------------------------------------------------------------------ */

export function PortalStatus({ status, detail, className, showDetail = true }: { status: string; detail?: string | null; className?: string; showDetail?: boolean }) {
  return (
    <span className={cn('inline-flex flex-col items-start gap-0.5', className)}>
      <StatusBadge status={status} />
      {showDetail && detail && STATUS_DETAIL[detail] && <span className="pl-0.5 text-[11px] text-fg-3">{STATUS_DETAIL[detail].label}</span>}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Services                                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_GLYPH: Record<string, { icon: LucideIcon; color: string }> = {
  cat_imei: { icon: ScanBarcode, color: 'var(--c3)' },
  cat_carrier: { icon: RadioTower, color: 'var(--c5)' },
  cat_device: { icon: Smartphone, color: 'var(--c2)' },
  cat_warranty: { icon: BadgeCheck, color: 'var(--c4)' },
  cat_unlock: { icon: KeyRound, color: 'var(--c4)' },
  cat_serial: { icon: ScanText, color: 'var(--c6)' },
}

export function CategoryGlyph({ categoryId, size = 'md', className }: { categoryId: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const g = CATEGORY_GLYPH[categoryId] ?? { icon: Box, color: 'var(--c6)' }
  const Icon = g.icon
  const s = size === 'sm' ? 'size-7 rounded-md [&_svg]:size-3.5' : size === 'lg' ? 'size-11 rounded-xl [&_svg]:size-5' : 'size-9 rounded-lg [&_svg]:size-4'
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center', s, className)}
      style={{ color: `color-mix(in oklab, ${g.color} 80%, var(--fg))`, background: `color-mix(in oklab, ${g.color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${g.color} 24%, transparent)` }}
      aria-hidden
    >
      <Icon />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Small layout pieces                                                */
/* ------------------------------------------------------------------ */

export function InfoRow({ label, children, mono, className }: { label: ReactNode; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0', className)}>
      <dt className="shrink-0 text-[12.5px] text-fg-3">{label}</dt>
      <dd className={cn('min-w-0 text-right text-[13px] text-fg', mono && 'font-mono text-[12px] break-all')}>{children}</dd>
    </div>
  )
}

/** Hatched, dashed container for anything that only exists in the demo. */
export function DemoNote({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border border-dashed border-warning/45 bg-hatch px-3 py-2 text-[12px] text-fg-2', className)}>{children}</div>
}

/** Page header for the API section (keys, webhooks, logs, DHRU). */
export function ApiSectionHeader({ title, description, actions }: { title: string; description: ReactNode; actions?: ReactNode }) {
  return <PageHeader eyebrow={<span className="mono-label">Developers · API</span>} title={title} description={description} actions={actions} />
}
