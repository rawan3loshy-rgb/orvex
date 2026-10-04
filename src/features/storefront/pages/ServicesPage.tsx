import { useStoreCatalog } from '@/hooks/installation'
import type { Category } from '@/types/installation'
import { useDocTitle, useStore } from '../lib/storeContext'
import { CatalogResults } from '../blocks/Blocks'
import { Container, Section, SectionHead } from '../ui'
import { SearchBox } from '../components/SearchBox'
import { CategoryChips } from './CategoryChips'
import { PageView } from './PageView'

/** /site/services — the "services" content page when configured, otherwise a live catalog listing. */
export default function ServicesPage() {
  const { config } = useStore()
  const page = config.pages.find((p) => p.slug === 'services')
  return (
    <>
      <div className="border-b border-line bg-bg-subtle">
        <Container className="grid gap-5 py-7 lg:grid-cols-[1fr_440px] lg:items-center">
          <CategoryChips allActive />
          <SearchBox size="md" placeholder="Search all services" />
        </Container>
      </div>
      {page ? <PageView page={page} /> : <FallbackListing />}
    </>
  )
}

function FallbackListing() {
  const { config } = useStore()
  useDocTitle('All services')
  const cats = [...config.categories].sort((a, b) => a.sort - b.sort)
  return (
    <>
      <Section className="pb-2 sm:pb-4">
        <SectionHead title="All services" subtitle="Every price below is calculated live from our catalog — it is exactly what you pay." className="mb-0 sm:mb-0" />
      </Section>
      {cats.map((c) => (
        <CategoryList key={c.id} cat={c} />
      ))}
    </>
  )
}

function CategoryList({ cat }: { cat: Category }) {
  const q = useStoreCatalog({ categoryId: cat.id, limit: 50, sort: 'popular' })
  return (
    <Section className="py-6 sm:py-8">
      <h2 className="sf-h mb-4 text-[22px] font-semibold">{cat.name}</h2>
      <CatalogResults query={q} layout="list" showPrices />
    </Section>
  )
}
