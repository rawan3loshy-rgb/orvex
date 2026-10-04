import { useState } from 'react'
import { useParams } from 'react-router'
import { ChevronRight, LayoutGrid, List } from 'lucide-react'
import { useStoreCatalog } from '@/hooks/installation'
import type { CatalogQuery } from '@/types/installation'
import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useDocTitle, useStore } from '../lib/storeContext'
import { CatalogResults } from '../blocks/Blocks'
import { Container, IconTile } from '../ui'
import { CategoryChips } from './CategoryChips'
import { NotFoundView } from './NotFoundPage'

const SORTS: { value: CatalogQuery['sort']; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'name', label: 'Name A–Z' },
]

export default function CategoryPage() {
  const { slug } = useParams()
  const { config, to } = useStore()
  const cat = config.categories.find((c) => c.slug === slug || c.id === slug)
  const [sort, setSort] = useState<CatalogQuery['sort']>('popular')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const q = useStoreCatalog({ categoryId: cat?.id, limit: 60, sort })
  useDocTitle(cat?.name)
  if (!cat) return <NotFoundView title="Category not found" />
  return (
    <>
      <div className="border-b border-line bg-bg-subtle">
        <Container className="py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13.5px] text-fg-3">
            <SfLink href={to('/site')} className="hover:text-fg">
              Home
            </SfLink>
            <ChevronRight className="size-3.5" />
            <SfLink href={to('/site/services')} className="hover:text-fg">
              Services
            </SfLink>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-fg-2" aria-current="page">
              {cat.name}
            </span>
          </nav>
          <div className="mt-5 flex items-start gap-4">
            <IconTile name={cat.icon} size="lg" />
            <div>
              <h1 className="sf-h text-[30px] leading-tight font-semibold sm:text-[38px]">{cat.name}</h1>
              <p className="mt-2 max-w-2xl text-[16px] text-fg-3">{cat.description}</p>
            </div>
          </div>
          <div className="mt-7">
            <CategoryChips activeId={cat.id} />
          </div>
        </Container>
      </div>
      <Container className="py-8 sm:py-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-fg-3">{q.data ? `${q.data.length} service${q.data.length === 1 ? '' : 's'} · live prices` : 'Loading services…'}</p>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="sf-sort">
              Sort by
            </label>
            <select id="sf-sort" value={sort} onChange={(e) => setSort(e.target.value as CatalogQuery['sort'])} className="h-10 rounded-[var(--sf-r)] border border-line-strong bg-surface px-3 text-[14px] font-medium text-fg outline-none focus:border-accent">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="flex rounded-[var(--sf-r)] border border-line-strong bg-surface p-0.5" role="group" aria-label="Layout">
              {(['grid', 'list'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayout(l)}
                  aria-pressed={layout === l}
                  aria-label={l === 'grid' ? 'Grid view' : 'List view'}
                  className={cn('grid size-9 place-items-center rounded-[calc(var(--sf-r)-2px)] transition-colors', layout === l ? 'bg-surface-2 text-fg' : 'text-fg-3 hover:text-fg')}
                >
                  {l === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <CatalogResults query={q} layout={layout} showPrices skeleton={6} />
      </Container>
    </>
  )
}
