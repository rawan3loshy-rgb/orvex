import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useBlocker, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import {
  Braces,
  Check,
  Columns2,
  CodeXml,
  Copy,
  Ellipsis,
  ExternalLink,
  Eye,
  FileCode,
  Hash,
  LayoutTemplate,
  Palette,
  Plus,
  RotateCcw,
  Save,
  SearchX,
  ShieldCheck,
  Trash,
  TriangleAlert,
  Variable,
} from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, MenuItem, MenuLabel, MenuSeparator, Modal, PageHeader, Popover, SearchInput, Segmented, Select, Skeleton, Switch, Tabs, Tooltip } from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { websiteService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import { toast } from '@/stores/toast'
import type { SectionType, SiteConfig, SitePage, SiteSection } from '@/types/installation'
import { SiteCanvas, resolvePageSections, sitePath, useSiteRuntime } from '@/features/site/SiteRenderer'
import { DYNAMIC_BLOCKS, TEMPLATE_VARIABLES, THEME_VARIABLES, sanitizeReport, type SiteRenderContext } from '@/features/site/renderSite'
import { CodeEditor, type CodeLanguage } from './CodeEditor'
import { SECTION_TEMPLATES, type SectionTemplate } from './sectionTemplates'
import {
  DevicePreview,
  DeviceToggle,
  SECTION_TYPES,
  SECTION_TYPE_ORDER,
  JsChip,
  SectionTypeIcon,
  SecurityModel,
  WebsiteCrumb,
  modKey,
  sectionUsage,
  sortSections,
  useBeforeUnload,
  useDebounced,
  useSaveShortcut,
  type DeviceId,
} from './shared'

type Draft = Pick<SiteSection, 'id' | 'name' | 'type' | 'html' | 'css' | 'js' | 'jsEnabled'>
type View = 'split' | 'code' | 'preview'

const toDraft = (s: SiteSection): Draft => ({ id: s.id, name: s.name, type: s.type, html: s.html, css: s.css, js: s.js, jsEnabled: s.jsEnabled })
const sameDraft = (a: Draft, b: Draft) => a.name === b.name && a.type === b.type && a.html === b.html && a.css === b.css && a.js === b.js && a.jsEnabled === b.jsEnabled

const KNOWN_VARS = new Set(TEMPLATE_VARIABLES.map((v) => v.key))

export default function SectionsPage() {
  const { site, ctx, isLoading, isError, refetch } = useSiteRuntime()
  const [params, setParams] = useSearchParams()
  const sections = useMemo(() => (site ? sortSections(site.sections) : []), [site])
  const usage = useMemo(() => (site ? sectionUsage(site) : new Map<string, SitePage[]>()), [site])

  const requestedId = params.get('id')
  const selectedId = requestedId && sections.some((s) => s.id === requestedId) ? requestedId : (sections[0]?.id ?? null)
  const saved = sections.find((s) => s.id === selectedId) ?? null

  const [draft, setDraft] = useState<Draft | null>(null)
  // Stable identity matters: the debounced preview keys off this object.
  const current = useMemo<Draft | null>(() => (saved ? (draft && draft.id === saved.id ? draft : toDraft(saved)) : null), [saved, draft])
  // Snapshot of the last successful save: keeps the editor clean between the
  // mutation resolving and the site query refetching.
  const [savedSig, setSavedSig] = useState<string | null>(null)
  const dirty = !!(saved && current && !sameDraft(current, toDraft(saved)) && JSON.stringify(current) !== savedSig)

  const [tab, setTab] = useState<CodeLanguage>('html')
  const [view, setView] = useState<View>('split')
  const [pendingSelect, setPendingSelect] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [enabledOverride, setEnabledOverride] = useState<Record<string, boolean>>({})

  const editorRefs: Record<CodeLanguage, RefObject<ReactCodeMirrorRef | null>> = {
    html: useRef<ReactCodeMirrorRef>(null),
    css: useRef<ReactCodeMirrorRef>(null),
    js: useRef<ReactCodeMirrorRef>(null),
  }

  const select = useCallback(
    (id: string) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('id', id)
          return n
        },
        { replace: true },
      ),
    [setParams],
  )
  const requestSelect = (id: string) => {
    if (id === selectedId) return
    if (dirty) setPendingSelect(id)
    else select(id)
  }

  const patch = (p: Partial<Draft>) => {
    if (!current) return
    setDraft({ ...current, ...p })
  }

  /* ------------------------------------------------------------ mutations */
  const update = useInstMutation((v: { id: string; body: Partial<SiteSection> }) => websiteService.updateSection(v.id, v.body))
  const toggle = useInstMutation((v: { id: string; enabled: boolean }) => websiteService.updateSection(v.id, { enabled: v.enabled }), {
    onSettled: (_d, _e, v) =>
      setEnabledOverride((o) => {
        const n = { ...o }
        delete n[v.id]
        return n
      }),
  })
  const create = useInstMutation(async (t: Omit<SectionTemplate, 'id' | 'description'> & { jsEnabled?: boolean }) => {
    const s = await websiteService.createSection({ name: t.name, type: t.type, html: t.html, css: t.css })
    if (t.js) return websiteService.updateSection(s.id, { js: t.js, jsEnabled: !!t.jsEnabled })
    return s
  })
  const remove = useInstMutation((id: string) => websiteService.deleteSection(id))

  const save = (then?: () => void) => {
    if (!current || !saved || !dirty || update.isPending) return
    const name = current.name.trim()
    if (!name) {
      toast.error('Section name is required')
      return
    }
    const pages = usage.get(current.id)?.length ?? 0
    const snapshot: Draft = { ...current, name }
    update.mutate(
      { id: current.id, body: { name, type: current.type, html: current.html, css: current.css, js: current.js, jsEnabled: current.jsEnabled } },
      {
        onSuccess: () => {
          setDraft(snapshot)
          setSavedSig(JSON.stringify(snapshot))
          toast.success('Section saved', pages ? `Live on ${pages} page${pages === 1 ? '' : 's'}.` : 'Not used on any page yet.')
          then?.()
        },
      },
    )
  }

  const revert = () => {
    setDraft(null)
    toast.info('Changes reverted')
  }

  const toggleEnabled = (s: SiteSection, enabled: boolean) => {
    setEnabledOverride((o) => ({ ...o, [s.id]: enabled }))
    toggle.mutate({ id: s.id, enabled }, { onSuccess: () => toast.success(enabled ? `${s.name} enabled` : `${s.name} disabled`, enabled ? 'Visible on every page that uses it.' : 'Hidden on the live site until re-enabled.') })
  }

  const duplicate = () => {
    if (!saved) return
    create.mutate(
      { name: `${saved.name} copy`, type: saved.type, html: saved.html, css: saved.css, js: saved.js, jsEnabled: saved.jsEnabled },
      {
        onSuccess: (s) => {
          toast.success('Section duplicated', `“${s.name}” was added to the library.`)
          requestSelect(s.id)
        },
      },
    )
  }

  const doDelete = () => {
    if (!saved) return
    const idx = sections.findIndex((s) => s.id === saved.id)
    const neighbor = sections[idx + 1] ?? sections[idx - 1]
    remove.mutate(saved.id, {
      onSuccess: () => {
        setConfirmDelete(false)
        setDraft(null)
        toast.success('Section deleted', `“${saved.name}” was removed from the library and all pages.`)
        if (neighbor) select(neighbor.id)
      },
    })
  }

  const insert = (text: string) => {
    const view = editorRefs[tab].current?.view
    if (!view) return
    view.dispatch({ ...view.state.replaceSelection(text), scrollIntoView: true })
    view.focus()
  }

  /* ------------------------------------------------------------ guards */
  useSaveShortcut(() => save())
  useBeforeUnload(dirty)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  /* ------------------------------------------------------------ preview data */
  const debounced = useDebounced(current, 260)
  const previewSection = useMemo<SiteSection | null>(() => {
    if (!saved) return null
    const d = debounced && debounced.id === saved.id ? debounced : toDraft(saved)
    return { ...saved, ...d, enabled: enabledOverride[saved.id] ?? saved.enabled }
  }, [saved, debounced, enabledOverride])

  const report = useMemo(() => (debounced ? sanitizeReport(debounced.html) : { total: 0, elements: 0, attributes: 0 }), [debounced])
  const unknownVars = useMemo(() => {
    if (!debounced) return []
    const out = new Set<string>()
    for (const m of debounced.html.matchAll(/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/gi)) if (!KNOWN_VARS.has(m[1]!.toLowerCase())) out.add(m[1]!)
    return [...out]
  }, [debounced])

  /* ------------------------------------------------------------ render */
  const enabledCount = sections.filter((s) => enabledOverride[s.id] ?? s.enabled).length

  return (
    <div>
      <PageHeader
        eyebrow={<WebsiteCrumb current="Sections" />}
        title="Sections"
        description="Reusable HTML & CSS blocks — hero, live price lists, FAQ, footer — that compose your public storefront. Edit with a live preview; changes go live on every page that uses the section."
        className="mb-5"
        actions={
          <>
            <Popover
              placement="bottom-end"
              className="w-[360px] p-4"
              trigger={({ toggle: t, open }) => (
                <Button variant="ghost" size="sm" leading={<ShieldCheck />} onClick={t} className={cn(open && 'bg-surface-2 text-fg')}>
                  Security model
                </Button>
              )}
            >
              <p className="mb-1 text-[13.5px] font-semibold">How sections render safely</p>
              <p className="mb-4 text-[12px] text-fg-3">The same pipeline renders this preview and your live site.</p>
              <SecurityModel compact />
            </Popover>
            <Button variant="secondary" size="sm" leading={<ExternalLink />} href="/site">
              View site
            </Button>
            <Button variant="accent" size="sm" leading={<Plus />} onClick={() => setNewOpen(true)} disabled={!site}>
              New section
            </Button>
          </>
        }
      />

      {isError ? (
        <Card>
          <EmptyState icon={<TriangleAlert />} title="Couldn’t load the website" description="The website configuration failed to load." action={<Button onClick={() => refetch()}>Try again</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:h-[calc(100dvh-232px)] lg:min-h-[620px] lg:grid-cols-[264px_minmax(0,1fr)]">
          <LibraryRail
            loading={isLoading}
            sections={sections}
            usage={usage}
            selectedId={selectedId}
            dirtyId={dirty ? selectedId : null}
            enabledCount={enabledCount}
            enabledOverride={enabledOverride}
            onSelect={requestSelect}
            onToggle={toggleEnabled}
            onNew={() => setNewOpen(true)}
          />

          <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            {isLoading || !site ? (
              <WorkspaceSkeleton />
            ) : !current || !saved || !previewSection ? (
              <EmptyState
                className="my-auto"
                icon={<LayoutTemplate />}
                title="No sections yet"
                description="Sections are the building blocks of your pages — a hero, a live unlock price list, an FAQ. Start from a template or a blank canvas."
                action={
                  <Button variant="accent" leading={<Plus />} onClick={() => setNewOpen(true)}>
                    New section
                  </Button>
                }
              />
            ) : (
              <>
                <Toolbar
                  draft={current}
                  saved={saved}
                  dirty={dirty}
                  saving={update.isPending}
                  view={view}
                  onView={setView}
                  onPatch={patch}
                  onSave={() => save()}
                  onRevert={revert}
                  onDuplicate={duplicate}
                  duplicating={create.isPending}
                  onDelete={() => setConfirmDelete(true)}
                  pages={usage.get(saved.id) ?? []}
                />
                <div className={cn('grid min-h-0 flex-1', view === 'split' ? 'lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-2 xl:grid-rows-1' : 'grid-cols-1')}>
                  {view !== 'preview' && (
                    <EditorPane
                      className={cn(view === 'split' && 'border-b border-line xl:border-r xl:border-b-0')}
                      draft={current}
                      tab={tab}
                      onTab={setTab}
                      onPatch={patch}
                      editorRefs={editorRefs}
                      onInsert={insert}
                      ctx={ctx}
                      report={report}
                      unknownVars={unknownVars}
                    />
                  )}
                  {view !== 'code' && <PreviewPane site={site} ctx={ctx} section={previewSection} pages={usage.get(saved.id) ?? []} />}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Switch section with unsaved changes */}
      <Modal
        open={!!pendingSelect}
        onClose={() => setPendingSelect(null)}
        size="sm"
        icon={<TriangleAlert className="text-warning" />}
        title="Unsaved changes"
        description={`You have unsaved edits to “${current?.name ?? ''}”. What would you like to do?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingSelect(null)}>
              Keep editing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const id = pendingSelect
                setPendingSelect(null)
                setDraft(null)
                if (id) select(id)
              }}
            >
              Discard
            </Button>
            <Button
              variant="accent"
              loading={update.isPending}
              onClick={() => {
                const id = pendingSelect
                save(() => {
                  setPendingSelect(null)
                  if (id) select(id)
                })
              }}
            >
              Save & switch
            </Button>
          </>
        }
      />

      {/* Leave page with unsaved changes */}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave without saving?"
        description={`Your edits to “${current?.name ?? ''}” haven’t been saved and will be lost.`}
        confirmLabel="Discard & leave"
        tone="danger"
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        loading={remove.isPending}
        tone="danger"
        title={`Delete “${saved?.name ?? ''}”?`}
        description="This permanently removes the section from the library."
        confirmLabel="Delete section"
      >
        {saved && (usage.get(saved.id)?.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-warning/25 bg-warning/[0.06] p-3 text-[12.5px] text-fg-2">
            <p className="font-medium text-fg">It will also be removed from {usage.get(saved.id)!.length === 1 ? 'this page' : 'these pages'}:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {usage.get(saved.id)!.map((p) => (
                <Badge key={p.id} tone="warning">
                  {p.title}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] text-fg-3">It isn’t used on any page.</p>
        )}
      </ConfirmDialog>

      {site && (
        <NewSectionModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          site={site}
          ctx={ctx}
          creating={create.isPending}
          onCreate={(tpl, name) =>
            create.mutate(
              { name, type: tpl.type, html: tpl.html, css: tpl.css, js: tpl.js },
              {
                onSuccess: (s) => {
                  setNewOpen(false)
                  toast.success('Section created', `Add “${s.name}” to a page from Website → Pages.`)
                  requestSelect(s.id)
                },
              },
            )
          }
        />
      )}
    </div>
  )
}

/* ============================================================================
 * Library rail
 * ========================================================================= */
function LibraryRail({
  loading,
  sections,
  usage,
  selectedId,
  dirtyId,
  enabledCount,
  enabledOverride,
  onSelect,
  onToggle,
  onNew,
}: {
  loading: boolean
  sections: SiteSection[]
  usage: Map<string, SitePage[]>
  selectedId: string | null
  dirtyId: string | null
  enabledCount: number
  enabledOverride: Record<string, boolean>
  onSelect: (id: string) => void
  onToggle: (s: SiteSection, enabled: boolean) => void
  onNew: () => void
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const filtered = query ? sections.filter((s) => s.name.toLowerCase().includes(query) || SECTION_TYPES[s.type].label.toLowerCase().includes(query)) : sections

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden max-lg:max-h-[360px]">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">Section library</h3>
          <p className="text-[11.5px] text-fg-3 tabular">{loading ? 'Loading…' : `${sections.length} sections · ${enabledCount} enabled`}</p>
        </div>
        <Tooltip content="New section">
          <Button size="sm" variant="secondary" icon onClick={onNew} aria-label="New section">
            <Plus />
          </Button>
        </Tooltip>
      </div>
      <div className="px-3 pb-2">
        <SearchInput value={q} onChange={setQ} placeholder="Filter sections…" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-1 px-1 pt-1">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2">
                <Skeleton className="size-7 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <div className="space-y-0.5">
            {filtered.map((s) => {
              const pages = usage.get(s.id) ?? []
              const enabled = enabledOverride[s.id] ?? s.enabled
              const active = s.id === selectedId
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  aria-current={active || undefined}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(s.id)
                    }
                  }}
                  className={cn('group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40', active ? 'bg-surface-3/70' : 'hover:bg-surface-2')}
                >
                  {active && <motion.span layoutId="section-lib-active" className="absolute inset-0 rounded-lg ring-1 ring-line-strong ring-inset" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
                  <SectionTypeIcon type={s.type} size="sm" className={cn('relative transition-opacity', !enabled && 'opacity-45')} />
                  <div className="relative min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('truncate text-[13px] font-medium', enabled ? 'text-fg' : 'text-fg-3')}>{s.name}</span>
                      {dirtyId === s.id && <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="Unsaved changes" />}
                      {s.jsEnabled && <JsChip />}
                    </div>
                    <Tooltip content={pages.length ? pages.map((p) => p.title).join(' · ') : null} placement="right">
                      <span className="block truncate text-[11.5px] text-fg-3">{!enabled ? 'Disabled' : pages.length ? `Used on ${pages.length} page${pages.length === 1 ? '' : 's'}` : 'Not used yet'}</span>
                    </Tooltip>
                  </div>
                  <span className="relative">
                    <Switch size="sm" checked={enabled} onChange={(v) => onToggle(s, v)} label={`${enabled ? 'Disable' : 'Enable'} ${s.name}`} />
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState compact icon={<SearchX />} title="No matching sections" description="Try a different name or type." />
        )}
      </div>
      <div className="border-t border-line p-2.5">
        <Button variant="outline" size="sm" className="w-full" leading={<Plus />} onClick={onNew}>
          New section
        </Button>
      </div>
    </Card>
  )
}

/* ============================================================================
 * Toolbar
 * ========================================================================= */
function Toolbar({
  draft,
  saved,
  dirty,
  saving,
  view,
  onView,
  onPatch,
  onSave,
  onRevert,
  onDuplicate,
  duplicating,
  onDelete,
  pages,
}: {
  draft: Draft
  saved: SiteSection
  dirty: boolean
  saving: boolean
  view: View
  onView: (v: View) => void
  onPatch: (p: Partial<Draft>) => void
  onSave: () => void
  onRevert: () => void
  onDuplicate: () => void
  duplicating: boolean
  onDelete: () => void
  pages: SitePage[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
      <Popover
        placement="bottom-start"
        className="w-[220px]"
        trigger={({ toggle }) => (
          <Tooltip content={`Type: ${SECTION_TYPES[draft.type].label} — click to change`}>
            <button type="button" onClick={toggle} className="rounded-lg transition-transform hover:scale-105" aria-label="Change section type">
              <SectionTypeIcon type={draft.type} />
            </button>
          </Tooltip>
        )}
      >
        {(close) => (
          <>
            <MenuLabel>Section type</MenuLabel>
            {SECTION_TYPE_ORDER.map((t) => {
              const Icon = SECTION_TYPES[t].icon
              return (
                <MenuItem
                  key={t}
                  icon={<Icon />}
                  active={draft.type === t}
                  onClick={() => {
                    onPatch({ type: t as SectionType })
                    close()
                  }}
                >
                  <span className="flex items-center justify-between">
                    {SECTION_TYPES[t].label}
                    {draft.type === t && <Check className="size-3.5 text-accent-ink" />}
                  </span>
                </MenuItem>
              )
            })}
          </>
        )}
      </Popover>

      <input
        value={draft.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        aria-label="Section name"
        spellCheck={false}
        className={cn(
          'h-8 w-[220px] min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[14px] font-semibold tracking-[-0.01em] text-fg transition-colors outline-none hover:border-line focus:border-accent/50 focus:bg-surface-2 focus:ring-3 focus:ring-accent/15 max-sm:flex-1',
          !draft.name.trim() && 'border-danger/50',
        )}
      />

      <AnimatePresence mode="wait" initial={false}>
        {dirty ? (
          <motion.span key="dirty" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[11.5px] font-medium text-warning ring-1 ring-warning/25 ring-inset">
            <span className="size-1.5 rounded-full bg-warning" />
            Unsaved changes
          </motion.span>
        ) : (
          <motion.span key="saved" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="hidden items-center gap-1.5 text-[11.5px] text-fg-3 md:flex">
            <Check className="size-3.5 text-success" />
            Saved {relative(saved.updatedAt)}
          </motion.span>
        )}
      </AnimatePresence>

      <div className="ml-auto flex items-center gap-1.5">
        <Segmented
          size="xs"
          value={view}
          onChange={onView}
          className="hidden sm:inline-flex"
          items={[
            { value: 'split', label: <span className="flex items-center gap-1.5" title="Code & preview"><Columns2 /><span className="hidden 2xl:inline">Split</span></span> },
            { value: 'code', label: <span className="flex items-center gap-1.5" title="Code only"><CodeXml /><span className="hidden 2xl:inline">Code</span></span> },
            { value: 'preview', label: <span className="flex items-center gap-1.5" title="Preview only"><Eye /><span className="hidden 2xl:inline">Preview</span></span> },
          ]}
        />
        <Popover
          placement="bottom-end"
          className="w-[230px]"
          trigger={({ toggle, open }) => (
            <Button variant="ghost" size="sm" icon onClick={toggle} aria-label="More actions" className={cn(open && 'bg-surface-2 text-fg')}>
              <Ellipsis />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Copy />}
                disabled={duplicating}
                onClick={() => {
                  close()
                  onDuplicate()
                }}
              >
                Duplicate section
              </MenuItem>
              <MenuItem
                icon={<Hash />}
                onClick={() => {
                  close()
                  navigator.clipboard?.writeText(saved.id).catch(() => undefined)
                  toast.success('Section ID copied', saved.id)
                }}
              >
                Copy section ID
              </MenuItem>
              {pages.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuLabel>Open on live site</MenuLabel>
                  {pages.slice(0, 4).map((p) => (
                    <MenuItem
                      key={p.id}
                      icon={<ExternalLink />}
                      onClick={() => {
                        close()
                        window.open(sitePath(p.slug), '_blank', 'noopener')
                      }}
                    >
                      {p.title}
                      <span className="ml-1.5 font-mono text-[11px] text-fg-3">{p.slug}</span>
                    </MenuItem>
                  ))}
                </>
              )}
              <MenuSeparator />
              <MenuItem
                icon={<Trash />}
                danger
                onClick={() => {
                  close()
                  onDelete()
                }}
              >
                Delete section
              </MenuItem>
            </>
          )}
        </Popover>
        <Button variant="ghost" size="sm" leading={<RotateCcw />} disabled={!dirty} onClick={onRevert}>
          <span className="max-sm:hidden">Revert</span>
        </Button>
        <Tooltip content={`Save · ${modKey}+S`}>
          <Button variant="accent" size="sm" leading={<Save />} disabled={!dirty} loading={saving} onClick={onSave}>
            Save
            <span className="ml-0.5 hidden font-mono text-[10.5px] opacity-70 md:inline">{modKey === '⌘' ? '⌘S' : 'Ctrl S'}</span>
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

/* ============================================================================
 * Editor pane
 * ========================================================================= */
function EditorPane({
  className,
  draft,
  tab,
  onTab,
  onPatch,
  editorRefs,
  onInsert,
  ctx,
  report,
  unknownVars,
}: {
  className?: string
  draft: Draft
  tab: CodeLanguage
  onTab: (t: CodeLanguage) => void
  onPatch: (p: Partial<Draft>) => void
  editorRefs: Record<CodeLanguage, RefObject<ReactCodeMirrorRef | null>>
  onInsert: (text: string) => void
  ctx: SiteRenderContext
  report: { total: number; elements: number; attributes: number }
  unknownVars: string[]
}) {
  const [cursor, setCursor] = useState({ line: 1, col: 1, lines: 1 })
  const lineCount = (s: string) => (s ? s.split('\n').length : 0)

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-col max-lg:h-[480px]', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line pr-2 pl-1">
        <Tabs
          size="sm"
          className="border-b-0"
          value={tab}
          onChange={onTab}
          items={[
            { value: 'html', label: 'HTML', icon: <FileCode />, count: lineCount(draft.html) },
            { value: 'css', label: 'CSS', icon: <Palette />, count: lineCount(draft.css) },
            {
              value: 'js',
              label: (
                <span className="flex items-center gap-1.5">
                  JS
                  <span className={cn('size-1.5 rounded-full', draft.jsEnabled ? 'bg-success' : 'bg-fg-3/40')} />
                </span>
              ),
              icon: <Braces />,
            },
          ]}
        />
        <InsertMenu tab={tab} ctx={ctx} onInsert={onInsert} />
      </div>

      <AnimatePresence initial={false}>
        {tab === 'js' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className={cn('flex flex-wrap items-start gap-3 border-b px-4 py-3', draft.jsEnabled ? 'border-success/20 bg-success/[0.05]' : 'border-warning/20 bg-warning/[0.06]')}>
              <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-4', draft.jsEnabled ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning')}>{draft.jsEnabled ? <ShieldCheck /> : <TriangleAlert />}</span>
              <div className="min-w-[220px] flex-1">
                <p className="text-[12.5px] font-medium text-fg">{draft.jsEnabled ? 'JavaScript runs in a sandboxed iframe' : 'Custom JavaScript is off for this section'}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">
                  When enabled, this section renders inside <code className="font-mono text-[11px] text-fg-2">{'<iframe sandbox="allow-scripts">'}</code> with an opaque origin. Scripts can animate and handle clicks inside the section, but can’t read cookies, storage, the rest of the page or this admin.
                </p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 self-center text-[12.5px] font-medium text-fg">
                <Switch checked={draft.jsEnabled} onChange={(v) => onPatch({ jsEnabled: v })} label="Enable JavaScript (sandboxed)" />
                Enable JavaScript (sandboxed)
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-0 flex-1 bg-bg-subtle/50">
        {(['html', 'css', 'js'] as CodeLanguage[]).map((lang) => (
          <div key={`${draft.id}-${lang}`} className={cn('absolute inset-0', tab !== lang && 'invisible')} aria-hidden={tab !== lang}>
            <CodeEditor
              ref={editorRefs[lang]}
              lang={lang}
              value={lang === 'html' ? draft.html : lang === 'css' ? draft.css : draft.js}
              onChange={(v) => onPatch(lang === 'html' ? { html: v } : lang === 'css' ? { css: v } : { js: v })}
              onCursor={tab === lang ? setCursor : undefined}
              placeholder={lang === 'js' ? '// Optional. Runs only when JavaScript is enabled for this section.' : lang === 'css' ? '/* Styles are scoped to this section. Use var(--site-primary) & friends. */' : '<section>…</section>'}
            />
          </div>
        ))}
      </div>

      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line bg-surface px-3 font-mono text-[11px] text-fg-3">
        <span className="text-fg-2 uppercase">{tab}</span>
        <span className="tabular">
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <span className="hidden tabular sm:inline">{cursor.lines} lines</span>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {unknownVars.length > 0 && (
            <Tooltip content={`Unknown template variable${unknownVars.length > 1 ? 's' : ''}: ${unknownVars.map((v) => `{{${v}}}`).join(', ')} — rendered as plain text.`}>
              <span className="flex items-center gap-1 text-warning">
                <Variable className="size-3.5" />
                {unknownVars.length} unknown
              </span>
            </Tooltip>
          )}
          {report.total > 0 ? (
            <Tooltip content={`${report.elements} element${report.elements === 1 ? '' : 's'} and ${report.attributes} attribute${report.attributes === 1 ? '' : 's'} (scripts, event handlers, unsafe URLs…) are stripped by the sanitizer before rendering.`}>
              <span className="flex items-center gap-1 text-warning">
                <ShieldCheck className="size-3.5" />
                {report.total} unsafe item{report.total === 1 ? '' : 's'} removed
              </span>
            </Tooltip>
          ) : (
            <span className="hidden items-center gap-1 text-success md:flex">
              <ShieldCheck className="size-3.5" />
              Sanitized
            </span>
          )}
          <span className="hidden truncate lg:inline">Live preview</span>
        </div>
      </div>
    </div>
  )
}

function InsertMenu({ tab, ctx, onInsert }: { tab: CodeLanguage; ctx: SiteRenderContext; onInsert: (text: string) => void }) {
  return (
    <Popover
      placement="bottom-end"
      className="w-[320px]"
      trigger={({ toggle, open }) => (
        <Button variant="ghost" size="xs" leading={<Plus />} onClick={toggle} disabled={tab === 'js'} className={cn(open && 'bg-surface-2 text-fg')}>
          Insert
        </Button>
      )}
    >
      {(close) =>
        tab === 'css' ? (
          <div className="max-h-[360px] overflow-y-auto">
            <MenuLabel>Theme variables</MenuLabel>
            {THEME_VARIABLES.map((v) => (
              <MenuItem
                key={v.name}
                icon={<Palette />}
                onClick={() => {
                  onInsert(`var(${v.name})`)
                  close()
                }}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[12px]">{v.name}</span>
                  <span className="truncate text-[11px] text-fg-3">{v.hint}</span>
                </span>
              </MenuItem>
            ))}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <MenuLabel>Template variables</MenuLabel>
            {TEMPLATE_VARIABLES.map((v) => (
              <MenuItem
                key={v.key}
                icon={<Variable />}
                onClick={() => {
                  onInsert(v.token)
                  close()
                }}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[12px]">{v.token}</span>
                  <span className="truncate text-[11px] text-fg-3">{v.resolve(ctx) || v.label}</span>
                </span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuLabel>Dynamic blocks</MenuLabel>
            {DYNAMIC_BLOCKS.map((b) => (
              <MenuItem
                key={b.id}
                icon={<LayoutTemplate />}
                onClick={() => {
                  onInsert(b.snippet)
                  close()
                }}
              >
                <span className="block">
                  <span className="block text-[13px]">{b.label}</span>
                  <span className="block truncate font-mono text-[10.5px] text-fg-3">{b.snippet}</span>
                </span>
              </MenuItem>
            ))}
          </div>
        )
      }
    </Popover>
  )
}

/* ============================================================================
 * Preview pane
 * ========================================================================= */
function PreviewPane({ site, ctx, section, pages }: { site: SiteConfig; ctx: SiteRenderContext; section: SiteSection; pages: SitePage[] }) {
  const [device, setDevice] = useState<DeviceId>('desktop')
  const [scale, setScale] = useState(1)
  const [whole, setWhole] = useState(false)
  const [pageId, setPageId] = useState<string | null>(null)

  const canWhole = pages.length > 0
  const page = whole && canWhole ? (pages.find((p) => p.id === pageId) ?? pages[0]!) : null

  useEffect(() => {
    if (!canWhole) setWhole(false)
  }, [canWhole])

  const canvasSections = useMemo(() => {
    if (!page) return [section]
    return resolvePageSections(site, page, { includeDisabled: true }).map((s) => (s.id === section.id ? section : s))
  }, [page, site, section])
  const dimmed = useMemo(() => canvasSections.filter((s) => !s.enabled).map((s) => s.id), [canvasSections])

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-bg-subtle max-lg:h-[560px]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <DeviceToggle value={device} onChange={setDevice} />
        <span className="mx-0.5 h-5 w-px bg-line" />
        <Tooltip content={canWhole ? 'Preview the section in the context of a page' : 'Add this section to a page to preview it in context'}>
          <label className={cn('flex items-center gap-2 text-[12.5px] font-medium text-fg-2', canWhole ? 'cursor-pointer' : 'opacity-50')}>
            <Switch size="sm" checked={!!page} onChange={setWhole} disabled={!canWhole} label="Show whole page" />
            Whole page
          </label>
        </Tooltip>
        {page && pages.length > 1 && <Select inputSize="sm" className="w-[150px]" value={page.id} onChange={(e) => setPageId(e.target.value)} options={pages.map((p) => ({ value: p.id, label: p.title }))} />}
        <span className="ml-auto font-mono text-[11px] text-fg-3 tabular" title="Preview scale">
          {DEVICES_LABEL[device]} · {Math.round(scale * 100)}%
        </span>
      </div>
      <div className="relative min-h-0 flex-1 bg-dots">
        <DevicePreview device={device} path={page?.slug ?? pages[0]?.slug ?? '/'} padding={14} onScale={setScale}>
          <SiteCanvas
            theme={site.theme}
            nav={site.nav}
            sections={canvasSections}
            ctx={ctx}
            chrome={!!page}
            activePath={page?.slug ?? null}
            fallbackFooter={!!page}
            emptyMessage={null}
            dimmedIds={dimmed}
            focusId={page ? section.id : null}
            style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
          />
        </DevicePreview>
        <AnimatePresence>
          {!section.enabled && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="pointer-events-none absolute inset-x-0 top-[58px] flex justify-center">
              <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-surface/95 px-3 py-1 text-[12px] font-medium text-warning shadow-pop backdrop-blur">
                <Eye className="size-3.5" />
                Disabled — hidden on the live site
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

const DEVICES_LABEL: Record<DeviceId, string> = { desktop: '1280', tablet: '768', mobile: '390' }

function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-[520px] flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
      <div className="grid flex-1 xl:grid-cols-2">
        <div className="space-y-2.5 border-line p-5 xl:border-r">
          {[72, 88, 64, 92, 56, 80, 70, 44, 86, 60].map((w, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3 w-5 shrink-0" />
              <div style={{ width: `${w}%` }}>
                <Skeleton className="h-3" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden bg-bg-subtle p-6 xl:block">
          <Skeleton className="h-full min-h-[300px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * New section modal
 * ========================================================================= */
function NewSectionModal({ open, onClose, site, ctx, creating, onCreate }: { open: boolean; onClose: () => void; site: SiteConfig; ctx: SiteRenderContext; creating: boolean; onCreate: (tpl: SectionTemplate, name: string) => void }) {
  const [tplId, setTplId] = useState(SECTION_TEMPLATES[0]!.id)
  const [name, setName] = useState('')
  const tpl = SECTION_TEMPLATES.find((t) => t.id === tplId) ?? SECTION_TEMPLATES[0]!

  useEffect(() => {
    if (open) {
      setTplId(SECTION_TEMPLATES[0]!.id)
      setName('')
    }
  }, [open])

  const finalName = name.trim() || tpl.name
  const submit = () => onCreate(tpl, finalName)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<LayoutTemplate />}
      title="New section"
      description="Start from a template — every template reads your theme variables, so it matches your brand instantly."
      footer={
        <>
          <span className="mr-auto hidden text-[12px] text-fg-3 sm:block">You can edit HTML, CSS and JS right after creating it.</span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" leading={<Plus />} loading={creating} onClick={submit}>
            Create section
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Name" hint="Shown in the section library and page composer.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tpl.name} autoFocus />
        </Field>
      </form>
      <div className="mt-5 mb-2 mono-label">Template</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTION_TEMPLATES.map((t) => {
          const active = t.id === tplId
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTplId(t.id)}
              className={cn('group overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow] duration-200', active ? 'border-accent/60 shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)]' : 'border-line hover:border-line-strong')}
            >
              <div className="relative h-[104px] border-b border-line bg-bg-subtle">
                <TemplateThumb template={t} site={site} ctx={ctx} />
                {active && (
                  <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-accent text-white shadow-card">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <SectionTypeIcon type={t.type} size="xs" />
                  <span className="truncate text-[13px] font-medium">{t.name}</span>
                  {t.js && <JsChip />}
                </div>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-fg-3">{t.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

function TemplateThumb({ template, site, ctx }: { template: SectionTemplate; site: SiteConfig; ctx: SiteRenderContext }) {
  const section = useMemo<SiteSection>(() => ({ id: `tpl_${template.id}`, name: template.name, type: template.type, html: template.html, css: template.css, js: '', jsEnabled: false, enabled: true, updatedAt: '' }), [template])
  return (
    <DevicePreview device="desktop" chromeBar={false} scroll={false} interactive={false} frameClassName="rounded-none border-0 shadow-none">
      <SiteCanvas mode="static" theme={site.theme} sections={[section]} ctx={ctx} chrome={false} fallbackFooter={false} emptyMessage={null} style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }} />
    </DevicePreview>
  )
}
