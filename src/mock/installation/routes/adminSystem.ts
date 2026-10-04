/** Admin API — identity, users & roles, health, installation, license, updates, settings, go-live, storefront admin, DHRU migration. */
import type { MockRoute } from '@/api/mockRouter'
import { can, permissionsOf, PERMISSIONS, requirePermission } from '@/core/services/access'
import { conflict, notFound } from '@/core/errors'
import { audit } from '@/core/services/audit'
import { changeUserRole, inviteUser, revokeSession, updateSettings } from '@/core/commands/system'
import { deleteDraftPage, discardStorefrontDraft, publishStorefront, saveDraftPage, updateStorefrontDraft, updateStorefrontSettings } from '@/core/commands/storefront'
import { editorView, resolvePublished } from '@/core/services/storefront'
import { supplierHealth } from '@/core/services/supplier'
import type { GoLiveItem, HealthComponent, InstallationSettings, StorefrontPage } from '@/core/domain'
import type { InstalledExtension } from '@/types/extensions'
import type { AdminMe, HealthView } from '@/types/installation'
import { adminActor, type Runtime } from '../runtime'
import { buildMigrationSource } from '../data/dhruImport'
import { apiLogStats } from './adminFinanceDev'
import { DAY, r, ts, type BodyFor, type CommandParams } from './util'

function health(rt: Runtime): HealthView {
  const { repo, ctx } = rt
  const now = ctx.clock.now()
  const sups = repo.suppliers.all().map((s) => supplierHealth(ctx, s))
  const healthy = sups.filter((h) => h === 'healthy').length
  const api = apiLogStats(rt)
  const jobs = rt.scheduler.pending()
  const due = jobs.filter((j) => j.dueAt <= now + 1000).length
  const byKind: Record<string, number> = {}
  for (const j of jobs) byKind[j.kind] = (byKind[j.kind] ?? 0) + 1
  const failingHooks = repo.webhookEndpoints.count((w) => w.status === 'failing')
  const lic = rt.system.license
  const components: HealthComponent[] = [
    { id: 'api', name: 'core-api', status: 'healthy', summary: 'Admin, portal, storefront, native API and DHRU endpoint', metric: `p50 ${api.p50} ms`, href: '/admin/developer/logs' },
    { id: 'worker', name: 'core-worker', status: due > 50 ? 'degraded' : 'healthy', summary: 'Order routing, supplier attempts, webhook retries', metric: `${jobs.length} jobs queued · ${due} due`, href: '/admin/system/health#jobs' },
    { id: 'db', name: 'PostgreSQL 16.4', status: 'healthy', summary: 'Single source of truth — orders, ledger, catalog', metric: `${rt.system.installation.database.latencyMs} ms · ${rt.system.installation.database.pool.active}/${rt.system.installation.database.pool.max} conns`, href: '/admin/system/installation' },
    { id: 'suppliers', name: 'Suppliers', status: healthy === sups.length ? 'healthy' : healthy >= sups.length / 2 ? 'attention' : 'degraded', summary: `${healthy} of ${sups.length} healthy`, metric: `${sups.length - healthy} need attention`, href: '/admin/suppliers' },
    { id: 'native', name: 'Native API v1', status: api.errorRate > 5 ? 'degraded' : 'healthy', summary: `${api.byProtocol.native} requests in 24 h`, metric: `${api.errorRate}% errors`, href: '/admin/developer/logs?protocol=native' },
    { id: 'dhru', name: 'DHRU-compatible endpoint', status: rt.system.settings.api.dhruCompatEnabled ? 'healthy' : 'attention', summary: `${api.byProtocol.dhru} requests in 24 h`, metric: rt.system.settings.api.dhruCompatEnabled ? 'Enabled' : 'Disabled', href: '/admin/developer/dhru' },
    { id: 'webhooks', name: 'Webhooks', status: failingHooks ? 'attention' : 'healthy', summary: 'Signed outbound deliveries (Standard Webhooks)', metric: failingHooks ? `${failingHooks} endpoint failing` : 'All endpoints delivering', href: '/admin/developer/webhooks' },
    { id: 'payments', name: 'Payment gateways', status: 'healthy', summary: 'Demo Card Gateway · Demo PayPal — simulated', metric: `${repo.paymentMethods.count((m) => m.enabled)} methods enabled`, href: '/admin/finance/payments' },
    { id: 'license', name: 'License', status: lic.status === 'active' ? 'healthy' : 'attention', summary: lic.status === 'active' ? `${lic.plan} · updates until ${lic.updatesUntil.slice(0, 10)}` : 'Update entitlement expired — operations continue', metric: lic.validation.mode, href: '/admin/system/license' },
    { id: 'backups', name: 'Backups', status: 'healthy', summary: 'Nightly pg_dump + pre-update snapshots', metric: `last ${Math.round((now - ts(rt.system.installation.database.lastBackupAt)) / 3600_000)} h ago`, href: '/admin/system/updates' },
  ]
  const overall = components.some((c) => c.status === 'down') ? 'down' : components.some((c) => c.status === 'degraded') ? 'degraded' : components.some((c) => c.status === 'attention') ? 'attention' : 'healthy'
  return { checkedAt: ctx.clock.iso(), overall, components, queue: { pending: jobs.length, due, byKind }, incidents: rt.system.incidents }
}

function goLive(rt: Runtime): GoLiveItem[] {
  const { repo } = rt
  const sys = rt.system
  const owner = repo.users.find((u) => u.roleId === 'role_owner' && u.status === 'active')
  const live = resolvePublished(repo.storefront.get())
  const items: GoLiveItem[] = [
    { id: 'db', label: 'PostgreSQL', detail: `${sys.installation.database.version} · ${sys.installation.database.provider}`, done: sys.installation.database.status === 'connected', href: '/admin/system/installation' },
    { id: 'owner', label: 'Owner account', detail: owner ? `${owner.name} (${owner.email})` : 'Create the owner account', done: !!owner, href: '/admin/system/roles' },
    { id: 'mfa', label: 'MFA', detail: sys.settings.security.enforceMfa ? 'Enforced for all admin users' : 'Not enforced', done: sys.settings.security.enforceMfa && !!owner?.mfa, href: '/admin/system/security' },
    { id: 'license', label: 'License', detail: `${sys.license.licenseId} · ${sys.license.plan} · ${sys.license.status}`, done: sys.license.status !== 'invalid', href: '/admin/system/license' },
    { id: 'supplier', label: 'Supplier connected', detail: `${repo.suppliers.count((s) => s.auth.status === 'ok')} of ${repo.suppliers.count()} authenticated (simulated connections)`, done: repo.suppliers.count((s) => s.auth.status === 'ok') > 0, href: '/admin/suppliers' },
    { id: 'sync', label: 'Catalog synced', detail: `${repo.syncRuns.count((x) => x.status !== 'failed')} successful syncs`, done: repo.syncRuns.count((x) => x.status !== 'failed') > 0, href: '/admin/catalog/sync' },
    { id: 'services', label: 'Services configured', detail: `${repo.services.count((s) => s.status === 'active')} active services with offers`, done: repo.services.count((s) => s.status === 'active') > 0, href: '/admin/services' },
    { id: 'pricing', label: 'Pricing configured', detail: `${repo.rules.count()} rules across ${repo.tiers.count()} tiers`, done: repo.rules.count((x) => x.tierId === 'tier_retail') > 0, href: '/admin/pricing' },
    { id: 'storefront', label: 'Storefront configured', detail: `v${live.revision.version} live · ${live.pages.length} public pages on ${live.domain.primary}`, done: live.pages.some((p) => p.kind === 'home'), href: '/admin/storefront' },
    { id: 'payments', label: 'Payment configured', detail: repo.paymentMethods.filter((m) => m.enabled && m.customerFacing).map((m) => m.name).join(', ') + ' (simulated gateways)', done: repo.paymentMethods.count((m) => m.enabled && m.customerFacing) > 0, href: '/admin/finance/payments' },
    { id: 'email', label: 'Email configured', detail: `${sys.settings.email.fromAddress} via ${sys.settings.email.provider}`, done: sys.settings.email.verified, href: '/admin/system/notifications' },
    { id: 'test', label: 'Sandbox test order', detail: repo.orders.find((o) => o.channel === 'admin' && o.status === 'completed') ? 'Admin test order completed end-to-end' : 'Place an admin test order', done: !!repo.orders.find((o) => o.channel === 'admin' && o.status === 'completed'), href: '/admin/orders' },
  ]
  items.push({ id: 'ready', label: 'Ready for Go Live', detail: items.every((i) => i.done) ? 'All checks passed' : `${items.filter((i) => !i.done).length} item(s) open`, done: items.every((i) => i.done), href: '/admin/system/installation#go-live' })
  return items
}

export const adminSystemRoutes: MockRoute[] = [
  r('GET', '/admin/me', (rt): AdminMe => {
    const actor = adminActor(rt)
    const u = rt.repo.users.require(actor.id)
    const perms = permissionsOf(rt.ctx, actor)
    return { userId: u.id, name: u.name, email: u.email, role: actor.role ?? '', permissions: perms.has('*') ? Object.keys(PERMISSIONS) : [...perms] as string[] }
  }),
  r('GET', '/admin/permissions', () => PERMISSIONS),
  r('GET', '/admin/users', (rt) => rt.repo.users.all().map((u) => ({ ...u, roleName: rt.repo.roles.get(u.roleId)?.name ?? u.roleId }))),
  r('GET', '/admin/roles', (rt) => rt.repo.roles.all().map((x) => ({ ...x, users: rt.repo.users.count((u) => u.roleId === x.id) }))),
  r<BodyFor<typeof inviteUser>>('POST', '/admin/users', (rt, { body }) => inviteUser(rt.ctx, { ...body, actor: adminActor(rt) })),
  r<BodyFor<typeof changeUserRole, 'userId'>>('POST', '/admin/users/:id/role', (rt, { params, body }) => changeUserRole(rt.ctx, { userId: params.id!, roleId: body.roleId, reason: body.reason, actor: adminActor(rt) })),
  r('POST', '/admin/users/:id/sessions/:sid/revoke', (rt, { params }) => revokeSession(rt.ctx, { userId: params.id!, sessionId: params.sid!, actor: adminActor(rt) })),

  r('GET', '/admin/system/health', (rt) => health(rt)),
  r('GET', '/admin/system/installation', (rt) => rt.system.installation),
  r('GET', '/admin/system/license', (rt) => rt.system.license),
  r('POST', '/admin/system/license/validate', (rt) => {
    requirePermission(rt.ctx, adminActor(rt), 'system.manage')
    const v = rt.system.license.validation
    v.lastValidatedAt = rt.clock.iso()
    v.nextValidationAt = rt.clock.iso(rt.clock.now() + DAY)
    v.mode = 'online'
    audit(rt.ctx, { actor: adminActor(rt), action: 'license.validated', target: { type: 'license', id: rt.system.license.licenseId, label: rt.system.license.licenseId }, summary: 'License validated online (simulated license server)', permission: 'system.manage' })
    return rt.system.license
  }),
  r('GET', '/admin/system/updates', (rt) => {
    const u = rt.system.updates
    const lic = rt.system.license
    const blocked = lic.status === 'updates_expired'
    return { ...u, entitlement: { status: lic.status, updatesUntil: lic.updatesUntil, blocked, message: blocked ? `Update entitlement ended ${lic.updatesUntil.slice(0, 10)}. ${u.currentVersion} keeps running — renew to install ${u.available?.version ?? 'new releases'}.` : `Updates included until ${lic.updatesUntil.slice(0, 10)}` } }
  }),
  r('POST', '/admin/system/updates/check', (rt) => {
    rt.system.updates.lastCheckedAt = rt.clock.iso()
    return rt.system.updates
  }),
  r<{ version: string; durationSec?: number }>('POST', '/admin/system/updates/complete', (rt, { body }) => {
    const actor = adminActor(rt)
    requirePermission(rt.ctx, actor, 'system.manage')
    if (rt.system.license.status === 'updates_expired') throw conflict('updates_expired', `Update entitlement ended ${rt.system.license.updatesUntil.slice(0, 10)} — renew to install new releases. The current version keeps running.`)
    const u = rt.system.updates
    const from = u.currentVersion
    u.history.unshift({ version: body.version, installedAt: rt.clock.iso(), durationSec: body.durationSec ?? 160, by: actor.name, status: 'success', backupId: `bkp_pre_${body.version}` })
    u.backups.unshift({ id: `bkp_pre_${body.version}`, createdAt: rt.clock.iso(rt.clock.now() - 140_000), sizeMb: 1291, version: from, kind: 'pre-update' })
    u.currentVersion = body.version
    u.schemaVersion = '022'
    u.migrationStatus = { applied: '022', pending: [], strategy: u.migrationStatus.strategy }
    u.available = null
    rt.system.installation.version = body.version
    rt.system.installation.schemaVersion = '022'
    // Extensions that declared they are not compatible with the new release are disabled, never left half-working.
    const disabled = rt.system.installation.extensions.filter((x) => x.status === 'enabled' && !x.compatibleWithNext)
    for (const x of disabled) {
      x.status = 'disabled'
      x.compatibleWithNext = true
      audit(rt.ctx, { actor, action: 'extension.disabled', target: { type: 'extension', id: x.id, label: x.name }, summary: `Disabled ${x.name} — not compatible with ${body.version}`, severity: 'warning', permission: 'system.manage', changes: [{ field: 'status', from: 'enabled', to: 'disabled' }] })
    }
    rt.system.installation.runtime.containers = rt.system.installation.runtime.containers.map((c) => (c.image.includes('core:') ? { ...c, image: `registry.orvex.io/core:${body.version}`, uptime: '0d 0h' } : c))
    audit(rt.ctx, { actor, action: 'system.updated', target: { type: 'system', id: 'core', label: `ORVEX Core ${from} → ${body.version}` }, summary: `Updated ${from} → ${body.version} (backup, expand migrations, worker drain, container swap, health check)`, severity: 'notice', permission: 'system.manage' })
    return u
  }),
  r('GET', '/admin/system/settings', (rt) => rt.system.settings),
  r<Partial<InstallationSettings[keyof InstallationSettings]>>('PATCH', '/admin/system/settings/:section', (rt, { params, body }) => updateSettings(rt.ctx, rt.system.settings, { section: params.section as 'general', patch: body as Record<string, never>, actor: adminActor(rt) })),
  r('GET', '/admin/system/go-live', (rt) => goLive(rt)),
  r<Partial<InstalledExtension>>('PATCH', '/admin/system/extensions/:id', (rt, { params, body }) => {
    const actor = adminActor(rt)
    requirePermission(rt.ctx, actor, 'system.manage')
    const ext = rt.system.installation.extensions.find((e) => e.id === params.id)
    if (!ext) throw notFound('Extension', params.id!)
    Object.assign(ext, body)
    audit(rt.ctx, { actor, action: 'extension.updated', target: { type: 'extension', id: ext.id, label: ext.name }, summary: `${ext.name}: ${body.status ?? 'updated'}`, permission: 'system.manage' })
    return ext
  }),

  /* Storefront admin — edits go to the DRAFT revision; publish promotes it. */
  r('GET', '/admin/storefront', (rt) => {
    const view = editorView(rt.repo.storefront.get())
    // The preview token unlocks unpublished content — only for people who may manage the storefront.
    if (!can(rt.ctx, adminActor(rt), 'storefront.manage')) view.publishing.previewPath = ''
    return view
  }),
  r<CommandParams<typeof updateStorefrontDraft>['patch']>('PATCH', '/admin/storefront/draft', (rt, { body }) => updateStorefrontDraft(rt.ctx, { patch: body, actor: adminActor(rt) })),
  r<Omit<StorefrontPage, 'id'>>('PUT', '/admin/storefront/draft/pages/:id', (rt, { params, body }) => saveDraftPage(rt.ctx, { page: { ...body, id: params.id! }, actor: adminActor(rt) })),
  r<Omit<StorefrontPage, 'id'>>('POST', '/admin/storefront/draft/pages', (rt, { body }) => saveDraftPage(rt.ctx, { page: { ...body, id: rt.ctx.ids.id('pg') }, actor: adminActor(rt) })),
  r('DELETE', '/admin/storefront/draft/pages/:id', (rt, { params }) => {
    deleteDraftPage(rt.ctx, { pageId: params.id!, actor: adminActor(rt) })
    return { ok: true }
  }),
  r('POST', '/admin/storefront/draft/discard', (rt) => discardStorefrontDraft(rt.ctx, { actor: adminActor(rt) })),
  r<BodyFor<typeof publishStorefront> | undefined>('POST', '/admin/storefront/publish', (rt, { body }) => publishStorefront(rt.ctx, { actor: adminActor(rt), expectedDraftUpdatedAt: body?.expectedDraftUpdatedAt })),
  r<CommandParams<typeof updateStorefrontSettings>['patch']>('PATCH', '/admin/storefront/settings', (rt, { body }) => updateStorefrontSettings(rt.ctx, { patch: body, actor: adminActor(rt) })),

  /* DHRU migration importer (simulation) */
  r('GET', '/admin/migration', (rt) => buildMigrationSource(rt.seededAt || rt.clock.now())),
  r<{ step: string }>('POST', '/admin/migration/run', (rt, { body }) => {
    const actor = adminActor(rt)
    requirePermission(rt.ctx, actor, 'system.manage')
    audit(rt.ctx, { actor, action: `migration.${body.step}`, target: { type: 'migration', id: 'dhru', label: 'DHRU Fusion import (simulated)' }, summary: `DHRU import — ${body.step} step simulated (no external data imported)`, severity: 'info', permission: 'system.manage' })
    return { ok: true, step: body.step, at: rt.clock.iso() }
  }),
]
