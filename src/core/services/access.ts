/**
 * Access control for admin actions.
 *
 * Sensitive commands declare the permission they need; the check runs inside
 * the command (not only in the UI), so every channel enforces it.
 */
import type { CoreContext } from '../ports'
import type { Actor, Permission } from '../domain'
import { forbidden } from '../errors'

export const PERMISSIONS: Record<Permission, { label: string; description: string; sensitive: boolean }> = {
  'orders.read': { label: 'View orders', description: 'Read orders, timelines and results.', sensitive: false },
  'orders.manage': { label: 'Manage orders', description: 'Create admin orders, cancel queued orders.', sensitive: false },
  'orders.review': { label: 'Resolve reviews', description: 'Resolve needs-review orders and verification requests.', sensitive: true },
  'refunds.create': { label: 'Issue refunds', description: 'Refund captured orders to wallet or original payment method.', sensitive: true },
  'accounts.manage': { label: 'Manage accounts', description: 'Create accounts, change tiers, credit limits, freeze/unfreeze.', sensitive: true },
  'ledger.adjust': { label: 'Manual ledger adjustment', description: 'Post goodwill credits and manual debits.', sensitive: true },
  'payments.manage': { label: 'Manage payments', description: 'Confirm bank transfers, configure payment methods.', sensitive: true },
  'catalog.manage': { label: 'Manage catalog', description: 'Services, revisions, offers and visibility.', sensitive: false },
  'pricing.manage': { label: 'Change pricing', description: 'Create and edit pricing rules and tiers.', sensitive: true },
  'suppliers.manage': { label: 'Manage suppliers', description: 'Connect suppliers, sync catalogs, maintenance, circuit reset.', sensitive: false },
  'suppliers.credentials': { label: 'Change supplier credentials', description: 'Replace stored supplier secrets.', sensitive: true },
  'storefront.manage': { label: 'Manage storefront', description: 'Pages, blocks, theme, navigation, publishing.', sensitive: false },
  'developer.manage': { label: 'Manage API & webhooks', description: 'API keys, webhook endpoints, DHRU compatibility.', sensitive: true },
  'roles.manage': { label: 'Change roles', description: 'Invite users, change roles and permissions.', sensitive: true },
  'system.manage': { label: 'System administration', description: 'Updates, license, settings, backups.', sensitive: true },
  'audit.read': { label: 'Read audit log', description: 'View the audit log.', sensitive: false },
}

export function permissionsOf(ctx: CoreContext, actor: Actor): Set<Permission | '*'> {
  if (actor.type !== 'admin') return new Set()
  const user = ctx.repo.users.get(actor.id)
  const role = user ? ctx.repo.roles.get(user.roleId) : undefined
  return new Set((role?.permissions ?? []) as (Permission | '*')[])
}

export function can(ctx: CoreContext, actor: Actor, perm: Permission): boolean {
  if (actor.type === 'system') return true
  const p = permissionsOf(ctx, actor)
  return p.has('*') || p.has(perm)
}

/** Throws 403 `permission_denied` unless the admin actor's role grants `perm`. */
export function requirePermission(ctx: CoreContext, actor: Actor, perm: Permission) {
  if (actor.type !== 'admin' && actor.type !== 'system') throw forbidden('permission_denied', `${PERMISSIONS[perm].label} is an operator-only action`, { permission: perm })
  if (!can(ctx, actor, perm)) {
    const user = ctx.repo.users.get(actor.id)
    const role = user ? ctx.repo.roles.get(user.roleId)?.name : 'Unknown'
    throw forbidden('permission_denied', `Requires “${PERMISSIONS[perm].label}” (${perm}). The ${role} role does not include it.`, { permission: perm, role })
  }
}
