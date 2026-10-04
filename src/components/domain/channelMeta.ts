import type { LucideIcon } from 'lucide-react'
import { Code2, Globe, LayoutDashboard, PlugZap, ShieldCheck } from 'lucide-react'
import type { OrderChannel } from '@/types/installation'

export const CHANNEL_META: Record<OrderChannel, { label: string; icon: LucideIcon; hint: string }> = {
  storefront: { label: 'Storefront', icon: Globe, hint: 'Customer checkout on the website' },
  portal: { label: 'Portal', icon: LayoutDashboard, hint: 'Reseller portal (manual or bulk)' },
  api: { label: 'API', icon: Code2, hint: 'Native API v1' },
  dhru: { label: 'DHRU', icon: PlugZap, hint: 'DHRU-compatible endpoint' },
  admin: { label: 'Admin', icon: ShieldCheck, hint: 'Created by an operator' },
}
