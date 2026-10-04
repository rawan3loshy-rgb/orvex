import { useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Compass, Moon, RotateCcw, Sun, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useUi } from '@/stores/ui'
import { useSession } from '@/stores/session'
import { demoService } from '@/services/installation'
import { vendorDemoService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { brand, demoInstallation } from '@/config/brand'
import { JOURNEY, type Step } from './journey'

/**
 * Area legend. Vendor = ORVEX coral; Installation = sage (the customer's own
 * installation); Storefront = ochre; Portal = mauve; Demo = warning.
 */
const AREA: Record<Step['area'], { label: string; dot: string }> = {
  Vendor: { label: brand.product, dot: 'bg-accent' },
  Installation: { label: 'Admin', dot: 'bg-c3' },
  Storefront: { label: 'Site', dot: 'bg-c4' },
  Portal: { label: 'Portal', dot: 'bg-c5' },
  Demo: { label: 'Demo', dot: 'bg-warning' },
}

/**
 * Floating prototype guide so reviewers can walk the full journey.
 * Not part of the product itself.
 */
export function JourneyNavigator() {
  const { journeyOpen, setJourneyOpen, theme, toggleTheme } = useUi()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const session = useSession()
  const { search } = useLocation()
  const here = pathname + search
  const activeIdx = JOURNEY.map((s, i) => ({ s, i })).filter(({ s }) => (s.to.includes('?') ? here === s.to : s.to === '/' ? pathname === '/' : pathname === s.to || (s.to !== '/admin' && s.to !== '/site' && s.to !== '/portal' && pathname.startsWith(`${s.to}/`)))).at(-1)?.i

  const goto = (s: Step) => {
    // Auto sign-in so the tour never dead-ends on an auth wall.
    if (s.to.startsWith('/account') && !session.vendor) session.signInVendor('alex@unlockdesk-demo.com', 'Alex Morgan')
    if (s.to.startsWith('/admin') && s.to !== '/admin/login' && !session.installation) session.signInInstallation('alex@unlockdesk-demo.com', 'Alex Morgan')
    navigate(s.to)
    setJourneyOpen(false)
  }

  return (
    <div className="fixed right-4 bottom-4 z-[45] flex flex-col items-end print:hidden">
      <AnimatePresence>
        {journeyOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            className="mb-2 w-[300px] origin-bottom-right overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-pop backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold">Demo journey</p>
                <p className="text-[11.5px] text-fg-3">
                  {brand.product} × {demoInstallation.siteName} · demo environment, integrations simulated
                </p>
              </div>
              <button onClick={() => setJourneyOpen(false)} className="rounded-md p-1 text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Close journey">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 border-b border-line px-4 py-2">
              {(Object.keys(AREA) as Step['area'][]).map((a) => (
                <span key={a} className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-fg-3 uppercase">
                  <span className={cn('size-1.5 rounded-full', AREA[a].dot)} />
                  {AREA[a].label}
                </span>
              ))}
            </div>
            <ol className="max-h-[52vh] overflow-y-auto p-2">
              {JOURNEY.map((s, i) => {
                const active = i === activeIdx
                const done = activeIdx != null && i < activeIdx
                return (
                  <li key={`${s.to}-${i}`}>
                    <button onClick={() => goto(s)} className={cn('group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors', active ? 'bg-surface-3' : 'hover:bg-surface-2')}>
                      <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold tabular', active ? 'border-accent bg-accent text-white' : done ? 'border-accent/40 bg-accent/10 text-accent-ink' : 'border-line-strong text-fg-3')}>
                        {done ? <Check className="size-3" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[12.5px]', active ? 'font-medium text-fg' : 'text-fg-2 group-hover:text-fg')}>{s.label}</span>
                        {s.note && <span className="block truncate font-mono text-[10px] text-fg-3">{s.note}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[9.5px] tracking-wide text-fg-3 uppercase">
                        <span className={cn('size-1.5 rounded-full', AREA[s.area].dot)} />
                        <span className="hidden min-[360px]:inline">{AREA[s.area].label}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className="flex items-center gap-1 border-t border-line p-2">
              <button onClick={toggleTheme} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-fg-2 hover:bg-surface-2 hover:text-fg">
                {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                {theme === 'dark' ? 'Light' : 'Dark'} theme
              </button>
              <button
                onClick={async () => {
                  await Promise.all([demoService.reset(), vendorDemoService.reset()])
                  qc.invalidateQueries()
                  toast.success('Demo reset', 'The installation was re-seeded (30 days of history, scenarios A–L).')
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-fg-2 hover:bg-surface-2 hover:text-fg"
              >
                <RotateCcw className="size-3.5" />
                Reset demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setJourneyOpen(!journeyOpen)}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface/90 pr-3.5 pl-2.5 text-[12.5px] font-medium text-fg shadow-pop backdrop-blur-xl transition-colors hover:border-line-strong"
      >
        <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-fg">
          <Compass className="size-3" />
        </span>
        Journey
        {activeIdx != null && (
          <span className="font-mono text-[11px] text-fg-3 tabular">
            {activeIdx + 1}/{JOURNEY.length}
          </span>
        )}
      </button>
    </div>
  )
}
