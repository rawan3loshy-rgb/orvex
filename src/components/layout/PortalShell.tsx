import { Suspense, useEffect } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen, ExternalLink, LifeBuoy, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { Logo, TenantMark } from '@/components/brand'
import { Avatar, Button, MenuItem, MenuSeparator, Popover } from '@/components/ui'
import { useSession } from '@/stores/session'
import { useUi } from '@/stores/ui'
import { cn } from '@/lib/cn'
import { brand, demoInstallation } from '@/config/brand'
import { PageLoader } from './PageLoader'
import { PORTAL_NAV } from './portalNav'

/**
 * Shell of the VENDOR platform (account.orvex.io): the customer's
 * commercial relationship with us — never their operational data.
 */
export function PortalShell() {
  const session = useSession((s) => s.vendor)
  const signOut = useSession((s) => s.signOutVendor)
  const { theme, toggleTheme } = useUi()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const signInVendor = useSession((s) => s.signInVendor)
  const demoLink = !session && new URLSearchParams(search).get('demo') === '1'
  useEffect(() => {
    if (demoLink) signInVendor('alex@unlockdesk-demo.com', 'Alex Morgan')
  }, [demoLink, signInVendor])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  if (demoLink) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="min-h-dvh bg-bg">
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
          <Link to="/account" className="flex items-center gap-3" aria-label={`${brand.product} account`}>
            <Logo size="sm" suffix="Account" />
          </Link>
          <span className="hidden h-5 w-px bg-line sm:block" />
          <span className="hidden min-w-0 items-center gap-2 text-[13px] sm:flex">
            <TenantMark className="size-5 rounded-md text-[10px]" />
            <span className="truncate font-medium">{demoInstallation.orgName}</span>
            <span className="hidden rounded-md border border-line px-1.5 py-px font-mono text-[10px] tracking-[0.06em] text-fg-2 uppercase md:inline">Professional</span>
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" href={brand.docsUrl} leading={<BookOpen />} className="hidden md:inline-flex">
              Docs
            </Button>
            <Button variant="ghost" size="sm" to="/account/support" leading={<LifeBuoy />} className="hidden md:inline-flex">
              Support
            </Button>
            <Button variant="ghost" size="sm" icon onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Popover
              placement="bottom-end"
              className="w-[250px]"
              trigger={({ toggle }) => (
                <button onClick={toggle} className="ml-1 rounded-full hover:ring-2 hover:ring-line-strong" aria-label="Account menu">
                  <Avatar name={session.name} size="sm" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="px-2.5 py-2">
                    <p className="text-[13px] font-medium">{session.name}</p>
                    <p className="text-[11.5px] text-fg-3">{session.email}</p>
                  </div>
                  <MenuSeparator />
                  <MenuItem icon={<Settings />} onClick={() => (close(), navigate('/account/settings'))}>
                    Account settings
                  </MenuItem>
                  <MenuItem icon={<ExternalLink />} onClick={() => (close(), navigate('/admin'))}>
                    Open installation admin
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    icon={<LogOut />}
                    onClick={() => {
                      close()
                      signOut()
                      navigate('/login')
                    }}
                  >
                    Sign out
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-4 sm:px-6">
          {PORTAL_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('relative shrink-0 px-2.5 py-2.5 text-[13px] font-medium transition-colors', isActive ? 'text-fg' : 'text-fg-3 hover:text-fg-2')}>
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && <motion.span layoutId="portal-nav" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 text-[12px] text-fg-3 sm:px-6">
        <span>
          © 2026 {brand.company} · {brand.accountDomain}
        </span>
        <span>The vendor platform never stores your installation’s operational data — orders, IMEIs, resellers or supplier keys.</span>
      </footer>
    </div>
  )
}
