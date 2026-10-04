import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string = string> {
  value: T
  label: ReactNode
  count?: number | string
  icon?: ReactNode
  disabled?: boolean
}

/** Underline tabs with an animated indicator. */
export function Tabs<T extends string>({ items, value, onChange, className, size = 'md' }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  const id = useId()
  return (
    <div role="tablist" className={cn('no-scrollbar relative flex items-center gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={it.disabled}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 px-2.5 font-medium whitespace-nowrap transition-colors disabled:opacity-40 [&_svg]:size-3.5',
              size === 'sm' ? 'h-9 text-[12.5px]' : 'h-10.5 text-[13px]',
              active ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {it.icon}
            {it.label}
            {it.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[10.5px] tabular', active ? 'bg-fg/10 text-fg' : 'bg-fg/[0.05] text-fg-3')}>{it.count}</span>
            )}
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-1.5 -bottom-px h-[2px] rounded-full bg-fg" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          </button>
        )
      })}
    </div>
  )
}

/** Compact segmented control (pill style). */
export function Segmented<T extends string>({ items, value, onChange, className, size = 'sm' }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: 'xs' | 'sm' | 'md' }) {
  const id = useId()
  return (
    <div className={cn('inline-flex items-center rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            disabled={it.disabled}
            className={cn(
              'relative flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
              size === 'xs' ? 'h-6 px-2 text-[11.5px]' : size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
              active ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md border border-line bg-surface shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative flex items-center gap-1.5">
              {it.icon}
              {it.label}
              {it.count !== undefined && <span className="text-fg-3 tabular">{it.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
