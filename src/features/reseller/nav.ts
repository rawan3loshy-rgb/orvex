import type { LucideIcon } from 'lucide-react'
import { Building, CirclePlus, FileText, KeyRound, LayoutDashboard, LayoutGrid, Layers, ListOrdered, PlugZap, ScrollText, Wallet, Webhook } from 'lucide-react'
import type { Capability } from './kitUtils'

export interface ResellerNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Capability needed to use the screen (shown with a lock otherwise). */
  need?: Capability
}

export interface ResellerNavGroup {
  label: string
  items: ResellerNavItem[]
}

export const NAV_GROUPS: ResellerNavGroup[] = [
  { label: 'Overview', items: [{ to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Ordering',
    items: [
      { to: '/portal/order', label: 'Place order', icon: CirclePlus, need: 'order' },
      { to: '/portal/bulk', label: 'Bulk orders', icon: Layers, need: 'order' },
      { to: '/portal/orders', label: 'Orders', icon: ListOrdered },
      { to: '/portal/services', label: 'Services', icon: LayoutGrid },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/portal/wallet', label: 'Wallet', icon: Wallet },
      { to: '/portal/statements', label: 'Statements', icon: FileText, need: 'finance' },
    ],
  },
  {
    label: 'API',
    items: [
      { to: '/portal/api/keys', label: 'API keys', icon: KeyRound, need: 'api' },
      { to: '/portal/api/webhooks', label: 'Webhooks', icon: Webhook, need: 'api' },
      { to: '/portal/api/logs', label: 'API logs', icon: ScrollText, need: 'api' },
      { to: '/portal/api/dhru', label: 'DHRU connection', icon: PlugZap, need: 'api' },
    ],
  },
  { label: 'Account', items: [{ to: '/portal/profile', label: 'Profile', icon: Building }] },
]

/** Mobile bottom bar — the four most used screens + "More" (drawer). */
export const BOTTOM_NAV: ResellerNavItem[] = [
  { to: '/portal', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/portal/order', label: 'Order', icon: CirclePlus, need: 'order' },
  { to: '/portal/orders', label: 'Orders', icon: ListOrdered },
  { to: '/portal/wallet', label: 'Wallet', icon: Wallet },
]
