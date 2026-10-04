/** Route smoke test — `node scripts/routes-smoke.mjs`. Calls every GET route (and a few commands) through the mock transport. */
import { createMockTransport } from '@/api/mockRouter'
import { createApiClient } from '@/api/client'
import type { StorefrontConfig, StorefrontEditorView, SyncRun } from '@/core/domain'
import { summarizeSyncRun } from '@/core/services/catalogSync'
import type { AccountRow, ConsoleResponse, Paginated, ServiceRow, SupplierDetail, SupplierView } from '@/types/installation'
import type { SyncChangeRow } from '@/services/installation'
import { createInstallationRoutes } from './routes'

export async function routesSmoke() {
  const api = createApiClient(createMockTransport(createInstallationRoutes(), { name: 'smoke', latency: [0, 0] }))
  const out: string[] = []
  const t0 = Date.now()
  const get = async (path: string, query?: object) => {
    const t = Date.now()
    try {
      const r = await api.get<unknown>(path, query)
      const size = JSON.stringify(r).length
      out.push(`✓ GET ${path}${query ? ` ${JSON.stringify(query)}` : ''} — ${(size / 1024).toFixed(1)} KB in ${Date.now() - t} ms`)
      return r as never
    } catch (e) {
      out.push(`✗ GET ${path} — ${(e as Error).message}`)
      return null as never
    }
  }
  const post = async (path: string, body?: unknown) => {
    try {
      const r = await api.post<unknown>(path, body)
      out.push(`✓ POST ${path}`)
      return r as never
    } catch (e) {
      out.push(`✗ POST ${path} — ${(e as Error).message}`)
      return null as never
    }
  }
  await get('/admin/cockpit')
  out.push(`  (first call includes seeding: ${Date.now() - t0} ms)`)
  const orders = await get('/admin/orders', { pageSize: 5 })
  await get('/admin/orders', { status: 'needs_review' })
  await get('/admin/orders/stats')
  const first = (orders as { items: { id: string; ref: string }[] } | null)?.items[0]
  if (first) await get(`/admin/orders/${first.ref}`)
  const c = (await get('/admin/orders', { scenario: 'C' })) as { items: { id: string }[] } | null
  await get('/admin/verifications')
  const accounts = (await get('/admin/accounts', { pageSize: 5 })) as { items: { account: { id: string } }[] } | null
  await get('/admin/accounts/acc_abcgsm')
  await get('/admin/accounts-summary')
  await get('/admin/categories')
  await get('/admin/services')
  await get('/admin/services/svc_4001')
  await get('/admin/pricing')
  await get('/admin/pricing/matrix')
  await get('/admin/drivers')
  await get('/admin/suppliers')
  await get('/admin/suppliers/sup_alpha')
  await get('/admin/sync/changes', { supplierId: 'sup_alpha', decision: 'pending' })
  await get('/admin/sync/runs')
  await get('/admin/products', { supplierId: 'sup_alpha' })
  await get('/admin/ledger/transactions', { pageSize: 5 })
  await get('/admin/ledger/accounts')
  await get('/admin/ledger/integrity')
  await get('/admin/finance/reconciliation')
  await get('/admin/finance/summary')
  await get('/admin/payment-methods')
  await get('/admin/payments', { pageSize: 5 })
  await get('/admin/refunds')
  await get('/admin/chargebacks')
  await get('/admin/api-keys')
  await get('/admin/api-logs', { pageSize: 5 })
  await get('/admin/api-logs/stats')
  await get('/admin/dhru')
  await get('/admin/webhooks')
  await get('/admin/webhook-deliveries', { pageSize: 5 })
  await get('/admin/inbound-webhooks', { pageSize: 5 })
  await get('/admin/notifications', { pageSize: 5 })
  await get('/admin/notifications/config')
  await get('/admin/audit', { pageSize: 5 })
  await get('/admin/me')
  await get('/admin/permissions')
  await get('/admin/users')
  await get('/admin/roles')
  await get('/admin/system/health')
  await get('/admin/system/installation')
  await get('/admin/system/license')
  await get('/admin/system/updates')
  await get('/admin/system/settings')
  await get('/admin/system/go-live')
  await get('/admin/storefront')
  await get('/admin/migration')
  await get('/portal/me')
  await get('/portal/dashboard')
  await get('/portal/services')
  await get('/portal/orders', { pageSize: 5 })
  await get('/portal/wallet')
  await get('/portal/statements')
  await get('/portal/api-keys')
  await get('/portal/webhooks')
  await get('/portal/members')
  await get('/store/config')
  await get('/store/search', { q: 'iPhone 15 unlock' })
  await post('/store/catalog', { query: { featured: true, limit: 6, sort: 'popular' } })
  await get('/store/services/iphone-15-carrier-check')
  await get('/demo/state')
  // Commands
  const co = (await post('/store/checkout', { serviceId: 'svc_4001', input: { imei: '356938035643809' }, email: 'smoke@mail.example', method: 'card', idempotencyKey: 'smoke-1' })) as { paymentIntentId: string; trackingToken: string } | null
  if (co) {
    await post(`/store/payments/${co.paymentIntentId}/complete`, { outcome: 'succeed' })
    await get(`/store/track/${co.trackingToken}`)
  }
  await post('/admin/console/native', { method: 'GET', path: '/v1/services', headers: { authorization: 'Bearer orx_live_a3c1_test' } })
  await post('/admin/console/dhru', { username: 'karim@abcgsm.example', apiaccesskey: 'orx_live_a3c1_x', action: 'accountinfo' })
  await post('/portal/orders', { serviceId: 'svc_4006', input: { imei: '490154203237518' }, idempotencyKey: 'smoke-portal-1' })
  await apiDirections(api, out, get, post)
  if (c?.items[0]) await post(`/admin/orders/${c.items[0].id}/review/lookup`)
  await post('/admin/services/svc_4001/price', { tierId: 'tier_retail', amount: 4_000_000, reason: 'smoke' })
  const svc = (await get('/store/services/iphone-15-carrier-check')) as { price: number } | null
  out.push(`  storefront price after change: ${svc ? svc.price / 1e6 : '—'}`)
  await storefrontPublishing(api, out, get)
  await post('/demo/act-as', { userId: 'usr_priya' })
  const denied = await post(`/admin/orders/${first?.id}/refund`, { amount: 1, destination: 'wallet', reason: 'smoke test', idempotencyKey: 'smoke-r' })
  out.push(`  refund as Support role → ${denied ? 'allowed (unexpected)' : 'denied (expected)'}`)
  void accounts
  out.push(`total ${Date.now() - t0} ms · ${out.filter((l) => l.startsWith('✗')).length} failures`)
  return out.join('\n')
}

/**
 * The two API directions through the real routes.
 *   Provider API (inbound)  — sync the demo provider, review + apply; connect a
 *                             new provider → test → sync discovers its catalog; map a product.
 *   Reseller API (outbound) — API clients are accounts with API access; their
 *                             service access is enforced on GET /v1/services.
 */
async function apiDirections(api: ReturnType<typeof createApiClient>, out: string[], get: <T>(path: string, query?: object) => Promise<T>, post: <T>(path: string, body?: unknown) => Promise<T>) {
  const check = (ok: boolean, label: string) => out.push(`${ok ? '✓' : '✗'} api: ${label}`)
  const patch = (path: string, body: unknown) => api.patch<unknown>(path, body).catch((e: Error) => out.push(`✗ PATCH ${path} — ${e.message}`))
  const available = (d: SupplierDetail | null) => d?.productList.filter((p) => p.status === 'available').length ?? -1

  /* Provider API — inbound */
  const services0 = (await get<ServiceRow[] | null>('/admin/services'))?.length ?? -1
  const sup = await get<SupplierDetail | null>('/admin/suppliers/sup_global')
  check(available(sup) === 100 && sup?.services === 22 && sup.supplier.connection.url === 'https://api.example-provider.test/v1', `Global GSM Provider connected: ${available(sup)} supplier products, mapped to ${sup?.services} ORVEX services`)
  const run = await post<SyncRun | null>('/admin/suppliers/sup_global/sync')
  const changes = run ? await get<SyncChangeRow[] | null>('/admin/sync/changes', { supplierId: 'sup_global', runId: run.id }) : null
  const sum = run && changes ? summarizeSyncRun(run, changes) : null
  check(!!sum && sum.remote === 101 && sum.unchanged === 95 && sum.added === 2 && sum.changed === 4 && sum.removed === 1, `Sync catalog → ${sum ? `${sum.remote} services: ${sum.unchanged} unchanged · ${sum.added} new · ${sum.changed} changed · ${sum.removed} removed` : 'failed'}`)
  await post('/admin/sync/changes/decide', { changeIds: (changes ?? []).filter((c) => c.decision === 'pending').map((c) => c.id), decision: 'applied' })
  const sup2 = await get<SupplierDetail | null>('/admin/suppliers/sup_global')
  const services1 = (await get<ServiceRow[] | null>('/admin/services'))?.length ?? -2
  check(available(sup2) === 101 && services1 === services0, `Apply sync → ${available(sup2)} supplier products; ORVEX services unchanged (${services1})`)
  const fresh = sup2?.productList.find((p) => p.externalId === '125')
  const offer = fresh ? await post<{ priority: number } | null>('/admin/services/svc_4008/offers', { supplierProductId: fresh.id, fieldMapping: { imei: 'imei' }, maxCost: null }) : null
  check(!!offer, `Map new product #125 → ORVEX service 4008 as offer P${offer?.priority ?? '?'}`)

  const created = await post<SupplierView | null>('/admin/suppliers', { name: 'Smoke Provider', driver: 'orvex_rest', url: 'https://api.smoke-provider.test/v1', username: null, credentials: [{ key: 'api_token', label: 'API key', value: 'smoke-secret-123' }] })
  const tested = created ? await post<{ ok: boolean } | null>(`/admin/suppliers/${created.supplier.id}/test`) : null
  const discovered = created ? await post<SyncRun | null>(`/admin/suppliers/${created.supplier.id}/sync`) : null
  check(!!tested?.ok && discovered?.remoteProducts === 100 && discovered.counts.new === 100, `Connect provider API → test ${tested?.ok ? 'OK' : 'failed'} → sync discovers ${discovered?.remoteProducts ?? 0} services to review`)

  /* Reseller API — outbound */
  const accounts = await get<Paginated<AccountRow> | null>('/admin/accounts', { kind: 'customer', pageSize: 200 })
  const clients = accounts?.items.filter((r) => r.account.channels.api || r.account.channels.dhru) ?? []
  check(clients.some((c) => c.account.id === 'acc_abcgsm'), `API clients: ${clients.length} accounts with Reseller API access (incl. ABC GSM)`)
  const list = async () => {
    const r = await post<ConsoleResponse | null>('/admin/console/native', { method: 'GET', path: '/v1/services', headers: { authorization: 'Bearer orx_live_a3c1_smoke' } })
    return r?.status === 200 ? ((r.body as { data: { id: string }[] }).data ?? []).map((x) => x.id) : null
  }
  const all = await list()
  const warranty = new Set(((await get<ServiceRow[] | null>('/admin/services', { categoryId: 'cat_warranty' })) ?? []).map((r) => r.service.code))
  await patch('/admin/accounts/acc_abcgsm', { patch: { serviceAccess: { mode: 'categories', categoryIds: ['cat_warranty'] } }, reason: 'smoke' })
  const restricted = await list()
  await patch('/admin/accounts/acc_abcgsm', { patch: { serviceAccess: { mode: 'all' } }, reason: 'smoke' })
  check(!!all && !!restricted && restricted.length > 0 && restricted.length < all.length && restricted.every((id) => warranty.has(id)), `Service access enforced on GET /v1/services: ${all?.length ?? '—'} → ${restricted?.length ?? '—'} (warranty only)`)
}

/**
 * Storefront Draft → Preview → Publish, end to end through the real routes:
 * edit the home headline, save the draft, check /site is unchanged, preview the
 * draft, publish, check /site shows the new headline — plus the refusals.
 */
async function storefrontPublishing(api: ReturnType<typeof createApiClient>, out: string[], get: <T>(path: string, query?: object) => Promise<T>) {
  const check = (ok: boolean, label: string) => out.push(`${ok ? '✓' : '✗'} storefront: ${label}`)
  const refused = async (call: () => Promise<unknown>, status: number) => {
    try {
      await call()
      return false
    } catch (e) {
      return (e as { status?: number }).status === status
    }
  }
  const headline = (cfg: StorefrontConfig | null) => {
    const hero = cfg?.pages.find((p) => p.kind === 'home')?.blocks.find((b) => b.type === 'hero')
    return hero?.type === 'hero' ? hero.title : undefined
  }
  const tokenOf = (v: StorefrontEditorView) => new URLSearchParams(v.publishing.previewPath.split('?')[1]).get('preview') ?? ''

  const live0 = await get<StorefrontConfig | null>('/store/config')
  const editor = await get<StorefrontEditorView | null>('/admin/storefront')
  const home = editor?.pages.find((p) => p.kind === 'home')
  if (!live0 || !editor || !home) return check(false, 'could not load storefront')
  const before = headline(live0)
  const NEW = `Smoke-test headline ${Date.now()}`
  check(live0.revision.status === 'published' && !live0.pages.some((p) => p.visibility === 'hidden'), `/site serves published v${live0.revision.version} without hidden pages`)

  await api.put(`/admin/storefront/draft/pages/${home.id}`, { ...home, blocks: home.blocks.map((b) => (b.type === 'hero' ? { ...b, title: NEW } : b)) })
  const live1 = await get<StorefrontConfig | null>('/store/config')
  check(headline(live1) === before && before !== NEW, 'Save draft leaves /site on the published headline')

  const token = tokenOf(editor)
  const preview = await get<StorefrontConfig | null>('/store/config', { preview: token })
  check(headline(preview) === NEW && preview?.revision.status === 'draft', `Preview renders the draft headline (draft v${preview?.revision.version})`)
  check(await refused(() => api.get('/store/config', { preview: 'forged-token' }), 403), 'a forged preview token is refused (403), not served published or draft')

  const ed2 = await get<StorefrontEditorView | null>('/admin/storefront')
  check(!!ed2?.publishing.hasUnpublishedChanges && ed2.publishing.pageStates[home.id] === 'changed', 'editor reports the home page as an unpublished change')
  check(await refused(() => api.post('/admin/storefront/publish', { expectedDraftUpdatedAt: '2000-01-01T00:00:00.000Z' }), 409), 'publishing a draft nobody reviewed (stale updatedAt) is refused')

  const published = await api.post<StorefrontEditorView>('/admin/storefront/publish', { expectedDraftUpdatedAt: ed2!.publishing.draft.updatedAt })
  const live2 = await get<StorefrontConfig | null>('/store/config')
  check(headline(live2) === NEW && live2?.revision.version === live0.revision.version + 1, `Publish: /site renders the new headline as v${live2?.revision.version}`)
  check(!published.publishing.hasUnpublishedChanges && published.publishing.history[0]?.version === live0.revision.version, `new draft forked clean; v${live0.revision.version} moved to history`)
  check(await refused(() => api.get('/store/config', { preview: token }), 403), 'the old preview link stops working after publish')
  check(await refused(() => api.post('/admin/storefront/publish', { expectedDraftUpdatedAt: published.publishing.draft.updatedAt }), 409), 'publishing an unchanged draft is refused')
  check(!JSON.stringify(live2?.pages).includes('"price"'), 'published content stores no prices (catalog stays live)')
}
