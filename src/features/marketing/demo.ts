/**
 * Marketing demo data — a faithful slice of the demo installation seed
 * (UnlockDesk Demo Ltd., ORVEX-DEMO-001). Suppliers, services, offers and
 * tier prices mirror src/mock/installation/data/*. Illustrative only: the
 * landing page never talks to an installation.
 */
export type SupplierKey = 'alpha' | 'beta' | 'gamma' | 'delta' | 'epsilon' | 'zeta' | 'eta' | 'theta' | 'iota' | 'kappa'
export type DriverKind = 'DHRU Fusion' | 'REST' | 'Manual'
export type Health = 'healthy' | 'degraded' | 'auth_error' | 'low_balance' | 'circuit_open' | 'half_open' | 'maintenance'

export interface DemoSupplier {
  key: SupplierKey
  name: string
  short: string
  mono: string
  driver: DriverKind
  health: Health
  color: string
}

// Identity colours never use coral (c1): coral is reserved for signal.
export const SUPPLIERS: Record<SupplierKey, DemoSupplier> = {
  alpha: { key: 'alpha', name: 'DHRU Supplier Alpha', short: 'Alpha', mono: 'DA', driver: 'DHRU Fusion', health: 'healthy', color: 'var(--c2)' },
  beta: { key: 'beta', name: 'Beta Unlock Source', short: 'Beta', mono: 'BU', driver: 'DHRU Fusion', health: 'healthy', color: 'var(--c3)' },
  gamma: { key: 'gamma', name: 'GammaCheck IMEI API', short: 'GammaCheck', mono: 'GC', driver: 'REST', health: 'healthy', color: 'var(--c4)' },
  delta: { key: 'delta', name: 'Delta GSM Server', short: 'Delta', mono: 'DG', driver: 'DHRU Fusion', health: 'degraded', color: 'var(--c5)' },
  epsilon: { key: 'epsilon', name: 'Epsilon Code Factory', short: 'Epsilon', mono: 'EC', driver: 'DHRU Fusion', health: 'auth_error', color: 'var(--c6)' },
  zeta: { key: 'zeta', name: 'Zeta Device Data', short: 'Zeta', mono: 'ZD', driver: 'REST', health: 'low_balance', color: 'var(--c3)' },
  eta: { key: 'eta', name: 'Eta Unlock Hub', short: 'Eta', mono: 'EU', driver: 'DHRU Fusion', health: 'circuit_open', color: 'var(--c2)' },
  theta: { key: 'theta', name: 'Theta Carrier Desk', short: 'Theta', mono: 'TC', driver: 'DHRU Fusion', health: 'half_open', color: 'var(--c4)' },
  iota: { key: 'iota', name: 'Iota Warranty Network', short: 'Iota', mono: 'IW', driver: 'REST', health: 'maintenance', color: 'var(--c5)' },
  kappa: { key: 'kappa', name: 'Kappa Manual Desk', short: 'Kappa', mono: 'KM', driver: 'Manual', health: 'healthy', color: 'var(--c6)' },
}

export const HEALTH_LABEL: Record<Health, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  auth_error: 'Auth error',
  low_balance: 'Low balance',
  circuit_open: 'Circuit open',
  half_open: 'Half-open',
  maintenance: 'Maintenance',
}

/** Routable = the routing engine may send new orders there. */
export const ROUTABLE: Record<Health, boolean> = { healthy: true, degraded: true, low_balance: true, half_open: true, auth_error: false, circuit_open: false, maintenance: false }

export const HEALTH_TONE: Record<Health, 'success' | 'warning' | 'danger' | 'neutral'> = {
  healthy: 'success',
  degraded: 'warning',
  low_balance: 'warning',
  half_open: 'warning',
  auth_error: 'danger',
  circuit_open: 'danger',
  maintenance: 'neutral',
}

export type Category = 'IMEI Checks' | 'Carrier & Network' | 'Warranty' | 'Unlock Codes' | 'Serial'

/** ServiceIcon colour buckets (components/brand) keyed by the old category names. */
export const ICON_BUCKET: Record<Category, string> = {
  'IMEI Checks': 'IMEI Services',
  'Carrier & Network': 'Other Services',
  Warranty: 'Codes',
  'Unlock Codes': 'Unlocking',
  Serial: 'Server Services',
}

export interface DemoService {
  code: string
  name: string
  category: Category
  icon: string
  processing: 'Instant' | 'Async'
  turnaround: string
  fields: string[]
  /** Offers in priority order — cost is the supplier product's cost. */
  offers: { k: SupplierKey; external: string; cost: number }[]
  /** Tier prices as the PricingEngine calculates them today (Retail is the list price). */
  tiers: { retail: number; silver: number; gold: number; platinum: number }
  /** How each non-retail tier is derived, for the "why this price" line. */
  rule: string
}

export const SERVICES: DemoService[] = [
  {
    code: '4001', name: 'iPhone 15 Carrier Check', category: 'IMEI Checks', icon: 'radio-tower', processing: 'Instant', turnaround: '1–3 min', fields: ['imei'],
    offers: [{ k: 'alpha', external: '#1042 · DHRU', cost: 0.72 }, { k: 'beta', external: '#1187 · DHRU', cost: 0.85 }],
    tiers: { retail: 3.5, silver: 0.9, gold: 0.94, platinum: 0.82 }, rule: 'Platinum is a contract price; Silver / Gold are cost + 25% / 30%',
  },
  {
    code: '4006', name: 'IMEI Blacklist Check (GSMA)', category: 'IMEI Checks', icon: 'shield-ban', processing: 'Instant', turnaround: '20–90 s', fields: ['imei'],
    offers: [{ k: 'gamma', external: 'imei.blacklist-gsma', cost: 0.08 }, { k: 'alpha', external: '#1051 · DHRU', cost: 0.11 }, { k: 'beta', external: '#1193 · DHRU', cost: 0.12 }],
    tiers: { retail: 0.9, silver: 0.1, gold: 0.15, platinum: 0.1 }, rule: 'Gold has a negotiated volume price; others are cost-plus',
  },
  {
    code: '4007', name: 'IMEI Full Report', category: 'IMEI Checks', icon: 'scan-barcode', processing: 'Instant', turnaround: '1–3 min', fields: ['imei'],
    offers: [{ k: 'gamma', external: 'imei.full-report', cost: 0.95 }, { k: 'alpha', external: '#1056 · DHRU', cost: 1.1 }],
    tiers: { retail: 4.5, silver: 1.19, gold: 1.24, platinum: 1.1 }, rule: 'Cost of the priority offer + 25% / 30% / 15%, rounded up to the cent',
  },
  {
    code: '4012', name: 'Activation Lock Status Check', category: 'IMEI Checks', icon: 'file-search', processing: 'Instant', turnaround: '30–120 s', fields: ['imei'],
    offers: [{ k: 'gamma', external: 'imei.activation-status', cost: 0.22 }, { k: 'alpha', external: '#1063 · DHRU', cost: 0.26 }],
    tiers: { retail: 1.5, silver: 0.28, gold: 0.29, platinum: 0.26 }, rule: 'Read-only status check · cost-plus per tier',
  },
  {
    code: '4018', name: 'Network Compatibility Check', category: 'Carrier & Network', icon: 'signal', processing: 'Instant', turnaround: '5–30 s', fields: ['model', 'country'],
    offers: [{ k: 'gamma', external: 'carrier.compatibility', cost: 0.06 }, { k: 'zeta', external: 'device.bands', cost: 0.0425 }],
    tiers: { retail: 0.6, silver: 0.08, gold: 0.08, platinum: 0.18 }, rule: 'Platinum carries a flat $0.12 margin on network checks',
  },
  {
    code: '4031', name: 'Apple Warranty & AppleCare Check', category: 'Warranty', icon: 'badge-check', processing: 'Instant', turnaround: '5–60 s', fields: ['imei'],
    offers: [{ k: 'zeta', external: 'warranty.apple', cost: 0.14 }, { k: 'gamma', external: 'warranty.apple-care', cost: 0.17 }, { k: 'iota', external: 'wty.apple', cost: 0.12 }],
    tiers: { retail: 1.2, silver: 0.19, gold: 0.2, platinum: 0.17 }, rule: 'Warranty category carries +35% / +40% for Silver / Gold',
  },
  {
    code: '4037', name: 'iPhone Official Unlock — T-Mobile US', category: 'Unlock Codes', icon: 'lock-open', processing: 'Async', turnaround: '1–4 days', fields: ['imei'],
    offers: [{ k: 'alpha', external: '#1210 · DHRU', cost: 11 }, { k: 'beta', external: '#1302 · DHRU', cost: 13.2 }],
    tiers: { retail: 34, silver: 13.2, gold: 18, platinum: 12.35 }, rule: 'Carrier-authorised unlock for eligible, fully paid devices',
  },
  {
    code: '4040', name: 'Samsung Network Unlock Code (NCK)', category: 'Unlock Codes', icon: 'key-round', processing: 'Async', turnaround: '1–12 h', fields: ['imei', 'model'],
    offers: [{ k: 'beta', external: '#1288 · DHRU', cost: 6.92 }, { k: 'delta', external: '#2218 · DHRU', cost: 6.1 }, { k: 'alpha', external: '#1214 · DHRU', cost: 7.4 }],
    tiers: { retail: 14, silver: 8.35, gold: 9, platinum: 7.8 }, rule: 'Unlock codes rounded up to 5 cents for Silver and Platinum',
  },
  {
    code: '4044', name: 'Huawei Modem Unlock Code', category: 'Unlock Codes', icon: 'binary', processing: 'Instant', turnaround: '30–120 s', fields: ['imei', 'model'],
    offers: [{ k: 'delta', external: '#2231 · DHRU', cost: 0.9 }, { k: 'epsilon', external: '#3110 · DHRU', cost: 0.95 }, { k: 'alpha', external: '#1220 · DHRU', cost: 1.1 }],
    tiers: { retail: 4.5, silver: 1.1, gold: 1.17, platinum: 1.05 }, rule: 'Calculated code for supported modems · cost-plus per tier',
  },
  {
    code: '4051', name: 'Serial Number Check (Apple)', category: 'Serial', icon: 'scan-text', processing: 'Instant', turnaround: '5–60 s', fields: ['serial'],
    offers: [{ k: 'zeta', external: 'serial.apple', cost: 0.1 }, { k: 'gamma', external: 'serial.validate', cost: 0.12 }],
    tiers: { retail: 0.9, silver: 0.13, gold: 0.14, platinum: 0.12 }, rule: 'Serial category carries +40% for Gold',
  },
]

export const svc = (code: string) => SERVICES.find((s) => s.code === code)!

export const FIELD_HINT: Record<string, string> = {
  imei: '15 digits · Luhn',
  serial: 'serial format',
  model: 'GSM pack model list',
  country: 'ISO country',
  carrier: 'carrier list',
  brand: 'brand list',
}
