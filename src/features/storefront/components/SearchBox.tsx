import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Search } from 'lucide-react'
import { useStoreSearch } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { useStore } from '../lib/storeContext'
import { CategoryIcon, Price, Spinner } from '../ui'

function useDebounced<T>(value: T, ms = 180) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * Catalog search with live suggestions. Suggestions come from the storefront
 * search API (prices resolved live for the visitor's tier).
 */
export function SearchBox({ size = 'lg', initial = '', autoFocus, placeholder = 'Search services — e.g. “iPhone 15 unlock”', onDone, className }: { size?: 'md' | 'lg'; initial?: string; autoFocus?: boolean; placeholder?: string; onDone?: () => void; className?: string }) {
  const { to } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState(initial)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const debounced = useDebounced(q.trim())
  const results = useStoreSearch(debounced)
  const list = debounced.length >= 2 ? (results.data ?? []).slice(0, 5) : []
  const id = useId()
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const go = (path: string) => {
    setOpen(false)
    onDone?.()
    navigate(to(path))
  }

  const submit = () => {
    if (active >= 0 && list[active]) return go(`/site/services/${list[active].slug}`)
    if (q.trim().length) go(`/site/search?q=${encodeURIComponent(q.trim())}`)
  }

  const showPanel = open && debounced.length >= 2

  return (
    <div ref={wrap} className={cn('relative w-full', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={cn('flex items-center gap-2 rounded-[var(--sf-r-lg)] border border-line-strong bg-surface shadow-card transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_16%,transparent)]', size === 'lg' ? 'p-1.5 pl-4' : 'p-1 pl-3')}
      >
        <Search className={cn('shrink-0 text-fg-3', size === 'lg' ? 'size-5' : 'size-4')} aria-hidden />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(list.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(-1, a - 1))
            } else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={placeholder}
          aria-label="Search services"
          aria-autocomplete="list"
          aria-controls={showPanel ? `${id}-list` : undefined}
          aria-expanded={showPanel}
          role="combobox"
          className={cn('min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-3/80 [&::-webkit-search-cancel-button]:hidden', size === 'lg' ? 'h-11 text-[16px]' : 'h-9 text-[15px]')}
        />
        <button type="submit" className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-[var(--sf-r)] bg-accent font-semibold text-accent-fg transition-[filter] hover:brightness-110', size === 'lg' ? 'h-11 px-5 text-[15px]' : 'h-9 px-3.5 text-[14px]')}>
          Search
        </button>
      </form>

      {showPanel && (
        <div id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[var(--sf-r-lg)] border border-line bg-surface text-left shadow-pop">
          {results.isFetching && !list.length ? (
            <div className="flex items-center gap-2 px-4 py-4 text-[14px] text-fg-3">
              <Spinner className="size-4" /> Searching…
            </div>
          ) : !list.length ? (
            <div className="px-4 py-4 text-[14px] text-fg-3">No services match “{debounced}”. Try “blacklist”, “warranty” or a phone model.</div>
          ) : (
            <>
              {list.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(`/site/services/${s.slug}`)}
                  className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors', i === active ? 'bg-surface-2' : 'hover:bg-surface-2')}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[var(--sf-r-sm)] bg-accent/10 text-accent-ink">
                    <CategoryIcon name={s.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-fg">{s.name}</span>
                    <span className="block truncate text-[12.5px] text-fg-3">{s.available ? s.categoryName : 'Temporarily unavailable'}</span>
                  </span>
                  <Price value={s.price} unavailable={!s.available} className="text-[15px]" />
                </button>
              ))}
              <button type="button" onClick={() => go(`/site/search?q=${encodeURIComponent(debounced)}`)} className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-[13.5px] font-semibold text-accent-ink hover:bg-surface-2">
                See all results for “{debounced}”
                <ArrowRight className="size-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
