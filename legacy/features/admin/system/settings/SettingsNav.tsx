import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { SETTINGS_TABS, type SettingsTabId } from './tabs'

export function SettingsNav({ value, onChange }: { value: SettingsTabId; onChange: (t: SettingsTabId) => void }) {
  const groups = SETTINGS_TABS.reduce<{ group: string; items: typeof SETTINGS_TABS }[]>((acc, t) => {
    const g = acc.find((x) => x.group === t.group)
    if (g) g.items.push(t)
    else acc.push({ group: t.group, items: [t] })
    return acc
  }, [])

  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [value])

  return (
    <>
      {/* Mobile / tablet: horizontal scroll tabs */}
      <div ref={scroller} className="no-scrollbar -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 pb-2 sm:-mx-6 sm:px-6 lg:hidden" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((t) => {
          const active = t.id === value
          return (
            <button
              key={t.id}
              data-tab={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={cn('relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5', active ? 'text-fg' : 'text-fg-3 hover:text-fg-2')}
            >
              {active && (
                <motion.span layoutId="settings-pill-m" className="absolute inset-0 rounded-lg border border-line bg-surface shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
                  <span aria-hidden className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-t-full bg-accent" />
                </motion.span>
              )}
              <span className="relative flex items-center gap-1.5">
                <t.icon />
                {t.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Desktop: vertical list */}
      <nav className="sticky top-20 hidden self-start lg:block" aria-label="Settings sections">
        {groups.map((g, gi) => (
          <div key={g.group} className={cn(gi > 0 && 'mt-4')}>
            <div className="mono-label mb-1 px-2.5">{g.group}</div>
            <div className="space-y-0.5">
              {g.items.map((t) => {
                const active = t.id === value
                return (
                  <button
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn('group relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors', active ? 'text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg')}
                  >
                    {active && (
                      <motion.span layoutId="settings-pill-d" className="absolute inset-0 rounded-lg bg-surface-3/80 shadow-[inset_0_0_0_1px_var(--line)]" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
                        <span aria-hidden className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
                      </motion.span>
                    )}
                    <t.icon className={cn('relative size-4 shrink-0', active ? 'text-fg' : 'text-fg-3 group-hover:text-fg-2')} />
                    <span className="relative truncate">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  )
}
