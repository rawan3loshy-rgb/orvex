/**
 * Typed block editor forms. Metadata, defaults and validation live in ./blockMeta.
 * Catalog blocks only store references (service ids / a query) — there are no
 * price, field or availability inputs anywhere in the editor.
 */
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useCategories, useServices, useStoreCatalog } from '@/hooks/installation'
import { Badge, Button, Checkbox, Field, Input, Segmented, Select, Textarea } from '@/components/ui'
import { Money } from '@/components/domain'
import type { Block, BlockType, CatalogQuery, StorefrontConfig, StorefrontLink } from '@/types/installation'
import { cn } from '@/lib/cn'
import { ServicePicker, TargetEditor, ToggleField } from './shared'
import { move } from './editorUtils'
import { EMBED_FORBIDDEN } from './blockMeta'

type B<T extends BlockType> = Extract<Block, { type: T }>

function T({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input inputSize="sm" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function A({ label, value, onChange, rows = 3, hint, mono }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; mono?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <Textarea rows={rows} mono={mono} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function LinkEditor({ label, link, onChange, config }: { label: string; link: StorefrontLink; onChange: (l: StorefrontLink) => void; config: StorefrontConfig }) {
  return (
    <Field label={label}>
      <div className="grid gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
        <Input inputSize="sm" value={link.label} placeholder="Button label" onChange={(e) => onChange({ ...link, label: e.target.value })} />
        <TargetEditor value={link.target} config={config} onChange={(target) => onChange({ ...link, target })} />
      </div>
    </Field>
  )
}

function ItemsEditor<I>({ label, items, onChange, blank, render }: { label: string; items: I[]; onChange: (items: I[]) => void; blank: I; render: (item: I, set: (patch: Partial<I>) => void) => ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-fg-2">
          {label} <span className="text-fg-3">({items.length})</span>
        </span>
        <Button size="xs" variant="ghost" leading={<Plus />} onClick={() => onChange([...items, blank])}>
          Add
        </Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
          <div className="grid gap-2">{render(it, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
          <div className="flex flex-col gap-0.5">
            <Button size="xs" variant="ghost" icon aria-label="Move up" disabled={i === 0} onClick={() => onChange(move(items, i, -1))}>
              <ArrowUp />
            </Button>
            <Button size="xs" variant="ghost" icon aria-label="Move down" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))}>
              <ArrowDown />
            </Button>
            <Button size="xs" variant="ghost" icon aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      {!items.length && <div className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-[12px] text-fg-3">No items yet</div>}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Block form dispatcher                                                    */
/* ------------------------------------------------------------------------- */
export function BlockForm({ block, onChange, config }: { block: Block; onChange: (b: Block) => void; config: StorefrontConfig }) {
  const set = <K extends Block>(patch: Partial<K>) => onChange({ ...block, ...patch } as Block)
  const images = config.media.filter((m) => m.kind === 'image')
  switch (block.type) {
    case 'hero': {
      const b = block
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <T label="Eyebrow" value={b.eyebrow} onChange={(v) => set<B<'hero'>>({ eyebrow: v })} />
            <Field label="Background media">
              <Select inputSize="sm" value={b.mediaId ?? ''} onChange={(e) => set<B<'hero'>>({ mediaId: e.target.value || null })} options={[{ value: '', label: 'None (centred layout)' }, ...images.map((m) => ({ value: m.id, label: m.name }))]} />
            </Field>
          </div>
          <T label="Title" value={b.title} onChange={(v) => set<B<'hero'>>({ title: v })} />
          <A label="Subtitle" value={b.subtitle} onChange={(v) => set<B<'hero'>>({ subtitle: v })} rows={2} />
          <ToggleField checked={b.search} onChange={(v) => set<B<'hero'>>({ search: v })} label="Show catalog search box" />
          <LinkEditor label="Primary link" link={b.primary} config={config} onChange={(l) => set<B<'hero'>>({ primary: l })} />
          {b.secondary ? (
            <div className="grid gap-1">
              <LinkEditor label="Secondary link" link={b.secondary} config={config} onChange={(l) => set<B<'hero'>>({ secondary: l })} />
              <Button size="xs" variant="ghost" className="justify-self-start" onClick={() => set<B<'hero'>>({ secondary: null })}>
                Remove secondary link
              </Button>
            </div>
          ) : (
            <Button size="xs" variant="ghost" leading={<Plus />} className="justify-self-start" onClick={() => set<B<'hero'>>({ secondary: { label: 'Learn more', target: { kind: 'track' } } })}>
              Add secondary link
            </Button>
          )}
        </div>
      )
    }
    case 'rich_text':
      return (
        <div className="grid gap-3">
          <T label="Title" value={block.title} onChange={(v) => set<B<'rich_text'>>({ title: v })} />
          <A label="Body" value={block.body} rows={6} hint="Separate paragraphs with a blank line. Plain text — no HTML." onChange={(v) => set<B<'rich_text'>>({ body: v })} />
        </div>
      )
    case 'image':
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="grid gap-3">
            <Field label="Image">
              <Select inputSize="sm" value={block.mediaId} onChange={(e) => set<B<'image'>>({ mediaId: e.target.value })} options={[{ value: '', label: 'Choose…' }, ...images.map((m) => ({ value: m.id, label: `${m.name} · ${m.width}×${m.height}` }))]} />
            </Field>
            <T label="Caption" value={block.caption} onChange={(v) => set<B<'image'>>({ caption: v })} />
            <Field label="Width">
              <Segmented
                items={[
                  { value: 'content', label: 'Content' },
                  { value: 'wide', label: 'Wide' },
                ]}
                value={block.width}
                onChange={(v) => set<B<'image'>>({ width: v })}
              />
            </Field>
          </div>
          <div className="aspect-[4/3] rounded-lg border border-line" style={{ background: config.media.find((m) => m.id === block.mediaId)?.preview ?? 'var(--surface-2)' }} />
        </div>
      )
    case 'faq':
      return (
        <div className="grid gap-3">
          <T label="Title" value={block.title} onChange={(v) => set<B<'faq'>>({ title: v })} />
          <ItemsEditor
            label="Questions"
            items={block.items}
            blank={{ q: '', a: '' }}
            onChange={(items) => set<B<'faq'>>({ items })}
            render={(it, s) => (
              <>
                <Input inputSize="sm" value={it.q} placeholder="Question" onChange={(e) => s({ q: e.target.value })} />
                <Textarea rows={2} value={it.a} placeholder="Answer" onChange={(e) => s({ a: e.target.value })} />
              </>
            )}
          />
        </div>
      )
    case 'testimonials':
      return (
        <div className="grid gap-3">
          <T label="Title" value={block.title} onChange={(v) => set<B<'testimonials'>>({ title: v })} />
          <ItemsEditor
            label="Quotes"
            items={block.items}
            blank={{ quote: '', name: '', role: '' }}
            onChange={(items) => set<B<'testimonials'>>({ items })}
            render={(it, s) => (
              <>
                <Textarea rows={2} value={it.quote} placeholder="Quote" onChange={(e) => s({ quote: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input inputSize="sm" value={it.name} placeholder="Name" onChange={(e) => s({ name: e.target.value })} />
                  <Input inputSize="sm" value={it.role} placeholder="Role / company" onChange={(e) => s({ role: e.target.value })} />
                </div>
              </>
            )}
          />
        </div>
      )
    case 'cta':
      return (
        <div className="grid gap-3">
          <T label="Title" value={block.title} onChange={(v) => set<B<'cta'>>({ title: v })} />
          <A label="Body" value={block.body} rows={2} onChange={(v) => set<B<'cta'>>({ body: v })} />
          <LinkEditor label="Button" link={block.cta} config={config} onChange={(l) => set<B<'cta'>>({ cta: l })} />
          <Field label="Tone">
            <Segmented
              items={[
                { value: 'brand', label: 'Brand colour' },
                { value: 'neutral', label: 'Neutral card' },
              ]}
              value={block.tone}
              onChange={(v) => set<B<'cta'>>({ tone: v })}
            />
          </Field>
        </div>
      )
    case 'catalog_grid':
      return <CatalogGridForm block={block} onChange={onChange} />
    case 'service_spotlight':
      return (
        <div className="grid gap-3">
          <Field label="Service">
            <ServicePicker value={block.serviceId} onChange={(id) => set<B<'service_spotlight'>>({ serviceId: id })} />
          </Field>
          <T label="Title" value={block.title} placeholder="Defaults to the service name" onChange={(v) => set<B<'service_spotlight'>>({ title: v })} />
          <A label="Body" value={block.body} rows={2} onChange={(v) => set<B<'service_spotlight'>>({ body: v })} />
          <LivePriceNote />
        </div>
      )
    case 'category_tiles':
      return <CategoryTilesForm block={block} onChange={onChange} />
    case 'trust_bar':
      return (
        <ItemsEditor
          label="Figures"
          items={block.items}
          blank={{ label: '', value: '' }}
          onChange={(items) => set<B<'trust_bar'>>({ items })}
          render={(it, s) => (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Input inputSize="sm" value={it.value} placeholder="Value" onChange={(e) => s({ value: e.target.value })} />
              <Input inputSize="sm" value={it.label} placeholder="Label" onChange={(e) => s({ label: e.target.value })} />
            </div>
          )}
        />
      )
    case 'steps':
      return (
        <div className="grid gap-3">
          <T label="Title" value={block.title} onChange={(v) => set<B<'steps'>>({ title: v })} />
          <ItemsEditor
            label="Steps"
            items={block.items}
            blank={{ title: '', body: '' }}
            onChange={(items) => set<B<'steps'>>({ items })}
            render={(it, s) => (
              <>
                <Input inputSize="sm" value={it.title} placeholder="Step title" onChange={(e) => s({ title: e.target.value })} />
                <Textarea rows={2} value={it.body} placeholder="Description" onChange={(e) => s({ body: e.target.value })} />
              </>
            )}
          />
        </div>
      )
    case 'quick_check':
      return (
        <div className="grid gap-3">
          <T label="Title" value={block.title} onChange={(v) => set<B<'quick_check'>>({ title: v })} />
          <Field label="Service" hint="The visitor's IMEI is validated inline (15 digits + Luhn) and prefilled on this service's order form.">
            <ServicePicker value={block.serviceId} onChange={(id) => set<B<'quick_check'>>({ serviceId: id })} imeiOnly />
          </Field>
          <A label="Body" value={block.body} rows={2} onChange={(v) => set<B<'quick_check'>>({ body: v })} />
          <LivePriceNote />
        </div>
      )
    case 'custom_embed': {
      const bad = EMBED_FORBIDDEN.test(block.html)
      return (
        <div className="grid gap-3">
          <T label="Label" value={block.label} hint="For accessibility and the editor list" onChange={(v) => set<B<'custom_embed'>>({ label: v })} />
          <A label="HTML" mono rows={6} value={block.html} onChange={(v) => set<B<'custom_embed'>>({ html: v })} hint="Sanitised with DOMPurify on render: scripts, iframes, forms, inline styles and event handlers are removed." />
          {bad && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
              <TriangleAlert className="size-3.5" /> Scripts, event handlers and javascript: URLs are refused by the server.
            </div>
          )}
        </div>
      )
    }
  }
}

function LivePriceNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-fg-3">
      <ListChecks className="mt-0.5 size-3.5 shrink-0" />
      Name, price, fields and availability are read live from the catalog — nothing is copied into this page.
    </div>
  )
}

function CategoryTilesForm({ block, onChange }: { block: B<'category_tiles'>; onChange: (b: Block) => void }) {
  const cats = useCategories()
  const all = block.categoryIds === 'all'
  const ids = all ? [] : (block.categoryIds as string[])
  return (
    <div className="grid gap-3">
      <T label="Title" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
      <ToggleField checked={all} onChange={(v) => onChange({ ...block, categoryIds: v ? 'all' : (cats.data ?? []).map((c) => c.id) })} label="Show all categories (new categories appear automatically)" />
      {!all && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(cats.data ?? []).map((c) => (
            <Checkbox key={c.id} checked={ids.includes(c.id)} onChange={(v) => onChange({ ...block, categoryIds: v ? [...ids, c.id] : ids.filter((x) => x !== c.id) })} label={c.name} description={`${c.services} services`} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Catalog grid — query builder (no price inputs)                           */
/* ------------------------------------------------------------------------- */
function CatalogGridForm({ block, onChange }: { block: B<'catalog_grid'>; onChange: (b: Block) => void }) {
  const cats = useCategories()
  const services = useServices()
  const q = block.query
  const mode: 'query' | 'pick' = q.serviceIds?.length ? 'pick' : 'query'
  const setQ = (patch: Partial<CatalogQuery>) => onChange({ ...block, query: { ...q, ...patch } })
  const tags = [...new Set((services.data ?? []).flatMap((s) => s.service.tags))].sort()
  const svcList = (services.data ?? []).filter((s) => s.service.visibility.storefront)
  const picked = q.serviceIds ?? []
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <T label="Title" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
        <T label="Subtitle" value={block.subtitle} onChange={(v) => onChange({ ...block, subtitle: v })} />
      </div>
      <div className="rounded-lg border border-line bg-surface-2 p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-fg">Which services</span>
          <Segmented
            size="xs"
            items={[
              { value: 'query', label: 'By query' },
              { value: 'pick', label: 'Pick services' },
            ]}
            value={mode}
            onChange={(m) => setQ(m === 'pick' ? { serviceIds: svcList.slice(0, 3).map((s) => s.service.id) } : { serviceIds: undefined })}
          />
        </div>
        {mode === 'query' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select inputSize="sm" value={q.categoryId ?? ''} onChange={(e) => setQ({ categoryId: e.target.value || undefined })} options={[{ value: '', label: 'Any category' }, ...(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
            </Field>
            <Field label="Tag">
              <Select inputSize="sm" value={q.tag ?? ''} onChange={(e) => setQ({ tag: e.target.value || undefined })} options={[{ value: '', label: 'Any tag' }, ...tags.map((t) => ({ value: t, label: t }))]} />
            </Field>
            <Field label="Sort">
              <Select
                inputSize="sm"
                value={q.sort}
                onChange={(e) => setQ({ sort: e.target.value as CatalogQuery['sort'] })}
                options={[
                  { value: 'popular', label: 'Most popular' },
                  { value: 'price_asc', label: 'Lowest price first' },
                  { value: 'name', label: 'Name A–Z' },
                ]}
              />
            </Field>
            <Field label="Limit">
              <Input inputSize="sm" type="number" min={1} max={60} value={q.limit} onChange={(e) => setQ({ limit: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} />
            </Field>
            <div className="sm:col-span-2">
              <ToggleField checked={!!q.featured} onChange={(v) => setQ({ featured: v || undefined })} label="Featured services only" />
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {picked.map((id, i) => {
              const s = svcList.find((x) => x.service.id === id)
              return (
                <div key={id} className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{s ? s.service.name : id}</span>
                  {s && !s.available && <Badge tone="warning">unavailable</Badge>}
                  <Button size="xs" variant="ghost" icon aria-label="Up" disabled={i === 0} onClick={() => setQ({ serviceIds: move(picked, i, -1) })}>
                    <ArrowUp />
                  </Button>
                  <Button size="xs" variant="ghost" icon aria-label="Down" disabled={i === picked.length - 1} onClick={() => setQ({ serviceIds: move(picked, i, 1) })}>
                    <ArrowDown />
                  </Button>
                  <Button size="xs" variant="ghost" icon aria-label="Remove" onClick={() => setQ({ serviceIds: picked.filter((x) => x !== id) })}>
                    <Trash2 />
                  </Button>
                </div>
              )
            })}
            <Select
              inputSize="sm"
              value=""
              onChange={(e) => e.target.value && setQ({ serviceIds: [...picked, e.target.value], limit: Math.max(q.limit, picked.length + 1) })}
              options={[{ value: '', label: '+ Add a service…' }, ...svcList.filter((s) => !picked.includes(s.service.id)).map((s) => ({ value: s.service.id, label: `${s.service.name} · ${s.categoryName}` }))]}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ToggleField checked={block.showPrices} onChange={(v) => onChange({ ...block, showPrices: v })} label="Show live prices" />
        <Segmented
          size="xs"
          items={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
          value={block.layout}
          onChange={(v) => onChange({ ...block, layout: v })}
        />
      </div>
      <CatalogPreview query={q} />
    </div>
  )
}

function CatalogPreview({ query }: { query: CatalogQuery }) {
  const res = useStoreCatalog(query)
  const list = res.data ?? []
  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="mono-label">Live result · {res.isLoading ? '…' : `${list.length} service${list.length === 1 ? '' : 's'}`}</span>
        <span className="text-[11.5px] text-fg-3">prices from the pricing engine, as visitors see them</span>
      </div>
      <div className="max-h-48 divide-y divide-line overflow-y-auto">
        {list.map((s) => (
          <div key={s.id} className={cn('flex items-center gap-2 px-3 py-1.5 text-[12.5px]', !s.available && 'text-fg-3')}>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            {!s.available && <Badge tone="warning">Temporarily unavailable</Badge>}
            <Money value={s.price} className="tabular text-fg-2" />
          </div>
        ))}
        {!res.isLoading && !list.length && <div className="px-3 py-3 text-[12px] text-fg-3">No services match this query.</div>}
      </div>
    </div>
  )
}
