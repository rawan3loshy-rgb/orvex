import type { StorefrontPage } from '@/types/installation'
import { useDocTitle } from '../lib/storeContext'
import { BlockRenderer } from '../blocks/Blocks'
import { Container, EmptyBlock, Pill } from '../ui'
import { FileText } from 'lucide-react'

/**
 * Renders a config page (typed blocks). Hidden pages only ever reach the renderer
 * in a draft preview (the published site never serves them), so they are flagged.
 */
export function PageView({ page }: { page: StorefrontPage }) {
  useDocTitle(page.seo.title || page.title)
  return (
    <>
      {page.visibility === 'hidden' && (
        <Container className="pt-4">
          <Pill tone="warning" dot>
            Hidden page — not reachable on the published site, even after publishing
          </Pill>
        </Container>
      )}
      {page.blocks.length ? (
        <BlockRenderer blocks={page.blocks} />
      ) : (
        <Container className="py-16">
          <EmptyBlock icon={<FileText />} title={page.title} body="This page has no content yet." />
        </Container>
      )}
    </>
  )
}
