import { NavLink, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUi } from '@/stores/ui'
import { ADMIN_NAV, type NavItem } from '@/features/admin/nav'
import { useCockpit, useInstallation, useLicense, useUpdates } from '@/hooks/installation'
import { LogoMark, TenantMark } from '@/components/brand'
import { Dot, Tooltip } from '@/components/ui'
import { brand, demoInstallation } from '@/config/brand'

function useBadges(): Record<string, { text?: string; tone?: 'accent' | 'warning' | 'danger' | 'success' } | undefined> {
  const cockpit = useCockpit()
  const updates = useUpdates()
  const c = cockpit.data
  const unhealthy = c?.suppliers.filter((s) => s.health !== 'healthy').length ?? 0
  return {
    orders: c && c.orders.processing + c.orders.queued ? { text: String(c.orders.processing + c.orders.queued), tone: 'accent' } : undefined,
    review: c?.orders.needsReview ? { text: String(c.orders.needsReview), tone: 'danger' } : undefined,
    verifications: c && c.verifications.open + c.verifications.awaitingSupplier ? { text: String(c.verifications.open + c.verifications.awaitingSupplier), tone: 'warning' } : undefined,
    suppliers: unhealthy ? { text: String(unhealthy), tone: 'warning' } : undefined,
    sync: c?.catalog.pendingSyncChanges ? { text: String(c.catalog.pendingSyncChanges), tone: 'accent' } : undefined,
    integrity: c && c.ledger.status !== 'pass' ? { tone: c.ledger.failures ? 'danger' : 'warning' } : undefined,
    reconciliation: c?.suppliers.some((s) => s.drift !== 0) ? { tone: 'warning' } : undefined,
    webhooks: c?.webhooks.failingEndpoints ? { tone: 'danger' } : undefined,
    updates: updates.data?.available ? { text: '1', tone: 'accent' } : undefined,
  }
}

/** Orders vs "Needs review" share a path; active state also looks at the query string. */
function useActive(item: NavItem) {
  const { pathname, search } = useLocation()
  if (item.to.includes('?')) return pathname + search === item.to
  if (item.to.includes('#')) return false
  if (item.id === 'orders') return pathname.startsWith('/admin/orders') && !search.includes('status=needs_review')
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function Item({ item, collapsed, badge, demo }: { item: NavItem; collapsed: boolean; badge?: { text?: string; tone?: 'accent' | 'warning' | 'danger' | 'success' }; demo?: boolean }) {
  const Icon = item.icon
  const isActive = useActive(item)
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      className={() =>
        cn(
          'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-[background-color,color,box-shadow]',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-surface text-fg shadow-[0_1px_2px_rgb(23_20_16/0.06),inset_0_0_0_1px_var(--line)] dark:bg-surface-2' : demo ? 'text-fg-2 hover:bg-warning/[0.06] hover:text-fg' : 'text-fg-2 hover:bg-fg/[0.04] hover:text-fg',
        )
      }
    >
      {() => (
        <>
          {isActive && <motion.span layoutId="nav-active" className="absolute top-[7px] bottom-[7px] left-0 w-[2px] rounded-full bg-accent" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
          <Icon className={cn('size-4 shrink-0', isActive ? 'text-fg' : 'text-fg-3 group-hover:text-fg-2')} strokeWidth={isActive ? 2.1 : 1.8} />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {badge &&
            (badge.text && !collapsed ? (
              <span className={cn('rounded-[5px] px-1.5 font-mono text-[10.5px] leading-[18px] font-medium tabular', badge.tone === 'accent' ? 'bg-accent/12 text-accent-ink' : 'bg-fg/8 text-fg-2')}>{badge.text}</span>
            ) : (
              <Dot tone={badge.tone ?? 'accent'} pulse className={cn(collapsed && 'absolute top-1.5 right-1.5')} />
            ))}
        </>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={item.label} placement="right" className="flex w-full">
      <div className="w-full">{link}</div>
    </Tooltip>
  ) : (
    link
  )
}

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { collapsedGroups, toggleGroup } = useUi()
  const badges = useBadges()
  const license = useLicense()
  const installation = useInstallation()
  const version = installation.data?.version ?? '2.4.1'
  const { pathname } = useLocation()
  return (
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
      {/* Workspace switcher */}
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-3', collapsed && 'justify-center px-0')}>
        <TenantMark />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">{demoInstallation.adminTitle}</div>
            <div className="truncate font-mono text-[10.5px] text-fg-3">{demoInstallation.domain}</div>
          </div>
        )}
        {!collapsed && <ChevronsUpDown className="size-3.5 text-fg-3" />}
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {ADMIN_NAV.map((g, gi) => {
          const closed = g.label ? collapsedGroups[g.id] && !g.items.some((i) => pathname.startsWith(i.to.split(/[?#]/)[0]!) && i.to !== '/admin') : false
          return (
            <div key={g.id} className={cn(g.label && 'mt-4', g.demo && !collapsed && 'mt-5 rounded-xl border border-dashed border-warning/40 bg-hatch p-1.5 pt-1')}>
              {g.label &&
                (collapsed ? (
                  <div className="mx-auto mb-1.5 h-px w-5 bg-line" />
                ) : (
                  <button onClick={() => toggleGroup(g.id)} className="group mb-1 flex w-full items-center justify-between px-2.5 py-1 text-left">
                    <span className={cn('mono-label flex items-center gap-2 transition-colors group-hover:text-fg-2', g.demo && 'text-warning')}>
                      <span className="text-fg-3/55 tabular">{g.demo ? '··' : String(gi).padStart(2, '0')}</span>
                      {g.label}
                      {g.direction && (
                        <span title={g.direction === 'inbound' ? 'Inbound — ORVEX consumes supplier APIs' : 'Outbound — external businesses consume the ORVEX API'} className={cn('rounded-[4px] border px-1 text-[9.5px] leading-[14px] tracking-[0.04em]', g.direction === 'inbound' ? 'border-line-strong text-fg-2' : 'border-accent/35 text-accent-ink')}>
                          {g.direction === 'inbound' ? '↓ IN' : '↑ OUT'}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn('size-3 text-fg-3 opacity-0 transition-[transform,opacity] group-hover:opacity-100', closed && '-rotate-90 opacity-100')} />
                  </button>
                ))}
              <AnimatePresence initial={false}>
                {!closed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="space-y-0.5 overflow-hidden">
                    {g.items.map((it) => (
                      <Item key={it.id} item={it} collapsed={collapsed} badge={badges[it.id]} demo={g.demo} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Installation footer */}
      {!collapsed ? (
        <div className="m-3 mt-0 rounded-xl border border-line bg-surface p-3 shadow-card dark:bg-surface/70">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <LogoMark className="size-5" />
              <span className="font-display font-wide text-[11.5px] font-[650] tracking-[0.06em] text-fg">{brand.product}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-fg-3">
              <Dot tone="warning" /> Demo environment
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between border-t border-line pt-2.5 text-[12px]">
            <span className="text-fg-2">Core</span>
            <span className="font-mono text-fg">v{version}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[12px]">
            <span className="text-fg-2">License</span>
            <span className="font-mono text-fg">{license.data?.licenseId ?? '—'}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[12px]">
            <span className="text-fg-2">Installation</span>
            <span className="font-mono text-fg">{installation.data?.installationId ?? '—'}</span>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex justify-center">
          <Tooltip content={`ORVEX Core v${version} · demo environment`} placement="right">
            <Dot tone="warning" />
          </Tooltip>
        </div>
      )}
    </div>
  )
}

export function AdminSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUi()
  return (
    <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg-subtle transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex', sidebarCollapsed ? 'w-[64px]' : 'w-[248px]')}>
      <SidebarContent collapsed={sidebarCollapsed} />
      <button
        onClick={toggleSidebar}
        className="absolute top-[18px] -right-3 z-10 grid size-6 place-items-center rounded-full border border-line bg-surface text-fg-3 opacity-0 shadow-card transition-opacity hover:text-fg [aside:hover_&]:opacity-100"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
      </button>
    </aside>
  )
}
