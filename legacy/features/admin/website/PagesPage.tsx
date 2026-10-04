import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useBlocker, useSearchParams } from 'react-router'
import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  GripVertical,
  House,
  LayoutTemplate,
  Link2,
  Pencil,
  Plus,
  Rocket,
  SearchX,
  Sparkles,
  Square,
  Trash,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  PageHeader,
  Popover,
  SearchInput,
  Segmented,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  Tooltip,
} from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { websiteService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { plural, relative } from '@/lib/format'
import { toast } from '@/stores/toast'
import type { SiteConfig, SitePage, SiteSection } from '@/types/installation'
import { SiteCanvas, resolvePageSections, sitePath, useSiteRuntime } from '@/features/site/SiteRenderer'
import { normalizePath, type SiteRenderContext } from '@/features/site/renderSite'
import { DevicePreview, DeviceToggle, JsChip, SECTION_TYPES, SectionTypeIcon, WebsiteCrumb, modKey, sectionUsage, slugify, sortSections, useBeforeUnload, useSaveShortcut, type DeviceId } from './shared'

type Filter = 'all' | 'published' | 'draft'

interface PageDraft {
  title: string
  slug: string
  status: SitePage['status']
  seo: { title: string; description: string }
  sectionIds: string[]
}

const toPageDraft = (p: SitePage): PageDraft => ({ title: p.title, slug: p.slug, status: p.status, seo: { ...p.seo }, sectionIds: [...p.sectionIds] })
const SLUG_RE = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/

function slugError(slug: string, pages: SitePage[], selfId: string | null) {
  if (!slug.trim()) return 'A URL is required'
  if (!SLUG_RE.test(slug)) return 'Use a leading “/”, lowercase letters, numbers and dashes'
  if (pages.some((p) => p.id !== selfId && normalizePath(p.slug) === normalizePath(slug))) return 'Another page already uses this URL'
  return null
}

export default function PagesPage() {
  const { site, ctx, isLoading, isError, refetch } = useSiteRuntime()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SitePage | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)

  const pages = useMemo(() => site?.pages ?? [], [site])
  const openId = params.get('page')
  const openPage = pages.find((p) => p.id === openId) ?? null
  const [drawerPage, setDrawerPage] = useState<SitePage | null>(null)
  useEffect(() => {
    if (openPage) setDrawerPage(openPage)
  }, [openPage])

  const setOpen = (id: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (id) n.set('page', id)
      else n.delete('page')
      return n
    })

  const counts = { all: pages.length, published: pages.filter((p) => p.status === 'published').length, draft: pages.filter((p) => p.status === 'draft').length }
  const query = q.trim().toLowerCase()
  const filtered = pages.filter((p) => (filter === 'all' || p.status === filter) && (!query || p.title.toLowerCase().includes(query) || p.slug.includes(query)))

  const statusMut = useInstMutation((v: { id: string; status: SitePage['status'] }) => websiteService.updatePage(v.id, { status: v.status }), {
    success: (_d, v) => (v.status === 'published' ? 'Page published' : 'Page moved to drafts'),
  })
  const del = useInstMutation((id: string) => websiteService.deletePage(id))
  const create = useInstMutation((b: { title: string; slug: string; sectionIds: string[] }) => websiteService.createPage(b))

  const blocker = useBlocker(({ currentLocation, nextLocation }) => editorDirty && !!openPage && currentLocation.pathname !== nextLocation.pathname)

  const confirmDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    del.mutate(target.id, {
      onSuccess: () => {
        toast.success('Page deleted', `${target.title} (${target.slug}) was removed.`)
        setDeleteTarget(null)
        if (openId === target.id) setOpen(null)
      },
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow={<WebsiteCrumb current="Pages" />}
        title="Pages"
        description="Compose your storefront — home, service prices, Reseller API, promo pages — from reusable sections, set search metadata and decide what’s published."
        actions={
          <>
            <Button variant="secondary" leading={<ExternalLink />} href="/site">
              Preview site
            </Button>
            <Button variant="accent" leading={<Plus />} onClick={() => setCreateOpen(true)} disabled={!site}>
              New page
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'published', label: 'Published', count: counts.published },
            { value: 'draft', label: 'Drafts', count: counts.draft },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search pages…" className="sm:w-[260px]" />
      </div>

      <Card className="overflow-hidden">
        {isError ? (
          <EmptyState icon={<TriangleAlert />} title="Couldn’t load pages" action={<Button onClick={() => refetch()}>Try again</Button>} />
        ) : isLoading || !site ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-5 p-4">
                <Skeleton className="hidden h-[100px] w-[160px] rounded-lg sm:block" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-4 h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={query ? <SearchX /> : <FileText />}
            title={query ? 'No pages match your search' : filter === 'draft' ? 'No drafts' : 'No pages yet'}
            description={query ? 'Try another title or URL.' : 'Create a page and compose it from your section library.'}
            action={
              !query && (
                <Button variant="accent" leading={<Plus />} onClick={() => setCreateOpen(true)}>
                  New page
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {filtered.map((p) => (
                <motion.li key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                  <PageRow
                    page={p}
                    site={site}
                    ctx={ctx}
                    onOpen={() => setOpen(p.id)}
                    onStatus={(status) => statusMut.mutate({ id: p.id, status })}
                    onDelete={() => setDeleteTarget(p)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      {site && drawerPage && (
        <PageEditor
          key={drawerPage.id}
          open={!!openPage}
          page={openPage ?? drawerPage}
          site={site}
          ctx={ctx}
          onClose={() => setOpen(null)}
          onDelete={() => setDeleteTarget(openPage ?? drawerPage)}
          onDirtyChange={setEditorDirty}
        />
      )}

      {site && (
        <CreatePageModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          site={site}
          creating={create.isPending}
          onCreate={(b) =>
            create.mutate(b, {
              onSuccess: (p) => {
                setCreateOpen(false)
                toast.success('Page created', `${p.title} was created as a draft.`)
                setOpen(p.id)
              },
            })
          }
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={del.isPending}
        tone="danger"
        title={`Delete “${deleteTarget?.title ?? ''}”?`}
        description={
          <>
            Visitors to <span className="font-mono text-fg-2">{deleteTarget?.slug}</span> will see a 404 page. Its sections stay in the library.
          </>
        }
        confirmLabel="Delete page"
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave without saving?"
        description="Your page changes haven’t been saved and will be lost."
        confirmLabel="Discard & leave"
        tone="danger"
      />
    </div>
  )
}

/* ============================================================================
 * Row
 * ========================================================================= */
function PageRow({ page, site, ctx, onOpen, onStatus, onDelete }: { page: SitePage; site: SiteConfig; ctx: SiteRenderContext; onOpen: () => void; onStatus: (s: SitePage['status']) => void; onDelete: () => void }) {
  const sections = useMemo(() => resolvePageSections(site, page), [site, page])
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') onOpen()
      }}
      className="group grid cursor-pointer grid-cols-1 gap-4 p-4 transition-colors outline-none hover:bg-surface-2/50 focus-visible:bg-surface-2/60 sm:grid-cols-[168px_minmax(0,1fr)_auto] sm:gap-5"
    >
      <div className="relative hidden h-[105px] overflow-hidden rounded-lg border border-line bg-bg-subtle shadow-card transition-[border-color,box-shadow] group-hover:border-line-strong group-hover:shadow-pop sm:block">
        <DevicePreview device="desktop" chromeBar={false} scroll={false} interactive={false} frameClassName="rounded-none border-0 shadow-none">
          <SiteCanvas mode="static" theme={site.theme} nav={site.nav} sections={sections} ctx={ctx} activePath={page.slug} />
        </DevicePreview>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {page.isHome && <House className="size-4 text-fg-3" />}
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-fg">{page.title}</span>
          <StatusBadge status={page.status} />
          {page.isHome && <Badge>Home page</Badge>}
        </div>
        <div className="mt-0.5 font-mono text-[12px] text-fg-3">{page.slug}</div>
        <SeoSnippet className="mt-3" siteName={site.theme.siteName} domain={site.domain} slug={page.slug} title={page.seo.title || page.title} description={page.seo.description} />
      </div>

      <div className="flex items-start justify-between gap-3 sm:flex-col sm:items-end">
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Tooltip content="Open on the site">
            <Button variant="ghost" size="sm" icon href={sitePath(page.slug)} aria-label="Preview page">
              <ExternalLink />
            </Button>
          </Tooltip>
          <Button variant="secondary" size="sm" leading={<Pencil />} onClick={onOpen}>
            Edit
          </Button>
          <Popover
            placement="bottom-end"
            className="w-[210px]"
            trigger={({ toggle, open }) => (
              <Button variant="ghost" size="sm" icon onClick={toggle} aria-label="Page actions" className={cn(open && 'bg-surface-2 text-fg')}>
                <Ellipsis />
              </Button>
            )}
          >
            {(close) => (
              <>
                {page.status === 'draft' ? (
                  <MenuItem
                    icon={<Rocket />}
                    onClick={() => {
                      close()
                      onStatus('published')
                    }}
                  >
                    Publish page
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon={<EyeOff />}
                    disabled={page.isHome}
                    onClick={() => {
                      close()
                      onStatus('draft')
                    }}
                  >
                    Move to drafts
                  </MenuItem>
                )}
                <MenuItem
                  icon={<Copy />}
                  onClick={() => {
                    close()
                    navigator.clipboard?.writeText(`https://${site.domain}${page.slug === '/' ? '' : page.slug}`).catch(() => undefined)
                    toast.success('URL copied')
                  }}
                >
                  Copy public URL
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<Trash />}
                  danger
                  disabled={page.isHome}
                  onClick={() => {
                    close()
                    onDelete()
                  }}
                >
                  {page.isHome ? 'Home can’t be deleted' : 'Delete page'}
                </MenuItem>
              </>
            )}
          </Popover>
        </div>
        <div className="text-right text-[12px] text-fg-3">
          <div className="tabular">{plural(page.sectionIds.length, 'section')}</div>
          <div>Updated {relative(page.updatedAt)}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Search-result style preview of a page's listing. Deliberately neutral (theme
 * tokens only) — it shows structure and length, not a specific search engine.
 */
export function SeoSnippet({ siteName, domain, slug, title, description, className }: { siteName: string; domain: string; slug: string; title: string; description: string; className?: string }) {
  const crumbs = normalizePath(slug).split('/').filter(Boolean)
  const tooLong = title.length > 60
  return (
    <div className={cn('max-w-[600px] rounded-lg border border-line bg-surface px-3.5 py-3', className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-surface-3 font-display text-[10.5px] font-bold text-fg-2 ring-1 ring-line-strong ring-inset" aria-hidden>
          {siteName.slice(0, 1).toUpperCase() || 'S'}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[12.5px] text-fg">{siteName}</div>
          <div className="truncate font-mono text-[11px] text-fg-3">
            https://{domain}
            {crumbs.map((c) => (
              <span key={c}> › {c}</span>
            ))}
          </div>
        </div>
      </div>
      <div className={cn('mt-1.5 truncate text-[16px] leading-snug font-medium tracking-[-0.01em] text-fg', tooLong && 'underline decoration-warning/60 decoration-dotted underline-offset-[3px]')} title={tooLong ? 'Longer than ~60 characters — search engines may truncate it' : undefined}>
        {title || 'Untitled page'}
      </div>
      <p className={cn('mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed', description ? 'text-fg-2' : 'text-fg-3 italic')}>{description || 'No meta description — search engines will pick text from the page.'}</p>
    </div>
  )
}

/* ============================================================================
 * Editor drawer
 * ========================================================================= */
function PageEditor({
  open,
  page,
  site,
  ctx,
  onClose,
  onDelete,
  onDirtyChange,
}: {
  open: boolean
  page: SitePage
  site: SiteConfig
  ctx: SiteRenderContext
  onClose: () => void
  onDelete: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState<PageDraft>(() => toPageDraft(page))
  const [tab, setTab] = useState<'content' | 'settings'>('content')
  const [device, setDevice] = useState<DeviceId>('desktop')
  const [confirmClose, setConfirmClose] = useState(false)

  const [savedSig, setSavedSig] = useState<string | null>(null)

  // Re-sync with the latest saved page each time the drawer opens.
  useEffect(() => {
    if (open) {
      setDraft(toPageDraft(page))
      setSavedSig(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const baseline = toPageDraft(page)
  const draftSig = JSON.stringify(draft)
  const dirty = draftSig !== JSON.stringify(baseline) && draftSig !== savedSig
  useEffect(() => onDirtyChange(open && dirty), [open, dirty, onDirtyChange])
  useBeforeUnload(open && dirty)

  const patch = (p: Partial<PageDraft>) => setDraft((d) => ({ ...d, ...p }))
  const titleError = draft.title.trim() ? null : 'A title is required'
  const urlError = page.isHome ? null : slugError(draft.slug, site.pages, page.id)
  const valid = !titleError && !urlError

  const save = useInstMutation((d: PageDraft) => websiteService.updatePage(page.id, { ...d, title: d.title.trim(), seo: { title: d.seo.title.trim(), description: d.seo.description.trim() } }))
  const doSave = () => {
    if (!dirty || !valid || save.isPending) return
    save.mutate(draft, {
      onSuccess: (p) => {
        const next = toPageDraft(p)
        setDraft(next)
        setSavedSig(JSON.stringify(next))
        toast.success('Page saved', p.status === 'published' ? `Live at ${p.slug}` : 'Saved as draft.')
      },
    })
  }
  useSaveShortcut(doSave, open)

  const tryClose = () => (dirty ? setConfirmClose(true) : onClose())

  const library = useMemo(() => sortSections(site.sections), [site.sections])
  const byId = useMemo(() => new Map(site.sections.map((s) => [s.id, s])), [site.sections])
  const usage = useMemo(() => sectionUsage(site), [site])
  const previewSections = useMemo(() => resolvePageSections(site, { sectionIds: draft.sectionIds }), [site, draft.sectionIds])

  const move = (index: number, dir: -1 | 1) => {
    const ids = [...draft.sectionIds]
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j]!, ids[index]!]
    patch({ sectionIds: ids })
  }
  const add = (id: string) => {
    const ids = [...draft.sectionIds]
    const footerIdx = ids.findIndex((x) => byId.get(x)?.type === 'footer')
    if (footerIdx >= 0) ids.splice(footerIdx, 0, id)
    else ids.push(id)
    patch({ sectionIds: ids })
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={tryClose}
        width="xl"
        icon={page.isHome ? <House /> : <FileText />}
        title={
          <span className="flex items-center gap-2">
            {draft.title || 'Untitled page'}
            <StatusBadge status={draft.status} />
          </span>
        }
        description={<span className="font-mono">{draft.slug}</span>}
        actions={
          <Button variant="ghost" size="sm" leading={<ExternalLink />} href={sitePath(page.slug)}>
            <span className="max-sm:hidden">Open</span>
          </Button>
        }
        bodyClassName="p-0 lg:overflow-hidden"
        footer={
          <>
            {!page.isHome && (
              <Button variant="ghost" className="mr-auto text-danger hover:bg-danger/10 hover:text-danger" leading={<Trash />} onClick={onDelete}>
                <span className="max-sm:hidden">Delete page</span>
              </Button>
            )}
            <AnimatePresence>
              {dirty && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mr-1 hidden items-center gap-1.5 text-[12px] text-warning sm:flex">
                  <span className="size-1.5 rounded-full bg-warning" />
                  Unsaved changes
                </motion.span>
              )}
            </AnimatePresence>
            <Button variant="ghost" onClick={() => setDraft(baseline)} disabled={!dirty}>
              Revert
            </Button>
            <Tooltip content={`${modKey}+S`}>
              <Button variant="accent" onClick={doSave} disabled={!dirty || !valid} loading={save.isPending}>
                Save page
              </Button>
            </Tooltip>
          </>
        }
      >
        <div className="grid lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          {/* Left: composition & settings */}
          <div className="flex min-h-0 flex-col lg:border-r lg:border-line">
            <Tabs
              className="px-3"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'content', label: 'Sections', icon: <LayoutTemplate />, count: draft.sectionIds.length },
                { value: 'settings', label: 'Settings & SEO', icon: <Link2 /> },
              ]}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {tab === 'content' ? (
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-[13.5px] font-semibold">Page composition</h4>
                      <p className="mt-0.5 text-[12px] text-fg-3">Drag to reorder — sections render top to bottom.</p>
                    </div>
                    <AddSectionMenu library={library} usedIds={draft.sectionIds} usage={usage} onAdd={add} />
                  </div>
                  {draft.sectionIds.length ? (
                    <Reorder.Group as="ol" axis="y" values={draft.sectionIds} onReorder={(ids: string[]) => patch({ sectionIds: ids })} className="space-y-1.5">
                      {draft.sectionIds.map((id, i) => (
                        <CompositionItem
                          key={id}
                          id={id}
                          section={byId.get(id)}
                          index={i}
                          total={draft.sectionIds.length}
                          onMove={(dir) => move(i, dir)}
                          onRemove={() => patch({ sectionIds: draft.sectionIds.filter((x) => x !== id) })}
                        />
                      ))}
                    </Reorder.Group>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line-strong">
                      <EmptyState compact icon={<Square />} title="This page is empty" description="Add sections from your library to build the page." />
                    </div>
                  )}
                  <p className="mt-4 text-[11.5px] leading-relaxed text-fg-3">Sections are shared: editing one in Website → Sections updates every page that uses it. Hidden sections stay in the composition but aren’t rendered.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Field label="Page title" error={titleError}>
                    <Input value={draft.title} onChange={(e) => patch({ title: e.target.value })} invalid={!!titleError} />
                  </Field>
                  <Field label="URL" error={urlError} hint={page.isHome ? 'The home page always lives at the root of your domain.' : `https://${site.domain}${draft.slug}`}>
                    <Input mono value={draft.slug} disabled={page.isHome} invalid={!!urlError} onChange={(e) => patch({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} leading={<Link2 />} />
                  </Field>
                  <Field label="Status" hint={draft.status === 'draft' ? 'Drafts are only visible to admins, with a “Draft preview” banner.' : 'Visible to everyone.'}>
                    <Segmented
                      size="sm"
                      value={draft.status}
                      onChange={(s) => patch({ status: s })}
                      items={[
                        { value: 'published', label: 'Published', icon: <Eye />, disabled: false },
                        { value: 'draft', label: 'Draft', icon: <EyeOff />, disabled: page.isHome },
                      ]}
                    />
                  </Field>
                  <div className="h-px bg-line" />
                  <div>
                    <h4 className="text-[13.5px] font-semibold">Search engine listing</h4>
                    <p className="mt-0.5 text-[12px] text-fg-3">How this page appears in search results and link previews.</p>
                  </div>
                  <Field label="SEO title" action={<Counter value={draft.seo.title.length} max={60} />}>
                    <Input value={draft.seo.title} placeholder={draft.title} onChange={(e) => patch({ seo: { ...draft.seo, title: e.target.value } })} />
                  </Field>
                  <Field label="Meta description" action={<Counter value={draft.seo.description.length} max={160} />}>
                    <Textarea rows={3} value={draft.seo.description} placeholder="A one or two sentence summary of the page." onChange={(e) => patch({ seo: { ...draft.seo, description: e.target.value } })} />
                  </Field>
                  <div>
                    <div className="mb-1.5 mono-label">Search preview</div>
                    <SeoSnippet siteName={site.theme.siteName} domain={site.domain} slug={draft.slug} title={draft.seo.title || draft.title} description={draft.seo.description} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: live preview */}
          <div className="flex min-h-0 flex-col bg-bg-subtle max-lg:h-[520px] max-lg:border-t max-lg:border-line">
            <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
              <span className="text-[12.5px] font-medium text-fg-2">Live preview</span>
              <span className="text-[11.5px] text-fg-3">· updates as you edit</span>
              <div className="ml-auto">
                <DeviceToggle value={device} onChange={setDevice} devices={['desktop', 'mobile']} />
              </div>
            </div>
            <div className="relative min-h-0 flex-1 bg-dots">
              <DevicePreview device={device} path={draft.slug} padding={14}>
                <SiteCanvas
                  theme={site.theme}
                  nav={site.nav}
                  sections={previewSections}
                  ctx={ctx}
                  activePath={draft.slug}
                  banner={draft.status === 'draft' ? 'Draft preview — this page isn’t published yet. Only admins can see it.' : null}
                  style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
                />
              </DevicePreview>
            </div>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false)
          setDraft(baseline)
          onClose()
        }}
        title="Discard unsaved changes?"
        description="Your edits to this page haven’t been saved."
        confirmLabel="Discard changes"
        tone="danger"
      />
    </>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cn('font-mono text-[11px] tabular', value > max ? 'text-warning' : 'text-fg-3')}>{value}/{max}</span>
}

function CompositionItem({ id, section, index, total, onMove, onRemove }: { id: string; section: SiteSection | undefined; index: number; total: number; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={id} as="li" dragListener={false} dragControls={controls} className="relative list-none" whileDrag={{ scale: 1.02, zIndex: 20 }}>
      <div className="group flex items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pr-1.5 pl-1 shadow-card transition-colors hover:border-line-strong">
        <button type="button" onPointerDown={(e) => controls.start(e)} className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg active:cursor-grabbing" aria-label="Drag to reorder">
          <GripVertical className="size-4" />
        </button>
        <span className="w-4 shrink-0 text-center font-mono text-[11px] text-fg-3 tabular">{index + 1}</span>
        {section ? <SectionTypeIcon type={section.type} size="sm" /> : <span className="grid size-7 place-items-center rounded-md bg-danger/10 text-danger"><TriangleAlert className="size-3.5" /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn('truncate text-[13px] font-medium', section && !section.enabled ? 'text-fg-3' : 'text-fg')}>{section?.name ?? 'Missing section'}</span>
            {section && !section.enabled && <Badge tone="warning">Hidden</Badge>}
            {section?.jsEnabled && <JsChip />}
          </div>
          <div className="truncate text-[11.5px] text-fg-3">{section ? SECTION_TYPES[section.type].label : id}</div>
        </div>
        <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          <Tooltip content="Move up">
            <Button variant="ghost" size="xs" icon disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
              <ArrowUp />
            </Button>
          </Tooltip>
          <Tooltip content="Move down">
            <Button variant="ghost" size="xs" icon disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
              <ArrowDown />
            </Button>
          </Tooltip>
          {section && (
            <Tooltip content="Edit section">
              <Button variant="ghost" size="xs" icon to={`/admin/website/sections?id=${section.id}`} aria-label="Edit section">
                <Pencil />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Remove from page">
            <Button variant="ghost" size="xs" icon onClick={onRemove} aria-label="Remove from page" className="hover:text-danger">
              <X />
            </Button>
          </Tooltip>
        </div>
      </div>
    </Reorder.Item>
  )
}

function AddSectionMenu({ library, usedIds, usage, onAdd }: { library: SiteSection[]; usedIds: string[]; usage: Map<string, SitePage[]>; onAdd: (id: string) => void }) {
  const [q, setQ] = useState('')
  const available = library.filter((s) => !usedIds.includes(s.id) && (!q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())))
  return (
    <Popover
      placement="bottom-end"
      className="w-[300px] p-0"
      trigger={({ toggle, open }) => (
        <Button variant="secondary" size="sm" leading={<Plus />} onClick={toggle} className={cn(open && 'border-line-strong')}>
          Add section
        </Button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-line p-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search the library…" autoFocus />
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1">
            <MenuLabel>Section library</MenuLabel>
            {available.length ? (
              available.map((s) => {
                const n = usage.get(s.id)?.length ?? 0
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onAdd(s.id)
                      close()
                      setQ('')
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <SectionTypeIcon type={s.type} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-fg">{s.name}</span>
                      <span className="block text-[11px] text-fg-3">
                        {SECTION_TYPES[s.type].label} · {n ? `on ${n} page${n === 1 ? '' : 's'}` : 'unused'}
                        {!s.enabled && ' · hidden'}
                      </span>
                    </span>
                    <Plus className="size-3.5 text-fg-3" />
                  </button>
                )
              })
            ) : (
              <p className="px-2.5 py-4 text-center text-[12.5px] text-fg-3">{q ? 'No matching sections.' : 'Every section is already on this page.'}</p>
            )}
          </div>
          <div className="border-t border-line p-2">
            <Button variant="ghost" size="sm" className="w-full" leading={<Sparkles />} to="/admin/website/sections">
              Create a new section
            </Button>
          </div>
        </div>
      )}
    </Popover>
  )
}

/* ============================================================================
 * Create page
 * ========================================================================= */
type StartWith = 'blank' | 'landing' | 'copy'

function CreatePageModal({ open, onClose, site, creating, onCreate }: { open: boolean; onClose: () => void; site: SiteConfig; creating: boolean; onCreate: (b: { title: string; slug: string; sectionIds: string[] }) => void }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [start, setStart] = useState<StartWith>('landing')
  const [copyFrom, setCopyFrom] = useState(site.pages[0]?.id ?? '')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
      setSlug('')
      setSlugTouched(false)
      setStart('landing')
      setSubmitted(false)
    }
  }, [open])

  const firstOf = (type: SiteSection['type']) => site.sections.find((s) => s.type === type && s.enabled)?.id
  const footer = firstOf('footer')
  const templates: Record<StartWith, string[]> = {
    blank: footer ? [footer] : [],
    landing: [firstOf('hero'), firstOf('features'), firstOf('cta'), footer].filter((x): x is string => !!x),
    copy: site.pages.find((p) => p.id === copyFrom)?.sectionIds ?? [],
  }

  const titleErr = !title.trim() ? 'Give the page a title' : null
  const urlErr = slugError(slug, site.pages, null)
  const submit = () => {
    setSubmitted(true)
    if (titleErr || urlErr) return
    onCreate({ title: title.trim(), slug, sectionIds: templates[start] })
  }

  const options: { id: StartWith; title: string; body: string; icon: ReactNode }[] = [
    { id: 'blank', title: 'Blank', body: 'Header and footer only', icon: <Square /> },
    { id: 'landing', title: 'Landing page', body: 'Hero, features, call to action', icon: <Sparkles /> },
    { id: 'copy', title: 'Copy a page', body: 'Reuse an existing layout', icon: <Copy /> },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<FilePlus />}
      title="New page"
      description="New pages start as drafts — publish when you’re ready."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={creating}>
            Create page
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Title" error={submitted ? titleErr : null}>
          <Input
            autoFocus
            value={title}
            placeholder="e.g. iPhone unlock deals"
            invalid={submitted && !!titleErr}
            onChange={(e) => {
              setTitle(e.target.value)
              if (!slugTouched) setSlug(e.target.value.trim() ? slugify(e.target.value) : '')
            }}
          />
        </Field>
        <Field label="URL" error={(submitted || slugTouched) && slug ? urlErr : submitted ? urlErr : null} hint={slug && !urlErr ? `https://${site.domain}${slug}` : undefined}>
          <Input
            mono
            value={slug}
            placeholder="/iphone-unlock-deals"
            leading={<Link2 />}
            invalid={(submitted || slugTouched) && !!urlErr}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
            }}
          />
        </Field>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg">Start with</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setStart(o.id)}
                className={cn('flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-[border-color,box-shadow]', start === o.id ? 'border-accent/60 bg-accent/[0.04] shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_15%,transparent)]' : 'border-line hover:border-line-strong')}
              >
                <span className={cn('grid size-7 place-items-center rounded-lg [&_svg]:size-3.5', start === o.id ? 'bg-accent/15 text-accent-ink' : 'bg-surface-2 text-fg-3')}>{o.icon}</span>
                <span>
                  <span className="block text-[13px] font-medium text-fg">{o.title}</span>
                  <span className="block text-[11.5px] text-fg-3">{o.body}</span>
                </span>
              </button>
            ))}
          </div>
          {start === 'copy' && (
            <Select className="mt-2" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} options={site.pages.map((p) => ({ value: p.id, label: `${p.title} (${p.slug})` }))} />
          )}
          <p className="mt-2 text-[11.5px] text-fg-3">
            {templates[start].length ? `${plural(templates[start].length, 'section')}: ${templates[start].map((id) => site.sections.find((s) => s.id === id)?.name).filter(Boolean).join(' · ')}` : 'No sections — add them after creating the page.'}
          </p>
        </div>
      </form>
    </Modal>
  )
}
