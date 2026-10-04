import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Binary,
  Box,
  Calculator,
  CalendarCheck,
  Cloud,
  Cpu,
  FileSearch,
  Hash,
  KeyRound,
  KeySquare,
  LockKeyholeOpen,
  LockOpen,
  Network,
  Phone,
  RadioTower,
  ScanBarcode,
  ScanText,
  Server,
  ShieldBan,
  ShieldOff,
  Signal,
  Smartphone,
  SmartphoneNfc,
  UserRoundX,
} from 'lucide-react'

// Identity colours never use coral (c1): coral is reserved for signal — actions, live state, key series.
const PCOLOR: Record<string, string> = { prv_globalunlock: 'var(--c2)', prv_imeihub: 'var(--c3)', prv_gsmsolutions: 'var(--c4)', prv_mobileapi: 'var(--c5)', prv_devicenet: 'var(--c6)' }

export function providerColor(id: string) {
  return PCOLOR[id] ?? 'var(--c6)'
}

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  'scan-barcode': ScanBarcode,
  'shield-ban': ShieldBan,
  smartphone: Smartphone,
  'radio-tower': RadioTower,
  'badge-check': BadgeCheck,
  cloud: Cloud,
  'lock-open': LockOpen,
  'lock-keyhole-open': LockKeyholeOpen,
  'smartphone-nfc': SmartphoneNfc,
  'key-round': KeyRound,
  network: Network,
  server: Server,
  'user-round-x': UserRoundX,
  'file-search': FileSearch,
  'shield-off': ShieldOff,
  cpu: Cpu,
  calculator: Calculator,
  binary: Binary,
  hash: Hash,
  'key-square': KeySquare,
  'calendar-check': CalendarCheck,
  phone: Phone,
  signal: Signal,
  'scan-text': ScanText,
  box: Box,
}

/** Icon keys offered when creating a service. */
export const SERVICE_ICON_KEYS = Object.keys(SERVICE_ICONS)

const CATEGORY_COLOR: Record<string, string> = {
  'IMEI Services': 'var(--c3)',
  Unlocking: 'var(--c2)',
  'Server Services': 'var(--c5)',
  Codes: 'var(--c4)',
  'Other Services': 'var(--c6)',
}

export function categoryColor(category: string) {
  return CATEGORY_COLOR[category] ?? 'var(--c6)'
}
