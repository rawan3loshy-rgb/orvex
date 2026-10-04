import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { MethodBadge } from '../shared'
import { DOC_NAV } from './sections'

const ALL_IDS = DOC_NAV.flatMap((g) => g.items.map((i) => i.id))

/** Tracks which doc section is currently in view. */
export function useScrollSpy() {
  const [active, setActive] = useState(ALL_IDS[0]!)
  useEffect(() => {
    const els = ALL_IDS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
    if (!els.length) return
    const visible = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top)
          else visible.delete(e.target.id)
        }
        if (visible.size) {
          const first = ALL_IDS.find((id) => visible.has(id))
          if (first) setActive(first)
        }
      },
      { rootMargin: '-80px 0px -55% 0px', threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return active
}

export function goTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

export function DocsSidebar({ active }: { active: string }) {
  return (
    <nav aria-label="API reference" className="space-y-6">
      {DOC_NAV.map((g) => (
        <div key={g.group}>
          <div className="mono-label mb-2 px-2.5">{g.group}</div>
          <ul className="space-y-px">
            {g.items.map((it) => {
              const on = it.id === active
              return (
                <li key={it.id} className="relative">
                  {on && (
                    <motion.span layoutId="docs-active" className="absolute inset-0 rounded-lg bg-surface-3/80 shadow-[inset_0_0_0_1px_var(--line)]" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
                      <span className="absolute top-1/2 left-0 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-accent" />
                    </motion.span>
                  )}
                  <a
                    href={`#${it.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      goTo(it.id)
                    }}
                    className={cn('relative flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors', on ? 'font-medium text-fg' : 'text-fg-2 hover:text-fg')}
                  >
                    {it.method && <MethodBadge method={it.method} size="xs" className={cn(!on && 'opacity-80')} />}
                    <span className="truncate">{it.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Compact horizontal jump bar for narrower screens. */
export function DocsJumpBar({ active }: { active: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the active chip centred without touching the window scroll position.
  useEffect(() => {
    const bar = ref.current
    const chip = document.getElementById(`jump-${active}`)
    if (!bar || !chip) return
    bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [active])
  return (
    <div className="glass sticky top-14 z-20 -mx-4 mb-2 border-b border-line px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 min-[1360px]:hidden">
      <div ref={ref} className="no-scrollbar mask-fade-x relative flex items-center gap-1 overflow-x-auto">
        {DOC_NAV.flatMap((g) => g.items).map((it) => (
          <button
            key={it.id}
            id={`jump-${it.id}`}
            type="button"
            onClick={() => goTo(it.id)}
            className={cn('relative flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] whitespace-nowrap transition-colors', it.id === active ? 'bg-surface-3 font-medium text-fg after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-accent' : 'text-fg-3 hover:text-fg-2')}
          >
            {it.method && <MethodBadge method={it.method} size="xs" />}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}
