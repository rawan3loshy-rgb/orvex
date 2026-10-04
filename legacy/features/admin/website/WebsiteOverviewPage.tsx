import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleCheck,
  Clock,
  CodeXml,
  ExternalLink,
  FileText,
  Globe,
  LayoutTemplate,
  Lock,
  Navigation,
  Palette,
  RotateCcw,
  Rocket,
  Save,
  ShieldCheck,
  TriangleAlert,
  Variable,
} from 'lucide-react'
import { Badge, Button, Card, CardFooter, CardHeader, CopyButton, EmptyState, KpiCard, MonoValue, PageHeader, Skeleton, StatusBadge, Timeline, Tooltip } from '@/components/ui'
import { useAudit, useInstMutation } from '@/hooks/installation'
import { websiteService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { dateTime, plural, relative } from '@/lib/format'
import { toast } from '@/stores/toast'
import type { SiteConfig } from '@/types/installation'
import { SiteCanvas, resolvePageSections, useSiteRuntime } from '@/features/site/SiteRenderer'
import { DYNAMIC_BLOCKS, TEMPLATE_VARIABLES, fontStack, onColor, type SiteRenderContext } from '@/features/site/renderSite'
import { CodeEditor } from './CodeEditor'
import { DevicePreview, SECTION_TYPES, SectionTypeIcon, SecurityModel, modKey, pendingChanges, sectionUsage, useSaveShortcut } from './shared'
import { matchPreset } from './themePresets'

export default function WebsiteOverviewPage() {
  const { site, ctx, isLoading, isError, refetch } = useSiteRuntime()
  const navigate = useNavigate()
  const publish = useInstMutation(() => websiteService.publish())

  const doPublish = () =>
    publish.mutate(undefined, {
      onSuccess: (s) => toast.success('Website published', `All changes are live on ${s.domain}.`),
    })

  const pending = site ? pendingChanges(site) : { sections: [], pages: [], total: 0 }
  const unusedSections = useMemo(() => {
    if (!site) return 0
    const usage = sectionUsage(site)
    return site.sections.filter((s) => !usage.has(s.id)).length
  }, [site])

  if (isError) {
    return (
      <div>
        <PageHeader eyebrow="Website" title="Website" />
        <Card>
          <EmptyState icon={<TriangleAlert />} title="Couldn’t load the website" description="The website configuration failed to load." action={<Button onClick={() => refetch()}>Try again</Button>} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Globe />}
        eyebrow={
          <>
            <span>Website</span>
            {site && <StatusBadge status="published" label="Live" />}
          </>
        }
        title={site?.theme.siteName ?? 'Website'}
        description={
          site ? (
            <>
              Your public storefront — IMEI checks, unlock prices and the Reseller API — served by ORVEX Core at <span className="font-mono text-[12.5px] text-fg">{site.domain}</span>.
            </>
          ) : (
            'Loading…'
          )
        }
        actions={
          <>
            <Button variant="secondary" leading={<ExternalLink />} href="/site">
              Open live site
            </Button>
            <Button variant="accent" leading={<Rocket />} onClick={doPublish} loading={publish.isPending} disabled={!site}>
              Publish changes
              {pending.total > 0 && <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[11px] tabular">{pending.total}</span>}
            </Button>
          </>
        }
      />

      {/* Preview + status */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="group relative h-[300px] bg-dots sm:h-[420px]">
            {site ? (
              <>
                <DevicePreview device="desktop" path="/" scroll={false} interactive={false} padding={20}>
                  <HomeCanvas site={site} ctx={ctx} />
                </DevicePreview>
                <a href="/site" target="_blank" rel="noreferrer" className="absolute inset-0 grid place-items-center bg-transparent transition-colors duration-300 group-hover:bg-overlay/30" aria-label="Open live site">
                  <span className="flex translate-y-1 items-center gap-1.5 rounded-full bg-fg px-4 py-2 text-[13px] font-medium text-bg opacity-0 shadow-pop transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    Open live site <ArrowUpRight className="size-4" />
                  </span>
                </a>
              </>
            ) : (
              <div className="p-5">
                <Skeleton className="h-[260px] w-full rounded-xl sm:h-[380px]" />
              </div>
            )}
          </div>
          <CardFooter>
            <span className="flex items-center gap-2">
              <FileText className="size-3.5" />
              Home page{site && ` · ${plural(site.pages.find((p) => p.isHome)?.sectionIds.length ?? 0, 'section')}`}
            </span>
            <Link to="/admin/website/pages?page=pg_home" className="flex items-center gap-1 font-medium text-fg-2 transition-colors hover:text-fg">
              Edit page <ArrowRight className="size-3.5" />
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={<Globe />} title="Status" description="Production website" actions={site && <Badge tone="success" dot pulse>Online</Badge>} />
          <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
            {site ? (
              <>
                <dl className="space-y-2.5 text-[12.5px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-fg-3">Domain</dt>
                    <dd>
                      <MonoValue value={site.domain} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-fg-3">HTTPS</dt>
                    <dd className="flex items-center gap-1.5 text-fg">
                      <Lock className="size-3.5 text-success" />
                      Certificate valid
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-fg-3">Last published</dt>
                    <dd>
                      <Tooltip content={dateTime(site.publishedAt)}>
                        <span className="text-fg">{relative(site.publishedAt)}</span>
                      </Tooltip>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-fg-3">Pages live</dt>
                    <dd className="text-fg tabular">
                      {site.pages.filter((p) => p.status === 'published').length} of {site.pages.length}
                    </dd>
                  </div>
                </dl>

                <div className={cn('rounded-xl border p-3', pending.total ? 'border-warning/25 bg-warning/[0.05]' : 'border-success/20 bg-success/[0.05]')}>
                  {pending.total ? (
                    <>
                      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
                        <Clock className="size-3.5 text-warning" />
                        {plural(pending.total, 'change')} since last publish
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {[...pending.sections.map((s) => ({ id: s.id, label: s.name, kind: 'Section', at: s.updatedAt, to: `/admin/website/sections?id=${s.id}` })), ...pending.pages.map((p) => ({ id: p.id, label: p.title, kind: 'Page', at: p.updatedAt, to: `/admin/website/pages?page=${p.id}` }))]
                          .sort((a, b) => b.at.localeCompare(a.at))
                          .slice(0, 4)
                          .map((c) => (
                            <li key={c.id}>
                              <Link to={c.to} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[12px] transition-colors hover:bg-surface-2">
                                <span className="truncate text-fg-2">
                                  <span className="text-fg-3">{c.kind} · </span>
                                  {c.label}
                                </span>
                                <span className="shrink-0 text-fg-3">{relative(c.at)}</span>
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
                      <CircleCheck className="size-3.5 text-success" />
                      Everything is published
                    </p>
                  )}
                </div>

                <Button variant={pending.total ? 'accent' : 'secondary'} className="mt-auto w-full" leading={<Rocket />} onClick={doPublish} loading={publish.isPending}>
                  {pending.total ? 'Publish changes' : 'Republish site'}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard loading={isLoading} icon={<FileText />} label="Pages" value={site?.pages.length ?? 0} footer={site && `${site.pages.filter((p) => p.status === 'published').length} published · ${site.pages.filter((p) => p.status === 'draft').length} draft`} onClick={() => navigate('/admin/website/pages')} />
        <KpiCard
          loading={isLoading}
          icon={<LayoutTemplate />}
          label="Sections"
          value={site?.sections.length ?? 0}
          footer={site && `${site.sections.filter((s) => s.enabled).length} enabled · ${unusedSections} unused`}
          onClick={() => navigate('/admin/website/sections')}
        />
        <KpiCard loading={isLoading} icon={<Navigation />} label="Navigation links" value={site ? site.nav.length + site.footerNav.length : 0} footer={site && `${site.nav.length} header · ${site.footerNav.length} footer`} onClick={() => navigate('/admin/website/navigation')} />
        <KpiCard
          loading={isLoading}
          icon={<Boxes />}
          label="Services on site"
          value={ctx.services.length}
          footer={ctx.services.length ? `${new Set(ctx.services.map((s) => s.category)).size} categories · live prices` : 'Live in the service catalog block'}
          onClick={() => navigate('/admin/services')}
        />
      </div>

      {/* Manage */}
      {site && <ManageCards site={site} />}

      {/* Head code + dynamic content */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {site ? <HeadCodeCard site={site} /> : <Skeleton className="h-[360px] w-full rounded-xl" />}
        <DynamicContentCard ctx={ctx} loading={!site} />
      </div>

      {/* Security + activity */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={<ShieldCheck />} title="Safe by design" description="Customer-authored HTML, CSS and JavaScript render through one hardened pipeline — in previews and on the live site." />
          <div className="px-5 pb-5">
            <SecurityModel />
          </div>
        </Card>
        <RecentActivity />
      </div>
    </div>
  )
}

/* ============================================================================
 * Pieces
 * ========================================================================= */
function HomeCanvas({ site, ctx }: { site: SiteConfig; ctx: SiteRenderContext }) {
  const home = site.pages.find((p) => p.isHome) ?? site.pages[0]
  const sections = useMemo(() => (home ? resolvePageSections(site, home) : []), [site, home])
  return <SiteCanvas mode="static" theme={site.theme} nav={site.nav} sections={sections} ctx={ctx} activePath="/" />
}

function ManageCards({ site }: { site: SiteConfig }) {
  const preset = matchPreset(site.theme)
  const types = [...new Set(site.sections.map((s) => s.type))].slice(0, 7)
  const cards = [
    {
      to: '/admin/website/pages',
      icon: <FileText />,
      title: 'Pages',
      body: 'Compose pages from sections, set SEO and publish.',
      meta: `${plural(site.pages.length, 'page')}`,
      visual: (
        <div className="flex flex-wrap gap-1.5">
          {site.pages.slice(0, 5).map((p) => (
            <span key={p.id} className={cn('rounded-md border px-1.5 py-0.5 font-mono text-[11px]', p.status === 'draft' ? 'border-dashed border-line-strong text-fg-3' : 'border-line bg-surface-2 text-fg-2')}>
              {p.slug}
            </span>
          ))}
        </div>
      ),
    },
    {
      to: '/admin/website/sections',
      icon: <LayoutTemplate />,
      title: 'Sections',
      body: 'Edit reusable HTML & CSS blocks with a live preview.',
      meta: `${plural(site.sections.length, 'section')}`,
      visual: (
        <div className="flex -space-x-1.5">
          {types.map((t) => (
            <Tooltip key={t} content={SECTION_TYPES[t].label}>
              <SectionTypeIcon type={t} size="sm" className="bg-surface ring-2 ring-surface" />
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      to: '/admin/website/navigation',
      icon: <Navigation />,
      title: 'Navigation',
      body: 'Header menu, call-to-action button and footer links.',
      meta: `${plural(site.nav.length + site.footerNav.length, 'link')}`,
      visual: (
        <div className="flex items-center gap-2 overflow-hidden rounded-md border border-line bg-surface-2 px-2 py-1.5 mask-fade-x">
          {site.nav.map((n) => (
            <span
              key={n.id}
              className={cn('shrink-0 text-[11px] whitespace-nowrap', n.highlight ? 'rounded px-1.5 py-0.5 font-medium' : 'text-fg-2')}
              // The CTA renders in the site's own primary colour, as visitors see it.
              style={n.highlight ? { background: site.theme.primary, color: onColor(site.theme.primary) } : undefined}
            >
              {n.label}
            </span>
          ))}
        </div>
      ),
    },
    {
      to: '/admin/website/theme',
      icon: <Palette />,
      title: 'Theme',
      body: 'Colors, fonts, radius and light or dark mode.',
      meta: preset ? `${preset.preset.name} · ${site.theme.mode}` : `Custom · ${site.theme.mode}`,
      visual: (
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1">
            {[site.theme.primary, site.theme.accent, site.theme.background, site.theme.surface, site.theme.text, site.theme.muted].map((c, i) => (
              <span key={i} className="size-5 rounded-full ring-2 ring-surface" style={{ background: c, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.08)' }} />
            ))}
          </div>
          <span className="truncate text-[12px] text-fg-2" style={{ fontFamily: fontStack(site.theme.fontHeading) }}>
            Aa {site.theme.fontHeading.replace(' Variable', '')}
          </span>
        </div>
      ),
    },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div key={c.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          <Link to={c.to} className="group block h-full">
            <Card interactive className="flex h-full flex-col p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 transition-colors group-hover:text-fg [&_svg]:size-4">{c.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold tracking-[-0.01em]">{c.title}</p>
                  <p className="text-[11.5px] text-fg-3">{c.meta}</p>
                </div>
                <ArrowRight className="size-4 -translate-x-1 text-fg-3 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <p className="mt-3 text-[12.5px] text-fg-3">{c.body}</p>
              <div className="mt-4 min-h-[28px]">{c.visual}</div>
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

function analyzeHead(code: string) {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><head>${code}</head><body></body></html>`, 'text/html')
  const els = Array.from(doc.head.children)
  const count = (tag: string) => els.filter((e) => e.tagName === tag).length
  return { meta: count('META'), link: count('LINK'), script: count('SCRIPT'), style: count('STYLE'), other: els.filter((e) => !['META', 'LINK', 'SCRIPT', 'STYLE', 'TITLE'].includes(e.tagName)).length }
}

function HeadCodeCard({ site }: { site: SiteConfig }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [savedValue, setSavedValue] = useState<string | null>(null)
  const value = draft ?? site.customHead
  const dirty = draft !== null && draft !== site.customHead && draft !== savedValue
  const stats = useMemo(() => analyzeHead(value), [value])
  const save = useInstMutation((customHead: string) => websiteService.updateSite({ customHead }))
  const doSave = () => {
    if (!dirty || save.isPending) return
    save.mutate(value, {
      onSuccess: (s) => {
        setSavedValue(s.customHead)
        setDraft(s.customHead)
        toast.success('Head code saved', 'Injected into every page of your website.')
      },
    })
  }
  useSaveShortcut(doSave, dirty)

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        icon={<CodeXml />}
        title={
          <span>
            Custom <code className="font-mono text-[13px]">{'<head>'}</code> code
          </span>
        }
        description="Search-console site tags, meta tags and preconnects added to every page."
        actions={
          dirty && (
            <Badge tone="warning" dot>
              Unsaved
            </Badge>
          )
        }
      />
      <div className="mx-5 h-[220px] overflow-hidden rounded-lg border border-line bg-bg-subtle">
        <CodeEditor lang="html" value={value} onChange={setDraft} placeholder={'<meta name="google-site-verification" content="…">'} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
        <Badge tone={stats.meta ? 'success' : 'neutral'}>{plural(stats.meta, 'meta tag')}</Badge>
        <Badge tone={stats.link ? 'success' : 'neutral'}>{plural(stats.link, 'link')}</Badge>
        {stats.script > 0 && (
          <Tooltip content="Scripts in head code are never executed inside the admin or the preview.">
            <Badge tone="warning">{plural(stats.script, 'script')} · not run in preview</Badge>
          </Tooltip>
        )}
        {stats.style + stats.other > 0 && <Badge tone="warning">{plural(stats.style + stats.other, 'other tag')} ignored</Badge>}
      </div>
      <CardFooter className="mt-4">
        <span className="min-w-0 text-[12px]">
          The preview applies <code className="font-mono text-fg-2">{'<meta>'}</code> and HTTPS <code className="font-mono text-fg-2">{'<link>'}</code> tags only.
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" leading={<RotateCcw />} disabled={!dirty} onClick={() => setDraft(null)}>
            Revert
          </Button>
          <Tooltip content={`${modKey}+S`}>
            <Button variant="primary" size="sm" leading={<Save />} disabled={!dirty} loading={save.isPending} onClick={doSave}>
              Save
            </Button>
          </Tooltip>
        </div>
      </CardFooter>
    </Card>
  )
}

function DynamicContentCard({ ctx, loading }: { ctx: SiteRenderContext; loading: boolean }) {
  return (
    <Card className="flex flex-col">
      <CardHeader icon={<Variable />} title="Dynamic content" description="Sections can pull live data from this installation — no code changes needed." />
      <div className="space-y-4 px-5 pb-5">
        <div>
          <div className="mb-2 mono-label">Template variables</div>
          <div className="overflow-hidden rounded-lg border border-line">
            {TEMPLATE_VARIABLES.map((v, i) => (
              <div key={v.key} className={cn('group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-2/60', i > 0 && 'border-t border-line')}>
                <code className="min-w-0 shrink-0 font-mono text-[12px] text-fg">{v.token}</code>
                <span className="hidden truncate text-[12px] text-fg-3 sm:inline">{v.description}</span>
                <span className="ml-auto shrink-0 truncate text-right text-[12.5px] font-medium text-fg tabular">{loading ? <Skeleton className="h-3 w-12" /> : v.resolve(ctx) || '—'}</span>
                <CopyButton value={v.token} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 mono-label">Dynamic blocks</div>
          <div className="space-y-2">
            {DYNAMIC_BLOCKS.map((b) => (
              <div key={b.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-fg">{b.label}</span>
                  <CopyButton value={b.snippet} label="Copy snippet" />
                </div>
                <p className="mt-0.5 text-[12px] text-fg-3">{b.description}</p>
                <code className="mt-2 block truncate rounded-md bg-bg-subtle px-2 py-1.5 font-mono text-[11.5px] text-fg-2">{b.snippet}</code>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-fg-3">
            Options: <code className="font-mono text-fg-2">data-limit</code> (1–60) and <code className="font-mono text-fg-2">data-category</code> (e.g. <code className="font-mono text-fg-2">Unlocking</code> or <code className="font-mono text-fg-2">IMEI Services</code>) on the service catalog.
          </p>
        </div>
      </div>
    </Card>
  )
}

function RecentActivity() {
  const audit = useAudit({ entity: 'website', pageSize: 6 })
  const items = audit.data?.items ?? []
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<Clock />}
        title="Recent website activity"
        description="From the audit log"
        actions={
          <Button variant="ghost" size="xs" to="/admin/system/activity" trailing={<ArrowRight />}>
            All activity
          </Button>
        }
      />
      <div className="flex-1 px-5 pb-5">
        {audit.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <Timeline
            items={items.map((a) => ({
              id: a.id,
              title: a.summary,
              detail: `${a.entity.label} · ${a.actor.name}`,
              time: relative(a.at).replace(' ago', ''),
              tone: a.action === 'website.published' ? 'success' : 'neutral',
              icon: a.action === 'website.published' ? <Rocket /> : <LayoutTemplate />,
            }))}
          />
        ) : (
          <EmptyState compact icon={<Clock />} title="No website changes yet" description="Edits and publishes will show up here." />
        )}
      </div>
    </Card>
  )
}
