/**
 * Small components shared by the cockpit, orders and verifications screens.
 * (Feature-local on purpose — shared layers belong to the lead.) Non-component helpers live in `./helpers`.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { FlashCtx } from './helpers'

/* ------------------------------------------------------------------------- */
/*  Flash highlight — timeline refs scroll to and highlight a record         */
/* ------------------------------------------------------------------------- */
export function FlashProvider({ value, children }: { value: string | null; children: ReactNode }) {
  return <FlashCtx.Provider value={value}>{children}</FlashCtx.Provider>
}

/** Small mono key/value line used in technical panels. */
export function KV({ k, v, mono, className }: { k: ReactNode; v: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5 text-[12.5px]', className)}>
      <span className="shrink-0 text-fg-3">{k}</span>
      <span className={cn('min-w-0 truncate text-right text-fg', mono && 'font-mono text-[12px]')}>{v}</span>
    </div>
  )
}
