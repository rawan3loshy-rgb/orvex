import { useStore } from '../lib/storeContext'
import { PageView } from './PageView'
import { NotFoundView } from './NotFoundPage'

export default function HomePage() {
  const { config } = useStore()
  const home = config.pages.find((p) => p.kind === 'home')
  if (!home) return <NotFoundView title="Welcome" body="The home page has not been published yet." />
  return <PageView page={home} />
}
