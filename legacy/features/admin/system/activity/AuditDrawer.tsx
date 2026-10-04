import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, GitCompareArrows, ScrollText } from 'lucide-react'
import { Button, CodeBlock, DescriptionList, Drawer, MonoValue } from '@/components/ui'
import { date, relative, time } from '@/lib/format'
import type { AdminUser, AuditEntry } from '@/types/installation'
import { ActorAvatar, EntityChip, SeverityBadge, entityHref } from './meta'

const ACTOR_KIND: Record<AuditEntry['actor']['type'], string> = { user: 'Admin session', system: 'System process', api: 'API key' }

export function AuditDrawer({ entry: current, onClose, users }: { entry: AuditEntry | null; onClose: () => void; users?: AdminUser[] }) {
  const [entry, setEntry] = useState(current)
  useEffect(() => {
    if (current) setEntry(current)
  }, [current])
  const user = entry && entry.actor.type === 'user' ? users?.find((u) => u.id === entry.actor.id || u.name === entry.actor.name) : undefined
  const href = entry ? entityHref(entry.entity, entry.action) : undefined

  return (
    <Drawer
      open={!!current}
      onClose={onClose}
      width="md"
      icon={<ScrollText />}
      title={entry?.summary}
      description={entry ? `${date(entry.at)} · ${time(entry.at, true)} · ${relative(entry.at)}` : undefined}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          {href && (
            <Button variant="primary" size="sm" to={href.to} trailing={<ArrowUpRight />}>
              {href.label}
            </Button>
          )}
        </>
      }
    >
      {entry && (
        <div className="space-y-6">
          {/* Actor */}
          <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface-2/40 p-4">
            <ActorAvatar actor={entry.actor} users={users} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-fg">{entry.actor.name}</p>
              <p className="truncate text-[12.5px] text-fg-3">
                {ACTOR_KIND[entry.actor.type]}
                {user ? ` · ${user.email}` : ''}
              </p>
            </div>
            <SeverityBadge severity={entry.severity} className="shrink-0" />
          </div>

          <section>
            <h3 className="mb-1 mono-label">Event</h3>
            <DescriptionList
              items={[
                { label: 'Action', value: <MonoValue value={entry.action} className="text-fg" /> },
                { label: 'Entity', value: <EntityChip entity={entry.entity} className="max-w-[260px]" /> },
                { label: 'Entity ID', value: <MonoValue value={entry.entity.id} className="text-fg" /> },
                { label: 'Actor ID', value: <span className="font-mono text-[12px]">{entry.actor.id}</span> },
                { label: 'IP address', value: <MonoValue value={entry.ip} className="text-fg" /> },
                { label: 'Timestamp', value: <span className="font-mono text-[12px]">{new Date(entry.at).toISOString()}</span> },
                { label: 'Event ID', value: <MonoValue value={entry.id} className="text-fg" /> },
              ]}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <GitCompareArrows className="size-3.5 text-fg-3" />
              <h3 className="mono-label">Changes</h3>
            </div>
            {entry.changes?.length ? (
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-3 border-b border-line bg-surface-2/60 px-3.5 py-2 text-[11px] font-medium text-fg-3">
                  <span>Field</span>
                  <span>Before</span>
                  <span />
                  <span>After</span>
                </div>
                {entry.changes.map((c) => (
                  <div key={c.field} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-0">
                    <span className="truncate font-mono text-[12px] text-fg-2" title={c.field}>
                      {c.field}
                    </span>
                    <span className="truncate rounded-md bg-danger/[0.07] px-2 py-1 font-mono text-[12px] text-danger line-through decoration-danger/40" title={c.from}>
                      {c.from}
                    </span>
                    <ArrowRight className="size-3.5 text-fg-3" />
                    <span className="truncate rounded-md bg-success/[0.08] px-2 py-1 font-mono text-[12px] text-success" title={c.to}>
                      {c.to}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-3.5 text-[12.5px] text-fg-3">No field-level changes were recorded for this action.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 mono-label">Raw event</h3>
            <CodeBlock lang="json" code={JSON.stringify(entry, null, 2)} maxHeight={260} />
          </section>
        </div>
      )}
    </Drawer>
  )
}
