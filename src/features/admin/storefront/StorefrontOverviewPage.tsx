import { Link } from 'react-router'
import { ArrowRight, Database, FileText, Globe, History, LayoutTemplate, Lock, Navigation, Palette, ShieldCheck, ShoppingCart, Tag } from 'lucide-react'
import { useCategories, usePaymentMethods, useStorefrontAdmin } from '@/hooks/installation'
import { PermissionHint } from '@/components/domain'
import { Badge, Button, Card, CardBody, CardHeader, DescriptionList, PageHeader } from '@/components/ui'
import { dateTime, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { EditorSkeleton, LoadFailed, StorefrontTabs } from './shared'
import { previewHref, SITE_URL } from './editorUtils'
import { PublishBar } from './PublishBar'

export default function StorefrontOverviewPage() {
  const q = useStorefrontAdmin()
  const cats = useCategories()
  const methods = usePaymentMethods()

  if (q.isLoading) return <EditorSkeleton />
  if (q.isError || !q.data) return <LoadFailed message={q.error?.message} onRetry={() => void q.refetch()} />
  const c = q.data
  const pub = c.publishing
  const publicPages = c.pages.filter((p) => p.visibility === 'public')
  const hiddenPages = c.pages.filter((p) => p.visibility === 'hidden')
  const catalogBlocks = c.pages.reduce((n, p) => n + p.blocks.filter((b) => ['catalog_grid', 'service_spotlight', 'quick_check'].includes(b.type)).length, 0)

  return (
    <div>
      <PageHeader
        icon={<Globe />}
        title="Storefront"
        description={`Your public website on ${c.domain.primary} — typed pages and catalog blocks, priced live from the catalog. Content is edited as a draft and published as a new version.`}
      />
      <StorefrontTabs />
      <PublishBar />

      <Card className="mb-4 overflow-hidden border-accent/30">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-ink">
              <Database className="size-5" />
            </span>
            <div>
              <div className="mono-label">Single source of truth</div>
              <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.01em]">Prices, fields and availability come from the catalog</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
                Change a price in <Link to="/admin/services" className="font-medium text-accent-ink hover:underline">Services</Link> or <Link to="/admin/pricing" className="font-medium text-accent-ink hover:underline">Pricing</Link> and the storefront updates immediately — pages only reference services by id or query. Fields come from the service revision; availability from routing (unavailable services show “Temporarily unavailable”).
              </p>
            </div>
          </div>
          <ol className="grid gap-2 text-[12.5px]">
            {[
              ['Catalog', 'service · revision fields · offers'],
              ['Pricing engine', 'Retail tier, or the signed-in customer’s tier'],
              ['Storefront block', `references only — ${catalogBlocks} catalog block${catalogBlocks === 1 ? '' : 's'}, 0 stored prices`],
            ].map(([a, b], i) => (
              <li key={a} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[10.5px] font-bold text-accent-fg">{i + 1}</span>
                <span className="font-semibold text-fg">{a}</span>
                <span className="truncate text-fg-3">{b}</span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="pt-4">
            <div className="mono-label">Live version</div>
            <div className="mt-1.5 font-display text-[22px] font-semibold tracking-[-0.02em]">
              v{pub.published.version} <span className="text-[14px] font-normal text-fg-3">· {relative(pub.published.publishedAt)}</span>
            </div>
            <div className="text-[12px] text-fg-3">
              {dateTime(pub.published.publishedAt)}
              {pub.published.publishedBy ? ` · ${pub.published.publishedBy}` : ''}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="pt-4">
            <div className="mono-label">Draft v{pub.draft.version}</div>
            <div className={cn('mt-1.5 font-display text-[22px] font-semibold tracking-[-0.02em]', pub.hasUnpublishedChanges && 'text-warning')}>
              {pub.changes.length} <span className="text-[14px] font-normal text-fg-3">unpublished change{pub.changes.length === 1 ? '' : 's'}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-fg-3">
              <span className="truncate">{pub.hasUnpublishedChanges ? pub.changes.map((x) => x.label).join(' · ') : 'Draft matches the live site'}</span>
              <PermissionHint permission="storefront.manage" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="pt-4">
            <div className="mono-label">Pages</div>
            <div className="mt-1.5 font-display text-[22px] font-semibold tracking-[-0.02em]">
              {publicPages.length} <span className="text-[14px] font-normal text-fg-3">public · {hiddenPages.length} hidden</span>
            </div>
            <div className="text-[12px] text-fg-3">{c.pages.reduce((n, p) => n + p.blocks.length, 0)} typed blocks</div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader icon={<FileText />} title="Pages" description="Typed blocks — no raw HTML sections" actions={<Button size="xs" variant="ghost" to="/admin/storefront/pages" trailing={<ArrowRight />}>Edit pages</Button>} />
          <div className="divide-y divide-line border-t border-line">
            {c.pages.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/storefront/pages?page=${p.id}`} className="font-medium text-fg hover:text-accent-ink">
                    {p.title}
                  </Link>
                  <div className="font-mono text-[11.5px] text-fg-3">/{p.slug}</div>
                </div>
                <Badge tone="neutral">{p.kind}</Badge>
                <PageBadge visibility={p.visibility} state={pub.pageStates[p.id]} />
                <span className="hidden w-20 text-right text-[12px] text-fg-3 sm:block">{relative(p.updatedAt)}</span>
                {p.visibility === 'public' && pub.pageStates[p.id] !== 'new' ? (
                  <a href={`${SITE_URL}/${p.kind === 'home' ? '' : p.slug}`} target="_blank" rel="noreferrer" className="text-[12px] text-fg-3 hover:text-fg">
                    Live
                  </a>
                ) : (
                  <span className="text-[12px] text-fg-3">—</span>
                )}
                {pub.previewPath && (
                  <a href={previewHref(pub.previewPath, `${SITE_URL}/${p.kind === 'home' ? '' : p.slug}`)} target="_blank" rel="noreferrer" className="text-[12px] text-fg-3 hover:text-fg">
                    Preview
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader icon={<History />} title="Publish history" description="Each publish creates a new immutable version" />
            <div className="divide-y divide-line border-t border-line text-[13px]">
              {[pub.published, ...pub.history].map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-10 font-mono font-medium">v{r.version}</span>
                  <Badge tone={r.status === 'published' ? 'success' : 'neutral'} dot>
                    {r.status === 'published' ? 'live' : 'superseded'}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-right text-[12px] text-fg-3">
                    {relative(r.publishedAt)}
                    {r.publishedBy ? ` · ${r.publishedBy}` : ''}
                  </span>
                </div>
              ))}
              {!pub.history.length && <div className="px-5 py-2.5 text-[12px] text-fg-3">Earlier versions appear here after the next publish.</div>}
            </div>
          </Card>
          <Card>
            <CardHeader icon={<Globe />} title="Domain" description="Served by your own installation" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: 'Primary', value: c.domain.primary, mono: true },
                  { label: 'TLS', value: <Badge tone={c.domain.tls === 'active' ? 'success' : 'warning'} dot icon={<Lock className="size-3" />}>{c.domain.tls === 'active' ? 'Certificate active' : 'Pending'}</Badge> },
                  { label: 'Aliases', value: c.domain.aliases.join(', ') || '—', mono: true },
                  { label: 'Verified', value: c.domain.verifiedAt ? dateTime(c.domain.verifiedAt) : 'Not verified' },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<ShoppingCart />} title="Checkout" actions={<Button size="xs" variant="ghost" to="/admin/storefront/settings">Configure</Button>} />
            <CardBody className="grid gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-fg-3">Guest checkout</span>
                <Badge tone={c.checkout.guestCheckout ? 'success' : 'neutral'}>{c.checkout.guestCheckout ? 'Enabled' : 'Off'}</Badge>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {c.checkout.methods.map((m) => {
                  const cfg = methods.data?.find((x) => x.id === m)
                  return (
                    <Badge key={m} tone="neutral">
                      {cfg ? `${cfg.name} · ${cfg.gateway}` : m}
                    </Badge>
                  )
                })}
              </div>
              <div className="text-[11.5px] text-fg-3">All gateways are simulated in this demo.</div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/admin/storefront/pages" icon={<LayoutTemplate />} title="Pages & blocks" body={`${c.pages.length} pages`} />
        <QuickLink
          to="/admin/storefront/theme"
          icon={<Palette />}
          title="Theme"
          body={
            <span className="flex items-center gap-1.5">
              {[c.theme.colors.primary, c.theme.colors.accent, c.theme.colors.background, c.theme.colors.text].map((col) => (
                <span key={col} className="size-3.5 rounded-full border border-line" style={{ background: col }} />
              ))}
              <span className="ml-1">{c.theme.fontHeading.replace(' Variable', '')}</span>
            </span>
          }
        />
        <QuickLink to="/admin/storefront/navigation" icon={<Navigation />} title="Navigation" body={`${c.nav.length} header · ${c.footerNav.length} footer links`} />
        <QuickLink to="/admin/storefront/settings" icon={<Tag />} title="SEO, locales & templates" body={`${c.locales.enabled.length} locales · ${c.templates.length} templates · ${cats.data?.length ?? '—'} categories`} />
      </div>

      <div className="mt-4 flex items-center gap-2 text-[12px] text-fg-3">
        <ShieldCheck className="size-3.5" /> Draft edits, publishing and live settings are permission-checked server-side (“storefront.manage”) and recorded in the audit log. Preview links use an admin-only token that changes with every publish.
      </div>
    </div>
  )
}

function PageBadge({ visibility, state }: { visibility: 'public' | 'hidden'; state: 'new' | 'changed' | 'unchanged' | undefined }) {
  if (visibility === 'hidden') return <Badge tone="neutral">hidden</Badge>
  if (state === 'new')
    return (
      <Badge tone="accent" dot>
        new in draft
      </Badge>
    )
  if (state === 'changed')
    return (
      <Badge tone="warning" dot>
        edited
      </Badge>
    )
  return (
    <Badge tone="success" dot>
      live
    </Badge>
  )
}

function QuickLink({ to, icon, title, body }: { to: string; icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <Link to={to} className="group rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{icon}</span>
        <ArrowRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-3 text-[13.5px] font-semibold">{title}</div>
      <div className="mt-0.5 text-[12px] text-fg-3">{body}</div>
    </Link>
  )
}
