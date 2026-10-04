import { Link, useLocation, useNavigate } from 'react-router'
import { Bell, ChevronRight, ExternalLink, FlaskConical, LayoutDashboard, LogOut, Menu, Moon, Search, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { useUi } from '@/stores/ui'
import { useSession } from '@/stores/session'
import { matchNav } from '@/features/admin/nav'
import { useCockpit, useDemoState, useInstMutation, useMe } from '@/hooks/installation'
import { demoService } from '@/services/installation'
import { Avatar, Button, Dot, Kbd, MenuItem, MenuLabel, MenuSeparator, Popover, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import { demoInstallation } from '@/config/brand'

const SEV_TONE = { critical: 'danger', warning: 'warning', info: 'accent' } as const

function Alerts() {
  const cockpit = useCockpit()
  const alerts = cockpit.data?.alerts ?? []
  const critical = alerts.filter((a) => a.severity === 'critical').length
  return (
    <Popover
      placement="bottom-end"
      className="w-[380px] p-0"
      trigger={({ toggle, open }) => (
        <Button variant="ghost" size="sm" icon onClick={toggle} aria-label="Alerts" className={cn(open && 'bg-surface-2 text-fg')}>
          <Bell />
          {alerts.length > 0 && <span className={cn('absolute top-1 right-1 size-1.5 rounded-full ring-2 ring-bg', critical ? 'bg-danger' : 'bg-warning')} />}
        </Button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[13px] font-semibold">Needs attention</span>
            <Link to="/admin/system/notifications" onClick={close} className="text-[12px] text-accent-ink hover:underline">
              Notification center
            </Link>
          </div>
          <div className="max-h-[380px] overflow-y-auto py-1">
            {alerts.length === 0 && <p className="px-4 py-6 text-center text-[12.5px] text-fg-3">All clear.</p>}
            {alerts.map((a) => (
              <Link key={a.id} to={a.href} onClick={close} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-surface-2">
                <Dot tone={SEV_TONE[a.severity]} pulse={a.severity === 'critical'} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-fg">{a.title}</p>
                  <p className="line-clamp-2 text-[11.5px] text-fg-3">{a.detail}</p>
                </div>
                <ChevronRight className="mt-1 size-3.5 shrink-0 text-fg-3" />
              </Link>
            ))}
          </div>
          {cockpit.data && <div className="border-t border-line px-4 py-2 text-[11px] text-fg-3">Updated {relative(cockpit.data.generatedAt)}</div>}
        </div>
      )}
    </Popover>
  )
}

function TrafficToggle() {
  const demo = useDemoState()
  const set = useInstMutation((enabled: boolean) => demoService.traffic({ enabled }), { success: (d) => (d.traffic.enabled ? 'Simulated traffic resumed' : 'Simulated traffic paused') })
  const running = demo.data?.traffic.enabled ?? true
  return (
    <Tooltip content={running ? 'DEMO: simulated orders are arriving. Click to pause.' : 'DEMO: simulated traffic paused. Click to resume.'}>
      <button onClick={() => set.mutate(!running)} className="hidden h-7 items-center gap-1.5 rounded-full border border-dashed border-warning/50 bg-warning/[0.05] px-2.5 text-[11.5px] font-medium text-fg-2 transition-colors hover:border-warning md:flex">
        <Dot tone={running ? 'success' : 'neutral'} pulse={running} />
        {running ? 'Demo live' : 'Demo paused'}
      </button>
    </Tooltip>
  )
}

export function AdminTopbar() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme, setCommandOpen, setMobileNav } = useUi()
  const signOut = useSession((s) => s.signOutInstallation)
  const me = useMe()
  const current = matchNav(pathname, search)
  const base = current?.to.split(/[?#]/)[0] ?? '/admin'
  const isDetail = current && pathname !== base && pathname.startsWith(`${base}/`)
  const name = me.data?.name ?? 'Alex Morgan'
  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-4 sm:px-6">
      <Button variant="ghost" size="sm" icon className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
        <span className="hidden text-fg-3 sm:inline">{current?.group ?? demoInstallation.adminTitle}</span>
        {current?.group && <ChevronRight className="hidden size-3.5 text-fg-3/60 sm:inline" />}
        <Link to={current?.to ?? '/admin'} className={cn('truncate font-medium', isDetail ? 'text-fg-2 hover:text-fg' : 'text-fg')}>
          {current?.label ?? 'Operations cockpit'}
        </Link>
        {isDetail && (
          <>
            <ChevronRight className="size-3.5 text-fg-3/60" />
            <span className="truncate font-mono text-[12px] text-fg">{decodeURIComponent(pathname.slice(base.length + 1).split('/')[0] ?? '')}</span>
          </>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={() => setCommandOpen(true)} className="hidden h-8 w-[220px] items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-fg-3 shadow-card transition-colors hover:border-line-strong hover:text-fg-2 xl:flex">
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search orders, IMEIs, accounts…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <Button variant="ghost" size="sm" icon className="xl:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
          <Search />
        </Button>
        <TrafficToggle />
        <span className="mx-1 hidden h-5 w-px bg-line md:block" />
        <Tooltip content="The customer's public storefront">
          <Button variant="ghost" size="sm" to="/site" className="hidden sm:inline-flex" leading={<ExternalLink />}>
            Storefront
          </Button>
        </Tooltip>
        <Tooltip content="The reseller portal (signed in as a reseller member)">
          <Button variant="ghost" size="sm" to="/portal" className="hidden lg:inline-flex" leading={<LayoutDashboard />}>
            Portal
          </Button>
        </Tooltip>
        <Button variant="ghost" size="sm" icon onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <Alerts />
        <Popover
          placement="bottom-end"
          className="w-[270px]"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="ml-1 flex items-center gap-2 rounded-full py-0.5 pr-0.5 pl-2 ring-offset-2 ring-offset-bg transition-shadow hover:ring-2 hover:ring-line-strong" aria-label="Account menu">
              {me.data && me.data.role !== 'Owner' && <span className="hidden rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning sm:inline">Acting as {me.data.role}</span>}
              <Avatar name={name} color="var(--c1)" size="sm" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="flex items-center gap-2.5 px-2.5 py-2">
                <Avatar name={name} color="var(--c1)" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{name}</p>
                  <p className="truncate text-[11.5px] text-fg-3">
                    {me.data?.role ?? 'Owner'} · {demoInstallation.domain}
                  </p>
                </div>
              </div>
              <MenuSeparator />
              <MenuItem icon={<UserRound />} onClick={() => (close(), navigate('/admin/system/roles'))}>
                Roles & users
              </MenuItem>
              <MenuItem icon={<FlaskConical />} onClick={() => (close(), navigate('/admin/demo'))}>
                Switch role (demo)
              </MenuItem>
              <MenuItem icon={<ShieldCheck />} onClick={() => (close(), navigate('/admin/system/license'))}>
                License
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Vendor platform (separate)</MenuLabel>
              <MenuItem icon={<ExternalLink />} onClick={() => (close(), navigate('/account'))}>
                ORVEX vendor portal
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<LogOut />}
                onClick={() => {
                  close()
                  signOut()
                  navigate('/admin/login')
                }}
              >
                Sign out
              </MenuItem>
            </>
          )}
        </Popover>
      </div>
    </header>
  )
}
