import { useState } from 'react'
import { ArrowUpRight, BookOpen } from 'lucide-react'
import type { WebhookEndpoint, WebhookEventType } from '@/types/installation'
import { Button, Card, CardHeader, CodeBlock, DemoTag } from '@/components/ui'
import { cn } from '@/lib/cn'
import { WEBHOOK_EVENTS, eventTone } from '../shared'

export function EventCatalog({ endpoints }: { endpoints: WebhookEndpoint[] }) {
  const [active, setActive] = useState<WebhookEventType>('order.completed')
  const ev = WEBHOOK_EVENTS.find((e) => e.id === active)!
  const subscribers = (id: WebhookEventType) => endpoints.filter((w) => w.events.includes(id) && w.status !== 'disabled').length

  return (
    <Card id="event-catalog" className="scroll-mt-20 overflow-hidden">
      <CardHeader
        icon={<BookOpen />}
        title="Event catalog"
        description="Every event shares the same envelope — id, type, created_at and data. Samples follow a MobileHub iPhone unlock (SVC-1007)."
        actions={
          <span className="flex items-center gap-2">
            <DemoTag />
            <Button size="sm" variant="ghost" to="/admin/developer/api#webhook-signatures" trailing={<ArrowUpRight />}>
              Signature docs
            </Button>
          </span>
        }
      />
      <div className="grid border-t border-line lg:grid-cols-[300px_minmax(0,1fr)]">
        <ul className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line p-2 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0">
          {WEBHOOK_EVENTS.map((e) => {
            const on = e.id === active
            const n = subscribers(e.id)
            return (
              <li key={e.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(e.id)}
                  className={cn('relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors', on ? 'bg-surface-3 text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg')}
                >
                  {on && <span className="absolute top-1/2 left-0 hidden h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent lg:block" />}
                  <span className="min-w-0">
                    <code className="flex items-center gap-1.5 font-mono text-[12px]">
                      <span className={cn('size-1.5 shrink-0 rounded-[2px]', eventTone(e.id))} />
                      {e.id}
                    </code>
                    <span className="hidden pl-3 text-[11.5px] text-fg-3 lg:block">{e.title}</span>
                  </span>
                  <span className={cn('hidden shrink-0 rounded-full px-1.5 text-[10.5px] tabular lg:inline', n ? 'bg-accent/10 text-accent-ink' : 'bg-fg/5 text-fg-3')}>{n}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="min-w-0 p-5">
          <div className="mb-3">
            <h4 className="font-mono text-[13.5px] font-medium text-fg">{ev.id}</h4>
            <p className="mt-1 text-[12.5px] text-fg-3">{ev.description}</p>
            <p className="mt-1 text-[12px] text-fg-3">
              {subscribers(ev.id)} enabled endpoint{subscribers(ev.id) === 1 ? '' : 's'} subscribed
            </p>
          </div>
          <CodeBlock title={`Payload example · ${ev.id}`} lang="json" code={JSON.stringify(ev.payload, null, 2)} maxHeight={360} />
        </div>
      </div>
    </Card>
  )
}
