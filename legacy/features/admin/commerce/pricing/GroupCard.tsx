import { motion } from 'motion/react'
import { Check, Plus, Users } from 'lucide-react'
import type { PricingGroup } from '@/types/installation'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { discountLabel } from '../resellers/shared'

export function GroupCard({ group: g, selected, onSelect, index }: { group: PricingGroup; selected: boolean; onSelect: () => void; index: number }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative flex min-h-[156px] flex-col overflow-hidden rounded-xl border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow,background-color] duration-200',
        selected ? 'border-transparent' : 'border-line hover:border-line-strong hover:shadow-pop',
      )}
      style={selected ? { boxShadow: `0 0 0 1.5px ${g.color}, 0 0 0 5px color-mix(in oklab, ${g.color} 13%, transparent), var(--shadow-card)` } : undefined}
      aria-pressed={selected}
    >
      <span className="absolute inset-x-0 top-0 h-[2px] transition-opacity" style={{ background: g.color, opacity: selected ? 1 : 0.45 }} />
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
          <span className="size-2 rounded-full" style={{ background: g.color }} />
          {g.name}
        </span>
        {selected ? (
          <span className="grid size-5 place-items-center rounded-full text-white dark:text-bg" style={{ background: g.color }}>
            <Check className="size-3" />
          </span>
        ) : g.isDefault ? (
          <Badge>Default</Badge>
        ) : null}
      </div>
      <div className="relative mt-3 flex items-baseline gap-2">
        <span className="font-display text-[28px] leading-none font-semibold tracking-[-0.03em] text-fg tabular">{g.discountPercent ? `−${g.discountPercent}%` : '0%'}</span>
        <span className="text-[12px] text-fg-3">{g.discountPercent ? 'off public' : discountLabel(0).toLowerCase()}</span>
      </div>
      <p className="relative mt-2 line-clamp-2 text-[12.5px] leading-snug text-fg-3">{g.description || 'No description'}</p>
      <div className="relative mt-auto flex items-center gap-3 pt-3 text-[12px] text-fg-2">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5 text-fg-3" />
          <span className="tabular">{num(g.resellersCount)}</span> reseller{g.resellersCount === 1 ? '' : 's'}
        </span>
        {g.overrides.length > 0 && (
          <span className="inline-flex items-center gap-1 text-info">
            <span className="size-1 rounded-full bg-current" />
            {g.overrides.length} contract price{g.overrides.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </motion.button>
  )
}

export function NewGroupCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[156px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong p-4 text-center text-fg-3 transition-colors hover:border-accent/50 hover:bg-accent/[0.03] hover:text-fg"
    >
      <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 transition-colors group-hover:border-accent/30 group-hover:text-accent-ink">
        <Plus className="size-4" />
      </span>
      <span className="text-[13px] font-medium">New pricing group</span>
      <span className="max-w-[190px] text-[12px]">Bundle a discount and contract prices for a tier of shops or distributors</span>
    </button>
  )
}
