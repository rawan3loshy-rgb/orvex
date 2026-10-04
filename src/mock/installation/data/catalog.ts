/**
 * DEMO DATA — GSM catalog built from the GSM vertical pack.
 *
 * Legitimate services only: device checks, carrier / SIM-lock status,
 * compatibility, warranty, device information, serial checks and
 * carrier-authorised unlock codes for eligible devices.
 *
 * Every service → revision (fields + result schema from the pack) → offers →
 * supplier products (which own the cost). Retail list prices become Retail-tier
 * pricing rules; nothing else stores a price.
 */
import { createRng } from '@/lib/random'
import { usd, type Micros } from '@/core/money'
import { fieldType } from '@/core/fields'
import { GSM_CATEGORIES, GSM_FIELDS, GSM_RESULT_SCHEMAS } from '@/core/verticals/gsm'
import type { Category, FieldDef, Offer, Service, ServiceRevision, SupplierProduct } from '@/core/domain'
import { SUPPLIER_SPECS } from './suppliers'

const H = 3600
const D = 86400

type SupplierKey = 'alpha' | 'beta' | 'gamma' | 'delta' | 'epsilon' | 'zeta' | 'eta' | 'theta' | 'iota' | 'kappa'

export interface ServiceSpec {
  code: string
  name: string
  cat: (typeof GSM_CATEGORIES)[number]['id']
  processing: Service['processing']
  turn: [number, number]
  schema: keyof typeof GSM_RESULT_SCHEMAS
  fields: FieldDef[]
  retail: number
  offers: [SupplierKey, number][]
  summary: string
  tags: string[]
  popularity: number
  featured?: boolean
  status?: Service['status']
  /** Do not add generated fallback offers (scenario-critical services). */
  fixedOffers?: boolean
}

const F = GSM_FIELDS
const instant: [number, number] = [60, 180]

export const SERVICE_SPECS: ServiceSpec[] = [
  /* IMEI Checks ---------------------------------------------------------- */
  { code: '4001', name: 'iPhone 15 Carrier Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 3.5, offers: [['alpha', 0.72], ['beta', 0.85]], summary: 'Original carrier, SIM-lock policy, blacklist status and unlock eligibility for iPhone 15 models.', tags: ['apple', 'iphone 15', 'carrier', 'unlock', 'sim lock'], popularity: 14, featured: true, fixedOffers: true },
  { code: '4002', name: 'iPhone 16 Carrier Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 3.9, offers: [['alpha', 0.86], ['beta', 0.99]], summary: 'Carrier, SIM-lock and unlock eligibility for iPhone 16 / 16 Pro.', tags: ['apple', 'iphone 16', 'carrier', 'unlock'], popularity: 9, featured: true },
  { code: '4003', name: 'iPhone 14 Carrier Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 3.2, offers: [['alpha', 0.66], ['beta', 0.78]], summary: 'Carrier, SIM-lock and unlock eligibility for iPhone 14 models.', tags: ['apple', 'iphone 14', 'carrier', 'unlock'], popularity: 10 },
  { code: '4004', name: 'iPhone 13 Carrier Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 2.9, offers: [['alpha', 0.58], ['beta', 0.7], ['gamma', 0.74]], summary: 'Carrier, SIM-lock and unlock eligibility for iPhone 13 models.', tags: ['apple', 'iphone 13', 'carrier'], popularity: 7 },
  { code: '4005', name: 'iPhone 12 & Older Carrier Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 2.5, offers: [['alpha', 0.48], ['beta', 0.55]], summary: 'Carrier and SIM-lock status for iPhone 12 and earlier.', tags: ['apple', 'iphone 12', 'carrier'], popularity: 5 },
  { code: '4006', name: 'IMEI Blacklist Check (GSMA)', cat: 'cat_imei', processing: 'instant', turn: [20, 90], schema: 'blacklist', fields: [F.imei], retail: 0.9, offers: [['gamma', 0.08], ['alpha', 0.11], ['beta', 0.12]], summary: 'Checks the GSMA device registry for lost, stolen or unpaid-bill reports.', tags: ['blacklist', 'gsma', 'trade-in', 'lost', 'stolen'], popularity: 16, featured: true },
  { code: '4007', name: 'IMEI Full Report', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'full_report', fields: [F.imei], retail: 4.5, offers: [['gamma', 0.95], ['alpha', 1.1]], summary: 'Model, carrier, blacklist, SIM-lock, warranty and purchase country in one report.', tags: ['report', 'carrier', 'blacklist', 'warranty'], popularity: 9, featured: true },
  { code: '4008', name: 'Samsung Carrier & Blacklist Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 1.8, offers: [['gamma', 0.32], ['beta', 0.38]], summary: 'Original carrier, lock and blacklist status for Samsung Galaxy devices.', tags: ['samsung', 'carrier', 'blacklist'], popularity: 8 },
  { code: '4009', name: 'Google Pixel Carrier Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 1.9, offers: [['alpha', 0.36], ['gamma', 0.41]], summary: 'Carrier and SIM-lock status for Google Pixel phones.', tags: ['google', 'pixel', 'carrier'], popularity: 4 },
  { code: '4010', name: 'Xiaomi IMEI Check', cat: 'cat_imei', processing: 'instant', turn: [30, 120], schema: 'device_info', fields: [F.imei], retail: 1.2, offers: [['delta', 0.15], ['gamma', 0.18]], summary: 'Model, region and manufacture data for Xiaomi, Redmi and POCO.', tags: ['xiaomi', 'redmi', 'poco'], popularity: 4 },
  { code: '4011', name: 'Motorola IMEI Check', cat: 'cat_imei', processing: 'instant', turn: [30, 120], schema: 'carrier_check', fields: [F.imei], retail: 1.4, offers: [['gamma', 0.46], ['beta', 0.38]], summary: 'Carrier, lock and blacklist status for Motorola devices.', tags: ['motorola', 'carrier'], popularity: 4, fixedOffers: true },
  { code: '4012', name: 'Activation Lock Status Check (Apple)', cat: 'cat_imei', processing: 'instant', turn: [30, 120], schema: 'activation_status', fields: [F.imei], retail: 1.5, offers: [['gamma', 0.22], ['alpha', 0.26]], summary: 'Read-only status: is Activation Lock (Find My) on? Essential before buying a used iPhone.', tags: ['apple', 'activation lock', 'trade-in', 'find my'], popularity: 9 },
  { code: '4013', name: 'Trade-in Check Bundle', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'full_report', fields: [F.imei], retail: 5.9, offers: [['alpha', 1.35], ['gamma', 1.42]], summary: 'Blacklist + carrier + activation-lock status for trade-in desks, in one order.', tags: ['trade-in', 'bundle', 'blacklist'], popularity: 6 },
  { code: '4014', name: 'Apple Purchase & Replacement Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'device_info', fields: [F.imei], retail: 2.4, offers: [['alpha', 0.52], ['zeta', 0.49]], summary: 'Estimated purchase date, sold-to region and replacement status.', tags: ['apple', 'purchase'], popularity: 4 },

  /* Carrier & Network ---------------------------------------------------- */
  { code: '4015', name: 'SIM-Lock Status Check', cat: 'cat_carrier', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei, F.brand], retail: 1.6, offers: [['gamma', 0.29], ['theta', 0.31], ['beta', 0.33]], summary: 'Is the device SIM-locked, and to which network? Multi-brand.', tags: ['sim lock', 'carrier', 'unlock'], popularity: 8, featured: true },
  { code: '4016', name: 'US Carrier Lookup', cat: 'cat_carrier', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 1.7, offers: [['alpha', 0.34], ['beta', 0.4]], summary: 'Original US carrier (T-Mobile, AT&T, Verizon, Cricket) and lock policy.', tags: ['us', 'carrier', 't-mobile', 'at&t', 'verizon'], popularity: 6 },
  { code: '4017', name: 'UK Network Check', cat: 'cat_carrier', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 1.7, offers: [['theta', 0.3], ['beta', 0.36]], summary: 'Original UK network (EE, Vodafone, O2, Three) and lock status.', tags: ['uk', 'carrier', 'ee', 'vodafone', 'o2'], popularity: 5 },
  { code: '4018', name: 'Network Compatibility Check', cat: 'cat_carrier', processing: 'instant', turn: [5, 30], schema: 'compatibility', fields: [F.model, F.country], retail: 0.6, offers: [['gamma', 0.06], ['zeta', 0.0425]], summary: '2G/3G/4G/5G band support of a model against carriers in a target country.', tags: ['compatibility', 'bands', '5g', 'travel'], popularity: 5 },
  { code: '4019', name: '5G Compatibility Check', cat: 'cat_carrier', processing: 'instant', turn: [5, 30], schema: 'compatibility', fields: [F.model, F.country], retail: 0.7, offers: [['gamma', 0.07], ['zeta', 0.06]], summary: 'Does this model support 5G (NR) on carriers in the target country?', tags: ['5g', 'compatibility'], popularity: 3 },
  { code: '4020', name: 'Carrier Unlock Eligibility — US', cat: 'cat_carrier', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei, F.carrierUS], retail: 2.2, offers: [['alpha', 0.44], ['beta', 0.52]], summary: 'Checks whether a US-locked device meets the carrier’s unlock policy.', tags: ['unlock', 'eligibility', 'us'], popularity: 5 },
  { code: '4021', name: 'Carrier Unlock Eligibility — UK', cat: 'cat_carrier', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei, F.carrierUK], retail: 2.2, offers: [['theta', 0.4], ['beta', 0.47]], summary: 'Checks whether a UK-locked device can be unlocked by its network.', tags: ['unlock', 'eligibility', 'uk'], popularity: 3 },
  { code: '4022', name: 'eSIM Capability Check', cat: 'cat_carrier', processing: 'instant', turn: [5, 30], schema: 'compatibility', fields: [F.model], retail: 0.5, offers: [['gamma', 0.05]], summary: 'Does this model support eSIM and dual-SIM operation?', tags: ['esim', 'compatibility'], popularity: 3 },
  { code: '4023', name: 'Roaming Lock Check', cat: 'cat_carrier', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 1.5, offers: [['delta', 0.26], ['beta', 0.3]], summary: 'Detects region / roaming locks on imported devices.', tags: ['roaming', 'region lock'], popularity: 2 },

  /* Device Information --------------------------------------------------- */
  { code: '4024', name: 'Device Information (IMEI)', cat: 'cat_device', processing: 'instant', turn: [5, 60], schema: 'device_info', fields: [F.imei], retail: 0.8, offers: [['gamma', 0.09], ['zeta', 0.08], ['alpha', 0.12]], summary: 'Brand, model, storage, colour and manufacture week.', tags: ['specs', 'model', 'device'], popularity: 8 },
  { code: '4025', name: 'Apple Model & Specs (Serial)', cat: 'cat_device', processing: 'instant', turn: [5, 60], schema: 'device_info', fields: [F.serial], retail: 0.9, offers: [['zeta', 0.11], ['gamma', 0.13]], summary: 'Exact model, storage and colour from an Apple serial number.', tags: ['apple', 'serial', 'specs'], popularity: 4 },
  { code: '4026', name: 'Samsung Device Info', cat: 'cat_device', processing: 'instant', turn: [5, 60], schema: 'device_info', fields: [F.imei], retail: 0.9, offers: [['gamma', 0.1], ['zeta', 0.12]], summary: 'Model code, region and manufacture date for Samsung devices.', tags: ['samsung', 'specs'], popularity: 4 },
  { code: '4027', name: 'Manufacture Date Lookup', cat: 'cat_device', processing: 'instant', turn: [5, 60], schema: 'device_info', fields: [F.imei], retail: 0.7, offers: [['zeta', 0.07], ['iota', 0.06]], summary: 'Manufacture week and factory for most brands.', tags: ['manufacture', 'date'], popularity: 2 },
  { code: '4028', name: 'Apple First Activation Date', cat: 'cat_device', processing: 'instant', turn: instant, schema: 'activation_status', fields: [F.imei], retail: 1.9, offers: [['alpha', 0.38], ['gamma', 0.42]], summary: 'When the device was first activated — useful for warranty disputes.', tags: ['apple', 'activation'], popularity: 3 },
  { code: '4029', name: 'Google Pixel Device Info', cat: 'cat_device', processing: 'instant', turn: [5, 60], schema: 'device_info', fields: [F.imei], retail: 0.9, offers: [['gamma', 0.11]], summary: 'Model, storage and manufacture data for Pixel phones.', tags: ['google', 'pixel', 'specs'], popularity: 2 },
  { code: '4030', name: 'Huawei Device Info', cat: 'cat_device', processing: 'instant', turn: [5, 60], schema: 'device_info', fields: [F.imei], retail: 0.9, offers: [['delta', 0.09], ['gamma', 0.12]], summary: 'Model, region and manufacture data for Huawei & Honor.', tags: ['huawei', 'honor', 'specs'], popularity: 2 },

  /* Warranty ------------------------------------------------------------- */
  { code: '4031', name: 'Apple Warranty & AppleCare Check', cat: 'cat_warranty', processing: 'instant', turn: [5, 60], schema: 'warranty', fields: [F.imei], retail: 1.2, offers: [['zeta', 0.14], ['gamma', 0.17], ['iota', 0.12]], summary: 'Limited warranty and AppleCare coverage with end dates.', tags: ['apple', 'warranty', 'applecare'], popularity: 7 },
  { code: '4032', name: 'Samsung Warranty Check', cat: 'cat_warranty', processing: 'instant', turn: [5, 60], schema: 'warranty', fields: [F.imei], retail: 1.1, offers: [['iota', 0.11], ['zeta', 0.13], ['gamma', 0.15]], summary: 'Manufacturer warranty status for Samsung Galaxy devices.', tags: ['samsung', 'warranty'], popularity: 5 },
  { code: '4033', name: 'Google Pixel Warranty', cat: 'cat_warranty', processing: 'instant', turn: [5, 60], schema: 'warranty', fields: [F.imei], retail: 1.1, offers: [['gamma', 0.14], ['iota', 0.12]], summary: 'Warranty status and coverage end date for Pixel phones.', tags: ['google', 'pixel', 'warranty'], popularity: 2 },
  { code: '4034', name: 'Xiaomi Warranty Check', cat: 'cat_warranty', processing: 'instant', turn: [5, 60], schema: 'warranty', fields: [F.imei], retail: 0.9, offers: [['iota', 0.1], ['zeta', 0.12]], summary: 'Warranty status for Xiaomi, Redmi and POCO.', tags: ['xiaomi', 'warranty'], popularity: 2 },
  { code: '4035', name: 'Motorola Warranty Check', cat: 'cat_warranty', processing: 'instant', turn: [5, 60], schema: 'warranty', fields: [F.imei], retail: 0.9, offers: [['zeta', 0.11], ['iota', 0.1]], summary: 'Warranty status for Motorola and Lenovo phones.', tags: ['motorola', 'warranty'], popularity: 2 },
  { code: '4036', name: 'Multi-brand Warranty Check', cat: 'cat_warranty', processing: 'instant', turn: [5, 60], schema: 'warranty', fields: [F.imei, F.brand], retail: 1.3, offers: [['iota', 0.15], ['zeta', 0.18], ['gamma', 0.19]], summary: 'One warranty check for every major brand.', tags: ['warranty', 'multi-brand'], popularity: 4 },

  /* Unlock Codes (carrier-authorised) ------------------------------------- */
  { code: '4037', name: 'iPhone Official Unlock — T-Mobile US', cat: 'cat_unlock', processing: 'async', turn: [1 * D, 4 * D], schema: 'official_unlock', fields: [F.imei], retail: 34, offers: [['alpha', 11], ['beta', 13.2]], summary: 'Carrier-authorised permanent unlock for eligible, fully paid iPhones on T-Mobile US.', tags: ['apple', 'unlock', 't-mobile', 'official', 'iphone'], popularity: 5, featured: true, fixedOffers: true },
  { code: '4038', name: 'iPhone Official Unlock — AT&T US', cat: 'cat_unlock', processing: 'async', turn: [6 * H, 3 * D], schema: 'official_unlock', fields: [F.imei], retail: 26, offers: [['alpha', 8.4], ['beta', 9.6]], summary: 'Official AT&T unlock for eligible devices that meet AT&T’s unlock policy.', tags: ['apple', 'unlock', 'at&t', 'official'], popularity: 4 },
  { code: '4039', name: 'iPhone Official Unlock — UK Networks', cat: 'cat_unlock', processing: 'async', turn: [2 * H, 2 * D], schema: 'official_unlock', fields: [F.imei, F.carrierUK], retail: 22, offers: [['beta', 7.2], ['theta', 7.6], ['kappa', 8]], summary: 'Network-authorised unlock for iPhones on EE, Vodafone, O2 or Three.', tags: ['apple', 'unlock', 'uk', 'official'], popularity: 4 },
  { code: '4040', name: 'Samsung Network Unlock Code (NCK)', cat: 'cat_unlock', processing: 'async', turn: [1 * H, 12 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 14, offers: [['beta', 6.92], ['delta', 6.1], ['alpha', 7.4]], summary: 'Network Control Key for Samsung devices that accept unlock-code entry.', tags: ['samsung', 'unlock', 'nck', 'code'], popularity: 7, featured: true },
  { code: '4041', name: 'Motorola Network Unlock Code', cat: 'cat_unlock', processing: 'async', turn: [2 * H, 24 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 12, offers: [['eta', 4.8], ['beta', 5.3]], summary: 'Carrier unlock code for Motorola and Lenovo phones.', tags: ['motorola', 'unlock', 'code'], popularity: 4, fixedOffers: true },
  { code: '4042', name: 'Alcatel / TCL Unlock Code (NCK)', cat: 'cat_unlock', processing: 'async', turn: [1 * H, 12 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 9, offers: [['epsilon', 2.9], ['eta', 3.1]], summary: 'Network unlock code for Alcatel and TCL handsets.', tags: ['alcatel', 'tcl', 'unlock', 'nck'], popularity: 3, fixedOffers: true },
  { code: '4043', name: 'ZTE Unlock Code', cat: 'cat_unlock', processing: 'async', turn: [1 * H, 12 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 9.5, offers: [['epsilon', 3.2], ['beta', 3.6]], summary: 'Network unlock code for ZTE handsets and modems.', tags: ['zte', 'unlock', 'code'], popularity: 3, fixedOffers: true },
  { code: '4044', name: 'Huawei Modem Unlock Code (Instant)', cat: 'cat_unlock', processing: 'instant', turn: [30, 120], schema: 'unlock_code', fields: [F.imei, F.model], retail: 4.5, offers: [['delta', 0.9], ['epsilon', 0.95], ['alpha', 1.1]], summary: 'Instant calculated unlock code for supported Huawei USB modems and routers.', tags: ['huawei', 'modem', 'unlock', 'instant'], popularity: 4 },
  { code: '4045', name: 'Google Pixel Official Unlock — US', cat: 'cat_unlock', processing: 'async', turn: [1 * D, 3 * D], schema: 'official_unlock', fields: [F.imei, F.carrierUS], retail: 29, offers: [['alpha', 9.8], ['beta', 10.9]], summary: 'Carrier-authorised unlock for eligible Pixel phones on US carriers.', tags: ['google', 'pixel', 'unlock', 'official'], popularity: 2 },
  { code: '4046', name: 'Nokia / HMD Unlock Code', cat: 'cat_unlock', processing: 'async', turn: [2 * H, 12 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 11, offers: [['kappa', 4.1]], summary: 'Unlock code for Nokia (HMD) phones — fulfilled by hand.', tags: ['nokia', 'hmd', 'unlock'], popularity: 2 },
  { code: '4047', name: 'LG Unlock Code (Legacy)', cat: 'cat_unlock', processing: 'async', turn: [2 * H, 12 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 10, offers: [['delta', 3.5], ['kappa', 3.8]], summary: 'Unlock codes for legacy LG models.', tags: ['lg', 'unlock', 'legacy'], popularity: 1 },
  { code: '4048', name: 'Samsung Unlock Code — Express', cat: 'cat_unlock', processing: 'instant', turn: [60, 300], schema: 'unlock_code', fields: [F.imei, F.model], retail: 16, offers: [['delta', 8.1], ['beta', 8.9]], summary: 'Same NCK as the standard service, delivered in minutes.', tags: ['samsung', 'unlock', 'express'], popularity: 3 },
  { code: '4049', name: 'Sony Xperia Unlock Code', cat: 'cat_unlock', processing: 'async', turn: [2 * H, 24 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 12, offers: [['epsilon', 4.2], ['kappa', 4.6]], summary: 'Network unlock code for Sony Xperia phones.', tags: ['sony', 'xperia', 'unlock'], popularity: 1 },
  { code: '4050', name: 'OnePlus Unlock Code', cat: 'cat_unlock', processing: 'async', turn: [1 * H, 12 * H], schema: 'unlock_code', fields: [F.imei, F.model], retail: 13, offers: [['beta', 5.1], ['eta', 4.9]], summary: 'Carrier unlock code for OnePlus phones sold through US carriers.', tags: ['oneplus', 'unlock'], popularity: 2 },

  /* Serial Checks -------------------------------------------------------- */
  { code: '4051', name: 'Serial Number Check (Apple)', cat: 'cat_serial', processing: 'instant', turn: [5, 60], schema: 'serial', fields: [F.serial], retail: 0.9, offers: [['zeta', 0.1], ['gamma', 0.12]], summary: 'Validates an Apple serial and returns model and production week.', tags: ['apple', 'serial'], popularity: 4 },
  { code: '4052', name: 'Serial Number Check (Samsung)', cat: 'cat_serial', processing: 'instant', turn: [5, 60], schema: 'serial', fields: [F.serial], retail: 0.9, offers: [['gamma', 0.11], ['zeta', 0.12]], summary: 'Validates a Samsung serial number.', tags: ['samsung', 'serial'], popularity: 2 },
  { code: '4053', name: 'Serial to IMEI Lookup (Apple)', cat: 'cat_serial', processing: 'instant', turn: instant, schema: 'device_info', fields: [F.serial], retail: 2.5, offers: [['alpha', 0.62], ['zeta', 0.58]], summary: 'Find the device details registered to an Apple serial number.', tags: ['apple', 'serial', 'imei'], popularity: 3 },
  { code: '4054', name: 'Serial Validation — Multi-brand', cat: 'cat_serial', processing: 'instant', turn: [5, 60], schema: 'serial', fields: [F.serial, F.brand], retail: 0.8, offers: [['gamma', 0.09], ['iota', 0.08]], summary: 'Format and checksum validation for most brands’ serial numbers.', tags: ['serial', 'validation'], popularity: 2 },

  /* Non-active examples --------------------------------------------------- */
  { code: '4055', name: 'Bulk Blacklist Check (Trade-in, 50+)', cat: 'cat_imei', processing: 'instant', turn: [20, 90], schema: 'blacklist', fields: [F.imei], retail: 0.7, offers: [['gamma', 0.07]], summary: 'Volume-priced GSMA blacklist check for trade-in partners. Draft — launching next month.', tags: ['blacklist', 'bulk'], popularity: 0, status: 'draft' },
  { code: '4056', name: 'Huawei Carrier Check', cat: 'cat_imei', processing: 'instant', turn: instant, schema: 'carrier_check', fields: [F.imei], retail: 1.6, offers: [['gamma', 0.2], ['delta', 0.18]], summary: 'Carrier and lock status for Huawei & Honor. Paused while the supplier fixes data quality.', tags: ['huawei', 'carrier'], popularity: 0, status: 'paused' },
]

export const POPULARITY: Record<string, number> = Object.fromEntries(SERVICE_SPECS.map((s) => [`svc_${s.code}`, s.popularity]))

/* ------------------------------------------------------------------------- */
/*  Builders                                                                 */
/* ------------------------------------------------------------------------- */
const supId = (k: SupplierKey) => `sup_${k}`
const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function remoteFieldName(driver: string, f: FieldDef) {
  if (driver === 'dhru_fusion') return fieldType(f.type).dhruParam ?? f.key.toUpperCase()
  return f.key
}

function productName(driver: string, s: ServiceSpec, k: SupplierKey) {
  if (driver === 'dhru_fusion') return `${s.name}${s.processing === 'instant' ? ' [Instant]' : ''}${k === 'beta' ? ' — Source B' : ''}`
  if (driver === 'manual') return `${s.name} (manual)`
  return `${s.name.toLowerCase().replace(/\s+—\s+/g, ' · ')}`
}

export interface CatalogBuild {
  categories: Category[]
  services: Service[]
  revisions: ServiceRevision[]
  products: SupplierProduct[]
  offers: Offer[]
}

export function buildCatalog(now: number): CatalogBuild {
  const rng = createRng(4401)
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
  const driverOf = (k: SupplierKey) => SUPPLIER_SPECS.find((x) => x.id === supId(k))!.driver
  const categories: Category[] = GSM_CATEGORIES.map((c, i) => ({ ...c, packId: 'gsm', sort: i }))
  const services: Service[] = []
  const revisions: ServiceRevision[] = []
  const products: SupplierProduct[] = []
  const offers: Offer[] = []
  const dhruIds: Record<string, number> = {}

  const makeProduct = (k: SupplierKey, s: ServiceSpec, cost: number, i: number): SupplierProduct => {
    const driver = driverOf(k)
    dhruIds[k] = (dhruIds[k] ?? 1000 + Math.floor(rng.next() * 800)) + rng.int(1, 9)
    const ext = driver === 'dhru_fusion' ? String(dhruIds[k]) : driver === 'manual' ? `MAN-${s.code}` : `${s.cat.replace('cat_', '')}.${slug(s.name).slice(0, 28)}`
    return {
      id: `sp_${k}_${s.code}`,
      supplierId: supId(k),
      externalId: ext,
      name: productName(driver, s, k),
      groupName: categories.find((c) => c.id === s.cat)!.name,
      cost: usd(cost),
      previousCost: null,
      status: 'available',
      remoteFields: s.fields.map((f) => remoteFieldName(driver, f)),
      processingHint: s.processing === 'instant' ? 'Instant' : `${Math.round(s.turn[0] / 3600)}–${Math.round(s.turn[1] / 3600)} h`,
      firstSeenAt: iso((200 - i) * 86400_000),
      lastSeenAt: iso(rng.int(5, 600) * 60_000),
      costChangedAt: null,
    }
  }

  SERVICE_SPECS.forEach((s, i) => {
    const id = `svc_${s.code}`
    const revId = `rev_${s.code}_1`
    const created = iso((260 - i * 3) * 86400_000)
    revisions.push({ id: revId, serviceId: id, number: 1, fields: s.fields, resultSchema: GSM_RESULT_SCHEMAS[s.schema]!, note: 'Initial revision', createdAt: created, createdBy: 'Alex Morgan' })
    services.push({
      id,
      code: s.code,
      slug: slug(s.name),
      name: s.name,
      categoryId: s.cat,
      packId: 'gsm',
      status: s.status ?? 'active',
      processing: s.processing,
      turnaround: { minSec: s.turn[0], maxSec: s.turn[1] },
      summary: s.summary,
      description: s.summary,
      icon: categories.find((c) => c.id === s.cat)!.icon,
      tags: s.tags,
      featured: !!s.featured,
      revisionId: revId,
      revision: 1,
      visibility: { storefront: (s.status ?? 'active') === 'active', portal: (s.status ?? 'active') !== 'draft', api: (s.status ?? 'active') !== 'draft' },
      whenUnavailable: 'show_unavailable',
      templateId: s.cat === 'cat_unlock' ? 'tpl_unlock' : 'tpl_check',
      createdAt: created,
      updatedAt: iso(rng.int(2, 60) * 86400_000),
    })
    const list = [...s.offers]
    if (!s.fixedOffers && s.status !== 'draft') {
      // Generated extra fallbacks keep most services resilient (2–4 offers).
      const pool: SupplierKey[] = s.cat === 'cat_unlock' ? ['beta', 'kappa', 'delta', 'alpha'] : ['gamma', 'beta', 'alpha', 'zeta', 'delta']
      const extra = rng.int(1, s.popularity >= 7 ? 2 : 1)
      for (const k of rng.shuffle(pool)) {
        if (list.length >= s.offers.length + extra || list.length >= 4) break
        if (list.some(([x]) => x === k)) continue
        const top = Math.max(...list.map(([, c]) => c))
        list.push([k, +(top * rng.float(1.08, 1.3)).toFixed(top < 1 ? 2 : 2)])
      }
    }
    list.forEach(([k, cost], idx) => {
      const p = makeProduct(k, s, cost, i)
      products.push(p)
      const driver = driverOf(k)
      offers.push({
        id: `off_${s.code}_${k}`,
        serviceId: id,
        supplierId: supId(k),
        supplierProductId: p.id,
        priority: idx + 1,
        enabled: true,
        disabledReason: null,
        fieldMapping: Object.fromEntries(s.fields.map((f) => [f.key, remoteFieldName(driver, f)])),
        maxCost: null,
        config: driver === 'dhru_fusion' ? { service_id: p.externalId } : {},
        createdAt: created,
        updatedAt: iso(rng.int(1, 90) * 86400_000),
      })
    })
  })

  // Unmapped supplier products (in their catalogs but not sold by us).
  const extras: [SupplierKey, string, number][] = [
    ['alpha', 'iPad Carrier Check', 0.64], ['alpha', 'Apple Watch Activation Status', 0.31], ['alpha', 'MacBook Warranty Check', 0.22], ['alpha', 'iPhone Official Unlock — Verizon', 6.9], ['alpha', 'Apple GSX Basic Report', 1.2],
    ['beta', 'Samsung Tablet Unlock Code', 6.1], ['beta', 'Vodafone EU Unlock Code', 5.6], ['beta', 'HTC Unlock Code', 3.9], ['beta', 'BlackBerry MEP Code (legacy)', 2.4],
    ['gamma', 'Bulk Blacklist (100 IMEIs)', 6.5], ['gamma', 'Carrier Check — Asia Pacific', 0.36], ['gamma', 'Device Age Estimate', 0.05], ['gamma', 'Insurance Claim Check', 0.4],
    ['delta', 'Realme Device Info', 0.08], ['delta', 'Oppo Unlock Code', 4.4], ['delta', 'Vivo Device Info', 0.08],
    ['epsilon', 'Nokia Unlock Code (fast)', 3.9], ['epsilon', 'Lenovo Tablet Code', 2.8],
    ['zeta', 'Battery Health Estimate', 0.09], ['zeta', 'Refurbishment History', 0.35], ['zeta', 'Parts Pairing Check', 0.28],
    ['eta', 'Kyocera Unlock Code', 4.2], ['theta', 'Ireland Network Check', 0.32], ['theta', 'Australia Network Check', 0.34],
    ['iota', 'Huawei Warranty Check', 0.11], ['iota', 'OnePlus Warranty Check', 0.11], ['kappa', 'Siemens Legacy Code', 3.2],
  ]
  extras.forEach(([k, name, cost], i) => {
    const driver = driverOf(k)
    dhruIds[k] = (dhruIds[k] ?? 1500) + rng.int(2, 11)
    products.push({
      id: `sp_${k}_x${i}`,
      supplierId: supId(k),
      externalId: driver === 'dhru_fusion' ? String(dhruIds[k]) : driver === 'manual' ? `MAN-X${i}` : `extra.${slug(name).slice(0, 24)}`,
      name,
      groupName: 'Other',
      cost: usd(cost),
      previousCost: null,
      status: 'available',
      remoteFields: driver === 'dhru_fusion' ? ['IMEI'] : ['imei'],
      processingHint: '—',
      firstSeenAt: iso(rng.int(20, 200) * 86400_000),
      lastSeenAt: iso(rng.int(5, 600) * 60_000),
      costChangedAt: null,
    })
  })

  return { categories, services, revisions, products, offers }
}

export type { SupplierKey }
export const retailPriceOf = (code: string): Micros => usd(SERVICE_SPECS.find((s) => s.code === code)!.retail)
