import { Compass } from 'lucide-react'
import { useDocTitle, useStore } from '../lib/storeContext'
import { Btn, Container } from '../ui'
import { SearchBox } from '../components/SearchBox'

export function NotFoundView({ title = 'Page not found', body = 'The page you are looking for does not exist or is no longer available.' }: { title?: string; body?: string }) {
  const { to } = useStore()
  useDocTitle(title)
  return (
    <Container className="flex flex-col items-center py-20 text-center sm:py-28">
      <span className="grid size-14 place-items-center rounded-full bg-accent/10 text-accent-ink">
        <Compass className="size-6" />
      </span>
      <h1 className="sf-h mt-5 text-[32px] font-semibold sm:text-[40px]">{title}</h1>
      <p className="mt-3 max-w-md text-[16px] text-fg-3">{body}</p>
      <div className="mt-8 w-full max-w-lg">
        <SearchBox size="md" />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Btn href={to('/site')} variant="secondary">
          Back to home
        </Btn>
        <Btn href={to('/site/services')} variant="ghost">
          Browse all services
        </Btn>
      </div>
    </Container>
  )
}

export default function NotFoundPage() {
  return <NotFoundView />
}
