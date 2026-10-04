/** Shared components for the Finance screens (ledger, integrity, reconciliation, payments). Non-component helpers live in `./helpers`. */
import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'

export { LoadError, Figure } from '@/features/admin/accounts/shared'

/** Calm explainer block ("why this matters"). */
export function Explainer({ title, children, className, icon }: { title?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn('flex gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3.5', className)}>
      <span className="mt-0.5 shrink-0 text-fg-3 [&_svg]:size-4">{icon ?? <Info />}</span>
      <div className="min-w-0 text-[12.5px] leading-relaxed text-fg-2">
        {title && <div className="mb-0.5 text-[13px] font-semibold text-fg">{title}</div>}
        {children}
      </div>
    </div>
  )
}

/** Hatched, dashed-border wrapper for DEMO-only controls. */
export function DemoZone({ children, className, label = 'DEMO / SIMULATION' }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn('relative rounded-xl border border-dashed border-warning/50 bg-hatch px-4 pt-5 pb-4', className)}>
      <span className="absolute -top-2.5 left-3 rounded bg-surface px-1.5 font-mono text-[10px] tracking-wider text-warning uppercase">{label}</span>
      {children}
    </div>
  )
}
