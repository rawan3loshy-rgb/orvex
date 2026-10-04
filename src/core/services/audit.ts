/** AuditService — every sensitive operation records who, what, target, when, from where and why. */
import type { CoreContext } from '../ports'
import type { Actor, AuditEvent, AuditSeverity, Permission } from '../domain'

const DEVICE: Record<Actor['type'], { ip: string; device: string }> = {
  admin: { ip: '10.0.4.18', device: 'Chrome 129 · macOS' },
  member: { ip: '81.92.144.21', device: 'Safari 18 · iPhone (portal)' },
  api_key: { ip: '203.0.113.41', device: 'API client' },
  guest: { ip: '172.58.12.9', device: 'Storefront checkout' },
  dhru: { ip: '198.51.100.77', device: 'DHRU-compatible client' },
  system: { ip: '127.0.0.1', device: 'core-worker' },
  supplier: { ip: '192.0.2.10', device: 'Supplier callback' },
  gateway: { ip: '192.0.2.200', device: 'Payment gateway webhook' },
}

export interface AuditInput {
  actor: Actor
  action: string
  target: AuditEvent['target']
  summary: string
  reason?: string | null
  severity?: AuditSeverity
  changes?: AuditEvent['changes']
  permission?: Permission | null
  at?: number
}

export function audit(ctx: CoreContext, a: AuditInput): AuditEvent {
  const where = DEVICE[a.actor.type]
  return ctx.repo.audit.insert({
    id: ctx.ids.id('aud'),
    at: ctx.clock.iso(a.at),
    actor: a.actor,
    action: a.action,
    target: a.target,
    summary: a.summary,
    reason: a.reason ?? null,
    ip: where.ip,
    device: where.device,
    severity: a.severity ?? 'info',
    changes: a.changes ?? [],
    permission: a.permission ?? null,
  })
}
