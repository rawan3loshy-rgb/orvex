import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, ChevronDown, EyeOff, FilePlus2, FileText, LayoutTemplate, Plus, Trash2 } from 'lucide-react'
import { useInstMutation, useStorefrontAdmin } from '@/hooks/installation'
import { storefrontAdminService } from '@/services/installation'
import { Guarded, PermissionHint } from '@/components/domain'
import { Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, Textarea } from '@/components/ui'
import type { Block, BlockType, StorefrontConfig, StorefrontEditorView, StorefrontPage } from '@/types/installation'
import { relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { EditorSkeleton, LoadFailed, StorefrontTabs, ToggleField } from './shared'
import { move, sameContent, SITE_URL } from './editorUtils'
import { PublishBar } from './PublishBar'
import { BlockForm } from './blockForms'
import { BLOCK_META, BLOCK_ORDER, blockErrors, blockSummary, newBlock } from './blockMeta'

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export default function PagesPage() {
  const q = useStorefrontAdmin()
  const [params, setParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)

  if (q.isLoading) return <EditorSkeleton />
  if (q.isError || !q.data) return <LoadFailed message={q.error?.message} onRetry={() => void q.refetch()} />
  const config = q.data
  const selectedId = params.get('page') ?? config.pages[0]?.id
  const page = config.pages.find((p) => p.id === selectedId) ?? config.pages[0]
  const select = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('page', id)
    setParams(next, { replace: true })
  }

  const states = config.publishing.pageStates
  const list = (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader
        title="Pages"
        description={`${config.pages.length} pages in draft v${config.publishing.draft.version}`}
        actions={
          <Guarded permission="storefront.manage">
            {(ok) => (
              <Button size="xs" variant="secondary" leading={<Plus />} disabled={!ok} onClick={() => setCreateOpen(true)}>
                New page
              </Button>
            )}
          </Guarded>
        }
      />
      <div className="divide-y divide-line border-t border-line">
        {config.pages.map((p) => (
          <button key={p.id} type="button" onClick={() => select(p.id)} className={cn('flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors', p.id === page?.id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
            <FileText className={cn('mt-0.5 size-4 shrink-0', p.id === page?.id ? 'text-accent-ink' : 'text-fg-3')} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-fg">{p.title}</span>
              <span className="block truncate font-mono text-[11px] text-fg-3">/{p.slug}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <PageStateBadge page={p} state={states[p.id]} />
              <span className="text-[10.5px] text-fg-3">{p.kind}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  )

  return (
    <div>
      <PageHeader icon={<LayoutTemplate />} title="Pages & blocks" description="Pages are lists of typed blocks. Catalog blocks reference services — prices, fields and availability are resolved live." />
      <StorefrontTabs />
      {page ? (
        <PageEditor key={`${page.id}:${page.updatedAt}`} page={page} config={config} sidebar={list} onDeleted={() => select(config.pages.find((p) => p.kind === 'home')?.id ?? '')} />
      ) : (
        <>
          <PublishBar />
          <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
            {list}
            <Card>
              <EmptyState icon={<FileText />} title="No pages yet" description="Create the first page of your storefront." />
            </Card>
          </div>
        </>
      )}
      <CreatePageModal open={createOpen} onClose={() => setCreateOpen(false)} config={config} onCreated={(id) => select(id)} />
    </div>
  )
}

/** Draft state of a page relative to the live site, plus its visibility. */
function PageStateBadge({ page, state }: { page: StorefrontPage; state: 'new' | 'changed' | 'unchanged' | undefined }) {
  if (page.visibility === 'hidden')
    return (
      <Badge tone="neutral" icon={<EyeOff className="size-3" />}>
        hidden
      </Badge>
    )
  if (state === 'new')
    return (
      <Badge tone="accent" dot>
        new
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

/* ------------------------------------------------------------------------- */
function CreatePageModal({ open, onClose, config, onCreated }: { open: boolean; onClose: () => void; config: StorefrontConfig; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [kind, setKind] = useState<'page' | 'legal'>('page')
  const effSlug = slugTouched ? slug : slugify(title)
  const dup = config.pages.some((p) => p.slug === effSlug)
  const reserved = ['services', 'search', 'track', 'account', 'pay', 'c'].includes(effSlug) && !config.pages.some((p) => p.slug === effSlug)
  const create = useInstMutation(storefrontAdminService.createPage, {
    success: (p) => `Added /${p.slug} to the draft — it goes live when you publish`,
    onSuccess: (p) => {
      onCreated(p.id)
      onClose()
      setTitle('')
      setSlug('')
      setSlugTouched(false)
    },
  })
  const valid = title.trim().length > 1 && /^[a-z0-9-]+$/.test(effSlug) && !dup
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New page"
      description="New pages are added to the draft. Preview them, then publish to put them live."
      icon={<FilePlus2 />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={create.isPending}
            onClick={() =>
              create.mutate({ title: title.trim(), slug: effSlug, kind, visibility: 'public', blocks: [], seo: { title: title.trim(), description: '', noindex: kind === 'legal' }, updatedAt: new Date().toISOString() })
            }
          >
            Create page
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Title">
          <Input value={title} autoFocus placeholder="e.g. Unlock Week" onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Slug" hint={`${SITE_URL}/${effSlug || '…'}`} error={dup ? 'Another page already uses this slug' : reserved ? 'This slug is used by a built-in storefront route' : undefined}>
          <Input
            mono
            value={effSlug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
          />
        </Field>
        <Field label="Kind">
          <Segmented<'page' | 'legal'>
            items={[
              { value: 'page', label: 'Content page' },
              { value: 'legal', label: 'Legal page' },
            ]}
            value={kind}
            onChange={setKind}
          />
        </Field>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------------- */
function PageEditor({ page, config, sidebar, onDeleted }: { page: StorefrontPage; config: StorefrontEditorView; sidebar: ReactNode; onDeleted: () => void }) {
  const [draft, setDraft] = useState<StorefrontPage>(page)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = useMemo(() => !sameContent(draft, page), [draft, page])
  const isHome = page.kind === 'home'
  const save = useInstMutation(storefrontAdminService.savePage, { success: (p) => `Draft saved — /${p.slug} is not live until you publish` })
  const del = useInstMutation(storefrontAdminService.deletePage, { success: 'Page removed from the draft — it stays live until you publish', onSuccess: onDeleted })
  const state = config.publishing.pageStates[page.id]
  const errors = draft.blocks.flatMap((b) => blockErrors(b).map((e) => `${BLOCK_META[b.type].label}: ${e}`))
  const slugErr = !isHome && !/^[a-z0-9-]+$/.test(draft.slug) ? 'Lowercase letters, digits and dashes only' : config.pages.some((p) => p.id !== page.id && p.slug === draft.slug) ? 'Another page already uses this slug' : undefined

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const setBlocks = (blocks: Block[]) => setDraft((d) => ({ ...d, blocks }))
  const setSeo = (patch: Partial<StorefrontPage['seo']>) => setDraft((d) => ({ ...d, seo: { ...d.seo, ...patch } }))

  const insert = (type: BlockType, at: number) => {
    const b = newBlock(type, config)
    const next = [...draft.blocks]
    next.splice(at, 0, b)
    setBlocks(next)
    setOpen(b.id)
    setAdding(null)
  }

  return (
    <>
      <PublishBar dirty={dirty} saving={save.isPending} onSaveDraft={() => save.mutate(draft)} onRevert={() => setDraft(page)} saveBlockedReason={slugErr ?? (errors.length ? errors.join(' · ') : undefined)} />
      <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        {sidebar}
        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em]">{draft.title || 'Untitled'}</h2>
                <PageStateBadge page={draft} state={state} />
                {dirty && <Badge tone="accent">Unsaved changes</Badge>}
              </div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                <span className="font-mono">/{draft.slug}</span> · edited in draft {relative(page.updatedAt)} ·{' '}
                {state === 'new' ? 'not on the live site yet' : state === 'changed' ? `differs from live v${config.publishing.published.version}` : `same as live v${config.publishing.published.version}`}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Page settings" description="Title, address, visibility and search appearance" />
            <CardBody className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title">
                  <Input inputSize="sm" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </Field>
                <Field label="Slug" error={slugErr} hint={isHome ? 'The home page lives at /site' : `${SITE_URL}/${draft.slug}`}>
                  <Input inputSize="sm" mono disabled={isHome} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} />
                </Field>
                <Field label="Visibility" hint={isHome ? 'The home page is always public' : draft.visibility === 'hidden' ? 'Not reachable on the site, even after publishing' : 'Reachable once published'}>
                  <Segmented<StorefrontPage['visibility']>
                    items={isHome ? [{ value: 'public', label: 'Public' }] : [
                      { value: 'public', label: 'Public' },
                      { value: 'hidden', label: 'Hidden' },
                    ]}
                    value={draft.visibility}
                    onChange={(v) => setDraft({ ...draft, visibility: v })}
                  />
                </Field>
                <Field label="Kind">
                  <Select
                    inputSize="sm"
                    disabled={isHome}
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as StorefrontPage['kind'] })}
                    options={isHome ? [{ value: 'home', label: 'Home page' }] : [
                      { value: 'page', label: 'Content page' },
                      { value: 'legal', label: 'Legal page' },
                    ]}
                  />
                </Field>
              </div>
              <div className="grid gap-3 rounded-lg border border-line bg-surface-2 p-3 lg:grid-cols-[1fr_340px]">
                <div className="grid gap-3">
                  <Field label="SEO title">
                    <Input inputSize="sm" value={draft.seo.title} onChange={(e) => setSeo({ title: e.target.value })} />
                  </Field>
                  <Field label="Meta description" hint={`${draft.seo.description.length}/160`}>
                    <Textarea rows={2} value={draft.seo.description} onChange={(e) => setSeo({ description: e.target.value })} />
                  </Field>
                  <ToggleField checked={draft.seo.noindex} onChange={(v) => setSeo({ noindex: v })} label="Hide from search engines (noindex)" />
                </div>
                <div className="rounded-lg border border-line bg-surface p-3">
                  <div className="mono-label mb-2">Search result preview</div>
                  <div className="truncate text-[11.5px] text-fg-3">
                    {config.domain.primary}
                    {isHome ? '' : ` › ${draft.slug}`}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[15px] font-medium text-[#1a5c45] dark:text-[#7fd1b0]">{draft.seo.title || draft.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] text-fg-2">{draft.seo.description || config.seo.defaultDescription}</div>
                  {draft.seo.noindex && <div className="mt-1.5 text-[11px] text-warning">Not indexed</div>}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Blocks"
              description={`${draft.blocks.length} typed blocks · top to bottom`}
              actions={
                <Button size="xs" variant="secondary" leading={<Plus />} onClick={() => setAdding(draft.blocks.length)}>
                  Add block
                </Button>
              }
            />
            <div className="grid gap-2 border-t border-line p-3">
              {draft.blocks.map((b, i) => {
                const meta = BLOCK_META[b.type]
                const isOpen = open === b.id
                const errs = blockErrors(b)
                return (
                  <div key={b.id} className={cn('rounded-lg border bg-surface', isOpen ? 'border-line-strong shadow-card' : 'border-line', errs.length && 'border-danger/40')}>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <button type="button" onClick={() => setOpen(isOpen ? null : b.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-expanded={isOpen}>
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-md border border-line [&_svg]:size-4', meta.catalog ? 'bg-accent/10 text-accent-ink' : 'bg-surface-2 text-fg-2')}>{meta.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[13px] font-medium">
                            {meta.label}
                            {meta.catalog && <Badge tone="accent">live catalog</Badge>}
                            {errs.length > 0 && <Badge tone="danger">needs attention</Badge>}
                          </span>
                          <span className="block truncate text-[12px] text-fg-3">{blockSummary(b)}</span>
                        </span>
                        <ChevronDown className={cn('size-4 shrink-0 text-fg-3 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      <div className="flex items-center">
                        <Button size="xs" variant="ghost" icon aria-label="Move up" disabled={i === 0} onClick={() => setBlocks(move(draft.blocks, i, -1))}>
                          <ArrowUp />
                        </Button>
                        <Button size="xs" variant="ghost" icon aria-label="Move down" disabled={i === draft.blocks.length - 1} onClick={() => setBlocks(move(draft.blocks, i, 1))}>
                          <ArrowDown />
                        </Button>
                        <Button size="xs" variant="ghost" icon aria-label="Insert block below" onClick={() => setAdding(i + 1)}>
                          <Plus />
                        </Button>
                        <Button size="xs" variant="ghost" icon aria-label="Remove block" onClick={() => setBlocks(draft.blocks.filter((x) => x.id !== b.id))}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-line p-3.5">
                        <BlockForm block={b} config={config} onChange={(nb) => setBlocks(draft.blocks.map((x) => (x.id === b.id ? nb : x)))} />
                      </div>
                    )}
                  </div>
                )
              })}
              {!draft.blocks.length && (
                <EmptyState compact icon={<LayoutTemplate />} title="No blocks yet" description="Add a hero, a catalog grid or text." action={<Button size="sm" leading={<Plus />} onClick={() => setAdding(0)}>Add block</Button>} />
              )}
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <PermissionHint permission="storefront.manage" />
            {!isHome && (
              <Guarded permission="storefront.manage">
                {(ok) => (
                  <Button size="sm" variant="ghost" className="text-danger" leading={<Trash2 />} disabled={!ok} onClick={() => setConfirmDelete(true)}>
                    Delete page
                  </Button>
                )}
              </Guarded>
            )}
          </div>

          <Modal open={adding !== null} onClose={() => setAdding(null)} size="lg" title="Add a block" description="Typed blocks only — catalog blocks reference services and are priced live.">
            <div className="grid gap-2 sm:grid-cols-2">
              {BLOCK_ORDER.map((t) => {
                const m = BLOCK_META[t]
                return (
                  <button key={t} type="button" onClick={() => insert(t, adding ?? draft.blocks.length)} className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-md border border-line [&_svg]:size-4', m.catalog ? 'bg-accent/10 text-accent-ink' : 'bg-surface-2 text-fg-2')}>{m.icon}</span>
                    <span>
                      <span className="flex items-center gap-2 text-[13px] font-semibold">
                        {m.label}
                        {m.catalog && <Badge tone="accent">catalog</Badge>}
                      </span>
                      <span className="block text-[12px] text-fg-3">{m.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Modal>

          <ConfirmDialog
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => del.mutate(page.id)}
            loading={del.isPending}
            tone="danger"
            title={`Delete “${page.title}”?`}
            description={`/${page.slug} is removed from the draft. The live site keeps serving it until you publish — remove navigation links to it first.`}
            confirmLabel="Delete page"
          />
        </div>
      </div>
    </>
  )
}
