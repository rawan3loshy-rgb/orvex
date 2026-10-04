import { cn } from '@/lib/cn'
import { SUPPLIERS, type SupplierKey } from './demo'

/** Supplier glyph — two-letter monogram on a tinted tile. */
export function SupplierMark({ k, size = 'sm', className }: { k: SupplierKey; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const s = SUPPLIERS[k]
  const cls = size === 'xs' ? 'size-5 text-[8.5px] rounded-[5px]' : size === 'sm' ? 'size-6 text-[9.5px] rounded-md' : 'size-8 text-[11px] rounded-lg'
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center font-mono leading-none font-semibold tracking-[-0.02em]', cls, className)}
      style={{ color: s.color, background: `color-mix(in oklab, ${s.color} 13%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${s.color} 30%, transparent)` }}
      title={s.name}
      aria-hidden
    >
      {s.mono}
    </span>
  )
}
