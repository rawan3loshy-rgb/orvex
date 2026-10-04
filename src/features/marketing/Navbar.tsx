import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui'
import { useUi } from '@/stores/ui'
import { brand } from '@/config/brand'
import { cn } from '@/lib/cn'
import { Container } from './shared'
import { EASE, scrollToId, useStartDemo } from './sharedUtils'

const NAV_LINKS = [
  { id: 'platform', label: 'Platform' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'developers', label: 'Developers' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const

/** Which nav item "owns" each section on the page. */
const OWNER: Record<string, string> = {
  architecture: 'architecture',
  platform: 'platform',
  providers: 'platform',
  catalog: 'platform',
  routing: 'platform',
  developers: 'developers',
  automation: 'platform',
  ledger: 'platform',
  'self-hosted': 'architecture',
  security: 'architecture',
  analytics: 'platform',
  website: 'platform',
  updates: 'architecture',
  workflow: 'developers',
  pricing: 'pricing',
  faq: 'faq',
}

function useActiveSection() {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const els = Object.keys(OWNER)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(OWNER[e.target.id] ?? null)
      },
      { rootMargin: '-42% 0px -56% 0px' },
    )
    els.forEach((el) => io.observe(el))
    const onTop = () => window.scrollY < 200 && setActive(null)
    window.addEventListener('scroll', onTop, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onTop)
    }
  }, [])
  return active
}

export function Navbar() {
  const { theme, toggleTheme } = useUi()
  const startDemo = useStartDemo()
  const { scrollY, scrollYProgress } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const active = useActiveSection()
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 8))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onResize = () => window.innerWidth >= 768 && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const go = (id: string) => {
    setOpen(false)
    scrollToId(id)
  }

  return (
    <header className={cn('fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color] duration-300', scrolled || open ? 'glass border-line' : 'border-transparent bg-transparent')}>
      <Container className="flex h-16 items-center gap-6 lg:gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            setOpen(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          aria-label={`${brand.product} — back to top`}
          className="shrink-0 rounded-md"
        >
          <Logo />
        </a>
        <span aria-hidden className="-ml-4 hidden items-center gap-3 xl:flex">
          <span className="h-4 w-px bg-line-strong" />
          <span className="mono-label whitespace-nowrap">{brand.descriptor}</span>
        </span>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => {
            const isActive = active === l.id
            return (
              <button key={l.id} type="button" onClick={() => go(l.id)} className={cn('relative h-8 rounded-md px-3 text-[13.5px] font-medium transition-colors', isActive ? 'text-fg' : 'text-fg-2 hover:text-fg')}>
                {isActive && (
                  <motion.span layoutId="mkt-nav-pill" className="absolute inset-0 rounded-md bg-fg/[0.06] ring-1 ring-line ring-inset" transition={{ type: 'spring', stiffness: 480, damping: 38 }}>
                    <span className="absolute inset-x-3 -bottom-px h-[1.5px] rounded-full bg-accent" />
                  </motion.span>
                )}
                <span className="relative">{l.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" icon onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={theme} initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.18 }} className="grid place-items-center">
                {theme === 'dark' ? <Sun /> : <Moon />}
              </motion.span>
            </AnimatePresence>
          </Button>
          <Button variant="ghost" size="sm" to="/login" className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button variant="primary" size="sm" onClick={startDemo} trailing={<ArrowRight />} className="hidden sm:inline-flex">
            Live demo
          </Button>
          <Button variant="ghost" size="sm" icon className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </Container>

      <motion.div aria-hidden style={{ scaleX: scrollYProgress }} className={cn('absolute inset-x-0 -bottom-px h-px origin-left bg-accent transition-opacity duration-300', scrolled ? 'opacity-90' : 'opacity-0')} />

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden border-t border-line md:hidden">
            <Container className="pt-2 pb-5">
              <nav aria-label="Mobile" className="flex flex-col">
                {NAV_LINKS.map((l, i) => (
                  <motion.button
                    key={l.id}
                    type="button"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * i, duration: 0.25, ease: EASE }}
                    onClick={() => go(l.id)}
                    className="flex h-12 items-center justify-between border-b border-line text-left text-[15px] font-medium text-fg"
                  >
                    {l.label}
                    <ArrowRight className="size-4 text-fg-3" />
                  </motion.button>
                ))}
              </nav>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="md" to="/login">
                  Sign in
                </Button>
                <Button variant="primary" size="md" onClick={startDemo} trailing={<ArrowRight />}>
                  Live demo
                </Button>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
