/**
 * DEMO DATA — a fictional legacy DHRU Fusion panel used by the migration importer.
 * The importer is a simulation: it scans, diffs and validates this dataset but
 * never imports external data.
 */
export interface MigrationSource {
  panel: string
  host: string
  database: string
  exportFile: string
  exportedAt: string
  scan: { services: number; activeServices: number; categories: number; clients: number; activeClients: number; supplierConnections: number; priceGroups: number; orders: number; creditBalances: number; dhruApiResellers: number }
  warnings: { id: string; kind: 'unmapped_service' | 'unsupported_field' | 'invalid_email' | 'pricing_review'; title: string; count: number; samples: { ref: string; detail: string; suggestion: string }[] }[]
  diff: { entity: string; create: number; update: number; skip: number; note: string }[]
  suppliers: { name: string; url: string; driver: 'dhru_fusion' | 'manual'; services: number; status: 'mapped' | 'needs_credentials' }[]
  validation: { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[]
}

export function buildMigrationSource(now: number): MigrationSource {
  const d = (days: number) => new Date(now - days * 86400_000).toISOString()
  return {
    panel: 'DHRU Fusion 6.1 (self-hosted, ionCube)',
    host: 'panel.unlockdesk-legacy.example',
    database: 'MariaDB 10.6',
    exportFile: 'dhru-export-2026-10-03.sql.gz (148 MB)',
    exportedAt: d(1),
    scan: { services: 842, activeServices: 518, categories: 31, clients: 217, activeClients: 164, supplierConnections: 18, priceGroups: 9, orders: 128_440, creditBalances: 48_210_000_000, dhruApiResellers: 37 },
    warnings: [
      {
        id: 'w_unmapped',
        kind: 'unmapped_service',
        title: 'Services without a supplier mapping',
        count: 12,
        samples: [
          { ref: 'Service #4471 “iPhone 6 Clean Unlock (old)”', detail: 'Linked to API connection “gsm-x” which no longer exists', suggestion: 'Import as draft without offers' },
          { ref: 'Service #3920 “BlackBerry MEP”', detail: 'Supplier connection disabled since 2024', suggestion: 'Skip — archived product' },
          { ref: 'Service #5102 “Samsung KG check v2”', detail: 'Supplier service ID 0', suggestion: 'Map to Alpha #2470 after import' },
        ],
      },
      {
        id: 'w_fields',
        kind: 'unsupported_field',
        title: 'Custom fields without a matching field type',
        count: 7,
        samples: [
          { ref: 'Custom field “PRD” on 4 services', detail: 'DHRU PRD (product code) has no GSM pack type', suggestion: 'Map to text field “product_code”' },
          { ref: 'Custom field “KBH”', detail: 'Legacy box hash used by 3 services', suggestion: 'Map to text field “kbh” (optional)' },
          { ref: 'Custom field “MEP”', detail: 'BlackBerry MEP value', suggestion: 'Drop — service is skipped' },
        ],
      },
      {
        id: 'w_emails',
        kind: 'invalid_email',
        title: 'Clients with invalid email addresses',
        count: 3,
        samples: [
          { ref: 'Client #882 “Mobile King”', detail: 'mobileking@@mail', suggestion: 'Import and ask the reseller to verify email' },
          { ref: 'Client #1043 “AA Phones”', detail: 'aa phones@shop.example (space)', suggestion: 'Auto-fix to aaphones@shop.example' },
          { ref: 'Client #1190 “Repair 24”', detail: 'empty email', suggestion: 'Import as pending account' },
        ],
      },
      {
        id: 'w_pricing',
        kind: 'pricing_review',
        title: 'Price-group rules that need review',
        count: 4,
        samples: [
          { ref: 'Group “VIP-old” → 9 services', detail: 'Fixed price below current supplier cost (negative margin)', suggestion: 'Import as Platinum overrides, flagged negative' },
          { ref: 'Group “Dealer +3%”', detail: 'Percentage of retail, not of cost', suggestion: 'Convert to cost + 28% (equivalent today)' },
          { ref: 'Group “Promo Black Friday 2025”', detail: 'Expired promotion still assigned to 12 clients', suggestion: 'Skip and move clients to Silver' },
        ],
      },
    ],
    diff: [
      { entity: 'Categories', create: 6, update: 0, skip: 25, note: '31 DHRU groups merged into the 6 GSM pack categories' },
      { entity: 'Services', create: 512, update: 0, skip: 330, note: 'Disabled and duplicate services skipped; field schemas generated from DHRU “Requires” flags' },
      { entity: 'Supplier connections', create: 18, update: 0, skip: 0, note: '15 DHRU Fusion driver connections, 3 manual suppliers — credentials must be re-entered (never exported)' },
      { entity: 'Offers', create: 1_204, update: 0, skip: 0, note: 'Primary + fallback API connections become prioritised offers' },
      { entity: 'Accounts', create: 214, update: 0, skip: 3, note: '3 duplicate clients merged; all become reseller accounts' },
      { entity: 'Pricing rules', create: 41, update: 0, skip: 9, note: 'Price groups converted to Silver / Gold / Platinum rules' },
      { entity: 'Opening balances', create: 164, update: 0, skip: 0, note: 'Ledger: DR Migration Clearing / CR Customer Available — total $48,210.00' },
      { entity: 'Order history', create: 0, update: 0, skip: 128_440, note: 'Optional — imported read-only into the archive (not into the live order engine)' },
    ],
    suppliers: [
      { name: 'GSM-Source One', url: 'https://gsm-source-one.example', driver: 'dhru_fusion', services: 212, status: 'needs_credentials' },
      { name: 'Unlock Base', url: 'https://unlockbase.example', driver: 'dhru_fusion', services: 140, status: 'needs_credentials' },
      { name: 'Checker Pro', url: 'https://checkerpro.example', driver: 'dhru_fusion', services: 96, status: 'needs_credentials' },
      { name: 'Manual Desk (legacy)', url: '—', driver: 'manual', services: 14, status: 'mapped' },
    ],
    validation: [
      { id: 'v1', label: 'Opening balances reconcile to the export', status: 'pass', detail: '$48,210.00 in the source = $48,210.00 posted (simulated)' },
      { id: 'v2', label: 'Every active service has at least one offer', status: 'warn', detail: '12 services imported as drafts without offers' },
      { id: 'v3', label: 'Field schemas validate', status: 'pass', detail: '512 service revisions generated; IMEI fields use the Luhn-checked type' },
      { id: 'v4', label: 'DHRU-compatible endpoint ready for existing integrations', status: 'pass', detail: '37 resellers keep their DHRU client — new API keys issued, usernames = account emails' },
      { id: 'v5', label: 'Client logins', status: 'pass', detail: 'Passwords are never imported — members receive a set-password invitation' },
      { id: 'v6', label: 'Supplier credentials', status: 'warn', detail: '18 connections need their API keys re-entered (secrets are not exported from DHRU)' },
    ],
  }
}
