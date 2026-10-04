import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { ArrowUpRight, BookOpen, KeyRound, ScrollText, Webhook } from 'lucide-react'
import { useApiKeys, useApiLogStats, useServices, useWebhooks } from '@/hooks/installation'
import type { Service, ServiceCategory } from '@/types/installation'
import { Badge, CopyButton, DemoTag, Skeleton } from '@/components/ui'
import { categoryColor } from '@/components/brand'
import { cn } from '@/lib/cn'
import { ms, num, pct } from '@/lib/format'
import { API_BASE } from './shared'
import { CATEGORY_SLUG, type Lang } from './api/samples'
import { DocsJumpBar, DocsSidebar, useScrollSpy } from './api/DocsNav'
import { C, DocSection, H2, LangContext, P } from './api/primitives'
import {
  AuthSection,
  BalanceSection,
  CreateOrderSection,
  ErrorsSection,
  GetOrderSection,
  GetResultSection,
  GetServiceSection,
  IdempotencySection,
  IntroSection,
  ListOrdersSection,
  ListServicesSection,
  RateLimitSection,
  WebhookEventsSection,
  WebhookRetriesSection,
  WebhookSignaturesSection,
} from './api/sections'
import { TryItConsole } from './api/TryItConsole'

const LANG_KEY = 'orvex.docs.lang'

function readLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'node' || v === 'python' || v === 'curl' ? v : 'curl'
  } catch {
    return 'curl'
  }
}

export default function ResellerApiPage() {
  const [lang, setLangState] = useState<Lang>(readLang)
  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* storage unavailable */
    }
  }
  const services = useServices({ status: 'active' })
  const active = useScrollSpy()
  const { hash } = useLocation()

  // Deep links such as /admin/developer/api#webhooks.
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' }), 120)
    return () => clearTimeout(t)
  }, [hash])

  const list = services.data ?? []
  // SVC-1007 (iPhone unlock) shows both an IMEI field and a carrier enum in its schema.
  const schemaExample = list.find((s) => s.id === 'SVC-1007') ?? list.find((s) => s.id === 'SVC-1001') ?? list[0]

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Hero services={list} />
      <DocsJumpBar active={active} />

      <div className="min-[1360px]:grid min-[1360px]:grid-cols-[212px_minmax(0,1fr)] min-[1360px]:gap-10">
        <aside className="hidden min-[1360px]:block">
          <div className="no-scrollbar sticky top-[76px] max-h-[calc(100dvh-96px)] overflow-y-auto pt-4 pb-10">
            <DocsSidebar active={active} />
          </div>
        </aside>

        <div className="min-w-0">
          <IntroSection services={list} loading={services.isLoading} />
          <AuthSection />
          <ErrorsSection />
          <RateLimitSection />
          <IdempotencySection />
          <ListServicesSection services={list} loading={services.isLoading} />
          <GetServiceSection service={schemaExample} loading={services.isLoading} />
          <CreateOrderSection />
          <GetOrderSection />
          <GetResultSection />
          <ListOrdersSection />
          <BalanceSection />
          <WebhookEventsSection />
          <WebhookSignaturesSection />
          <WebhookRetriesSection />
          <DocSection id="try-it">
            <H2 eyebrow="Sandbox">Try it console</H2>
            <P>
              Build a <C>POST /orders</C> request as any active reseller — an instant IMEI check or an async carrier unlock — and send it to this installation. The order goes through IMEI validation, pricing, supplier routing and billing exactly like a production call, then shows up in Orders, the reseller&apos;s balance and API logs.
            </P>
            <TryItConsole />
          </DocSection>
        </div>
      </div>
    </LangContext.Provider>
  )
}

const CATEGORIES: ServiceCategory[] = ['IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services']

function Hero({ services }: { services: Service[] }) {
  const stats = useApiLogStats()
  const keys = useApiKeys()
  const webhooks = useWebhooks()
  const s = stats.data
  const activeKeys = keys.data?.filter((k) => k.status === 'active').length
  const failing = webhooks.data?.filter((w) => w.status === 'failing').length ?? 0

  return (
    <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-70 [mask-image:radial-gradient(ellipse_at_top_right,black_10%,transparent_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent/60 [mask-image:linear-gradient(90deg,transparent,black_30%,black_70%,transparent)]" />

      <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
            <BookOpen className="size-3.5" />
            Developer
            <span className="text-fg-3/50">/</span>
            Reference
            <Badge tone="accent" className="ml-1">
              v1 · stable
            </Badge>
            <DemoTag />
          </div>
          <h1 className="font-display text-[30px] leading-tight font-semibold tracking-[-0.03em] text-fg sm:text-[34px]">Reseller API</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-fg-2">
            Everything GSM partners need to list services, place IMEI checks, unlocks and code orders, receive results and reconcile balances — served by this installation and documented with its live catalog.
          </p>
          <div className="mt-5 flex max-w-full flex-wrap items-center gap-2">
            <div className="flex h-10 max-w-full min-w-0 items-center gap-3 rounded-xl border border-line bg-bg-subtle pr-1.5 pl-3.5">
              <span className="mono-label shrink-0">Base URL</span>
              <code className="min-w-0 truncate font-mono text-[13px] text-fg">{API_BASE}</code>
              <CopyButton value={API_BASE} label="Copy base URL" className="size-7 shrink-0" />
            </div>
            <span className="hidden text-[12px] text-fg-3 sm:inline">REST · JSON · Bearer auth · HMAC-signed webhooks</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((c) => {
              const n = services.filter((s) => s.category === c).length
              return (
                <a
                  key={c}
                  href="#list-services"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('list-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-surface/80 px-2 font-mono text-[11px] text-fg-2 transition-colors hover:border-line-strong hover:text-fg"
                >
                  <span className="size-1.5 rounded-[2px]" style={{ background: categoryColor(c) }} />
                  {CATEGORY_SLUG[c]}
                  <span className="text-fg-3 tabular">{services.length ? n : '·'}</span>
                </a>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
          <HeroStat label="Requests · 24h" value={s ? num(s.requests24h) : null} />
          <HeroStat label="Error rate" value={s ? pct(s.errorRate, 2) : null} tone={s && s.errorRate > 5 ? 'text-warning' : undefined} />
          <HeroStat label="p95 latency" value={s ? ms(s.p95) : null} />
        </div>
      </div>

      <div className="relative grid border-t border-line sm:grid-cols-3">
        <QuickLink to="/admin/developer/keys" icon={<KeyRound />} title="API keys" sub={activeKeys != null ? `${activeKeys} active keys` : '…'} />
        <QuickLink to="/admin/developer/webhooks" icon={<Webhook />} title="Webhooks" sub={webhooks.data ? `${webhooks.data.length} endpoints${failing ? ` · ${failing} failing` : ''}` : '…'} warn={failing > 0} />
        <QuickLink to="/admin/developer/logs" icon={<ScrollText />} title="API logs" sub={s ? `${num(s.endpoints.length)} endpoints in use · 24h` : '…'} last />
      </div>
    </motion.header>
  )
}

function HeroStat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 bg-surface/90 px-3 py-3 backdrop-blur sm:min-w-[118px] sm:px-4">
      <div className="mono-label sm:whitespace-nowrap">{label}</div>
      {value == null ? <Skeleton className="mt-2 h-5 w-14" /> : <div className={cn('mt-1.5 font-display text-[20px] leading-none font-semibold tracking-[-0.02em] tabular', tone ?? 'text-fg')}>{value}</div>}
    </div>
  )
}

function QuickLink({ to, icon, title, sub, warn, last }: { to: string; icon: ReactNode; title: string; sub: string; warn?: boolean; last?: boolean }) {
  return (
    <Link to={to} className={cn('group flex items-center gap-3 px-6 py-4 transition-colors hover:bg-surface-2/60 sm:px-8', !last && 'border-b border-line sm:border-r sm:border-b-0')}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 transition-colors group-hover:text-accent-ink [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        <span className={cn('block truncate text-[12px]', warn ? 'text-danger' : 'text-fg-3')}>{sub}</span>
      </span>
      <ArrowUpRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
    </Link>
  )
}
