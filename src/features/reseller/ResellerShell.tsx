import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Building, ChevronsUpDown, ExternalLink, Lock, LogOut, Menu, Moon, MoreHorizontal, Sun, UserRoundCog, Wallet, X } from 'lucide-react'
import { LogoMark, TenantMark } from '@/components/brand'
import { Avatar, Badge, Button, MenuItem, MenuLabel, MenuSeparator, Popover, Skeleton } from '@/components/ui'
import { PageLoader } from '@/components/layout/PageLoader'
import { Money } from '@/components/domain'
import { useDemoState, useInstMutation } from '@/hooks/installation'
import { demoService } from '@/services/installation'
import { ACCOUNT_TIER_LABEL } from '@/core/domain'
import { useUi } from '@/stores/ui'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { BOTTOM_NAV, NAV_GROUPS, type ResellerNavItem } from './nav'
import { lowBalanceThreshold, ROLE_LABEL, usePortalSession } from './kitUtils'

const TENANT = 'UnlockDesk'

/**
 * UnlockDesk Partner Portal — the reseller portal served by the customer's own
 * ORVEX installation. Desktop: sidebar; mobile: drawer + bottom navigation.
 */
export function ResellerShell() {
  const { pathname } = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [drawerPath, setDrawerPath] = useState(pathname)

  // Close the drawer whenever the route changes (adjusted during render, not in an effect).
  if (drawerPath !== pathname) {
    setDrawerPath(pathname)
    setDrawer(false)
  }

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    document.title = `${TENANT} Partner Portal`
  }, [])

  return (
    <div className="min-h-dvh bg-bg lg:pl-[252px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] border-r border-line bg-bg-subtle lg:block">
        <SidebarContent />
      </aside>

      <Topbar onMenu={() => setDrawer(true)} />

      <main className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-28 sm:px-6 lg:pt-8 lg:pb-14">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
        <footer className="mt-14 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5 text-[11.5px] text-fg-3">
          <span>© 2026 UnlockDesk Demo Ltd. · Partner Portal</span>
          <span className="inline-flex items-center gap-1.5">
            Payments and fulfilment are simulated in this demo · Powered by <LogoMark mono className="size-3.5" /> ORVEX
          </span>
        </footer>
      </main>

      <BottomNav onMore={() => setDrawer(true)} />
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

function TenantLockup({ compact }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <TenantMark className={compact ? 'size-7' : 'size-8 text-[13px]'} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-[14.5px] font-semibold tracking-[-0.015em] text-fg">{TENANT}</span>
        <span className={cn('block truncate text-[11px] text-fg-3', compact && 'hidden min-[420px]:block')}>Partner Portal</span>
      </span>
    </span>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { me, can, isLoading } = usePortalSession()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <Link to="/portal" onClick={onNavigate} aria-label={`${TENANT} Partner Portal home`}>
          <TenantLockup />
        </Link>
      </div>

      <div className="px-3 pt-3">
        <Link to="/portal/profile" onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 shadow-card transition-colors hover:border-line-strong">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-2">
            <Building className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            {isLoading || !me ? (
              <>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-1.5 h-3 w-16" />
              </>
            ) : (
              <>
                <span className="block truncate text-[13px] font-semibold text-fg">{me.account.name}</span>
                <span className="block truncate text-[11.5px] text-fg-3">
                  {me.tierName} pricing · {me.account.number}
                </span>
              </>
            )}
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Portal">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="mb-1 px-2.5 mono-label">{g.label}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <SideLink item={it} locked={!!it.need && !!me && !can[it.need]} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-line p-3">
        <DemoMemberSwitcher variant="card" />
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-fg-3">
          Powered by
          <LogoMark mono className="size-3.5 text-fg-2" />
          <span className="font-display font-semibold tracking-[0.08em] text-fg-2">ORVEX</span>
        </div>
      </div>
    </div>
  )
}

function SideLink({ item, locked, onNavigate }: { item: ResellerNavItem; locked: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={locked ? 'Not available for your role' : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-surface text-fg shadow-card ring-1 ring-line' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
          locked && !isActive && 'text-fg-3',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="reseller-nav" className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <Icon className={cn('size-4 shrink-0', isActive ? 'text-accent-ink' : 'text-fg-3 group-hover:text-fg-2')} />
          <span className="flex-1 truncate">{item.label}</span>
          {locked && <Lock className="size-3 text-fg-3" />}
        </>
      )}
    </NavLink>
  )
}

/* ------------------------------------------------------------------ */
/*  Top bar                                                            */
/* ------------------------------------------------------------------ */

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggleTheme } = useUi()
  const { me } = usePortalSession()
  return (
    <header className="glass sticky top-0 z-20 border-b border-line">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Button variant="ghost" size="sm" icon onClick={onMenu} aria-label="Open menu" className="lg:hidden">
          <Menu />
        </Button>
        <Link to="/portal" className="min-w-0 lg:hidden" aria-label="Partner Portal home">
          <TenantLockup compact />
        </Link>

        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          {me ? (
            <>
              <span className="truncate text-[13.5px] font-semibold">{me.account.name}</span>
              <Badge tone="accent" variant="soft">
                {me.tierName}
              </Badge>
              <span className="hidden text-[12px] text-fg-3 xl:inline">{ACCOUNT_TIER_LABEL[me.account.tier]} account</span>
            </>
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <DemoMemberSwitcher variant="pill" className="hidden md:inline-flex" />
          <BalancePill />
          <Button variant="ghost" size="sm" icon onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <MemberMenu />
        </div>
      </div>
    </header>
  )
}

function BalancePill() {
  const { me } = usePortalSession()
  if (!me) return <Skeleton className="h-8 w-24 rounded-full" />
  const low = me.balance.available < lowBalanceThreshold(me.account.lowBalanceAlert)
  return (
    <Link
      to="/portal/wallet"
      title="Available balance · reserved for open orders"
      className="group flex h-8 items-center gap-2 rounded-full border border-line bg-surface pr-3 pl-2.5 text-[12.5px] shadow-card transition-colors hover:border-line-strong"
    >
      <Wallet className={cn('size-3.5', low ? 'text-warning' : 'text-fg-3')} />
      <Money value={me.balance.available} className="font-semibold text-fg" />
      {me.balance.held > 0 && (
        <span className="hidden items-center gap-1.5 text-fg-3 sm:inline-flex">
          <span className="h-3.5 w-px bg-line-strong" />
          <Money value={me.balance.held} />
          <span className="hidden md:inline">held</span>
        </span>
      )}
    </Link>
  )
}

function MemberMenu() {
  const { me } = usePortalSession()
  const navigate = useNavigate()
  if (!me) return <Skeleton className="size-7 rounded-full" />
  return (
    <Popover
      placement="bottom-end"
      className="w-[270px]"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="ml-0.5 rounded-full hover:ring-2 hover:ring-line-strong" aria-label="Member menu">
          <Avatar name={me.member.name} size="sm" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar name={me.member.name} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{me.member.name}</p>
              <p className="truncate text-[11.5px] text-fg-3">{me.member.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 pb-2">
            <Badge tone="neutral">{ROLE_LABEL[me.member.role]}</Badge>
            <span className="truncate text-[11.5px] text-fg-3">{me.account.name}</span>
          </div>
          <MenuSeparator />
          <MenuItem icon={<Building />} onClick={() => (close(), navigate('/portal/profile'))}>
            Account & members
          </MenuItem>
          <MenuItem icon={<Wallet />} onClick={() => (close(), navigate('/portal/wallet'))}>
            Wallet
          </MenuItem>
          <div className="md:hidden">
            <MenuSeparator />
            <div className="px-2.5 pt-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-warning">DEMO · VIEW PORTAL AS</div>
            <div className="mx-1 mb-1 rounded-lg border border-dashed border-warning/40 bg-hatch">
              <DemoMemberList onDone={close} />
            </div>
          </div>
          <MenuSeparator />
          <MenuItem icon={<ExternalLink />} onClick={() => (close(), navigate('/admin'))}>
            Open UnlockDesk admin (demo)
          </MenuItem>
          <MenuItem icon={<LogOut />} onClick={() => (close(), toast.info('Sign-out is disabled in the demo', 'Use the DEMO member switcher to view the portal as someone else.'))}>
            Sign out
          </MenuItem>
        </>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ */
/*  DEMO member switcher                                               */
/* ------------------------------------------------------------------ */

function DemoMemberList({ onDone }: { onDone?: () => void }) {
  const demo = useDemoState()
  const { me } = usePortalSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const switchTo = useInstMutation((memberId: string) => demoService.portalMember(memberId), {
    success: (s, id) => {
      const m = s.members.find((x) => x.id === id)
      return m ? `Viewing the portal as ${m.name} (${m.accountName})` : 'Member switched'
    },
    onSuccess: () => {
      if (/\/portal\/orders\/.+/.test(pathname)) navigate('/portal/orders')
    },
  })
  const members = demo.data?.members ?? []
  const groups = members.reduce<Record<string, typeof members>>((acc, m) => {
    ;(acc[m.accountName] ??= []).push(m)
    return acc
  }, {})
  const currentId = demo.data?.sessions.portalMemberId ?? me?.member.id
  return (
    <div className="max-h-[360px] overflow-y-auto p-1">
      {demo.isLoading && <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-7" />)}</div>}
      {Object.entries(groups).map(([account, list]) => (
        <div key={account}>
          <MenuLabel>{account}</MenuLabel>
          {list.map((m) => (
            <MenuItem
              key={m.id}
              active={m.id === currentId}
              disabled={switchTo.isPending}
              icon={<Avatar name={m.name} size="xs" />}
              onClick={() => {
                if (m.id !== currentId) switchTo.mutate(m.id)
                onDone?.()
              }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">{m.name}</span>
                <span className="shrink-0 text-[11px] text-fg-3">{ROLE_LABEL[m.role as keyof typeof ROLE_LABEL] ?? m.role}</span>
              </span>
            </MenuItem>
          ))}
        </div>
      ))}
    </div>
  )
}

function DemoMemberSwitcher({ variant, className }: { variant: 'pill' | 'card'; className?: string }) {
  const { me } = usePortalSession()
  return (
    <Popover
      placement={variant === 'pill' ? 'bottom-end' : 'top-start'}
      className="w-[300px] p-0"
      trigger={({ toggle }) =>
        variant === 'pill' ? (
          <button
            onClick={toggle}
            className={cn('h-8 items-center gap-2 rounded-full border border-dashed border-warning/55 bg-hatch px-2.5 text-[12px] text-fg-2 transition-colors hover:border-warning', className)}
            aria-label="Demo: switch portal member"
          >
            <span className="rounded-sm bg-warning/15 px-1 font-mono text-[9.5px] font-semibold tracking-[0.1em] text-warning">DEMO</span>
            <span className="max-w-[140px] truncate">{me ? `${me.member.name.split(' ')[0]} · ${ROLE_LABEL[me.member.role]}` : 'Member'}</span>
            <ChevronsUpDown className="size-3.5 text-fg-3" />
          </button>
        ) : (
          <button onClick={toggle} className={cn('flex w-full items-center gap-2.5 rounded-lg border border-dashed border-warning/50 bg-hatch px-2.5 py-2 text-left transition-colors hover:border-warning', className)} aria-label="Demo: switch portal member">
            <UserRoundCog className="size-4 shrink-0 text-warning" />
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[9.5px] font-semibold tracking-[0.1em] text-warning">DEMO · VIEW AS</span>
              <span className="block truncate text-[12.5px] font-medium text-fg">{me ? `${me.member.name} · ${ROLE_LABEL[me.member.role]}` : '…'}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-fg-3" />
          </button>
        )
      }
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-3 py-2.5">
            <div className="font-mono text-[10px] font-semibold tracking-[0.1em] text-warning">DEMO / SIMULATION</div>
            <p className="mt-0.5 text-[12px] text-fg-3">Switch the signed-in portal member to see other accounts and roles. Not part of the real product.</p>
          </div>
          <DemoMemberList onDone={close} />
        </div>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile                                                             */
/* ------------------------------------------------------------------ */

function BottomNav({ onMore }: { onMore: () => void }) {
  const { me, can } = usePortalSession()
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Quick navigation">
      <div className="mx-auto grid h-16 max-w-[560px] grid-cols-5">
        {BOTTOM_NAV.map((it) => {
          const Icon = it.icon
          const locked = !!it.need && !!me && !can[it.need]
          return (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors', isActive ? 'text-accent-ink' : 'text-fg-3', locked && 'opacity-60')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="reseller-bottom" className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  {it.label}
                </>
              )}
            </NavLink>
          )
        })}
        <button type="button" onClick={onMore} className="flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-fg-3">
          <MoreHorizontal className="size-5" strokeWidth={1.8} />
          More
        </button>
      </div>
    </nav>
  )
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div className="absolute inset-0 bg-overlay backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-[300px] max-w-[86vw] border-r border-line bg-bg-subtle shadow-pop"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
          >
            <Button variant="ghost" size="sm" icon onClick={onClose} aria-label="Close menu" className="absolute top-3 right-3 z-10">
              <X />
            </Button>
            <SidebarContent onNavigate={onClose} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
