import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router'
import { Eye, Menu, Search, ShieldCheck, User, X } from 'lucide-react'
import { useStoreConfig } from '@/hooks/installation'
import type { StorefrontNavItem } from '@/types/installation'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import { FALLBACK_THEME, storefrontVars } from './lib/theme'
import { SfLink, StoreProvider } from './lib/store'
import { isExternal, resolveTarget, useStore, withPreview, type StoreCtx } from './lib/storeContext'
import { SearchBox } from './components/SearchBox'
import { Btn, Container, ErrorState, Skel } from './ui'
import './storefront.css'

export default function StorefrontLayout() {
  const [params] = useSearchParams()
  // Without a token this is the public site and always renders the PUBLISHED revision.
  const previewToken = params.get('preview') || null
  const config = useStoreConfig(previewToken)
  const theme = config.data?.theme ?? FALLBACK_THEME
  const vars = useMemo(() => storefrontVars(theme), [theme])
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const ctx = useMemo<StoreCtx | null>(() => {
    if (!config.data) return null
    const cfg = config.data
    const to = (path: string) => withPreview(path, previewToken)
    return { config: cfg, previewToken, preview: !!previewToken, to, hrefOf: (t) => to(resolveTarget(t, cfg)), pageHref: (p) => to(p.kind === 'home' || !p.slug ? '/site' : `/site/${p.slug}`) }
  }, [config.data, previewToken])

  return (
    <div className="sf-root flex min-h-dvh flex-col bg-bg text-fg" style={vars} data-sf-mode={theme.mode}>
      {!ctx ? (
        config.isError && previewToken && config.error?.status === 403 ? (
          <Container className="py-24">
            <ErrorState title="This preview link is no longer valid" message="Preview links stop working when the draft is published or discarded. Open a fresh preview from the storefront editor." />
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Btn href={pathname} variant="secondary">
                View the published site
              </Btn>
              <Btn href="/admin/storefront">Back to the editor</Btn>
            </div>
          </Container>
        ) : config.isError ? (
          <Container className="py-24">
            <ErrorState title="The store is temporarily unavailable" message={config.error?.message ?? 'Please try again in a moment.'} onRetry={() => void config.refetch()} />
          </Container>
        ) : (
          <LayoutSkeleton />
        )
      ) : (
        <StoreProvider value={ctx}>
          <DemoRibbon />
          {ctx.config.revision.status === 'draft' && <PreviewBanner />}
          <Header />
          <main id="main" className="flex-1">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
          <Footer />
        </StoreProvider>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
function DemoRibbon() {
  return (
    <div className="border-b border-line bg-bg-subtle">
      <Container className="flex h-8 items-center justify-center gap-2 text-[12px] text-fg-3">
        <ShieldCheck className="size-3.5 text-accent-ink" aria-hidden />
        <span>
          <span className="font-semibold text-fg-2">Demo storefront</span> · payments are simulated — no real card or PayPal charge
        </span>
      </Container>
    </div>
  )
}

/** Shown only when the layout rendered the DRAFT revision (the server resolved it from the preview token). */
function PreviewBanner() {
  const { pathname } = useLocation()
  const { config } = useStore()
  const r = config.revision
  return (
    <div className="sticky top-0 z-50 border-b border-warning/30 bg-[color-mix(in_oklab,var(--warning)_14%,var(--bg))]">
      <Container className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 text-[13px]">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-fg">
          <Eye className="size-4 shrink-0 text-warning" aria-hidden />
          <span className="font-semibold tracking-[0.04em]">PREVIEW — Draft v{r.version}</span>
          <span className="text-fg-2">
            saved {relative(r.updatedAt)} · not visible to visitors · checkout disabled
          </span>
        </span>
        <span className="flex items-center gap-4">
          <a href="/admin/storefront" className="font-semibold text-fg-2 underline-offset-4 hover:text-fg hover:underline">
            Back to editor
          </a>
          <SfLink href={pathname} className="font-semibold text-accent-ink underline-offset-4 hover:underline">
            Exit preview
          </SfLink>
        </span>
      </Container>
    </div>
  )
}

function navHref(item: StorefrontNavItem, hrefOf: StoreCtx['hrefOf']) {
  return hrefOf(item.target)
}

function Header() {
  const { config, hrefOf, to, preview } = useStore()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const { pathname, search: qs } = useLocation()
  const t = config.theme

  // Close the menu and search on navigation (adjusting state during render, not in an effect).
  const location = `${pathname}${qs}`
  const [seenLocation, setSeenLocation] = useState(location)
  if (seenLocation !== location) {
    setSeenLocation(location)
    setMenu(false)
    setSearch(false)
  }

  useEffect(() => {
    if (!menu) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menu])

  const regular = config.nav.filter((n) => !n.highlight)
  const highlighted = config.nav.filter((n) => n.highlight)

  return (
    <header className={cn('sticky z-40 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-md', preview ? 'top-10' : 'top-0')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Container className="flex h-16 items-center gap-4">
        <SfLink href={to('/site')} className="flex shrink-0 items-center gap-2.5" aria-label={`${t.brandName} home`}>
          <Logo text={t.logoText} />
        </SfLink>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {regular.map((n) => (
            <NavItemLink key={n.id} item={n} href={navHref(n, hrefOf)} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setSearch((s) => !s)} className="grid size-10 place-items-center rounded-[var(--sf-r)] text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg" aria-label="Search services" aria-expanded={search}>
            <Search className="size-[19px]" />
          </button>
          <SfLink href={to('/site/account')} className="hidden h-10 items-center gap-2 rounded-[var(--sf-r)] px-3 text-[14.5px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex" aria-label="Account">
            {config.customer ? (
              <>
                <span className="grid size-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">{config.customer.name.slice(0, 1)}</span>
                <span className="max-w-[9rem] truncate">{config.customer.name}</span>
              </>
            ) : (
              <>
                <User className="size-[18px]" />
                Sign in
              </>
            )}
          </SfLink>
          {highlighted.slice(0, 1).map((n) => (
            <Btn key={n.id} href={navHref(n, hrefOf)} size="sm" className="hidden sm:inline-flex">
              {n.label}
            </Btn>
          ))}
          <button type="button" onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-[var(--sf-r)] text-fg-2 hover:bg-surface-2 lg:hidden" aria-label="Open menu" aria-expanded={menu}>
            <Menu className="size-5" />
          </button>
        </div>
      </Container>

      {search && (
        <div className="border-t border-line bg-bg">
          <Container className="py-3">
            <SearchBox size="md" autoFocus onDone={() => setSearch(false)} />
          </Container>
        </div>
      )}

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-overlay" aria-label="Close menu" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col bg-bg shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <Logo text={t.logoText} />
              <button type="button" onClick={() => setMenu(false)} className="grid size-10 place-items-center rounded-[var(--sf-r)] text-fg-2 hover:bg-surface-2" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <SearchBox size="md" placeholder="Search services" onDone={() => setMenu(false)} />
              <nav aria-label="Mobile" className="mt-4 grid">
                {config.nav.map((n) => (
                  <SfLink key={n.id} href={navHref(n, hrefOf)} className="flex items-center justify-between border-b border-line py-3.5 text-[16.5px] font-medium text-fg">
                    {n.label}
                    {n.highlight && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[12px] font-semibold text-accent-ink">Popular</span>}
                  </SfLink>
                ))}
                <SfLink href={to('/site/account')} className="flex items-center gap-2 border-b border-line py-3.5 text-[16.5px] font-medium text-fg">
                  <User className="size-[18px] text-fg-3" />
                  {config.customer ? `Account · ${config.customer.name}` : 'Sign in / account'}
                </SfLink>
              </nav>
            </div>
            <div className="border-t border-line p-5 text-[12.5px] text-fg-3">Demo storefront — payments are simulated.</div>
          </div>
        </div>
      )}
    </header>
  )
}

function NavItemLink({ item, href }: { item: StorefrontNavItem; href: string }) {
  const cls = 'inline-flex h-10 items-center rounded-[var(--sf-r)] px-3 text-[14.5px] font-medium transition-colors'
  if (isExternal(href))
    return (
      <SfLink href={href} className={cn(cls, 'text-fg-2 hover:bg-surface-2 hover:text-fg')}>
        {item.label}
      </SfLink>
    )
  const path = href.split('?')[0]!
  return (
    <NavLink to={href} end={path === '/site'} className={({ isActive }) => cn(cls, isActive ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg')}>
      {item.label}
    </NavLink>
  )
}

export function Logo({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative grid size-8 place-items-center rounded-[calc(var(--sf-r)*0.8)] bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.2)_inset]">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M10 6.5h4" />
          <path d="m9.5 14 2 2 3.5-4" />
        </svg>
      </span>
      <span className="sf-h text-[19px] font-semibold tracking-[-0.025em] text-fg">{text}</span>
    </span>
  )
}

function Footer() {
  const { config, hrefOf, to } = useStore()
  const cats = [...config.categories].sort((a, b) => a.sort - b.sort)
  const year = new Date().getFullYear()
  return (
    <footer className="mt-8 border-t border-line bg-bg-subtle">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo text={config.theme.logoText} />
          <p className="mt-4 text-[14px] leading-relaxed text-fg-3">{config.seo.defaultDescription}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[12.5px] text-fg-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1">
              <ShieldCheck className="size-3.5 text-accent-ink" /> Validated before you pay
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1">Funds released if we can’t deliver</span>
          </div>
        </div>
        <FooterCol title="Services">
          {cats.map((c) => (
            <SfLink key={c.id} href={to(`/site/c/${c.slug}`)} className="text-fg-2 hover:text-fg">
              {c.name}
            </SfLink>
          ))}
        </FooterCol>
        <FooterCol title="Company">
          {config.footerNav.map((n) => (
            <SfLink key={n.id} href={hrefOf(n.target)} className="text-fg-2 hover:text-fg">
              {n.label}
            </SfLink>
          ))}
        </FooterCol>
        <FooterCol title="Your orders">
          <SfLink href={to('/site/track')} className="text-fg-2 hover:text-fg">
            Track an order
          </SfLink>
          <SfLink href={to('/site/account')} className="text-fg-2 hover:text-fg">
            {config.customer ? 'My account' : 'Sign in'}
          </SfLink>
          <SfLink href={to('/site/services')} className="text-fg-2 hover:text-fg">
            All services
          </SfLink>
        </FooterCol>
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-2 py-5 text-[12.5px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {config.theme.brandName} · {config.domain.primary}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Payments in this demo are simulated (Demo Card Gateway · Demo PayPal).</span>
            <a href="/" className="font-medium text-fg-3 opacity-80 hover:opacity-100">
              Powered by ORVEX
            </a>
          </span>
        </Container>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[13px] font-semibold text-fg">{title}</div>
      <div className="grid gap-2.5 text-[14px]">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
function LayoutSkeleton() {
  return (
    <>
      <div className="h-8 border-b border-line bg-bg-subtle" />
      <div className="border-b border-line">
        <Container className="flex h-16 items-center gap-4">
          <Skel className="h-8 w-36" />
          <Skel className="ml-auto h-9 w-24" />
        </Container>
      </div>
      <PageSkeleton />
    </>
  )
}

export function PageSkeleton() {
  return (
    <Container className="py-14">
      <Skel className="h-5 w-40" />
      <Skel className="mt-4 h-11 w-full max-w-2xl" />
      <Skel className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skel key={i} className="h-48" />
        ))}
      </div>
    </Container>
  )
}
