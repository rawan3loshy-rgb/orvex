/**
 * DEMO DATA — ten fictional GSM suppliers. All connections are simulated.
 *
 *   sup_alpha    DHRU Supplier Alpha     DHRU Fusion   healthy        (drift −$11.00 from an UNKNOWN order)
 *   sup_beta     Beta Unlock Source      DHRU Fusion   healthy        backup for most Alpha services
 *   sup_gamma    GammaCheck IMEI API     ORVEX REST    healthy        instant checks, results inline
 *   sup_delta    Delta GSM Server        DHRU Fusion   degraded       slow and flaky
 *   sup_epsilon  Epsilon Code Factory    DHRU Fusion   auth error     API key rejected since 2 h ago
 *   sup_zeta     Zeta Device Data        ORVEX REST    low balance    prepaid credit almost used up
 *   sup_eta      Eta Unlock Hub          DHRU Fusion   circuit open   connection refused ×5
 *   sup_theta    Theta Carrier Desk      DHRU Fusion   half-open      recovering, probing
 *   sup_iota     Iota Warranty Network   ORVEX REST    maintenance    scheduled window
 *   sup_kappa    Kappa Manual Desk       Manual        healthy        hand-fulfilled codes
 */
import { usd, type Micros } from '@/core/money'
import type { DriverId, ErrorMapping, Supplier, SupplierProfile } from '@/core/domain'

export interface SupplierSpec {
  id: string
  name: string
  code: string
  driver: DriverId
  url: string
  username: string | null
  credentials: { key: string; label: string; masked: string }[]
  profile: SupplierProfile
  timeoutMs: number
  lowBalanceThreshold: Micros
  rateLimit: Supplier['rateLimit']
  region: string
  color: string
  notes: string
  connectedDaysAgo: number
  /** Expected (ledger − in-flight) balance at the end of the seed. */
  targetExpected: Micros
  /** Extra drift not explained by unknown orders (e.g. an unrecorded supplier credit). */
  extraDrift: Micros
  callbackSigning: 'hmac_sha256' | 'none'
  cooldownSec: number
}

const SAFE: ErrorMapping[] = [
  { id: 'em_src', match: 'source unavailable', classifyAs: 'rejected_failover_safe', note: 'Supplier-side capacity — another supplier can fulfil' },
  { id: 'em_dis', match: 'temporarily disabled', classifyAs: 'rejected_failover_safe', note: 'Supplier switched the service off' },
  { id: 'em_oos', match: 'out of stock', classifyAs: 'rejected_failover_safe', note: 'No codes in stock at the supplier' },
  { id: 'em_imei', match: 'not found in manufacturer database', classifyAs: 'rejected_terminal', note: 'Input problem — every supplier would reject' },
  { id: 'em_elig', match: 'not eligible', classifyAs: 'rejected_terminal', note: 'Device eligibility — terminal' },
]

export const SUPPLIER_SPECS: SupplierSpec[] = [
  {
    id: 'sup_alpha',
    name: 'DHRU Supplier Alpha',
    code: 'ALP',
    driver: 'dhru_fusion',
    url: 'https://api.alpha-gsm.example',
    username: 'unlockdesk',
    credentials: [{ key: 'api_access_key', label: 'API access key', masked: 'K7Q2-••••-••••-91XZ' }],
    profile: { successRate: 0.987, latencyMs: 420, jitter: 0.3 },
    timeoutMs: 10_000,
    lowBalanceThreshold: usd(500),
    rateLimit: { requests: 20, perSeconds: 1 },
    region: 'EU-Central · Frankfurt',
    color: 'var(--c2)',
    notes: 'Primary for most IMEI checks and US official unlocks. DHRU Fusion v6.1.',
    connectedDaysAgo: 412,
    targetExpected: usd(2481.32),
    extraDrift: usd(0),
    callbackSigning: 'none',
    cooldownSec: 120,
  },
  {
    id: 'sup_beta',
    name: 'Beta Unlock Source',
    code: 'BET',
    driver: 'dhru_fusion',
    url: 'https://beta-unlock.example',
    username: 'udesk_api',
    credentials: [{ key: 'api_access_key', label: 'API access key', masked: 'B3TA-••••-••••-0C1D' }],
    profile: { successRate: 0.985, latencyMs: 610, jitter: 0.35 },
    timeoutMs: 12_000,
    lowBalanceThreshold: usd(400),
    rateLimit: { requests: 10, perSeconds: 1 },
    region: 'UK · London',
    color: 'var(--c3)',
    notes: 'Backup offer for Alpha services; strong on unlock codes.',
    connectedDaysAgo: 380,
    targetExpected: usd(1942.1),
    extraDrift: usd(2.4),
    callbackSigning: 'none',
    cooldownSec: 120,
  },
  {
    id: 'sup_gamma',
    name: 'GammaCheck IMEI API',
    code: 'GAM',
    driver: 'orvex_rest',
    url: 'https://api.gammacheck.example',
    username: null,
    credentials: [
      { key: 'api_token', label: 'API token', masked: 'gmc_••••••••••••••••a91e' },
      { key: 'callback_secret', label: 'Callback signing secret', masked: 'whsec_••••••••4b10' },
    ],
    profile: { successRate: 0.992, latencyMs: 180, jitter: 0.25 },
    timeoutMs: 8_000,
    lowBalanceThreshold: usd(500),
    rateLimit: { requests: 50, perSeconds: 1 },
    region: 'US-East · Virginia',
    color: 'var(--c4)',
    notes: 'Fast instant checks with inline results.',
    connectedDaysAgo: 301,
    targetExpected: usd(3120.55),
    extraDrift: usd(0),
    callbackSigning: 'hmac_sha256',
    cooldownSec: 120,
  },
  {
    id: 'sup_delta',
    name: 'Delta GSM Server',
    code: 'DLT',
    driver: 'dhru_fusion',
    url: 'https://server.delta-gsm.example',
    username: 'unlockdesk',
    credentials: [{ key: 'api_access_key', label: 'API access key', masked: 'D17A-••••-••••-77QE' }],
    profile: { successRate: 0.76, latencyMs: 1500, jitter: 0.95 },
    timeoutMs: 15_000,
    lowBalanceThreshold: usd(300),
    rateLimit: { requests: 5, perSeconds: 1 },
    region: 'AP-Southeast · Singapore',
    color: 'var(--c5)',
    notes: 'Cheap but flaky over the last week — latency spikes.',
    connectedDaysAgo: 214,
    targetExpected: usd(640.8),
    extraDrift: usd(0),
    callbackSigning: 'none',
    cooldownSec: 120,
  },
  {
    id: 'sup_epsilon',
    name: 'Epsilon Code Factory',
    code: 'EPS',
    driver: 'dhru_fusion',
    url: 'https://epsilon-codes.example',
    username: 'unlockdesk',
    credentials: [{ key: 'api_access_key', label: 'API access key', masked: 'EPS1-••••-••••-3K0P' }],
    profile: { successRate: 0.97, latencyMs: 700, jitter: 0.3 },
    timeoutMs: 12_000,
    lowBalanceThreshold: usd(300),
    rateLimit: { requests: 10, perSeconds: 1 },
    region: 'EU-West · Amsterdam',
    color: 'var(--c6)',
    notes: 'Supplier rotated API keys this morning — ours was not updated.',
    connectedDaysAgo: 188,
    targetExpected: usd(815),
    extraDrift: usd(0),
    callbackSigning: 'none',
    cooldownSec: 120,
  },
  {
    id: 'sup_zeta',
    name: 'Zeta Device Data',
    code: 'ZET',
    driver: 'orvex_rest',
    url: 'https://api.zeta-devicedata.example',
    username: null,
    credentials: [{ key: 'api_token', label: 'API token', masked: 'zdd_••••••••••••••••5d0f' }],
    profile: { successRate: 0.985, latencyMs: 260, jitter: 0.3 },
    timeoutMs: 8_000,
    lowBalanceThreshold: usd(250),
    rateLimit: { requests: 30, perSeconds: 1 },
    region: 'US-West · Oregon',
    color: 'var(--c3)',
    notes: 'Warranty & device data. Prepaid — top up weekly.',
    connectedDaysAgo: 150,
    targetExpected: usd(38.4),
    extraDrift: usd(0),
    callbackSigning: 'hmac_sha256',
    cooldownSec: 120,
  },
  {
    id: 'sup_eta',
    name: 'Eta Unlock Hub',
    code: 'ETA',
    driver: 'dhru_fusion',
    url: 'https://eta-unlockhub.example',
    username: 'unlockdesk',
    credentials: [{ key: 'api_access_key', label: 'API access key', masked: 'ETA9-••••-••••-1M2N' }],
    profile: { successRate: 0.96, latencyMs: 820, jitter: 0.4 },
    timeoutMs: 12_000,
    lowBalanceThreshold: usd(300),
    rateLimit: { requests: 10, perSeconds: 1 },
    region: 'EU-East · Warsaw',
    color: 'var(--c5)',
    notes: 'Connection refused repeatedly — circuit opened automatically.',
    connectedDaysAgo: 122,
    targetExpected: usd(1210),
    extraDrift: usd(0),
    callbackSigning: 'none',
    cooldownSec: 1800,
  },
  {
    id: 'sup_theta',
    name: 'Theta Carrier Desk',
    code: 'THE',
    driver: 'dhru_fusion',
    url: 'https://theta-carrier.example',
    username: 'unlockdesk',
    credentials: [{ key: 'api_access_key', label: 'API access key', masked: 'TH3T-••••-••••-8V2B' }],
    profile: { successRate: 0.97, latencyMs: 540, jitter: 0.3 },
    timeoutMs: 12_000,
    lowBalanceThreshold: usd(200),
    rateLimit: { requests: 10, perSeconds: 1 },
    region: 'UK · Manchester',
    color: 'var(--c4)',
    notes: 'Recovering after an outage — circuit half-open, next order is a probe.',
    connectedDaysAgo: 96,
    targetExpected: usd(455.25),
    extraDrift: usd(0),
    callbackSigning: 'none',
    cooldownSec: 600,
  },
  {
    id: 'sup_iota',
    name: 'Iota Warranty Network',
    code: 'IOT',
    driver: 'orvex_rest',
    url: 'https://api.iota-warranty.example',
    username: null,
    credentials: [{ key: 'api_token', label: 'API token', masked: 'iwn_••••••••••••••••c71b' }],
    profile: { successRate: 0.98, latencyMs: 300, jitter: 0.3 },
    timeoutMs: 8_000,
    lowBalanceThreshold: usd(200),
    rateLimit: { requests: 30, perSeconds: 1 },
    region: 'EU-North · Stockholm',
    color: 'var(--c6)',
    notes: 'Scheduled maintenance announced by the supplier.',
    connectedDaysAgo: 70,
    targetExpected: usd(980),
    extraDrift: usd(0),
    callbackSigning: 'hmac_sha256',
    cooldownSec: 120,
  },
  {
    id: 'sup_kappa',
    name: 'Kappa Manual Desk',
    code: 'KAP',
    driver: 'manual',
    url: 'https://kappa-desk.example',
    username: 'unlockdesk',
    credentials: [{ key: 'portal_password', label: 'Supplier portal password', masked: '••••••••••' }],
    profile: { successRate: 0.99, latencyMs: 250, jitter: 0.2 },
    timeoutMs: 10_000,
    lowBalanceThreshold: usd(100),
    rateLimit: { requests: 2, perSeconds: 1 },
    region: 'Manual desk · GMT',
    color: 'var(--c2)',
    notes: 'Hand-fulfilled legacy unlock codes (Nokia/HMD, LG). Results in 2–12 h.',
    connectedDaysAgo: 260,
    targetExpected: usd(300),
    extraDrift: usd(0),
    callbackSigning: 'none',
    cooldownSec: 120,
  },
]

export function buildSupplier(spec: SupplierSpec, now: number): Supplier {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
  return {
    id: spec.id,
    name: spec.name,
    code: spec.code,
    driver: spec.driver,
    connection: { url: spec.url, username: spec.username, credentials: spec.credentials.map((c) => ({ ...c, updatedAt: iso(spec.connectedDaysAgo * 86400_000 * 0.4) })), environment: 'simulated' },
    enabled: true,
    maintenance: { active: false, until: null, note: '' },
    circuit: { state: 'closed', consecutiveFailures: 0, threshold: 5, openedAt: null, cooldownSec: spec.cooldownSec },
    auth: { status: 'ok', checkedAt: iso(3600_000), message: null },
    reportedBalance: usd(0),
    balanceCheckedAt: iso(60_000),
    lowBalanceThreshold: spec.lowBalanceThreshold,
    timeoutMs: spec.timeoutMs,
    rateLimit: spec.rateLimit,
    errorMappings: SAFE.map((m) => ({ ...m, id: `${m.id}_${spec.code.toLowerCase()}` })),
    callback: { url: spec.callbackSigning === 'hmac_sha256' ? `https://portal.unlockdesk-demo.com/hooks/suppliers/${spec.id.replace('sup_', '')}` : null, signing: spec.callbackSigning },
    region: spec.region,
    notes: spec.notes,
    color: spec.color,
    connectedAt: iso(spec.connectedDaysAgo * 86400_000),
    lastSyncAt: null,
    profile: spec.profile,
  }
}
