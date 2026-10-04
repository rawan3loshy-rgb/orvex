import { useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router'
import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react'
import { CircleAlert, ExternalLink, FileText, GripVertical, Hash, Info, Link2, MousePointerClick, Navigation, PanelBottom, Plus, Trash, TriangleAlert } from 'lucide-react'
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, Input, PageHeader, Segmented, Select, Skeleton, Tooltip } from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { websiteService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toast'
import type { SiteConfig, SiteNavItem } from '@/types/installation'
import { SiteCanvas, findPageBySlug, resolvePageSections, useSiteRuntime } from '@/features/site/SiteRenderer'
import { splitHref, type SiteRenderContext } from '@/features/site/renderSite'
import { DevicePreview, DeviceToggle, UnsavedBar, WebsiteCrumb, newId, useBeforeUnload, useSaveShortcut, type DeviceId } from './shared'

type Kind = SiteNavItem['kind']
type ListId = 'nav' | 'footerNav'

const KIND_DEFAULT: Record<Kind, string> = { page: '/', anchor: '#', external: 'https://' }

interface Issue {
  level: 'error' | 'warning'
  message: string
}

function validate(item: SiteNavItem, site: SiteConfig, anchors: Set<string>): Issue | null {
  if (!item.label.trim()) return { level: 'error', message: 'Label is required' }
  const href = item.href.trim()
  if (item.kind === 'external') {
    if (!/^(https?:\/\/[^\s]+\.[^\s]+|mailto:[^\s]+|tel:[^\s]+)$/i.test(href)) return { level: 'error', message: 'Enter a full URL (https://…), mailto: or tel:' }
    return null
  }
  if (item.kind === 'anchor') {
    const { path, hash } = splitHref(href)
    if (!hash) return { level: 'error', message: 'Anchors look like #faq or /#faq' }
    if (path && !path.startsWith('/')) return { level: 'error', message: 'Anchor paths must start with /' }
    if (path && !findPageBySlug(site, path)) return { level: 'warning', message: `No page at ${path}` }
    if (!anchors.has(hash)) return { level: 'warning', message: `No section has id="${hash}"` }
    return null
  }
  if (!href.startsWith('/')) return { level: 'error', message: 'Page links start with /' }
  const page = findPageBySlug(site, splitHref(href).path || '/')
  if (!page) return { level: 'warning', message: `No page at ${href} — visitors will see a 404` }
  if (page.status === 'draft') return { level: 'warning', message: `${page.title} is still a draft` }
  return null
}

export default function NavigationPage() {
  const { site, ctx, isLoading, isError, refetch } = useSiteRuntime()
  const [nav, setNav] = useState<SiteNavItem[] | null>(null)
  const [footerNav, setFooterNav] = useState<SiteNavItem[] | null>(null)
  const [device, setDevice] = useState<DeviceId>('desktop')

  useEffect(() => {
    if (site && nav === null) setNav(site.nav.map((n) => ({ ...n })))
    if (site && footerNav === null) setFooterNav(site.footerNav.map((n) => ({ ...n })))
  }, [site, nav, footerNav])

  const anchors = useMemo(() => {
    const set = new Set<string>()
    for (const s of site?.sections ?? []) for (const m of s.html.matchAll(/\sid="([^"]+)"/g)) set.add(m[1]!)
    return set
  }, [site])

  const [savedSig, setSavedSig] = useState<string | null>(null)
  const draftSig = JSON.stringify([nav, footerNav])
  const dirty = !!site && !!nav && !!footerNav && draftSig !== JSON.stringify([site.nav, site.footerNav]) && draftSig !== savedSig
  const issues = useMemo(() => {
    const map = new Map<string, Issue>()
    if (!site) return map
    for (const item of [...(nav ?? []), ...(footerNav ?? [])]) {
      const issue = validate(item, site, anchors)
      if (issue) map.set(item.id, issue)
    }
    return map
  }, [nav, footerNav, site, anchors])
  const errorCount = [...issues.values()].filter((i) => i.level === 'error').length

  const save = useInstMutation((b: { nav: SiteNavItem[]; footerNav: SiteNavItem[] }) => websiteService.updateSite(b))
  const doSave = () => {
    if (!dirty || !nav || !footerNav || save.isPending) return
    if (errorCount) {
      toast.error('Fix the highlighted links first', `${errorCount} link${errorCount === 1 ? ' has' : 's have'} an error.`)
      return
    }
    const clean = (list: SiteNavItem[]) => list.map((n) => ({ ...n, label: n.label.trim(), href: n.href.trim() }))
    save.mutate(
      { nav: clean(nav), footerNav: clean(footerNav) },
      {
        onSuccess: (s) => {
          const nextNav = s.nav.map((n) => ({ ...n }))
          const nextFooter = s.footerNav.map((n) => ({ ...n }))
          setNav(nextNav)
          setFooterNav(nextFooter)
          setSavedSig(JSON.stringify([nextNav, nextFooter]))
          toast.success('Navigation saved', 'Header and footer links are live on every page.')
        },
      },
    )
  }
  const discard = () => {
    if (!site) return
    setNav(site.nav.map((n) => ({ ...n })))
    setFooterNav(site.footerNav.map((n) => ({ ...n })))
  }

  useSaveShortcut(doSave)
  useBeforeUnload(dirty)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  const setList = (list: ListId, items: SiteNavItem[]) => (list === 'nav' ? setNav(items) : setFooterNav(items))
  const updateItem = (list: ListId, id: string, p: Partial<SiteNavItem>) => {
    const items = (list === 'nav' ? nav : footerNav) ?? []
    setList(
      list,
      items.map((n) => (n.id === id ? { ...n, ...p } : n)),
    )
  }
  const addItem = (list: ListId) => {
    const items = (list === 'nav' ? nav : footerNav) ?? []
    const item: SiteNavItem = { id: newId(list === 'nav' ? 'nav' : 'fnav'), label: '', href: '/', kind: 'page' }
    // Keep CTA buttons at the end of the header.
    const firstCta = list === 'nav' ? items.findIndex((n) => n.highlight) : -1
    const next = [...items]
    next.splice(firstCta >= 0 ? firstCta : next.length, 0, item)
    setList(list, next)
  }
  const removeItem = (list: ListId, id: string) => setList(list, ((list === 'nav' ? nav : footerNav) ?? []).filter((n) => n.id !== id))

  const home = site?.pages.find((p) => p.isHome)
  const heroSections = useMemo(() => (site && home ? resolvePageSections(site, home).filter((s) => s.type === 'hero').slice(0, 1) : []), [site, home])
  const footerSections = useMemo(() => (site ? site.sections.filter((s) => s.type === 'footer' && s.enabled).slice(0, 1) : []), [site])

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow={<WebsiteCrumb current="Navigation" />}
        title="Navigation"
        description="The links in your site header and footer. Changes preview instantly and apply to every page once saved."
        actions={
          <>
            <Button variant="ghost" onClick={discard} disabled={!dirty}>
              Discard
            </Button>
            <Button variant="accent" onClick={doSave} disabled={!dirty} loading={save.isPending}>
              Save navigation
            </Button>
          </>
        }
      />

      {isError ? (
        <Card>
          <EmptyState icon={<TriangleAlert />} title="Couldn’t load navigation" action={<Button onClick={() => refetch()}>Try again</Button>} />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="space-y-5">
            <Card>
              <CardHeader
                icon={<Navigation />}
                title="Header navigation"
                description="Shown in the site header. Mark one item as a button for your primary call to action — e.g. “Check an IMEI”."
                actions={
                  <Button variant="secondary" size="sm" leading={<Plus />} onClick={() => addItem('nav')} disabled={!nav}>
                    Add link
                  </Button>
                }
              />
              <div className="px-5 pb-5">
                {isLoading || !nav || !site ? (
                  <ListSkeleton />
                ) : (
                  <NavList list="nav" items={nav} site={site} anchors={anchors} issues={issues} onReorder={(items) => setNav(items)} onChange={(id, p) => updateItem('nav', id, p)} onRemove={(id) => removeItem('nav', id)} onAdd={() => addItem('nav')} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                icon={<PanelBottom />}
                title="Footer links"
                description={
                  <>
                    Rendered wherever a section includes <code className="font-mono text-[11.5px] text-fg-2">{'<nav data-block="footer-links">'}</code>.
                  </>
                }
                actions={
                  <Button variant="secondary" size="sm" leading={<Plus />} onClick={() => addItem('footerNav')} disabled={!footerNav}>
                    Add link
                  </Button>
                }
              />
              <div className="px-5 pb-5">
                {isLoading || !footerNav || !site ? (
                  <ListSkeleton rows={3} />
                ) : (
                  <NavList list="footerNav" items={footerNav} site={site} anchors={anchors} issues={issues} onReorder={(items) => setFooterNav(items)} onChange={(id, p) => updateItem('footerNav', id, p)} onRemove={(id) => removeItem('footerNav', id)} onAdd={() => addItem('footerNav')} />
                )}
              </div>
            </Card>

            <div className="flex gap-3 rounded-xl border border-line bg-surface-2/50 p-4 text-[12.5px] text-fg-3">
              <Info className="mt-0.5 size-4 shrink-0 text-fg-3" />
              <div className="space-y-1">
                <p>
                  <span className="font-medium text-fg-2">Page</span> links open a page of your site (e.g. <code className="font-mono text-fg-2">/reseller-api</code>). <span className="font-medium text-fg-2">Anchor</span> links jump to a section with a matching id (
                  <code className="font-mono text-fg-2">#faq</code>, or <code className="font-mono text-fg-2">/services#unlocking</code> on another page). <span className="font-medium text-fg-2">External</span> links — API docs, status page — open in a new tab.
                </p>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="xl:sticky xl:top-[76px] xl:self-start">
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold tracking-[-0.01em]">Live preview</h3>
                  <p className="text-[12px] text-fg-3">{device === 'mobile' ? 'Tap the menu button to open the mobile menu.' : 'Hover the links — this is the real header.'}</p>
                </div>
                <div className="ml-auto">
                  <DeviceToggle value={device} onChange={setDevice} devices={['desktop', 'tablet', 'mobile']} />
                </div>
              </div>
              {site && nav && footerNav ? (
                <PreviewStack site={site} ctx={ctx} nav={nav} footerNav={footerNav} device={device} hero={heroSections} footer={footerSections} />
              ) : (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-[260px] w-full rounded-xl" />
                  <Skeleton className="h-[200px] w-full rounded-xl" />
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <UnsavedBar show={dirty} onDiscard={discard} onSave={doSave} saving={save.isPending} disabled={errorCount > 0} hint={errorCount ? `${errorCount} link${errorCount === 1 ? '' : 's'} need attention` : 'Header and footer links'} />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave without saving?"
        description="Your navigation changes haven’t been saved and will be lost."
        confirmLabel="Discard & leave"
        tone="danger"
      />
    </div>
  )
}

/* ============================================================================
 * Preview
 * ========================================================================= */
function PreviewStack({ site, ctx, nav, footerNav, device, hero, footer }: { site: SiteConfig; ctx: SiteRenderContext; nav: SiteNavItem[]; footerNav: SiteNavItem[]; device: DeviceId; hero: SiteConfig['sections']; footer: SiteConfig['sections'] }) {
  return (
    <div className="space-y-3 bg-bg-subtle p-3">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 px-1 mono-label">
          <Navigation className="size-3" /> Header
        </div>
        <div className={cn('relative bg-dots', device === 'mobile' ? 'h-[440px]' : 'h-[300px]')}>
          <DevicePreview device={device} path="/">
            <SiteCanvas theme={site.theme} nav={nav} footerNav={footerNav} sections={hero} ctx={ctx} activePath="/" fallbackFooter={false} emptyMessage={null} style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }} />
          </DevicePreview>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 px-1 mono-label">
          <PanelBottom className="size-3" /> Footer
        </div>
        <div className={cn('relative bg-dots', device === 'desktop' ? 'h-[200px]' : 'h-[300px]')}>
          <DevicePreview device={device} path="/" chromeBar={false}>
            <SiteCanvas theme={site.theme} nav={nav} footerNav={footerNav} sections={footer} ctx={ctx} chrome={false} fallbackFooter emptyMessage={null} style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }} />
          </DevicePreview>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * Lists
 * ========================================================================= */
function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[86px] w-full rounded-lg" />
      ))}
    </div>
  )
}

function NavList({
  list,
  items,
  site,
  anchors,
  issues,
  onReorder,
  onChange,
  onRemove,
  onAdd,
}: {
  list: ListId
  items: SiteNavItem[]
  site: SiteConfig
  anchors: Set<string>
  issues: Map<string, Issue>
  onReorder: (items: SiteNavItem[]) => void
  onChange: (id: string, p: Partial<SiteNavItem>) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong">
        <EmptyState compact icon={<Link2 />} title="No links yet" description={list === 'nav' ? 'Your header will only show the logo.' : 'The footer links block will be empty.'} action={<Button size="sm" variant="secondary" leading={<Plus />} onClick={onAdd}>Add link</Button>} />
      </div>
    )
  }
  const byId = new Map(items.map((i) => [i.id, i]))
  return (
    <Reorder.Group axis="y" values={items.map((i) => i.id)} onReorder={(ids: string[]) => onReorder(ids.map((id) => byId.get(id)!).filter(Boolean))} className="space-y-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <NavRow key={item.id} item={item} list={list} site={site} anchors={anchors} issue={issues.get(item.id) ?? null} onChange={(p) => onChange(item.id, p)} onRemove={() => onRemove(item.id)} />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  )
}

function NavRow({ item, list, site, anchors, issue, onChange, onRemove }: { item: SiteNavItem; list: ListId; site: SiteConfig; anchors: Set<string>; issue: Issue | null; onChange: (p: Partial<SiteNavItem>) => void; onRemove: () => void }) {
  const controls = useDragControls()
  const pageOptions = useMemo(() => {
    const opts = site.pages.map((p) => ({ value: p.slug, label: `${p.title}  ·  ${p.slug}${p.status === 'draft' ? '  (draft)' : ''}` }))
    if (!opts.some((o) => o.value === item.href)) opts.unshift({ value: item.href, label: `${item.href}  (not a page)` })
    return opts
  }, [site.pages, item.href])
  const anchorListId = `anchors-${item.id}`

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={controls}
      className="relative list-none"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      whileDrag={{ scale: 1.015, zIndex: 20 }}
    >
      <div className={cn('group rounded-xl border bg-surface p-2.5 shadow-card transition-colors', issue?.level === 'error' ? 'border-danger/40' : 'border-line hover:border-line-strong')}>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <button type="button" onPointerDown={(e) => controls.start(e)} className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg active:cursor-grabbing" aria-label="Drag to reorder">
            <GripVertical className="size-4" />
          </button>
          <Input inputSize="sm" value={item.label} placeholder="Label" onChange={(e) => onChange({ label: e.target.value })} invalid={!item.label.trim()} className="min-w-[120px] flex-1 sm:max-w-[190px]" aria-label="Link label" />
          <div className="min-w-[180px] flex-[2]">
            {item.kind === 'page' ? (
              <Select inputSize="sm" value={item.href} onChange={(e) => onChange({ href: e.target.value })} options={pageOptions} aria-label="Target page" />
            ) : item.kind === 'anchor' ? (
              <>
                <Input inputSize="sm" mono value={item.href} placeholder="#faq or /#how" list={anchorListId} onChange={(e) => onChange({ href: e.target.value })} leading={<Hash />} aria-label="Anchor" />
                <datalist id={anchorListId}>
                  {[...anchors].map((a) => (
                    <option key={a} value={`/#${a}`} />
                  ))}
                </datalist>
              </>
            ) : (
              <Input inputSize="sm" mono value={item.href} placeholder="https://" onChange={(e) => onChange({ href: e.target.value })} leading={<ExternalLink />} aria-label="URL" />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {list === 'nav' && (
              <Tooltip content={item.highlight ? 'Shown as a button — click to make it a plain link' : 'Show as a button (call to action)'}>
                <button
                  type="button"
                  onClick={() => onChange({ highlight: !item.highlight })}
                  aria-pressed={!!item.highlight}
                  className={cn('flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[12px] font-medium transition-colors', item.highlight ? 'border-accent/40 bg-accent/10 text-accent-ink' : 'border-line text-fg-3 hover:border-line-strong hover:text-fg-2')}
                >
                  <MousePointerClick className="size-3.5" />
                  <span className="hidden md:inline">Button</span>
                </button>
              </Tooltip>
            )}
            <Tooltip content="Remove link">
              <Button variant="ghost" size="sm" icon onClick={onRemove} aria-label="Remove link" className="hover:text-danger">
                <Trash />
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
          <Segmented
            size="xs"
            value={item.kind}
            onChange={(kind) => onChange({ kind, href: kind === item.kind ? item.href : kind === 'page' ? (site.pages[0]?.slug ?? '/') : KIND_DEFAULT[kind] })}
            items={[
              { value: 'page', label: 'Page', icon: <FileText /> },
              { value: 'anchor', label: 'Anchor', icon: <Hash /> },
              { value: 'external', label: 'External', icon: <ExternalLink /> },
            ]}
          />
          <AnimatePresence mode="wait" initial={false}>
            {issue && (
              <motion.span key={issue.message} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={cn('flex items-center gap-1 text-[11.5px]', issue.level === 'error' ? 'text-danger' : 'text-warning')}>
                {issue.level === 'error' ? <CircleAlert className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
                {issue.message}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Reorder.Item>
  )
}
