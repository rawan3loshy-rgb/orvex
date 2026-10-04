import { Suspense, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useUi } from '@/stores/ui'
import { useSession } from '@/stores/session'
import { AdminSidebar, SidebarContent } from './AdminSidebar'
import { AdminTopbar } from './AdminTopbar'
import { CommandPalette } from './CommandPalette'
import { PageLoader } from './PageLoader'

/**
 * Shell of the customer's installation admin (their-domain.com/admin).
 * Requires an installation session — independent of the vendor account.
 */
export function AdminShell() {
  const session = useSession((s) => s.installation)
  const signIn = useSession((s) => s.signInInstallation)
  const { mobileNavOpen, setMobileNav } = useUi()
  const { pathname, search } = useLocation()
  // Demo deep links: `?demo=1` signs in as the demo Owner so a link opens the screen directly.
  const demoLink = !session && new URLSearchParams(search).get('demo') === '1'

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    if (demoLink) signIn('alex@unlockdesk-demo.com', 'Alex Morgan')
  }, [demoLink, signIn])

  if (demoLink) return <PageLoader />
  if (!session) return <Navigate to="/admin/login" replace state={{ from: pathname }} />

  return (
    <div className="flex min-h-dvh bg-bg">
      <AdminSidebar />
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[272px] border-r border-line bg-bg-subtle" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', stiffness: 420, damping: 42 }}>
              <SidebarContent onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
