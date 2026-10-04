/**
 * Vendor platform seed (account.orvex.io). Commercial data only — account,
 * subscription, invoices, licences, installation metadata, releases, support.
 * No operational data from the customer's installation lives here: no orders,
 * no customer or reseller balances, no supplier credentials.
 *
 * DEMO DATA — the customer, UnlockDesk Demo Ltd., is a fictional GSM service
 * business running ORVEX Core 2.4.1 (installation ORVEX-DEMO-001, self-hosted).
 * Tickets and invoices reference its suppliers and custom work so the story
 * matches the installation demo.
 */
import type { Invoice, Payment, Plan, PublicMetrics, Subscription, SupportTicket, VendorAccount, VendorLicense } from '@/types/vendor'

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For new resale businesses putting their first suppliers, storefront and reseller accounts online.',
    priceMonthly: 149,
    billingNote: 'per month, billed quarterly',
    highlighted: false,
    installations: '1 production installation · self-hosted',
    features: ['Storefront, checkout & reseller portal', 'Native API v1 & DHRU-compatible endpoint', 'Double-entry ledger & payment modules', 'Up to 3 suppliers · 50 services', 'Stable update channel', 'Email support'],
    modules: ['core', 'storefront', 'portal', 'native_api', 'dhru', 'payments'],
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For established operators running several suppliers, pricing tiers and sales channels.',
    priceMonthly: 449,
    billingNote: 'per month, billed quarterly',
    highlighted: true,
    installations: '1 production + 1 staging · self-hosted',
    features: ['Everything in Starter', 'Unlimited suppliers, services & accounts', 'Custom extensions & supplier drivers', 'Staging installation for update rehearsals', 'Stable + beta channels', 'Business-hours support (8h SLA)'],
    modules: ['core', 'storefront', 'portal', 'native_api', 'dhru', 'payments', 'custom_extensions'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For groups that need several installations, drivers built for them or a vendor-managed dedicated server.',
    priceMonthly: null,
    billingNote: 'annual agreement',
    highlighted: false,
    installations: 'Multiple installations · self-hosted or vendor-managed dedicated',
    features: ['Everything in Professional', 'Additional production installations', 'Vendor-managed dedicated installation option', 'Custom supplier drivers built by our engineers', 'White-label admin', '24/7 support · 1h critical SLA', 'Source code escrow'],
    modules: ['core', 'storefront', 'portal', 'native_api', 'dhru', 'payments', 'custom_extensions', 'multi_installation', 'white_label'],
  },
]

export const PUBLIC_METRICS: PublicMetrics = {
  activeIntegrations: 128,
  ordersProcessed: 2_400_000,
  apiAvailability: 99.98,
  activePlatforms: 84,
  demo: true,
}

export const ACCOUNT: VendorAccount = {
  id: 'acc_29f1',
  firstName: 'Alex',
  lastName: 'Morgan',
  name: 'Alex Morgan',
  email: 'alex@unlockdesk-demo.com',
  company: 'UnlockDesk Demo Ltd.',
  country: 'Netherlands',
  vatId: 'NL8•••••••B01',
  createdAt: '2025-08-12T09:30:00Z',
  team: [
    { id: 'tm_1', name: 'Alex Morgan', email: 'alex@unlockdesk-demo.com', role: 'Owner', lastActiveAt: new Date().toISOString() },
    { id: 'tm_2', name: 'Omar Haddad', email: 'omar@unlockdesk-demo.com', role: 'Billing', lastActiveAt: new Date(Date.now() - 4 * 86400_000).toISOString() },
    { id: 'tm_3', name: 'Maya Lindqvist', email: 'maya@unlockdesk-demo.com', role: 'Technical', lastActiveAt: new Date(Date.now() - 86400_000).toISOString() },
  ],
  security: {
    mfa: true,
    lastLoginAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    sessions: [
      { id: 'ses_1', device: 'Chrome on macOS', location: 'Amsterdam, NL', lastActiveAt: new Date().toISOString(), current: true },
      { id: 'ses_2', device: 'Safari on iPhone', location: 'Amsterdam, NL', lastActiveAt: new Date(Date.now() - 2 * 86400_000).toISOString(), current: false },
    ],
  },
}

export const SUBSCRIPTION: Subscription = {
  id: 'sub_8Kq2',
  planId: 'professional',
  planName: 'Professional',
  status: 'active',
  billingCycle: 'quarterly',
  amount: 1644,
  currency: 'USD',
  startedAt: '2025-08-12T00:00:00Z',
  currentPeriodStart: '2026-08-12T00:00:00Z',
  currentPeriodEnd: '2026-11-11T23:59:59Z',
  nextRenewalAt: '2026-11-12T00:00:00Z',
  autoRenew: true,
  addOns: [{ id: 'addon_priority', name: 'Priority support', price: 99, description: '4h response SLA and a named support engineer.' }],
  paymentMethod: { brand: 'Visa', last4: '4242', expMonth: 8, expYear: 2028 },
  usage: [
    { label: 'Installations', used: 2, limit: 2, unit: '' },
    { label: 'Admin users', used: 6, limit: 25, unit: '' },
    { label: 'Support tickets this quarter', used: 5, limit: null, unit: '' },
    { label: 'Custom development hours', used: 18, limit: 40, unit: 'h' },
  ],
}

const inv = (number: string, issued: string, periodStart: string, periodEnd: string, lines: Invoice['lines'], status: Invoice['status'] = 'paid', paidDelayDays = 1): Invoice => {
  const subtotal = lines.reduce((a, l) => a + l.amount, 0)
  return {
    id: `in_${number.replace(/\D/g, '')}`,
    number,
    issuedAt: issued,
    dueAt: new Date(new Date(issued).getTime() + 14 * 86400_000).toISOString(),
    paidAt: status === 'paid' ? new Date(new Date(issued).getTime() + paidDelayDays * 86400_000).toISOString() : null,
    periodStart,
    periodEnd,
    subtotal,
    tax: 0,
    total: subtotal,
    status,
    lines,
  }
}

export const INVOICES: Invoice[] = [
  inv(
    'INV-2026-0418',
    '2026-09-18T09:00:00Z',
    '2026-08-01T00:00:00Z',
    '2026-08-31T00:00:00Z',
    [
      { description: 'Custom development — UnlockDesk ERP Export extension (nightly ledger export, SFTP delivery)', quantity: 12, unitPrice: 140, amount: 1680 },
      { description: 'Custom development — ledger account mapping to the chart of accounts, catch-up by transaction id', quantity: 4, unitPrice: 140, amount: 560 },
      { description: 'Custom development — extension hand-over, test run on staging & runbook', quantity: 2, unitPrice: 140, amount: 280 },
    ],
    'open',
  ),
  inv('INV-2026-0371', '2026-08-12T00:00:00Z', '2026-08-12T00:00:00Z', '2026-11-11T00:00:00Z', [
    { description: 'ORVEX Core — Professional (quarterly)', quantity: 3, unitPrice: 449, amount: 1347 },
    { description: 'Priority support add-on (quarterly)', quantity: 3, unitPrice: 99, amount: 297 },
  ]),
  inv('INV-2026-0369', '2026-08-12T00:00:00Z', '2026-08-12T00:00:00Z', '2026-08-12T00:00:00Z', [{ description: 'Vendor-assisted upgrade & staging installation setup', quantity: 1, unitPrice: 950, amount: 950 }]),
  inv('INV-2026-0244', '2026-05-12T00:00:00Z', '2026-05-12T00:00:00Z', '2026-08-11T00:00:00Z', [{ description: 'ORVEX Core — Starter (quarterly)', quantity: 3, unitPrice: 149, amount: 447 }]),
  inv('INV-2026-0117', '2026-02-12T00:00:00Z', '2026-02-12T00:00:00Z', '2026-05-11T00:00:00Z', [{ description: 'ORVEX Core — Starter (quarterly)', quantity: 3, unitPrice: 149, amount: 447 }], 'paid', 3),
  inv('INV-2026-0021', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z', [{ description: 'Vendor-assisted upgrade to Core 2.0 — accounts & ledger migration', quantity: 1, unitPrice: 600, amount: 600 }]),
  inv('INV-2025-0388', '2025-11-12T00:00:00Z', '2025-11-12T00:00:00Z', '2026-02-11T00:00:00Z', [{ description: 'ORVEX Core — Starter (quarterly)', quantity: 3, unitPrice: 149, amount: 447 }]),
  inv('INV-2025-0301', '2025-08-12T00:00:00Z', '2025-08-12T00:00:00Z', '2025-11-11T00:00:00Z', [
    { description: 'ORVEX Core — Starter (quarterly)', quantity: 3, unitPrice: 149, amount: 447 },
    { description: 'Assisted installation (Docker Compose on a dedicated server)', quantity: 1, unitPrice: 750, amount: 750 },
  ]),
]

export const PAYMENTS: Payment[] = [
  { id: 'py_01', at: '2026-08-13T00:00:00Z', amount: 1644, method: 'Visa •••• 4242', status: 'succeeded', invoiceId: 'in_20260371', description: 'Professional — Q3 2026–27' },
  { id: 'py_02', at: '2026-08-13T00:00:00Z', amount: 950, method: 'Visa •••• 4242', status: 'succeeded', invoiceId: 'in_20260369', description: 'Upgrade & staging setup' },
  { id: 'py_03', at: '2026-05-13T00:00:00Z', amount: 447, method: 'Visa •••• 4242', status: 'succeeded', invoiceId: 'in_20260244', description: 'Starter — quarterly' },
  { id: 'py_04', at: '2026-02-12T00:00:00Z', amount: 447, method: 'Visa •••• 1881', status: 'failed', invoiceId: 'in_20260117', description: 'Starter — quarterly (card expired)' },
  { id: 'py_05', at: '2026-02-15T00:00:00Z', amount: 447, method: 'Visa •••• 4242', status: 'succeeded', invoiceId: 'in_20260117', description: 'Starter — quarterly (retry)' },
  { id: 'py_06', at: '2026-01-16T00:00:00Z', amount: 600, method: 'SEPA transfer', status: 'succeeded', invoiceId: 'in_20260021', description: 'Upgrade to Core 2.0' },
  { id: 'py_07', at: '2025-11-13T00:00:00Z', amount: 447, method: 'Visa •••• 1881', status: 'succeeded', invoiceId: 'in_20250388', description: 'Starter — quarterly' },
  { id: 'py_08', at: '2025-08-13T00:00:00Z', amount: 1197, method: 'Visa •••• 1881', status: 'succeeded', invoiceId: 'in_20250301', description: 'Starter + assisted installation' },
]

export const LICENSE: VendorLicense = {
  id: 'LIC-4829-AX',
  key: 'LX-2048-AX91-7KQ2-M3PD',
  keyMasked: 'LX-2048-AX91-••••-••••',
  plan: 'Professional',
  status: 'active',
  issuedAt: '2025-08-12T00:00:00Z',
  activatedAt: '2025-08-21T10:41:00Z',
  /**
   * End of the current update & support entitlement. The right to run the
   * installed version is perpetual — nothing stops when this date passes.
   */
  expiresAt: '2026-12-31T23:59:59Z',
  updatesUntil: '2026-12-31T23:59:59Z',
  maxInstallations: 2,
  licensedDomains: ['portal.unlockdesk-demo.com', 'staging.unlockdesk-demo.com'],
  licensedVersion: '2.x',
  modules: [
    { id: 'core', name: 'ORVEX Core (orders, ledger, routing)', included: true },
    { id: 'storefront', name: 'Storefront & checkout', included: true },
    { id: 'portal', name: 'Reseller portal', included: true },
    { id: 'native_api', name: 'Native API v1 & webhooks', included: true },
    { id: 'dhru', name: 'DHRU compatibility & importer', included: true },
    { id: 'payments', name: 'Payment gateway modules', included: true },
    { id: 'custom_extensions', name: 'Custom extensions & drivers', included: true },
    { id: 'multi_installation', name: 'Additional production installations', included: false },
    { id: 'white_label', name: 'White-label admin', included: false },
  ],
  installations: [
    { id: 'ORVEX-DEMO-001', name: 'UnlockDesk Production', domain: 'portal.unlockdesk-demo.com', environment: 'production', version: '2.4.1', schemaVersion: '019', status: 'online', lastHeartbeatAt: new Date(Date.now() - 66 * 60_000).toISOString(), activatedAt: '2025-08-21T10:41:00Z', hosting: 'Docker Compose · dedicated server', region: 'EU-Central', database: 'PostgreSQL 16.4 (self-hosted)', deployment: 'self-managed', updateChannel: 'stable' },
    { id: 'ORVEX-DEMO-001-STG', name: 'UnlockDesk Staging', domain: 'staging.unlockdesk-demo.com', environment: 'staging', version: '2.5.0', schemaVersion: '022', status: 'online', lastHeartbeatAt: new Date(Date.now() - 12 * 60_000).toISOString(), activatedAt: '2026-08-12T11:30:00Z', hosting: 'Docker Compose · cloud VM (8 vCPU)', region: 'EU-Central', database: 'Managed PostgreSQL 16', deployment: 'self-managed', updateChannel: 'stable' },
  ],
  signature: { algorithm: 'Ed25519', publicKeyId: 'orvex-license-2026', issuedBy: 'license.orvex.io' },
}

const at = (iso: string) => new Date(iso).toISOString()
export const TICKETS: SupportTicket[] = [
  {
    id: 'TCK-2041',
    subject: 'Delta GSM Server — unlock code orders landing in Needs Review',
    status: 'in_progress',
    priority: 'high',
    category: 'Provider adapter',
    installationId: 'ORVEX-DEMO-001',
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    messages: [
      { id: 'm1', author: 'Alex Morgan', role: 'customer', body: 'Since yesterday afternoon roughly a quarter of Huawei Modem Unlock Code orders sent to Delta GSM Server time out after 45 s. They land in Needs Review with the funds held. DHRU Supplier Alpha is the next routable offer for that service — why doesn’t Core fail over to it automatically? Do we need to change the DHRU Fusion driver settings?', at: new Date(Date.now() - 26 * 3600_000).toISOString() },
      { id: 'm2', author: 'Jonas — ORVEX Support', role: 'support', body: 'Thanks Alex — this is intended behaviour. A timeout after the request was sent is an UNKNOWN outcome: Delta may already have accepted the order. Failing over automatically could place a second supplier order for the same IMEI, so Core keeps the funds held and sends the order to Needs Review. Definitive rejections that are classified failover-safe (for example “service disabled”) do move on to the next offer. We see the same latency on other customers’ reports about Delta GSM Server, so this looks supplier-side; we have contacted their technical team.', at: new Date(Date.now() - 22 * 3600_000).toISOString() },
      { id: 'm3', author: 'Jonas — ORVEX Support', role: 'support', body: 'Update: Delta confirmed a capacity issue on their gateway and expects a fix within 24h. For the held orders: check each order at Delta (its reference is on the attempt), then resolve it in Orders → Needs Review — “received” lets it complete normally, “confirmed not received” allows the next offer to be tried. No customer was charged twice and no duplicate supplier orders were placed. If failures continue, the circuit breaker opens and new orders go straight to the next offer, which is safe because nothing was sent to Delta. Core 2.5.0 adds a supplier lookup to the review queue to make this faster.', at: new Date(Date.now() - 2 * 3600_000).toISOString() },
    ],
  },
  {
    id: 'TCK-2033',
    subject: 'Update to 2.5.0 — UnlockDesk ERP Export extension compatibility',
    status: 'awaiting_customer',
    priority: 'normal',
    category: 'Update',
    installationId: 'ORVEX-DEMO-001',
    createdAt: at('2026-09-29T14:10:00Z'),
    updatedAt: at('2026-09-30T08:45:00Z'),
    messages: [
      { id: 'm1', author: 'Sarah Chen', role: 'customer', body: 'The update preflight says our custom “UnlockDesk ERP Export” extension (~2.4.0) is not declared compatible with 2.5 and will be disabled. Will the nightly ledger export to our accounting system keep working after the update?', at: at('2026-09-29T14:10:00Z') },
      { id: 'm2', author: 'Priya — ORVEX Professional Services', role: 'support', body: 'The extension reads ledger transactions through an interface that did not change in 2.5 — only its manifest pins ~2.4.0. We have prepared version 1.0.0 targeting ^2.5.0, and Maya ran it with us on your staging installation (already on 2.5.0): the export totals match. Shall we schedule a vendor-assisted update window for production this week, outside your peak hours? Even if the extension is disabled for a night, nothing is lost — it catches up from the last exported transaction.', at: at('2026-09-30T08:45:00Z') },
    ],
  },
  {
    id: 'TCK-2024',
    subject: 'Low-balance alerts for supplier accounts',
    status: 'resolved',
    priority: 'normal',
    category: 'General',
    installationId: 'ORVEX-DEMO-001',
    createdAt: at('2026-09-22T08:30:00Z'),
    updatedAt: at('2026-09-24T10:05:00Z'),
    messages: [
      { id: 'm1', author: 'Maya Lindqvist', role: 'customer', body: 'Last Saturday our Zeta Device Data balance ran out. Warranty checks failed over to GammaCheck IMEI API at a higher cost until Monday morning. Can Core warn us before a supplier balance runs low?', at: at('2026-09-22T08:30:00Z') },
      { id: 'm2', author: 'Jonas — ORVEX Support', role: 'support', body: 'Each supplier already has a low-balance threshold (Suppliers → Zeta Device Data → Settings). On 2.4 crossing it marks the supplier “low balance” in the admin and the audit log. “Insufficient funds” replies are classified not-accepted — the supplier provably did not process the order — which is why those orders could fail over safely. Core 2.5.0 adds supplier balance alerts: email and Telegram notifications to Owners and Admins. Your staging installation already runs 2.5.0 if you want to try it.', at: at('2026-09-22T13:40:00Z') },
      { id: 'm3', author: 'Maya Lindqvist', role: 'customer', body: 'Tested on staging — the email and the Telegram message to our on-call group both fired at the threshold. We will roll it out with the 2.5.0 update. Thanks!', at: at('2026-09-24T10:05:00Z') },
    ],
  },
  {
    id: 'TCK-2017',
    subject: 'Add second staging domain to license',
    status: 'resolved',
    priority: 'low',
    category: 'Licensing',
    installationId: null,
    createdAt: at('2026-09-10T10:00:00Z'),
    updatedAt: at('2026-09-11T09:12:00Z'),
    messages: [
      { id: 'm1', author: 'Maya Lindqvist', role: 'customer', body: 'Can we use staging.unlockdesk-demo.com as our licensed staging installation? We want to rehearse updates and test supplier driver settings there before they touch live orders.', at: at('2026-09-10T10:00:00Z') },
      { id: 'm2', author: 'Jonas — ORVEX Support', role: 'support', body: 'Done — the domain is now bound to your license. Re-validate from System → License on the staging installation. The license only carries domains and installation metadata — none of your operational data.', at: at('2026-09-11T09:12:00Z') },
    ],
  },
  {
    id: 'TCK-1988',
    subject: 'Custom extension — nightly ledger export to our accounting system',
    status: 'closed',
    priority: 'normal',
    category: 'Custom development',
    installationId: 'ORVEX-DEMO-001',
    createdAt: at('2026-08-04T09:00:00Z'),
    updatedAt: at('2026-08-25T16:20:00Z'),
    messages: [
      { id: 'm1', author: 'Alex Morgan', role: 'customer', body: 'We would like ledger transactions — captures, refunds, wallet top-ups and supplier settlements — exported every night to our accounting system as CSV over SFTP. Can you build this as an extension?', at: at('2026-08-04T09:00:00Z') },
      { id: 'm2', author: 'Priya — ORVEX Professional Services', role: 'support', body: 'Yes. Estimate: 16–20 hours from your Professional allowance. The extension only needs the ledger:read permission — it reads balanced transactions and never writes. It exports by transaction id, so a missed night catches up automatically. It runs inside your installation: the files go from your server to your SFTP host and never pass through us.', at: at('2026-08-05T11:30:00Z') },
      { id: 'm3', author: 'Priya — ORVEX Professional Services', role: 'support', body: 'Delivered as extension ext.unlockdesk.erp-sync 0.9.2 (18 h, invoiced on INV-2026-0418). It is installed alongside Core, so Core updates never overwrite it.', at: at('2026-08-25T16:20:00Z') },
    ],
  },
  {
    id: 'TCK-1902',
    subject: 'Invoice address change',
    status: 'closed',
    priority: 'low',
    category: 'Billing',
    installationId: null,
    createdAt: at('2026-06-02T12:00:00Z'),
    updatedAt: at('2026-06-02T15:30:00Z'),
    messages: [
      { id: 'm1', author: 'Omar Haddad', role: 'customer', body: 'Please update our billing address to Keizersgracht 100, Amsterdam.', at: at('2026-06-02T12:00:00Z') },
      { id: 'm2', author: 'Billing — ORVEX Systems', role: 'support', body: 'Updated. Future invoices will use the new address.', at: at('2026-06-02T15:30:00Z') },
    ],
  },
]
