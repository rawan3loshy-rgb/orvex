import type { LucideIcon } from 'lucide-react'
import {
  SlidersHorizontal,
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BadgeCheck,
  BellRing,
  BookOpen,
  Boxes,
  CloudDownload,
  CreditCard,
  FileClock,
  FileSearch,
  FlaskConical,
  Gauge,
  Globe,
  HeartPulse,
  KeyRound,
  Landmark,
  LayoutTemplate,
  ListChecks,
  Navigation,
  Palette,
  PlugZap,
  Puzzle,
  ReceiptText,
  RefreshCcwDot,
  Route,
  Scale,
  ScrollText,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Truck,
  Users,
  Webhook,
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
  /** Visually distinct group (DEMO / SIMULATION). */
  demo?: boolean
  /** API direction tag shown next to the label: ORVEX consumes (inbound) or exposes (outbound) the API. */
  direction?: 'inbound' | 'outbound'
}

export const ADMIN_NAV: NavGroup[] = [
  { id: 'root', label: null, items: [{ id: 'cockpit', label: 'Operations cockpit', to: '/admin', icon: Gauge, end: true, keywords: 'dashboard home overview alerts kpi' }] },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'orders', label: 'Orders', to: '/admin/orders', icon: ReceiptText, end: true, keywords: 'order engine timeline status' },
      { id: 'review', label: 'Needs review', to: '/admin/orders?status=needs_review', icon: ShieldAlert, keywords: 'unknown timeout review blocked failover' },
      { id: 'verifications', label: 'Verifications', to: '/admin/verifications', icon: BadgeCheck, keywords: 'after-care code does not work dispute refund' },
      { id: 'accounts', label: 'Accounts', to: '/admin/accounts', icon: Users, keywords: 'customers resellers clients business api wallet credit' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      { id: 'services', label: 'Services', to: '/admin/services', icon: Boxes, keywords: 'catalog products fields revisions offers' },
      { id: 'pricing', label: 'Pricing', to: '/admin/pricing', icon: Tags, keywords: 'tiers rules markup margin retail silver gold platinum' },
      { id: 'routing', label: 'Routing', to: '/admin/routing', icon: Route, keywords: 'priority failover unknown margin guard' },
    ],
  },
  {
    id: 'provider-api',
    label: 'Provider API',
    direction: 'inbound',
    items: [
      { id: 'providers', label: 'Provider integrations', to: '/admin/integrations/providers', icon: ArrowDownToLine, keywords: 'provider api inbound connect supplier catalog sync import adapter discover services' },
      { id: 'suppliers', label: 'Suppliers', to: '/admin/suppliers', icon: Truck, keywords: 'providers dhru driver connection credentials test health circuit balance products' },
      { id: 'sync', label: 'Catalog sync', to: '/admin/catalog/sync', icon: RefreshCcwDot, keywords: 'supplier provider changes price review import new removed unchanged' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { id: 'ledger', label: 'Ledger', to: '/admin/finance/ledger', icon: Landmark, keywords: 'double entry transactions accounts balances' },
      { id: 'payments', label: 'Payments', to: '/admin/finance/payments', icon: CreditCard, keywords: 'gateway card paypal bank transfer refunds chargebacks' },
      { id: 'reconciliation', label: 'Reconciliation', to: '/admin/finance/reconciliation', icon: Scale, keywords: 'supplier balance drift expected actual' },
      { id: 'integrity', label: 'Financial integrity', to: '/admin/finance/integrity', icon: ShieldCheck, keywords: 'ledger checks trial balance holds' },
    ],
  },
  {
    id: 'channels',
    label: 'Channels',
    items: [
      { id: 'storefront', label: 'Storefront', to: '/admin/storefront', icon: Globe, end: true, keywords: 'website shop public site publish' },
      { id: 'storefront-pages', label: 'Pages & blocks', to: '/admin/storefront/pages', icon: LayoutTemplate, keywords: 'cms blocks catalog hero faq' },
      { id: 'storefront-theme', label: 'Theme', to: '/admin/storefront/theme', icon: Palette, keywords: 'colors fonts brand' },
      { id: 'storefront-nav', label: 'Navigation', to: '/admin/storefront/navigation', icon: Navigation, keywords: 'menu links' },
      { id: 'storefront-settings', label: 'Site settings', to: '/admin/storefront/settings', icon: SlidersHorizontal, keywords: 'seo languages checkout templates media domain' },
    ],
  },
  {
    id: 'reseller-api',
    label: 'Reseller API',
    direction: 'outbound',
    items: [
      { id: 'reseller-api', label: 'Reseller API', to: '/admin/developer', icon: ArrowUpFromLine, end: true, keywords: 'orvex api outbound resellers external websites apps sell services overview' },
      { id: 'clients', label: 'API clients', to: '/admin/developer/clients', icon: Users, keywords: 'resellers api accounts service access pricing permissions limits balance' },
      { id: 'keys', label: 'API keys', to: '/admin/developer/keys', icon: KeyRound, keywords: 'tokens scopes ip allowlist permissions' },
      { id: 'webhooks', label: 'Webhooks', to: '/admin/developer/webhooks', icon: Webhook, keywords: 'events deliveries signature retries inbound' },
      { id: 'logs', label: 'API logs', to: '/admin/developer/logs', icon: ScrollText, keywords: 'requests responses errors' },
      { id: 'api', label: 'Docs & console', to: '/admin/developer/api', icon: BookOpen, keywords: 'native api rest v1 docs documentation console endpoints idempotency' },
      { id: 'dhru', label: 'DHRU compatibility', to: '/admin/developer/dhru', icon: PlugZap, keywords: 'dhru fusion legacy endpoint status mapping' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'notifications', label: 'Notifications', to: '/admin/system/notifications', icon: BellRing, keywords: 'email telegram whatsapp alerts' },
      { id: 'audit', label: 'Audit log', to: '/admin/system/audit', icon: FileClock, keywords: 'activity who changed what' },
      { id: 'roles', label: 'Roles & users', to: '/admin/system/roles', icon: Users, keywords: 'permissions owner admin finance support' },
      { id: 'security', label: 'Security', to: '/admin/system/security', icon: ShieldCheck, keywords: 'mfa sessions ip rate limit hashing' },
      { id: 'health', label: 'Health', to: '/admin/system/health', icon: HeartPulse, keywords: 'status uptime worker queue' },
      { id: 'updates', label: 'Updates', to: '/admin/system/updates', icon: CloudDownload, keywords: 'release upgrade migration backup' },
      { id: 'license', label: 'License', to: '/admin/system/license', icon: FileSearch, keywords: 'entitlement plan expiry' },
      { id: 'installation', label: 'Installation', to: '/admin/system/installation', icon: Server, keywords: 'go live checklist postgres docker self-hosted' },
      { id: 'extensions', label: 'Extensions', to: '/admin/system/extensions', icon: Puzzle, keywords: 'drivers packs gateways modules' },
      { id: 'migration', label: 'DHRU migration', to: '/admin/migration', icon: ArrowLeftRight, keywords: 'import dhru panel migrate' },
      { id: 'settings', label: 'Settings', to: '/admin/settings', icon: Settings, keywords: 'configuration general api email' },
    ],
  },
  {
    id: 'demo',
    label: 'Demo / Simulation',
    demo: true,
    items: [
      { id: 'demo', label: 'Simulation controls', to: '/admin/demo', icon: FlaskConical, keywords: 'demo simulate supplier timeout scenario fast forward act as role' },
      { id: 'scenarios', label: 'Scenarios A–L', to: '/admin/demo#scenarios', icon: ListChecks, keywords: 'demo stories walkthrough' },
      { id: 'activity', label: 'Live activity', to: '/admin/demo#live', icon: Activity, keywords: 'traffic generator' },
    ],
  },
]

export const ADMIN_NAV_FLAT = ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))

/** Resolve the nav item that best matches a location (path + search). */
export function matchNav(pathname: string, search = '') {
  const full = pathname + search
  const exact = ADMIN_NAV_FLAT.find((i) => i.to.includes('?') && full.startsWith(i.to))
  if (exact) return exact
  return ADMIN_NAV_FLAT.filter((i) => !i.to.includes('?') && !i.to.includes('#') && (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`))).sort((a, b) => b.to.length - a.to.length)[0]
}
