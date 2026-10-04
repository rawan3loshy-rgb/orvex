/**
 * DEMO DATA — accounts. One model for every buyer (fictional businesses and people).
 *
 *   12 resellers (incl. ABC GSM — Gold, $250 credit), 6 business, 4 API-only,
 *   30 retail customers; guest accounts are created by guest checkouts in the replay.
 */
import { usd, type Micros } from '@/core/money'
import type { Account, AccountMember, AccountTier, MemberRole } from '@/core/domain'
import { tierDefaults } from '@/core/commands/accounts'

export interface AccountSpec {
  id: string
  name: string
  tier: AccountTier
  pricing: 'tier_retail' | 'tier_silver' | 'tier_gold' | 'tier_platinum'
  country: string
  contact: string
  email: string
  credit: number
  /** Relative order volume in the replay. */
  weight: number
  /** Preferred channels for replayed orders. */
  channels: ('portal' | 'api' | 'dhru' | 'storefront')[]
  status?: Account['status']
  statusReason?: string
  members?: [string, string, MemberRole][]
  ageDays: number
  notes?: string
  website?: string
  /** Desired available balance at the end of the seed (resellers/business/API). */
  targetAvailable?: number
  serviceCategories?: string[]
  phone?: string
}

export const ACCOUNT_SPECS: AccountSpec[] = [
  /* Resellers ------------------------------------------------------------ */
  { id: 'acc_abcgsm', name: 'ABC GSM', tier: 'reseller', pricing: 'tier_gold', country: 'AE', contact: 'Karim Haddad', email: 'karim@abcgsm.example', credit: 250, weight: 10, channels: ['portal', 'api', 'dhru'], ageDays: 340, website: 'abcgsm.example', targetAvailable: 842.5, phone: '+971501234567', notes: 'Dubai trade-in desk + 6 repair counters. Migrated from a DHRU panel in 2025 — still uses the DHRU-compatible endpoint for their POS.', members: [['Karim Haddad', 'karim@abcgsm.example', 'owner'], ['Lina Haddad', 'lina@abcgsm.example', 'finance'], ['Omar Saleh', 'omar@abcgsm.example', 'orderer'], ['ABC Integrations', 'dev@abcgsm.example', 'developer']] },
  { id: 'acc_mobilehub', name: 'MobileHub', tier: 'reseller', pricing: 'tier_platinum', country: 'US', contact: 'Marcus Reed', email: 'ops@mobilehub.example', credit: 2500, weight: 16, channels: ['api'], ageDays: 390, website: 'mobilehub.example', targetAvailable: 4820, notes: 'Distributor feeding 40+ repair shops. Contract pricing until 2027-03.', members: [['Marcus Reed', 'ops@mobilehub.example', 'owner'], ['Dev Team', 'api@mobilehub.example', 'developer']] },
  { id: 'acc_phonefix', name: 'PhoneFix Center', tier: 'reseller', pricing: 'tier_silver', country: 'DE', contact: 'Lena Fischer', email: 'api@phonefix-center.example', credit: 500, weight: 7, channels: ['api', 'dhru', 'portal'], ageDays: 301, targetAvailable: 1240, members: [['Lena Fischer', 'api@phonefix-center.example', 'owner']] },
  { id: 'acc_cellpoint', name: 'CellPoint Repairs', tier: 'reseller', pricing: 'tier_silver', country: 'NL', contact: 'Sofie de Vries', email: 'tech@cellpoint.example', credit: 1000, weight: 6, channels: ['portal', 'api'], ageDays: 256, targetAvailable: 960.5, members: [['Sofie de Vries', 'tech@cellpoint.example', 'owner'], ['Bram Jansen', 'bram@cellpoint.example', 'orderer']] },
  { id: 'acc_asiagsm', name: 'Asia GSM Hub', tier: 'reseller', pricing: 'tier_gold', country: 'SG', contact: 'Wei Ling Tan', email: 'platform@asiagsmhub.example', credit: 5000, weight: 10, channels: ['dhru', 'api'], ageDays: 188, targetAvailable: 8412, members: [['Wei Ling Tan', 'platform@asiagsmhub.example', 'owner']] },
  { id: 'acc_gulfmobile', name: 'Gulf Mobile Services', tier: 'reseller', pricing: 'tier_silver', country: 'AE', contact: 'Omar Farouk', email: 'dev@gulfmobile.example', credit: 0, weight: 3, channels: ['dhru', 'portal'], ageDays: 97, targetAvailable: 31.4, serviceCategories: ['cat_imei', 'cat_carrier'], members: [['Omar Farouk', 'dev@gulfmobile.example', 'owner']] },
  { id: 'acc_movil', name: 'Movil Express', tier: 'reseller', pricing: 'tier_silver', country: 'ES', contact: 'Carla Jiménez', email: 'api@movilexpress.example', credit: 750, weight: 5, channels: ['dhru', 'portal'], ageDays: 160, targetAvailable: 1875, serviceCategories: ['cat_unlock', 'cat_carrier', 'cat_imei'], members: [['Carla Jiménez', 'api@movilexpress.example', 'owner']] },
  { id: 'acc_techrepair', name: 'TechRepair Pro', tier: 'reseller', pricing: 'tier_platinum', country: 'CH', contact: 'Anna Keller', email: 'integration@techrepair-pro.example', credit: 10000, weight: 9, channels: ['api'], ageDays: 122, targetAvailable: 15240, notes: 'Contract pricing until 2027-03. IP allowlist enforced.', members: [['Anna Keller', 'integration@techrepair-pro.example', 'owner']] },
  { id: 'acc_smartfix', name: 'SmartFix Store', tier: 'reseller', pricing: 'tier_silver', country: 'CA', contact: 'Hannah Brooks', email: 'eng@smartfix.example', credit: 250, weight: 4, channels: ['api', 'portal'], ageDays: 74, targetAvailable: 642.1, notes: 'Their webhook endpoint has been returning 5xx since this morning.', members: [['Hannah Brooks', 'eng@smartfix.example', 'owner']] },
  { id: 'acc_celular', name: 'Celular Brasil', tier: 'reseller', pricing: 'tier_silver', country: 'BR', contact: 'Rafael Souza', email: 'contato@celularbrasil.example', credit: 0, weight: 3, channels: ['dhru', 'portal'], ageDays: 45, targetAvailable: 18.6, members: [['Rafael Souza', 'contato@celularbrasil.example', 'owner']] },
  { id: 'acc_istanbul', name: 'Istanbul GSM Market', tier: 'reseller', pricing: 'tier_gold', country: 'TR', contact: 'Emre Yilmaz', email: 'b2b@istanbulgsm.example', credit: 2000, weight: 6, channels: ['dhru', 'api'], ageDays: 58, targetAvailable: 3310, members: [['Emre Yilmaz', 'b2b@istanbulgsm.example', 'owner']] },
  { id: 'acc_unlockzone', name: 'UnlockZone', tier: 'reseller', pricing: 'tier_silver', country: 'GB', contact: 'Tom Hale', email: 'tom@unlockzone.example', credit: 0, weight: 2, channels: ['portal'], ageDays: 214, status: 'frozen', statusReason: 'Two card chargebacks on wallet top-ups — finance review', members: [['Tom Hale', 'tom@unlockzone.example', 'owner']] },
  { id: 'acc_gsmcorner', name: 'GSM Corner', tier: 'reseller', pricing: 'tier_silver', country: 'PL', contact: 'Piotr Nowak', email: 'piotr@gsmcorner.example', credit: 0, weight: 0, channels: ['portal'], ageDays: 1, status: 'pending', statusReason: 'Awaiting business registration documents', members: [['Piotr Nowak', 'piotr@gsmcorner.example', 'owner']] },

  /* Business ------------------------------------------------------------- */
  { id: 'acc_tradein', name: 'Trade-In Partners Ltd', tier: 'business', pricing: 'tier_silver', country: 'GB', contact: 'Grace Okafor', email: 'desk@tradein-partners.example', credit: 0, weight: 5, channels: ['portal'], ageDays: 140, targetAvailable: 412.75, serviceCategories: ['cat_imei', 'cat_device', 'cat_warranty'] },
  { id: 'acc_recell', name: 'ReCell Marketplace', tier: 'business', pricing: 'tier_gold', country: 'US', contact: 'Daniel Price', email: 'ops@recell.example', credit: 500, weight: 5, channels: ['portal'], ageDays: 110, targetAvailable: 1290 },
  { id: 'acc_fleet', name: 'FleetPhone Services', tier: 'business', pricing: 'tier_silver', country: 'DE', contact: 'Jonas Weber', email: 'it@fleetphone.example', credit: 0, weight: 2, channels: ['portal'], ageDays: 90, targetAvailable: 205 },
  { id: 'acc_campus', name: 'Campus Device Desk', tier: 'business', pricing: 'tier_silver', country: 'US', contact: 'Maya Chen', email: 'devices@campus-desk.example', credit: 0, weight: 2, channels: ['portal'], ageDays: 70, targetAvailable: 148.2 },
  { id: 'acc_insure', name: 'Insure-a-Phone', tier: 'business', pricing: 'tier_gold', country: 'GB', contact: 'Priya Shah', email: 'claims@insure-a-phone.example', credit: 1000, weight: 4, channels: ['portal'], ageDays: 160, targetAvailable: 2210 },
  { id: 'acc_secondlife', name: 'Second Life Mobiles', tier: 'business', pricing: 'tier_silver', country: 'FR', contact: 'Léa Martin', email: 'contact@secondlife-mobiles.example', credit: 0, weight: 3, channels: ['portal'], ageDays: 85, targetAvailable: 336.9 },

  /* API-only ------------------------------------------------------------- */
  { id: 'acc_checkmyimei', name: 'CheckMyIMEI API', tier: 'api_only', pricing: 'tier_platinum', country: 'US', contact: 'Sam Rivera', email: 'eng@checkmyimei.example', credit: 3000, weight: 9, channels: ['api'], ageDays: 200, targetAvailable: 6120, serviceCategories: ['cat_imei', 'cat_carrier', 'cat_device', 'cat_warranty', 'cat_serial'] },
  { id: 'acc_repairdesk', name: 'RepairDesk Connector', tier: 'api_only', pricing: 'tier_gold', country: 'NL', contact: 'Ruben Smit', email: 'connector@repairdesk.example', credit: 1000, weight: 5, channels: ['api'], ageDays: 132, targetAvailable: 1704.3 },
  { id: 'acc_buyback', name: 'BuyBack Bot', tier: 'api_only', pricing: 'tier_gold', country: 'US', contact: 'Ava Brooks', email: 'api@buybackbot.example', credit: 500, weight: 4, channels: ['api'], ageDays: 64, targetAvailable: 890, serviceCategories: ['cat_imei', 'cat_device'] },
  { id: 'acc_deviceguard', name: 'DeviceGuard Insurance API', tier: 'api_only', pricing: 'tier_platinum', country: 'GB', contact: 'Oliver Grant', email: 'platform@deviceguard.example', credit: 2000, weight: 3, channels: ['api'], ageDays: 41, targetAvailable: 2675 },
]

const RETAIL_NAMES: [string, string][] = [
  ['Liam Carter', 'US'], ['Sofia Rossi', 'IT'], ['Noah Becker', 'DE'], ['Amelia Hughes', 'GB'], ['Mateo García', 'ES'], ['Chloé Dubois', 'FR'], ['Yusuf Demir', 'TR'], ['Hana Sato', 'JP'], ['Ethan Wright', 'US'], ['Zara Ahmed', 'AE'],
  ['Lucas Silva', 'BR'], ['Ingrid Larsen', 'NO'], ['Mason Lee', 'CA'], ['Aisha Bello', 'NG'], ['Daniel Kowalski', 'PL'], ['Emma Janssen', 'NL'], ['Arjun Mehta', 'IN'], ['Olivia Brown', 'AU'], ['Hugo Lefèvre', 'BE'], ['Mia Novak', 'CZ'],
  ['Ryan O’Connor', 'IE'], ['Layla Haddad', 'LB'], ['Ben Fischer', 'AT'], ['Nora Lindgren', 'SE'], ['Tomás Pereira', 'PT'], ['Grace Kim', 'KR'], ['Jack Turner', 'GB'], ['Valentina Cruz', 'MX'], ['Samir Khalil', 'EG'], ['Ella Murphy', 'US'],
]

export function retailSpecs(): AccountSpec[] {
  return RETAIL_NAMES.map(([name, country], i) => ({
    id: `acc_r${String(i + 1).padStart(2, '0')}`,
    name,
    tier: 'retail' as const,
    pricing: 'tier_retail' as const,
    country,
    contact: name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/(^\.|\.$)/g, '')}@mail.example`,
    credit: 0,
    weight: 1,
    channels: ['storefront' as const],
    ageDays: 20 + ((i * 37) % 300),
    status: i === 17 ? ('frozen' as const) : undefined,
    statusReason: i === 17 ? 'Card used in a fraud report — awaiting verification' : undefined,
  }))
}

export function buildAccount(spec: AccountSpec, now: number, number: number): Account {
  const d = tierDefaults(spec.tier)
  const iso = (ms: number) => new Date(now - ms).toISOString()
  const channels = { ...d.channels }
  if (spec.tier === 'reseller') channels.dhru = spec.channels.includes('dhru')
  return {
    id: spec.id,
    number: `AC-${10000 + number}`,
    name: spec.name,
    kind: 'customer',
    tier: spec.tier,
    status: spec.status ?? 'active',
    statusReason: spec.statusReason ?? null,
    pricingTierId: spec.pricing,
    creditLimit: usd(spec.credit),
    email: spec.email,
    contactName: spec.contact,
    phone: spec.phone ?? null,
    country: spec.country,
    company: spec.tier === 'retail' ? null : spec.name,
    website: spec.website ?? null,
    serviceAccess: spec.serviceCategories ? { mode: 'categories', categoryIds: spec.serviceCategories } : { mode: 'all' },
    channels,
    limits: d.limits,
    lowBalanceAlert: spec.tier === 'retail' ? null : (usd(spec.tier === 'api_only' ? 500 : 100) as Micros),
    tags: spec.tier === 'reseller' && spec.channels.includes('dhru') ? ['dhru-migrated'] : [],
    notes: spec.notes ?? '',
    createdAt: iso(spec.ageDays * 86400_000),
    lastActiveAt: iso(3600_000),
  }
}

export function buildMembers(spec: AccountSpec, now: number): AccountMember[] {
  const list = spec.members ?? [[spec.contact, spec.email, 'owner']]
  return list.map(([name, email, role], i) => ({
    id: `mem_${spec.id.replace('acc_', '')}_${i + 1}`,
    accountId: spec.id,
    name,
    email,
    role,
    mfa: role === 'owner' || role === 'finance' || i % 2 === 0,
    status: spec.status === 'pending' ? 'invited' : 'active',
    lastActiveAt: spec.status === 'pending' ? null : new Date(now - (i * 5 + 1) * 3600_000).toISOString(),
    createdAt: new Date(now - (spec.ageDays - i * 10) * 86400_000).toISOString(),
  }))
}
