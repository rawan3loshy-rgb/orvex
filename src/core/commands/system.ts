/** System commands — admin users & roles, sessions, settings. Storefront publishing lives in ./storefront. */
import type { CoreContext } from '../ports'
import type { Actor, AdminUser, InstallationSettings } from '../domain'
import { conflict, invalid } from '../errors'
import { requirePermission } from '../services/access'
import { audit } from '../services/audit'

export function changeUserRole(ctx: CoreContext, p: { userId: string; roleId: string; actor: Actor; reason?: string }) {
  requirePermission(ctx, p.actor, 'roles.manage')
  const u = ctx.repo.users.require(p.userId)
  const role = ctx.repo.roles.require(p.roleId)
  if (u.id === p.actor.id && role.id !== 'role_owner' && u.roleId === 'role_owner') {
    const owners = ctx.repo.users.count((x) => x.roleId === 'role_owner' && x.status === 'active')
    if (owners <= 1) throw conflict('last_owner', 'The installation needs at least one Owner')
  }
  const from = ctx.repo.roles.get(u.roleId)?.name ?? u.roleId
  u.roleId = role.id
  audit(ctx, { actor: p.actor, action: 'role.changed', target: { type: 'user', id: u.id, label: u.name }, summary: `Changed role ${from} → ${role.name}`, reason: p.reason ?? null, severity: 'notice', permission: 'roles.manage', changes: [{ field: 'role', from, to: role.name }] })
  return u
}

export function inviteUser(ctx: CoreContext, p: { name: string; email: string; roleId: string; actor: Actor }): AdminUser {
  requirePermission(ctx, p.actor, 'roles.manage')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) throw invalid('Valid email required')
  if (ctx.repo.users.find((u) => u.email === p.email.toLowerCase())) throw conflict('duplicate_user', 'A user with this email already exists')
  ctx.repo.roles.require(p.roleId)
  const u = ctx.repo.users.insert({ id: ctx.ids.id('usr'), name: p.name || p.email, email: p.email.toLowerCase(), roleId: p.roleId, status: 'invited', mfa: false, lastActiveAt: null, createdAt: ctx.clock.iso(), color: 'var(--c6)', sessions: [] })
  audit(ctx, { actor: p.actor, action: 'user.invited', target: { type: 'user', id: u.id, label: u.email }, summary: `Invited ${u.email} as ${ctx.repo.roles.get(p.roleId)?.name}`, severity: 'notice', permission: 'roles.manage' })
  return u
}

export function revokeSession(ctx: CoreContext, p: { userId: string; sessionId: string; actor: Actor }) {
  if (p.actor.id !== p.userId) requirePermission(ctx, p.actor, 'roles.manage')
  const u = ctx.repo.users.require(p.userId)
  u.sessions = u.sessions.filter((s) => s.id !== p.sessionId)
  audit(ctx, { actor: p.actor, action: 'session.revoked', target: { type: 'user', id: u.id, label: u.name }, summary: 'Revoked a session', severity: 'notice' })
  return u
}

export function updateSettings<K extends keyof InstallationSettings>(ctx: CoreContext, settings: InstallationSettings, p: { section: K; patch: Partial<InstallationSettings[K]>; actor: Actor }) {
  requirePermission(ctx, p.actor, 'system.manage')
  const before = settings[p.section] as Record<string, unknown>
  const changes = Object.entries(p.patch).map(([k, v]) => ({ field: `${String(p.section)}.${k}`, from: JSON.stringify(before[k]), to: JSON.stringify(v) }))
  Object.assign(settings[p.section] as object, p.patch)
  audit(ctx, { actor: p.actor, action: 'settings.updated', target: { type: 'settings', id: String(p.section), label: String(p.section) }, summary: `Updated ${String(p.section)} settings`, severity: p.section === 'security' ? 'warning' : 'info', changes, permission: 'system.manage' })
  return settings
}
