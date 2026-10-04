/**
 * DEMO DATA — "Global GSM Provider", the Provider-API walkthrough supplier.
 *
 * A wholesale provider exposing a 100-service catalog over the ORVEX REST
 * adapter (API key auth). ORVEX imported the catalog as supplier products;
 * 22 of them are mapped as extra (lowest-priority) offers on existing ORVEX
 * services — the customer-facing service stays ORVEX's, the product is source data.
 *
 * Since the last scheduled sync the provider changed its catalog
 * (GLOBAL_SYNC_DELTA): the next "Sync catalog" discovers
 *   101 remote services · 95 unchanged · 2 new · 4 changed · 1 removed.
 *
 * The same catalog (with per-provider cost jitter) is what any newly connected
 * provider exposes in the simulation, so Connect → Test → Sync always discovers
 * a realistic catalog.
 */
import { usd, type Micros } from '@/core/money'
import type { DriverId } from '@/core/domain'
import type { RemoteProduct } from '@/core/ports'
import { createRng } from '@/lib/random'
import type { SupplierSpec } from './suppliers'

export const GLOBAL_PROVIDER_ID = 'sup_global'

export const GLOBAL_PROVIDER_SPEC: SupplierSpec = {
  id: GLOBAL_PROVIDER_ID,
  name: 'Global GSM Provider',
  code: 'GLB',
  driver: 'orvex_rest',
  url: 'https://api.example-provider.test/v1',
  username: null,
  credentials: [
    { key: 'api_token', label: 'API key', masked: 'gsp_live_••••••••••••7f3a' },
    { key: 'callback_secret', label: 'Callback signing secret', masked: 'whsec_••••••••e21c' },
  ],
  profile: { successRate: 0.99, latencyMs: 240, jitter: 0.25 },
  timeoutMs: 8_000,
  lowBalanceThreshold: usd(300),
  rateLimit: { requests: 40, perSeconds: 1 },
  region: 'EU-West · Dublin',
  color: 'var(--c2)',
  notes: 'Wholesale GSM catalog (100 services) connected through the ORVEX REST adapter with an API key. Mapped products are fallback offers behind the primary suppliers.',
  connectedDaysAgo: 12,
  targetExpected: usd(1850),
  extraDrift: usd(0),
  callbackSigning: 'hmac_sha256',
  cooldownSec: 120,
}

export interface ProviderCatalogItem {
  externalId: string
  name: string
  group: string
  cost: number
  fields: string[]
  processing: string
  /** ORVEX service this product is mapped to as an offer (demo seed only). */
  mapTo?: string
}

const IMEI = ['imei']
const CODE = ['imei', 'model']
const SERIAL = ['serial_number']
const NOW = 'Instant'
const CODE_ETA = '1–12 h'

const G = { imei: 'IMEI Checks', carrier: 'Carrier & Network', device: 'Device Information', warranty: 'Warranty', unlock: 'Unlock Codes (carrier-authorised)', serial: 'Serial Checks' }

const item = (externalId: string, name: string, group: string, cost: number, fields = IMEI, mapTo?: string, processing = NOW): ProviderCatalogItem => ({ externalId, name, group, cost, fields, processing, mapTo })

/** The provider's catalog as ORVEX imported it 12 days ago — exactly 100 services. */
export const GLOBAL_CATALOG: ProviderCatalogItem[] = [
  /* IMEI checks (24) */
  item('101', 'IMEI Blacklist Check (GSMA)', G.imei, 0.1, IMEI, 'svc_4006'),
  item('102', 'IMEI Full Report', G.imei, 1.05, IMEI, 'svc_4007'),
  item('103', 'Samsung Carrier & Blacklist Check', G.imei, 0.35, IMEI, 'svc_4008'),
  item('104', 'Activation Lock Status (Apple, read-only)', G.imei, 0.24, IMEI, 'svc_4012'),
  item('105', 'iPhone 16 Carrier Check', G.imei, 0.94, IMEI, 'svc_4002'),
  item('106', 'iPhone 14 Carrier Check', G.imei, 0.72, IMEI, 'svc_4003'),
  item('107', 'iPhone 13 Carrier Check', G.imei, 0.62, IMEI, 'svc_4004'),
  item('108', 'Xiaomi IMEI Info', G.imei, 0.17, IMEI, 'svc_4010'),
  item('109', 'Google Pixel Carrier Check', G.imei, 0.39, IMEI, 'svc_4009'),
  item('110', 'Apple Purchase Date Check', G.imei, 0.5),
  item('111', 'Trade-in Check Bundle', G.imei, 1.39, IMEI, 'svc_4013'),
  item('112', 'Huawei Carrier Check', G.imei, 0.21),
  item('113', 'Oppo IMEI Info', G.imei, 0.09),
  item('114', 'Vivo IMEI Info', G.imei, 0.09),
  item('115', 'Realme IMEI Info', G.imei, 0.09),
  item('116', 'OnePlus IMEI Info', G.imei, 0.1),
  item('117', 'Honor IMEI Info', G.imei, 0.1),
  item('118', 'Nokia / HMD IMEI Info', G.imei, 0.08),
  item('119', 'Sony IMEI Info', G.imei, 0.08),
  item('120', 'LG IMEI Info', G.imei, 0.07),
  item('121', 'Lenovo IMEI Info', G.imei, 0.08),
  item('122', 'ZTE IMEI Info', G.imei, 0.07),
  item('123', 'Tecno IMEI Info', G.imei, 0.08),
  item('124', 'Infinix IMEI Info', G.imei, 0.08),
  /* Carrier & network (20) */
  item('201', 'SIM-Lock Status Check', G.carrier, 0.3, IMEI, 'svc_4015'),
  item('202', 'US Carrier Lookup', G.carrier, 0.37, IMEI, 'svc_4016'),
  item('203', 'UK Network Check', G.carrier, 0.33, IMEI, 'svc_4017'),
  item('204', 'Network Compatibility Check', G.carrier, 0.05, ['model', 'country'], 'svc_4018'),
  item('205', '5G Compatibility Check', G.carrier, 0.06, ['model', 'country']),
  item('206', 'Carrier Check — LATAM', G.carrier, 0.4),
  item('207', 'Carrier Check — Canada', G.carrier, 0.36),
  item('208', 'Carrier Check — Australia', G.carrier, 0.35),
  item('209', 'Carrier Check — Germany', G.carrier, 0.32),
  item('210', 'Carrier Check — France', G.carrier, 0.32),
  item('211', 'Carrier Check — Italy', G.carrier, 0.32),
  item('212', 'Carrier Check — Spain', G.carrier, 0.32),
  item('213', 'Carrier Check — Japan', G.carrier, 0.44),
  item('214', 'Carrier Check — Middle East', G.carrier, 0.41),
  item('215', 'eSIM Capability Check', G.carrier, 0.05, ['model']),
  item('216', 'Roaming Lock Check', G.carrier, 0.28),
  item('217', 'Carrier Unlock Eligibility — US', G.carrier, 0.46),
  item('218', 'Carrier Unlock Eligibility — UK', G.carrier, 0.42),
  item('219', 'Carrier Unlock Eligibility — Canada', G.carrier, 0.44),
  item('220', 'MVNO Network Lookup', G.carrier, 0.26),
  /* Device information (18) */
  item('301', 'Device Information (IMEI)', G.device, 0.1, IMEI, 'svc_4024'),
  item('302', 'Apple Model & Specs (Serial)', G.device, 0.12, SERIAL, 'svc_4025'),
  item('303', 'Samsung Device Info', G.device, 0.11, IMEI, 'svc_4026'),
  item('304', 'Manufacture Date Lookup', G.device, 0.07),
  item('305', 'Apple First Activation Date', G.device, 0.4),
  item('306', 'Google Pixel Device Info', G.device, 0.11),
  item('307', 'Huawei Device Info', G.device, 0.1),
  item('308', 'Battery Health Estimate', G.device, 0.09),
  item('309', 'Storage & Colour Lookup', G.device, 0.06),
  item('310', 'Model Number Decoder', G.device, 0.04, ['model']),
  item('311', 'Refurbishment History', G.device, 0.35),
  item('312', 'Parts Pairing Check', G.device, 0.28),
  item('313', 'Device Age Estimate', G.device, 0.05),
  item('314', 'Sold-by Region Lookup', G.device, 0.22),
  item('315', 'Apple Replacement Status', G.device, 0.3),
  item('316', 'Samsung Model Code Lookup', G.device, 0.06),
  item('317', 'Xiaomi Region Check', G.device, 0.12),
  item('318', 'Tablet Device Info', G.device, 0.1),
  /* Warranty (14) */
  item('401', 'Apple Warranty & AppleCare Check', G.warranty, 0.15, IMEI, 'svc_4031'),
  item('402', 'Samsung Warranty Check', G.warranty, 0.12, IMEI, 'svc_4032'),
  item('403', 'Google Pixel Warranty', G.warranty, 0.13),
  item('404', 'Xiaomi Warranty Check', G.warranty, 0.11),
  item('405', 'Motorola Warranty Check', G.warranty, 0.11),
  item('406', 'Multi-brand Warranty Check', G.warranty, 0.16, ['imei', 'brand'], 'svc_4036'),
  item('407', 'Huawei Warranty Check', G.warranty, 0.11),
  item('408', 'OnePlus Warranty Check', G.warranty, 0.11),
  item('409', 'Sony Warranty Check', G.warranty, 0.11),
  item('410', 'Oppo Warranty Check', G.warranty, 0.1),
  item('411', 'Vivo Warranty Check', G.warranty, 0.1),
  item('412', 'Lenovo Warranty Check', G.warranty, 0.1),
  item('413', 'Device Insurance Status', G.warranty, 0.38),
  item('414', 'Extended Warranty Lookup', G.warranty, 0.2),
  /* Unlock codes — carrier-authorised only (14) */
  item('501', 'Samsung Network Unlock Code (NCK)', G.unlock, 7.1, CODE, 'svc_4040', CODE_ETA),
  item('502', 'Motorola Network Unlock Code', G.unlock, 5.2, CODE, undefined, CODE_ETA),
  item('503', 'Alcatel / TCL Unlock Code (NCK)', G.unlock, 3.3, CODE, undefined, CODE_ETA),
  item('504', 'ZTE Unlock Code', G.unlock, 3.5, CODE, undefined, CODE_ETA),
  item('505', 'Huawei Modem Unlock Code', G.unlock, 1.05, CODE),
  item('506', 'Nokia / HMD Unlock Code', G.unlock, 4.3, CODE, undefined, CODE_ETA),
  item('507', 'LG Unlock Code (Legacy)', G.unlock, 3.7, CODE, undefined, CODE_ETA),
  item('508', 'Sony Xperia Unlock Code', G.unlock, 4.4, CODE, undefined, CODE_ETA),
  item('509', 'OnePlus Unlock Code', G.unlock, 5.0, CODE, undefined, CODE_ETA),
  item('510', 'Samsung Unlock Code — Express', G.unlock, 8.6, CODE),
  item('511', 'iPhone Official Unlock — AT&T US', G.unlock, 9.1, IMEI, undefined, '6–72 h'),
  item('512', 'iPhone Official Unlock — UK Networks', G.unlock, 7.5, ['imei', 'carrier'], undefined, '2–48 h'),
  item('513', 'Google Pixel Official Unlock — US', G.unlock, 10.4, ['imei', 'carrier'], undefined, '24–72 h'),
  item('514', 'BlackBerry MEP Code (legacy)', G.unlock, 2.2, IMEI, undefined, CODE_ETA),
  /* Serial checks (10) */
  item('601', 'Serial Number Check (Apple)', G.serial, 0.11, SERIAL, 'svc_4051'),
  item('602', 'Serial Number Check (Samsung)', G.serial, 0.11, SERIAL),
  item('603', 'Serial to Device Profile (Apple)', G.serial, 0.6, SERIAL),
  item('604', 'Serial Validation — Multi-brand', G.serial, 0.08, ['serial_number', 'brand']),
  item('605', 'MacBook Serial Check', G.serial, 0.14, SERIAL),
  item('606', 'iPad Serial Check', G.serial, 0.13, SERIAL),
  item('607', 'Apple Watch Serial Check', G.serial, 0.13, SERIAL),
  item('608', 'AirPods Serial Check', G.serial, 0.09, SERIAL),
  item('609', 'Serial Check — Huawei', G.serial, 0.09, SERIAL),
  item('610', 'Serial Check — Xiaomi', G.serial, 0.09, SERIAL),
]

/** What changed upstream since the last scheduled sync (picked up by the next "Sync catalog"). */
export const GLOBAL_SYNC_DELTA = {
  added: [item('125', 'Galaxy S25 Carrier & Blacklist Check', G.imei, 0.36), item('126', 'iPhone 17 Carrier Check', G.imei, 0.98)],
  /** externalId → new cost: one decrease on a mapped product, one increase on a mapped product, one unmapped. */
  priced: [
    ['101', 0.09],
    ['301', 0.12],
    ['206', 0.44],
  ] as [string, number][],
  /** externalId → new required input fields. */
  fields: [['201', ['imei', 'brand']]] as [string, string[]][],
  removed: ['514'],
}

/** Field names as a driver expects them on the wire (DHRU uses upper-case parameters). */
function wireFields(driver: DriverId, fields: string[]) {
  return driver === 'dhru_fusion' ? fields.map((f) => (f === 'model' ? 'MODELID' : f.toUpperCase())) : fields
}

export function toRemoteProduct(i: ProviderCatalogItem, driver: DriverId, cost: Micros = usd(i.cost)): RemoteProduct {
  return { externalId: i.externalId, name: i.name, groupName: i.group, cost, fields: wireFields(driver, i.fields), processingHint: i.processing }
}

/** Remote catalog a freshly connected (simulated) provider exposes: same services, its own prices. */
export function simulatedProviderCatalog(driver: DriverId, seed: number): RemoteProduct[] {
  const rng = createRng(seed)
  return GLOBAL_CATALOG.map((i) => toRemoteProduct(i, driver, usd(Math.max(0.03, +(i.cost * rng.float(0.88, 1.15)).toFixed(2)))))
}
