import { Activity, ArrowRight, Bot, KeyRound, Pencil, ShieldOff, Tags, UserPlus, Wallet } from 'lucide-react'
import { useAudit } from '@/hooks/installation'
import type { AuditEntry, Reseller } from '@/types/installation'
import { Button, Card, CardBody, CardHeader, EmptyState, Skeleton, Timeline, type TimelineItem } from '@/components/ui'
import type { Tone } from '@/types/common'
import { dateTime, relative } from '@/lib/format'

const TONE: Record<AuditEntry['severity'], Tone> = { info: 'neutral', notice: 'info', warning: 'warning', critical: 'danger' }

function iconFor(a: AuditEntry) {
  if (a.actor.type === 'system') return <Bot />
  if (a.action.includes('balance')) return <Wallet />
  if (a.action.includes('suspend')) return <ShieldOff />
  if (a.action.startsWith('api_key')) return <KeyRound />
  if (a.action.startsWith('pricing')) return <Tags />
  if (a.action.includes('created')) return <UserPlus />
  return <Pencil />
}

export function ActivityTab({ reseller }: { reseller: Reseller }) {
  const audit = useAudit({ search: reseller.name, pageSize: 40 })
  const items: TimelineItem[] = (audit.data?.items ?? []).map((a) => ({
    id: a.id,
    tone: TONE[a.severity],
    icon: iconFor(a),
    title: a.summary,
    time: <span title={dateTime(a.at)}>{relative(a.at)}</span>,
    detail: (
      <div className="space-y-1.5">
        <div>
          <span className="text-fg-2">{a.actor.name}</span>
          <span className="mx-1.5 text-fg-3/60">·</span>
          <code className="font-mono text-[11.5px]">{a.action}</code>
          <span className="mx-1.5 text-fg-3/60">·</span>
          {a.entity.label}
        </div>
        {a.changes?.map((c) => (
          <div key={c.field} className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface-2/60 px-2 py-1 font-mono text-[11.5px]">
            <span className="text-fg-3">{c.field}</span>
            <span className="text-danger/80 line-through decoration-danger/40">{c.from}</span>
            <ArrowRight className="size-3 text-fg-3" />
            <span className="text-success">{c.to}</span>
          </div>
        ))}
      </div>
    ),
  }))

  return (
    <Card>
      <CardHeader
        icon={<Activity />}
        title="Activity"
        description={`Audit trail for ${reseller.name} — top-ups, pricing group moves, API keys, service access and status changes.`}
        actions={
          <Button size="sm" variant="ghost" to="/admin/system/activity">
            Full audit log
          </Button>
        }
      />
      <CardBody>
        {audit.isLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-3.5">
                <Skeleton className="size-[27px] rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-72" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState compact icon={<Activity />} title="No recorded activity" description="Balance top-ups, status changes, API key events, allowed-service edits and profile changes will appear here." />
        ) : (
          <Timeline items={items} />
        )}
      </CardBody>
    </Card>
  )
}
