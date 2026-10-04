import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  Boxes,
  ChartColumn,
  FileText,
  Globe,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Navigation,
  Palette,
  PlugZap,
  Puzzle,
  ReceiptText,
  Route,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  CloudDownload,
  Users,
  Webhook,
  Workflow,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  to: string
  icon: LucideIcon
  /** Extra search keywords for the command palette. */
  keywords?: string
  end?: boolean
}

export interface NavGroup {
  id: string
  label: string | null
  items: NavItem[]
}

export const ADMIN_NAV: NavGroup[] = [
  { id: 'root', label: null, items: [{ id: 'overview', label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true, keywords: 'dashboard home kpi' }] },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'orders', label: 'Orders', to: '/admin/orders', icon: ReceiptText, keywords: 'order engine timeline' },
      { id: 'services', label: 'Services', to: '/admin/services', icon: Boxes, keywords: 'catalog products' },
      { id: 'providers', label: 'Providers', to: '/admin/providers', icon: PlugZap, keywords: 'suppliers api connections integrations' },
      { id: 'mappings', label: 'Mappings', to: '/admin/mappings', icon: Workflow, keywords: 'service mapping provider external id' },
      { id: 'routing', label: 'Routing', to: '/admin/routing', icon: Route, keywords: 'rules fallback strategy priority' },
      { id: 'resellers', label: 'Resellers', to: '/admin/resellers', icon: Users, keywords: 'clients partners api customers' },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    items: [
      { id: 'pricing', label: 'Pricing', to: '/admin/pricing', icon: Tags, keywords: 'margin markup groups' },
      { id: 'transactions', label: 'Transactions', to: '/admin/transactions', icon: ArrowLeftRight, keywords: 'ledger balance top-up refunds' },
      { id: 'reports', label: 'Reports', to: '/admin/reports', icon: ChartColumn, keywords: 'analytics revenue' },
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    items: [
      { id: 'reseller-api', label: 'Reseller API', to: '/admin/developer/api', icon: BookOpen, keywords: 'docs documentation endpoints reference' },
      { id: 'api-keys', label: 'API Keys', to: '/admin/developer/keys', icon: KeyRound, keywords: 'tokens credentials scopes' },
      { id: 'webhooks', label: 'Webhooks', to: '/admin/developer/webhooks', icon: Webhook, keywords: 'events deliveries callbacks' },
      { id: 'api-logs', label: 'API Logs', to: '/admin/developer/logs', icon: ScrollText, keywords: 'requests responses latency' },
    ],
  },
  {
    id: 'experience',
    label: 'Experience',
    items: [
      { id: 'website', label: 'Website', to: '/admin/website', icon: Globe, end: true, keywords: 'public site builder' },
      { id: 'pages', label: 'Pages', to: '/admin/website/pages', icon: FileText, keywords: 'cms' },
      { id: 'sections', label: 'Sections', to: '/admin/website/sections', icon: LayoutTemplate, keywords: 'html css editor blocks' },
      { id: 'navigation', label: 'Navigation', to: '/admin/website/navigation', icon: Navigation, keywords: 'menu links' },
      { id: 'theme', label: 'Theme', to: '/admin/website/theme', icon: Palette, keywords: 'colors fonts branding' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'health', label: 'Health', to: '/admin/system/health', icon: HeartPulse, keywords: 'status uptime metrics monitoring' },
      { id: 'activity', label: 'Activity', to: '/admin/system/activity', icon: Activity, keywords: 'audit log events' },
      { id: 'extensions', label: 'Extensions', to: '/admin/system/extensions', icon: Puzzle, keywords: 'adapters plugins modules themes' },
      { id: 'settings', label: 'Settings', to: '/admin/settings', icon: Settings, keywords: 'configuration users roles security database installation' },
      { id: 'updates', label: 'Updates', to: '/admin/system/updates', icon: CloudDownload, keywords: 'release upgrade version migration' },
      { id: 'license', label: 'License', to: '/admin/system/license', icon: ShieldCheck, keywords: 'activation entitlement' },
    ],
  },
]

export const ADMIN_NAV_FLAT = ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))

/** Resolve the nav item that best matches a pathname (longest prefix). */
export function matchNav(pathname: string) {
  return ADMIN_NAV_FLAT.filter((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`))).sort((a, b) => b.to.length - a.to.length)[0]
}
