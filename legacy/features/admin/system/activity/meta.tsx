import type { LucideIcon } from 'lucide-react'
import { Boxes, Cpu, Globe, KeyRound, PlugZap, ReceiptText, Route, Server, ShieldCheck, Tags, UserRound, Users, Webhook, Workflow } from 'lucide-react'
import { Avatar, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types/common'
import type { AdminUser, AuditEntityType, AuditEntry, AuditSeverity } from '@/types/installation'

export const SEVERITY: Record<AuditSeverity, { label: string; tone: Tone }> = {
  info: { label: 'Info', tone: 'neutral' },
  notice: { label: 'Notice', tone: 'info' },
  warning: { label: 'Warning', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
}

export const ENTITY: Record<AuditEntityType, { label: string; icon: LucideIcon }> = {
  service: { label: 'Service', icon: Boxes },
  provider: { label: 'Provider', icon: PlugZap },
  mapping: { label: 'Mapping', icon: Workflow },
  routing_rule: { label: 'Routing rule', icon: Route },
  reseller: { label: 'Reseller', icon: Users },
  api_key: { label: 'API key', icon: KeyRound },
  webhook: { label: 'Webhook', icon: Webhook },
  pricing_group: { label: 'Pricing group', icon: Tags },
  order: { label: 'Order', icon: ReceiptText },
  user: { label: 'User', icon: UserRound },
  website: { label: 'Website', icon: Globe },
  system: { label: 'System', icon: Server },
  license: { label: 'License', icon: ShieldCheck },
}

/** Area of the admin each entity type lives in — used when the id is not a direct record link. */
const AREA: Record<AuditEntityType, { to: string; label: string }> = {
  service: { to: '/admin/services', label: 'Open services' },
  provider: { to: '/admin/providers', label: 'Open providers' },
  mapping: { to: '/admin/mappings', label: 'Open mappings' },
  routing_rule: { to: '/admin/routing', label: 'Open routing' },
  reseller: { to: '/admin/resellers', label: 'Open resellers' },
  api_key: { to: '/admin/developer/keys', label: 'Open API keys' },
  webhook: { to: '/admin/developer/webhooks', label: 'Open webhooks' },
  pricing_group: { to: '/admin/pricing', label: 'Open pricing' },
  order: { to: '/admin/orders', label: 'Open orders' },
  user: { to: '/admin/settings?tab=users', label: 'Open users' },
  website: { to: '/admin/website', label: 'Open website' },
  system: { to: '/admin/settings?tab=system', label: 'Open system settings' },
  license: { to: '/admin/system/license', label: 'Open license' },
}

/** Deep link to the affected record, or to its area of the admin. */
export function entityHref(e: AuditEntry['entity'], action?: string): { to: string; label: string } {
  if (e.id.startsWith('ord_')) return { to: `/admin/orders/${e.id}`, label: 'Open order' }
  if (e.id.startsWith('rsl_')) return { to: `/admin/resellers/${e.id}`, label: 'Open reseller' }
  if (e.id.startsWith('prv_')) return { to: `/admin/providers/${e.id}`, label: 'Open provider' }
  if (/^SVC-\d+$/.test(e.id)) return { to: `/admin/services/${e.id}`, label: 'Open service' }
  if (action?.startsWith('system.update') || action?.startsWith('system.backup')) return { to: '/admin/system/updates', label: 'Open Update Center' }
  if (action?.startsWith('extension.')) return { to: '/admin/system/extensions', label: 'Open extensions' }
  if (action?.startsWith('settings.')) {
    const tab = action.slice('settings.'.length).replace(/_updated$/, '')
    return { to: `/admin/settings?tab=${tab}`, label: 'Open settings' }
  }
  return AREA[e.type]
}

export function SeverityBadge({ severity, className }: { severity: AuditSeverity; className?: string }) {
  const m = SEVERITY[severity]
  return (
    <Badge tone={m.tone} dot={severity !== 'info'} pulse={severity === 'critical'} className={className}>
      {m.label}
    </Badge>
  )
}

export function ActorAvatar({ actor, users, size = 'md' }: { actor: AuditEntry['actor']; users?: AdminUser[]; size?: 'sm' | 'md' | 'lg' }) {
  if (actor.type !== 'user') {
    const Icon = actor.type === 'system' ? Cpu : KeyRound
    return (
      <span className={cn('grid shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2', size === 'sm' ? 'size-6 [&_svg]:size-3' : size === 'lg' ? 'size-10 [&_svg]:size-4.5' : 'size-8 [&_svg]:size-3.5')}>
        <Icon />
      </span>
    )
  }
  const u = users?.find((x) => x.id === actor.id || x.name === actor.name)
  return <Avatar name={actor.name} color={u?.color ?? 'var(--c6)'} size={size} />
}

export function EntityChip({ entity, className }: { entity: AuditEntry['entity']; className?: string }) {
  const m = ENTITY[entity.type]
  const Icon = m.icon
  return (
    <span className={cn('inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface-2/70 py-0.5 pr-1 pl-1.5 text-[12px]', className)}>
      <Icon className="size-3 shrink-0 text-fg-3" />
      <span className="truncate text-fg-2">{entity.label}</span>
      <span className="shrink-0 rounded bg-fg/[0.06] px-1 font-mono text-[9.5px] tracking-wide text-fg-3 uppercase">{m.label}</span>
    </span>
  )
}

/** "Today", "Yesterday", "Mon, 28 Sep" */
export function dayLabel(d: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(d)
  that.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - that.getTime()) / 86400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const wd = that.toLocaleDateString('en-US', { weekday: 'long' })
  const md = that.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: that.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
  return `${wd}, ${md}`
}

export const dayKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
