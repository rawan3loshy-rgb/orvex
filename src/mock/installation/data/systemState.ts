/** DEMO DATA — installation identity, license, update center, settings, extensions. */
import type { InstallationInfo, InstallationLicense, InstallationSettings, UpdateCenterState } from '@/core/domain'
import type { InstalledExtension } from '@/types/extensions'
import { RELEASES } from '@/mock/shared/releases'
import { GSM_PACK } from '@/core/verticals/gsm'

export interface SystemState {
  installation: InstallationInfo
  license: InstallationLicense
  updates: UpdateCenterState
  settings: InstallationSettings
  incidents: { id: string; title: string; status: 'resolved' | 'monitoring' | 'investigating'; startedAt: string; resolvedAt: string | null; component: string }[]
}

export function buildSystemState(now: number): SystemState {
  const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString()
  const daysAgo = (d: number) => new Date(now - d * 86400_000).toISOString()
  const extensions: InstalledExtension[] = [
    { id: 'driver.dhru-fusion', name: 'DHRU Fusion Driver', kind: 'supplier-driver', version: '2.1.0', coreRange: '^2.2.0', author: 'ORVEX Systems', source: 'core', description: 'HTTP driver for DHRU Fusion-compatible supplier APIs (form-POST + JSON, statuses 0/1/3/4). Not SOAP/WSDL.', permissions: ['network:outbound', 'secrets:read'], status: 'enabled', installedAt: daysAgo(400), updatedAt: daysAgo(29), compatibleWithNext: true },
    { id: 'driver.orvex-rest', name: 'ORVEX REST Driver', kind: 'supplier-driver', version: '1.4.2', coreRange: '^2.2.0', author: 'ORVEX Systems', source: 'core', description: 'Generic JSON REST supplier driver with Bearer auth and HMAC-signed callbacks.', permissions: ['network:outbound', 'secrets:read'], status: 'enabled', installedAt: daysAgo(400), updatedAt: daysAgo(29), compatibleWithNext: true },
    { id: 'driver.manual', name: 'Manual Fulfilment Driver', kind: 'supplier-driver', version: '1.0.0', coreRange: '^2.0.0', author: 'ORVEX Systems', source: 'core', description: 'Work-queue driver for suppliers that fulfil by hand.', permissions: ['email:send'], status: 'enabled', installedAt: daysAgo(260), updatedAt: daysAgo(90), compatibleWithNext: true },
    { id: 'pack.gsm', name: GSM_PACK.name, kind: 'vertical-pack', version: GSM_PACK.version, coreRange: '^2.0.0', author: GSM_PACK.author, source: 'official', description: GSM_PACK.description, permissions: ['catalog:extend'], status: 'enabled', installedAt: daysAgo(400), updatedAt: daysAgo(60), compatibleWithNext: true },
    { id: 'gateway.demo-card', name: 'Demo Card Gateway', kind: 'payment-gateway', version: '1.2.0', coreRange: '^2.3.0', author: 'ORVEX Systems', source: 'official', description: 'Simulated card processor for the demo environment. Replace with a real gateway module in production.', permissions: ['network:outbound', 'secrets:read', 'ledger:post'], status: 'enabled', installedAt: daysAgo(120), updatedAt: daysAgo(30), compatibleWithNext: true },
    { id: 'gateway.demo-paypal', name: 'Demo PayPal (sandbox)', kind: 'payment-gateway', version: '1.0.4', coreRange: '^2.3.0', author: 'ORVEX Systems', source: 'official', description: 'Simulated PayPal checkout.', permissions: ['network:outbound', 'secrets:read', 'ledger:post'], status: 'enabled', installedAt: daysAgo(120), updatedAt: daysAgo(30), compatibleWithNext: true },
    { id: 'theme.storefront', name: 'Storefront Theme', kind: 'theme', version: '3.0.0', coreRange: '^2.4.0', author: 'ORVEX Systems', source: 'official', description: 'Catalog-driven storefront theme: typed blocks, service templates, checkout.', permissions: ['catalog:read'], status: 'enabled', installedAt: daysAgo(58), updatedAt: daysAgo(12), compatibleWithNext: true },
    { id: 'ext.unlockdesk.erp-sync', name: 'UnlockDesk ERP Export', kind: 'module', version: '0.9.2', coreRange: '~2.4.0', author: 'UnlockDesk Demo Ltd. (custom)', source: 'custom', description: 'Nightly export of ledger transactions to UnlockDesk’s accounting system. Built by ORVEX professional services.', permissions: ['ledger:read'], status: 'enabled', installedAt: daysAgo(40), updatedAt: daysAgo(40), compatibleWithNext: false },
    { id: 'module.statements', name: 'Account Statements', kind: 'module', version: '1.3.0', coreRange: '^2.3.0', author: 'ORVEX Systems', source: 'official', description: 'Monthly PDF statements for accounts, generated from the ledger.', permissions: ['ledger:read', 'email:send'], status: 'enabled', installedAt: daysAgo(70), updatedAt: daysAgo(70), compatibleWithNext: true },
  ]
  return {
    installation: {
      installationId: 'ORVEX-DEMO-001',
      name: 'UnlockDesk Production',
      orgName: 'UnlockDesk Demo Ltd.',
      domain: 'portal.unlockdesk-demo.com',
      environment: 'production',
      deployment: 'self_hosted',
      version: '2.4.1',
      schemaVersion: '019',
      installedAt: '2025-08-21T10:12:00Z',
      database: { engine: 'PostgreSQL', version: '16.4', provider: 'Self-hosted (dedicated server)', hostMasked: '••••••••.internal:5432', name: 'orvex', sslMode: 'verify-full', status: 'connected', latencyMs: 1.8, pool: { active: 14, idle: 26, max: 40 }, sizeMb: 6412, tables: 58, lastBackupAt: minsAgo(312) },
      runtime: {
        platform: 'Docker Compose',
        node: '22.11.0 LTS',
        os: 'Linux · Debian 12 (x86_64)',
        proxy: 'Caddy 2.8 (auto-TLS)',
        cpuCores: 8,
        memoryMb: 32768,
        containers: [
          { name: 'core-api', image: 'registry.orvex.io/core:2.4.1', status: 'running', uptime: '26d 4h' },
          { name: 'core-worker', image: 'registry.orvex.io/core:2.4.1', status: 'running', uptime: '26d 4h' },
          { name: 'core-scheduler', image: 'registry.orvex.io/core:2.4.1', status: 'running', uptime: '26d 4h' },
          { name: 'caddy', image: 'caddy:2.8-alpine', status: 'running', uptime: '58d 11h' },
        ],
      },
      queue: { driver: 'PostgreSQL job table (SKIP LOCKED)', workers: 4 },
      storage: { driver: 'Local volume (/var/lib/orvex)', usedGb: 38.4, totalGb: 250 },
      env: [
        { key: 'APP_URL', value: 'https://portal.unlockdesk-demo.com', secret: false },
        { key: 'DATABASE_URL', value: 'postgres://••••••:••••••@••••••••.internal:5432/orvex?sslmode=verify-full', secret: true },
        { key: 'LICENSE_KEY', value: 'LX-2048-AX91-••••-••••', secret: true },
        { key: 'LICENSE_SERVER_URL', value: 'https://license.orvex.io', secret: false },
        { key: 'UPDATE_CHANNEL', value: 'stable', secret: false },
        { key: 'ENCRYPTION_KEY', value: '••••••••••••••••••••••••••••••••', secret: true },
        { key: 'SMTP_URL', value: 'smtp://••••••@smtp.••••••.example:587', secret: true },
        { key: 'WORKERS', value: '4', secret: false },
      ],
      extensions,
    },
    license: {
      licenseId: 'LIC-4829-AX',
      licenseKeyMasked: 'LX-2048-AX91-••••-••••',
      installationId: 'ORVEX-DEMO-001',
      plan: 'Professional',
      customer: 'UnlockDesk Demo Ltd.',
      status: 'active',
      domain: 'portal.unlockdesk-demo.com',
      issuedAt: '2025-08-12T00:00:00Z',
      activatedAt: '2025-08-21T10:41:00Z',
      perpetualUse: true,
      licensedMajor: '2.x',
      updatesUntil: '2026-12-31T23:59:59Z',
      supportUntil: '2026-12-31T23:59:59Z',
      entitlements: [
        { id: 'core', name: 'ORVEX Core (orders, ledger, routing)', included: true },
        { id: 'storefront', name: 'Storefront & checkout', included: true },
        { id: 'portal', name: 'Reseller portal', included: true },
        { id: 'native_api', name: 'Native API v1', included: true },
        { id: 'dhru', name: 'DHRU compatibility & importer', included: true },
        { id: 'payments', name: 'Payment gateway modules', included: true },
        { id: 'custom_extensions', name: 'Custom extensions', included: true },
        { id: 'updates', name: 'Updates & security patches', included: true },
        { id: 'white_label', name: 'White-label admin', included: false },
        { id: 'multi_installation', name: 'Additional production installations', included: false },
      ],
      limits: [
        { label: 'Production installations', value: '1' },
        { label: 'Staging installations', value: '1' },
        { label: 'Suppliers / services / accounts', value: 'Unlimited' },
        { label: 'Admin users', value: '25' },
      ],
      validation: { mode: 'online', lastValidatedAt: minsAgo(66), nextValidationAt: new Date(now + (24 * 60 - 66) * 60_000).toISOString(), gracePeriodDays: 30, cacheValidUntil: new Date(now + 30 * 86400_000).toISOString(), signature: 'ed25519:mE4x…Q2Lw', licenseServer: 'https://license.orvex.io' },
    },
    updates: {
      currentVersion: '2.4.1',
      schemaVersion: '019',
      channel: 'stable',
      lastCheckedAt: minsAgo(66),
      available: RELEASES.find((r) => r.version === '2.5.0') ?? null,
      releases: RELEASES,
      history: [
        { version: '2.4.1', installedAt: '2026-09-05T02:14:00Z', durationSec: 148, by: 'Alex Morgan', status: 'success', backupId: 'bkp_0905' },
        { version: '2.4.0', installedAt: '2026-08-12T10:20:00Z', durationSec: 312, by: 'ORVEX Systems (vendor-assisted)', status: 'success', backupId: 'bkp_0812' },
        { version: '2.3.2', installedAt: '2026-07-09T01:03:00Z', durationSec: 121, by: 'Sarah Chen', status: 'success', backupId: 'bkp_0709' },
        { version: '2.3.0', installedAt: '2026-06-14T01:45:00Z', durationSec: 264, by: 'Sarah Chen', status: 'rolled_back', backupId: 'bkp_0614' },
        { version: '2.3.0', installedAt: '2026-06-15T01:30:00Z', durationSec: 251, by: 'Sarah Chen', status: 'success', backupId: 'bkp_0615' },
      ],
      backups: [
        { id: 'bkp_nightly_1001', createdAt: minsAgo(312), sizeMb: 1284, version: '2.4.1', kind: 'scheduled' },
        { id: 'bkp_nightly_0930', createdAt: minsAgo(312 + 1440), sizeMb: 1279, version: '2.4.1', kind: 'scheduled' },
        { id: 'bkp_manual_0927', createdAt: daysAgo(4), sizeMb: 1262, version: '2.4.1', kind: 'manual' },
        { id: 'bkp_0905', createdAt: '2026-09-05T02:10:00Z', sizeMb: 1121, version: '2.4.0', kind: 'pre-update' },
      ],
      preflight: [
        { id: 'entitlement', label: 'Update entitlement', status: 'pass', detail: 'Updates included until 31 Dec 2026' },
        { id: 'version', label: 'Upgrade path', status: 'pass', detail: '2.4.1 → 2.5.0 is a supported direct upgrade (min 2.3.0)' },
        { id: 'disk', label: 'Disk space', status: 'pass', detail: '211 GB free · 4.2 GB required' },
        { id: 'postgres', label: 'PostgreSQL compatibility', status: 'pass', detail: 'PostgreSQL 16.4 within supported range 14 – 17' },
        { id: 'migrations', label: 'Migrations are expand-only', status: 'pass', detail: '3 additive migrations — old workers keep running during the migration step' },
        { id: 'extensions', label: 'Extension compatibility', status: 'warn', detail: 'UnlockDesk ERP Export (~2.4.0) is not declared compatible with 2.5 — it will be disabled until updated' },
        { id: 'backup', label: 'Recent backup', status: 'pass', detail: 'Nightly backup 5h ago · a fresh pre-update backup is taken in step 2' },
      ],
      migrationStatus: { applied: '019', pending: ['020_order_review_lookups', '021_webhook_message_ids', '022_pricing_rule_min_margin'], strategy: 'Expand / contract — 2.5.0 only adds columns and tables; old columns are removed in a later release' },
    },
    settings: {
      general: { orgName: 'UnlockDesk Demo Ltd.', supportEmail: 'support@unlockdesk-demo.com', timezone: 'Asia/Dubai', currency: 'USD' },
      security: { enforceMfa: true, sessionTimeoutMin: 60, ipAllowlistAdmin: ['10.0.0.0/16'], passwordMinLength: 12, auditRetentionDays: 365 },
      api: { baseUrl: 'https://portal.unlockdesk-demo.com/v1', dhruEndpoint: 'https://portal.unlockdesk-demo.com/api/dhru', defaultRateLimit: 600, idempotencyWindowHours: 24, sandboxEnabled: true, dhruCompatEnabled: true },
      email: { provider: 'SMTP (simulated)', fromName: 'UnlockDesk', fromAddress: 'no-reply@unlockdesk-demo.com', smtpHostMasked: 'smtp.••••••.example:587', verified: true },
      webhooks: { signing: 'standard-webhooks', algorithm: 'HMAC-SHA256', maxAttempts: 8, schedule: 'immediately, 5s, 5m, 30m, 2h, 5h, 10h, 10h', timeoutMs: 10000 },
      localization: { language: 'English (US)', dateFormat: 'DD MMM YYYY', numberFormat: '1,234.56' },
      branding: { logoText: 'UnlockDesk', primaryColor: '#0e7c66', adminTitle: 'UnlockDesk Ops' },
    },
    incidents: [
      { id: 'inc_1', title: 'Epsilon Code Factory rejecting our API key', status: 'investigating', startedAt: minsAgo(120), resolvedAt: null, component: 'Suppliers' },
      { id: 'inc_2', title: 'Eta Unlock Hub connection refused — circuit open', status: 'monitoring', startedAt: minsAgo(20), resolvedAt: null, component: 'Suppliers' },
      { id: 'inc_3', title: 'Delayed webhook deliveries to one reseller endpoint', status: 'monitoring', startedAt: minsAgo(400), resolvedAt: null, component: 'Webhooks' },
      { id: 'inc_4', title: 'Nightly backup slower than usual', status: 'resolved', startedAt: daysAgo(3), resolvedAt: daysAgo(3), component: 'Backups' },
    ],
  }
}
