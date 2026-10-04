import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useStore } from '../lib/storeContext'

/** Horizontal category navigation (scrolls on mobile). */
export function CategoryChips({ activeId, allActive }: { activeId?: string; allActive?: boolean }) {
  const { config, to } = useStore()
  const cats = [...config.categories].sort((a, b) => a.sort - b.sort)
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium whitespace-nowrap transition-colors',
      active ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg',
    )
  return (
    <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      <SfLink href={to('/site/services')} className={chip(!!allActive)} aria-current={allActive ? 'page' : undefined}>
        All services
      </SfLink>
      {cats.map((c) => (
        <SfLink key={c.id} href={to(`/site/c/${c.slug}`)} className={chip(c.id === activeId)} aria-current={c.id === activeId ? 'page' : undefined}>
          {c.name}
          <span className={cn('text-[12px]', c.id === activeId ? 'opacity-80' : 'text-fg-3')}>{c.services}</span>
        </SfLink>
      ))}
    </nav>
  )
}
