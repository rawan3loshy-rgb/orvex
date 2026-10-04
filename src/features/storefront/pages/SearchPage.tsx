import { useSearchParams } from 'react-router'
import { SearchX } from 'lucide-react'
import { useStoreSearch } from '@/hooks/installation'
import { SfLink } from '../lib/store'
import { useDocTitle, useStore } from '../lib/storeContext'
import { CardGridSkeleton, Container, EmptyBlock, ErrorState, ServiceCard } from '../ui'
import { SearchBox } from '../components/SearchBox'

const SUGGESTIONS = ['iPhone 15 unlock', 'blacklist', 'warranty', 'Samsung', 'activation lock status', 'T-Mobile']

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const { to } = useStore()
  const res = useStoreSearch(q)
  useDocTitle(q ? `Search: ${q}` : 'Search')
  const list = q.length >= 2 ? (res.data ?? []) : []
  return (
    <>
      <div className="border-b border-line bg-bg-subtle">
        <Container className="py-8 sm:py-12">
          <h1 className="sf-h text-[28px] font-semibold sm:text-[36px]">{q ? <>Results for “{q}”</> : 'Search services'}</h1>
          <div className="mt-5 max-w-2xl">
            <SearchBox key={q} initial={q} size="lg" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13.5px]">
            <span className="text-fg-3">Popular:</span>
            {SUGGESTIONS.map((s) => (
              <SfLink key={s} href={to(`/site/search?q=${encodeURIComponent(s)}`)} className="rounded-full border border-line bg-surface px-3 py-1 font-medium text-fg-2 hover:border-line-strong hover:text-fg">
                {s}
              </SfLink>
            ))}
          </div>
        </Container>
      </div>
      <Container className="py-8 sm:py-12">
        {q.length < 2 ? (
          <EmptyBlock title="What do you need to check?" body="Search by phone model, carrier or service — for example “iPhone 15 unlock” or “blacklist”." />
        ) : res.isLoading ? (
          <CardGridSkeleton count={6} />
        ) : res.isError ? (
          <ErrorState title="Search failed" message={res.error?.message} onRetry={() => void res.refetch()} />
        ) : !list.length ? (
          <EmptyBlock
            icon={<SearchX />}
            title={`No services match “${q}”`}
            body="Check the spelling, try a broader term, or browse all services."
            action={
              <SfLink href={to('/site/services')} className="font-semibold text-accent-ink hover:underline">
                Browse all services
              </SfLink>
            }
          />
        ) : (
          <>
            <p className="mb-5 text-[14px] text-fg-3">
              {list.length} result{list.length === 1 ? '' : 's'} · prices shown live
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <ServiceCard key={s.id} card={s} />
              ))}
            </div>
          </>
        )}
      </Container>
    </>
  )
}
