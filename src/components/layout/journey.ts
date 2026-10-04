import { brand, demoInstallation } from '@/config/brand'

export interface Step {
  label: string
  to: string
  area: 'Vendor' | 'Installation' | 'Storefront' | 'Portal' | 'Demo'
  note?: string
}

/** The ORVEX demo story, in order (see docs/ALIGNMENT_PLAN.md · "most important demo story"). */
export const JOURNEY: Step[] = [
  { label: `${brand.product} — the product`, to: '/', area: 'Vendor', note: brand.domain },
  { label: 'Vendor portal: your installations & licence', to: '/account/installation', area: 'Vendor', note: 'separate from your operational data' },
  { label: 'Installation & go-live checklist', to: '/admin/system/installation', area: 'Installation', note: `${demoInstallation.domain} · self-hosted` },
  { label: 'Operations cockpit', to: '/admin', area: 'Installation' },
  { label: 'Provider API — connect & sync a 100-service catalog', to: '/admin/integrations/providers', area: 'Installation', note: 'Global GSM Provider · inbound' },
  { label: 'A DHRU supplier — Supplier Alpha', to: '/admin/suppliers/sup_alpha', area: 'Installation', note: 'DHRU Fusion HTTP driver' },
  { label: 'Review catalog sync changes', to: '/admin/catalog/sync', area: 'Installation' },
  { label: 'Service, fields & offers', to: '/admin/services/svc_4001', area: 'Installation', note: 'iPhone 15 Carrier Check' },
  { label: 'Pricing — why this price?', to: '/admin/pricing', area: 'Installation' },
  { label: 'Storefront — a customer orders', to: '/site', area: 'Storefront', note: demoInstallation.domain },
  { label: 'Guarded failover (Scenario B)', to: '/admin/orders?scenario=B', area: 'Installation' },
  { label: 'Timeout → UNKNOWN → Needs review', to: '/admin/orders?status=needs_review', area: 'Installation' },
  { label: 'Ledger — every cent, double-entry', to: '/admin/finance/ledger', area: 'Installation' },
  { label: 'Supplier reconciliation (−$11.00 drift)', to: '/admin/finance/reconciliation', area: 'Installation' },
  { label: 'Reseller portal — ABC GSM', to: '/portal', area: 'Portal' },
  { label: 'Reseller API — clients, keys & an order end to end', to: '/admin/developer', area: 'Installation', note: 'outbound' },
  { label: 'Native API docs & console', to: '/admin/developer/api', area: 'Installation' },
  { label: 'DHRU-compatible endpoint', to: '/admin/developer/dhru', area: 'Installation' },
  { label: 'Coming from DHRU — migration', to: '/admin/migration', area: 'Installation' },
  { label: 'Verification & refunds', to: '/admin/verifications', area: 'Installation' },
  { label: 'Audit log', to: '/admin/system/audit', area: 'Installation' },
  { label: 'Updates & licence state', to: '/admin/system/updates', area: 'Installation' },
  { label: 'DEMO / SIMULATION controls', to: '/admin/demo', area: 'Demo', note: 'force timeouts, payments, roles' },
]
