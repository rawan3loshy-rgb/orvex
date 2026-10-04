import { Hammer } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/ui'

export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} description="This screen is being built." />
      <div className="rounded-xl border border-dashed border-line-strong">
        <EmptyState icon={<Hammer />} title={`${title} — coming together`} description="Placeholder route." />
      </div>
    </div>
  )
}
