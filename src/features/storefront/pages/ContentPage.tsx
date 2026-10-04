import { useParams } from 'react-router'
import { useStore } from '../lib/storeContext'
import { PageView } from './PageView'
import { NotFoundView } from './NotFoundPage'

export default function ContentPage() {
  const { slug = '' } = useParams()
  const { config } = useStore()
  const page = config.pages.find((p) => p.slug === slug && p.kind !== 'home')
  if (!page) return <NotFoundView />
  return <PageView page={page} />
}
