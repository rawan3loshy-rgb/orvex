/** DEMO DATA — admin users & roles, payment methods, notification routing, webhooks, API keys. */
import { usd } from '@/core/money'
import type { AdminUser, ApiKey, NotificationChannelConfig, NotificationRoute, PaymentMethodConfig, Role, WebhookEndpoint } from '@/core/domain'
import { displayHash } from '@/core/commands/developer'

export const ROLES: Role[] = [
  { id: 'role_owner', name: 'Owner', description: 'Everything, including roles, license and system administration.', permissions: ['*'], system: true },
  { id: 'role_admin', name: 'Admin', description: 'Everything except role management and system administration.', permissions: ['orders.read', 'orders.manage', 'orders.review', 'refunds.create', 'accounts.manage', 'ledger.adjust', 'payments.manage', 'catalog.manage', 'pricing.manage', 'suppliers.manage', 'suppliers.credentials', 'storefront.manage', 'developer.manage', 'audit.read'], system: true },
  { id: 'role_ops', name: 'Operations', description: 'Day-to-day order flow: reviews, suppliers, catalog. No money movements or pricing.', permissions: ['orders.read', 'orders.manage', 'orders.review', 'catalog.manage', 'suppliers.manage', 'audit.read'], system: false },
  { id: 'role_finance', name: 'Finance', description: 'Refunds, payments, ledger adjustments and pricing. Read-only elsewhere.', permissions: ['orders.read', 'refunds.create', 'ledger.adjust', 'payments.manage', 'pricing.manage', 'accounts.manage', 'audit.read'], system: false },
  { id: 'role_support', name: 'Support', description: 'Customer support: read orders, open and recheck verification requests.', permissions: ['orders.read', 'audit.read'], system: false },
  { id: 'role_viewer', name: 'Viewer', description: 'Read-only access to every screen.', permissions: ['orders.read'], system: false },
]

export function buildUsers(now: number): AdminUser[] {
  const ago = (h: number) => new Date(now - h * 3600_000).toISOString()
  const session = (id: string, device: string, ip: string, location: string, h: number, current = false) => ({ id, device, ip, location, createdAt: ago(h + 20), lastSeenAt: ago(h), current })
  return [
    { id: 'usr_alex', name: 'Alex Morgan', email: 'alex@unlockdesk-demo.com', roleId: 'role_owner', status: 'active', mfa: true, lastActiveAt: ago(0), createdAt: ago(410 * 24), color: 'var(--c1)', sessions: [session('ses_1', 'Chrome 129 · macOS', '10.0.4.18', 'Dubai, AE', 0, true), session('ses_2', 'Safari · iPhone', '94.200.11.7', 'Dubai, AE', 9)] },
    { id: 'usr_sarah', name: 'Sarah Chen', email: 'sarah@unlockdesk-demo.com', roleId: 'role_admin', status: 'active', mfa: true, lastActiveAt: ago(0.3), createdAt: ago(380 * 24), color: 'var(--c2)', sessions: [session('ses_3', 'Firefox 131 · Windows', '10.0.4.22', 'Dubai, AE', 0.3)] },
    { id: 'usr_daniel', name: 'Daniel Okafor', email: 'daniel@unlockdesk-demo.com', roleId: 'role_ops', status: 'active', mfa: true, lastActiveAt: ago(1.2), createdAt: ago(260 * 24), color: 'var(--c4)', sessions: [session('ses_4', 'Chrome 129 · Windows', '10.0.4.31', 'Lagos, NG', 1.2)] },
    { id: 'usr_omar', name: 'Omar Haddad', email: 'omar@unlockdesk-demo.com', roleId: 'role_finance', status: 'active', mfa: true, lastActiveAt: ago(5), createdAt: ago(120 * 24), color: 'var(--c5)', sessions: [session('ses_5', 'Edge 129 · Windows', '10.0.4.40', 'Dubai, AE', 5)] },
    { id: 'usr_priya', name: 'Priya Raman', email: 'priya@unlockdesk-demo.com', roleId: 'role_support', status: 'active', mfa: false, lastActiveAt: ago(2), createdAt: ago(60 * 24), color: 'var(--c3)', sessions: [session('ses_6', 'Chrome 129 · ChromeOS', '10.0.4.55', 'Chennai, IN', 2)] },
    { id: 'usr_lucas', name: 'Lucas Meyer', email: 'lucas@unlockdesk-demo.com', roleId: 'role_viewer', status: 'invited', mfa: false, lastActiveAt: null, createdAt: ago(30), color: 'var(--c6)', sessions: [] },
  ]
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'card', name: 'Card', gateway: 'Demo Card Gateway', enabled: true, mode: 'simulated', fee: { bps: 290, fixed: usd(0.3) }, settlement: 'instant', customerFacing: true, instructions: 'Visa, Mastercard, Amex — 3-D Secure handled by the gateway.' },
  { id: 'paypal', name: 'PayPal', gateway: 'Demo PayPal (sandbox)', enabled: true, mode: 'simulated', fee: { bps: 349, fixed: usd(0.49) }, settlement: 'instant', customerFacing: true, instructions: 'Redirects to PayPal and back.' },
  { id: 'bank_transfer', name: 'Bank transfer', gateway: 'Bank transfer (manual confirmation)', enabled: true, mode: 'simulated', fee: { bps: 0, fixed: usd(0) }, settlement: 'manual_confirmation', customerFacing: true, instructions: 'IBAN AE07 0331 2345 6789 0123 456 · reference = payment ref. Credited when finance confirms receipt.' },
  { id: 'manual', name: 'Manual payment', gateway: 'Manual payment', enabled: true, mode: 'simulated', fee: { bps: 0, fixed: usd(0) }, settlement: 'manual_confirmation', customerFacing: false, instructions: 'Cash or offline payment recorded by an operator.' },
]

export const NOTIFICATION_CHANNELS: (NotificationChannelConfig & { id: string })[] = [
  { id: 'nch_email', channel: 'email', enabled: true, transport: 'SMTP (simulated — no email is sent)', target: 'ops@unlockdesk-demo.com' },
  { id: 'nch_telegram', channel: 'telegram', enabled: true, transport: 'Telegram bot (simulated)', target: '#unlockdesk-ops' },
  { id: 'nch_whatsapp', channel: 'whatsapp', enabled: true, transport: 'WhatsApp Business (simulated)', target: '+971 4 000 0000' },
]

export const NOTIFICATION_ROUTES: (NotificationRoute & { id: string })[] = [
  { id: 'nr_1', template: 'order.completed', audience: 'customer', channels: ['email'], enabled: true },
  { id: 'nr_2', template: 'order.rejected', audience: 'customer', channels: ['email'], enabled: true },
  { id: 'nr_3', template: 'order.needs_review', audience: 'operator', channels: ['telegram', 'email'], enabled: true },
  { id: 'nr_4', template: 'payment.received', audience: 'customer', channels: ['email'], enabled: true },
  { id: 'nr_5', template: 'refund.issued', audience: 'customer', channels: ['email'], enabled: true },
  { id: 'nr_6', template: 'verification.updated', audience: 'customer', channels: ['email'], enabled: true },
  { id: 'nr_7', template: 'supplier.low_balance', audience: 'operator', channels: ['telegram', 'email'], enabled: true },
  { id: 'nr_8', template: 'supplier.auth_error', audience: 'operator', channels: ['telegram'], enabled: true },
  { id: 'nr_9', template: 'supplier.circuit_open', audience: 'operator', channels: ['telegram'], enabled: true },
  { id: 'nr_10', template: 'api.error_spike', audience: 'operator', channels: ['email'], enabled: true },
  { id: 'nr_11', template: 'webhook.failing', audience: 'operator', channels: ['email'], enabled: true },
  { id: 'nr_12', template: 'account.low_balance', audience: 'customer', channels: ['email', 'whatsapp'], enabled: true },
]

export function buildWebhookEndpoints(now: number): WebhookEndpoint[] {
  const ago = (d: number) => new Date(now - d * 86400_000).toISOString()
  const all = ['order.created', 'order.processing', 'order.completed', 'order.rejected', 'order.cancelled', 'order.refunded'] as const
  return [
    { id: 'whe_ops', accountId: null, url: 'https://ops.unlockdesk-demo.com/hooks/orvex', description: 'Operations dashboard (needs review, refunds)', events: ['order.needs_review', 'order.refunded', 'order.rejected'], status: 'active', secretMasked: 'whsec_••••••••9f2c', createdAt: ago(300) },
    { id: 'whe_abc', accountId: 'acc_abcgsm', url: 'https://pos.abcgsm.example/orvex/webhook', description: 'ABC GSM POS', events: [...all], status: 'active', secretMasked: 'whsec_••••••••a1b2', createdAt: ago(200) },
    { id: 'whe_mobilehub', accountId: 'acc_mobilehub', url: 'https://hooks.mobilehub.example/orvex/orders', description: 'MobileHub order sync', events: ['order.completed', 'order.rejected', 'order.refunded'], status: 'active', secretMasked: 'whsec_••••••••77d0', createdAt: ago(380) },
    { id: 'whe_asiagsm', accountId: 'acc_asiagsm', url: 'https://events.asiagsmhub.example/orvex', description: 'Asia GSM Hub events', events: ['order.completed', 'order.rejected'], status: 'active', secretMasked: 'whsec_••••••••3c4e', createdAt: ago(150) },
    { id: 'whe_techrepair', accountId: 'acc_techrepair', url: 'https://secure.techrepair-pro.example/callbacks/orders', description: 'TechRepair Pro', events: ['order.completed', 'order.rejected', 'order.processing'], status: 'active', secretMasked: 'whsec_••••••••e5f6', createdAt: ago(110) },
    { id: 'whe_smartfix', accountId: 'acc_smartfix', url: 'https://smartfix.example/orvex/webhook', description: 'SmartFix Store (returning 5xx)', events: ['order.completed', 'order.rejected'], status: 'failing', secretMasked: 'whsec_••••••••0a9b', createdAt: ago(60) },
    { id: 'whe_checkmyimei', accountId: 'acc_checkmyimei', url: 'https://api.checkmyimei.example/v2/orvex-events', description: 'CheckMyIMEI result push', events: ['order.completed', 'order.rejected'], status: 'active', secretMasked: 'whsec_••••••••c3d4', createdAt: ago(190) },
  ]
}

export function buildApiKeys(now: number): ApiKey[] {
  const ago = (d: number) => new Date(now - d * 86400_000).toISOString()
  const k = (id: string, accountId: string, name: string, prefix: string, scopes: ApiKey['scopes'], dhru: boolean, days: number, extra?: Partial<ApiKey>): ApiKey => ({
    id,
    accountId,
    name,
    prefix,
    last4: id.slice(-4).replace(/_/g, 'x'),
    hash: displayHash(`${prefix}_${id}`),
    environment: 'live',
    scopes,
    ipAllowlist: [],
    rateLimitPerMin: 600,
    dhruCompat: dhru,
    status: 'active',
    createdAt: ago(days),
    createdBy: 'Account owner',
    lastUsedAt: ago(0.01),
    expiresAt: null,
    ...extra,
  })
  const FULL: ApiKey['scopes'] = ['services:read', 'orders:read', 'orders:write', 'account:read']
  return [
    k('key_abc_live1', 'acc_abcgsm', 'POS integration', 'orx_live_a3c1', FULL, true, 200),
    k('key_abc_test1', 'acc_abcgsm', 'Staging', 'orx_test_77b2', FULL, false, 120, { environment: 'test', lastUsedAt: ago(6) }),
    k('key_mh_live1', 'acc_mobilehub', 'Production', 'orx_live_4f2a', [...FULL, 'webhooks:manage'], false, 380, { ipAllowlist: ['203.0.113.0/24'], rateLimitPerMin: 1200 }),
    k('key_pf_live1', 'acc_phonefix', 'Shop system', 'orx_live_9e10', FULL, true, 290),
    k('key_cp_live1', 'acc_cellpoint', 'Repair desk', 'orx_live_c0de', FULL, false, 250),
    k('key_ag_live1', 'acc_asiagsm', 'DHRU gateway', 'orx_live_5a5a', FULL, true, 180),
    k('key_gm_live1', 'acc_gulfmobile', 'Counter POS', 'orx_live_6b2e', FULL, true, 90),
    k('key_mv_live1', 'acc_movil', 'Panel', 'orx_live_1d4f', FULL, true, 150),
    k('key_tr_live1', 'acc_techrepair', 'Production', 'orx_live_88aa', FULL, false, 120, { ipAllowlist: ['198.51.100.10', '198.51.100.11'], rateLimitPerMin: 1200 }),
    k('key_sf_live1', 'acc_smartfix', 'Store app', 'orx_live_2c3d', FULL, false, 70),
    k('key_cb_live1', 'acc_celular', 'DHRU panel', 'orx_live_3e7f', FULL, true, 44),
    k('key_ig_live1', 'acc_istanbul', 'Wholesale', 'orx_live_7a1b', FULL, true, 55),
    k('key_cmi_live1', 'acc_checkmyimei', 'Production', 'orx_live_0f9e', FULL, false, 198, { rateLimitPerMin: 3000 }),
    k('key_rd_live1', 'acc_repairdesk', 'Connector', 'orx_live_4d8c', FULL, false, 130),
    k('key_bb_live1', 'acc_buyback', 'Bot', 'orx_live_bb01', ['services:read', 'orders:read', 'orders:write'], false, 60),
    k('key_dg_live1', 'acc_deviceguard', 'Claims platform', 'orx_live_d6a0', FULL, false, 40),
    k('key_uz_live1', 'acc_unlockzone', 'Old panel', 'orx_live_dead', FULL, true, 200, { status: 'revoked', lastUsedAt: ago(19) }),
  ]
}
