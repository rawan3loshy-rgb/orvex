import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, Globe, ImageIcon, Languages, LayoutTemplate, Lock, Plus, Save, Search, Settings2, ShoppingCart, Trash2, Upload } from 'lucide-react'
import { useInstMutation, usePaymentMethods, useStorefrontAdmin } from '@/hooks/installation'
import { storefrontAdminService } from '@/services/installation'
import { Guarded, PermissionHint, SimulatedBadge } from '@/components/domain'
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, Checkbox, DescriptionList, Field, Input, PageHeader, Progress, Select, Tabs, Textarea } from '@/components/ui'
import type { ServiceTemplate, ServiceTemplateSection, StorefrontConfig, StorefrontEditorView } from '@/types/installation'
import { bytes, dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { EditorSkeleton, LoadFailed, StorefrontTabs, ToggleField } from './shared'
import { move, sameContent, uid } from './editorUtils'
import { PublishBar } from './PublishBar'

type Tab = 'seo' | 'locales' | 'checkout' | 'templates' | 'media' | 'domain'

export default function StorefrontSettingsPage() {
  const q = useStorefrontAdmin()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'seo'
  if (q.isLoading) return <EditorSkeleton />
  if (q.isError || !q.data) return <LoadFailed message={q.error?.message} onRetry={() => void q.refetch()} />
  const c = q.data
  return (
    <div>
      <PageHeader icon={<Settings2 />} title="Storefront settings" description="SEO, languages and service page templates are drafted and published with the site. Checkout, media and domain are live settings." />
      <StorefrontTabs />
      <Tabs<Tab>
        className="mb-4"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        items={[
          { value: 'seo', label: 'SEO', icon: <Search className="size-3.5" /> },
          { value: 'locales', label: 'Languages', icon: <Languages className="size-3.5" />, count: c.locales.enabled.length },
          { value: 'checkout', label: 'Checkout', icon: <ShoppingCart className="size-3.5" /> },
          { value: 'templates', label: 'Service templates', icon: <LayoutTemplate className="size-3.5" />, count: c.templates.length },
          { value: 'media', label: 'Media', icon: <ImageIcon className="size-3.5" />, count: c.media.length },
          { value: 'domain', label: 'Domain', icon: <Globe className="size-3.5" /> },
        ]}
      />
      {tab === 'seo' && <SeoSection key={JSON.stringify(c.seo)} c={c} />}
      {tab === 'locales' && <LocalesSection key={JSON.stringify(c.locales)} c={c} />}
      {tab === 'checkout' && <CheckoutSection key={JSON.stringify(c.checkout)} c={c} />}
      {tab === 'templates' && <TemplatesSection key={JSON.stringify(c.templates)} c={c} />}
      {tab === 'media' && (
        <>
          <PublishBar />
          <MediaSection c={c} />
        </>
      )}
      {tab === 'domain' && (
        <>
          <PublishBar />
          <DomainSection c={c} />
        </>
      )}
    </div>
  )
}

/** Save bar for LIVE settings — these are not drafted; saving applies them to the storefront immediately. */
function LiveSaveBar({ dirty, invalid, loading, onSave, onReset, note }: { dirty: boolean; invalid?: boolean; loading: boolean; onSave: () => void; onReset: () => void; note?: ReactNode }) {
  return (
    <CardFooter>
      <span className="flex items-center gap-3">
        {note ?? (dirty ? 'Unsaved changes — live setting, applies immediately when saved' : 'Live setting — not part of draft & publish')}
        <PermissionHint permission="storefront.manage" />
      </span>
      <span className="flex gap-2">
        {dirty && (
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset
          </Button>
        )}
        <Guarded permission="storefront.manage">
          {(ok) => (
            <Button size="sm" variant="accent" leading={<Save />} disabled={!ok || !dirty || invalid} loading={loading} onClick={onSave}>
              Save & apply
            </Button>
          )}
        </Guarded>
      </span>
    </CardFooter>
  )
}

/* ------------------------------------------------------------------------- */
function SeoSection({ c }: { c: StorefrontConfig }) {
  const [seo, setSeo] = useState(c.seo)
  const dirty = !sameContent(seo, c.seo)
  const analyticsOk = !seo.analyticsId || /^G-[A-Z0-9]{6,12}$/.test(seo.analyticsId)
  const save = useInstMutation(() => storefrontAdminService.saveDraft({ seo }), { success: 'SEO settings saved to the draft' })
  return (
    <>
      <PublishBar dirty={dirty} saving={save.isPending} onSaveDraft={() => save.mutate()} onRevert={() => setSeo(c.seo)} saveBlockedReason={analyticsOk ? undefined : 'Analytics ID must look like G-ABC123456'} />
      <Card className="max-w-3xl">
        <CardHeader title="Search & analytics" description="Typed settings only — no raw <head> injection" />
        <CardBody className="grid gap-4">
          <Field label="Title suffix" hint={`Example: “IMEI Blacklist Check${seo.titleSuffix}”`}>
            <Input inputSize="sm" value={seo.titleSuffix} onChange={(e) => setSeo({ ...seo, titleSuffix: e.target.value })} />
          </Field>
          <Field label="Default meta description" hint={`${seo.defaultDescription.length}/160 — used when a page has none`}>
            <Textarea rows={2} value={seo.defaultDescription} onChange={(e) => setSeo({ ...seo, defaultDescription: e.target.value })} />
          </Field>
          <Field label="Analytics measurement ID" hint="Verified ID format (G-XXXXXXX). Leave empty to disable analytics." error={analyticsOk ? undefined : 'Use a measurement ID like G-ABC123456'}>
            <Input inputSize="sm" mono value={seo.analyticsId ?? ''} placeholder="G-XXXXXXXXXX" onChange={(e) => setSeo({ ...seo, analyticsId: e.target.value.trim().toUpperCase() || null })} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <ToggleField checked={seo.sitemap} onChange={(v) => setSeo({ ...seo, sitemap: v })} label="Publish sitemap.xml" />
            <span className="font-mono text-[11.5px] text-fg-3">https://{c.domain.primary}/sitemap.xml</span>
          </div>
          <div className="text-[12px] text-fg-3">
            {c.pages.filter((p) => p.visibility === 'public' && !p.seo.noindex).length} pages indexable · {c.pages.filter((p) => p.seo.noindex).length} hidden with noindex · service pages are added automatically from the catalog.
          </div>
        </CardBody>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------------- */
const AVAILABLE_LOCALES = [
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
]

function LocalesSection({ c }: { c: StorefrontConfig }) {
  const [loc, setLoc] = useState(c.locales)
  const [add, setAdd] = useState('')
  const dirty = !sameContent(loc, c.locales)
  const save = useInstMutation(() => storefrontAdminService.saveDraft({ locales: loc }), { success: 'Languages saved to the draft' })
  const addable = AVAILABLE_LOCALES.filter((l) => !loc.enabled.some((e) => e.code === l.code))
  return (
    <>
      <PublishBar dirty={dirty} saving={save.isPending} onSaveDraft={() => save.mutate()} onRevert={() => setLoc(c.locales)} />
      <Card className="max-w-3xl">
        <CardHeader title="Languages" description="Storefront UI and page translations. Service names come from the catalog." />
        <div className="divide-y divide-line border-t border-line">
          {loc.enabled.map((l) => (
            <div key={l.code} className="flex items-center gap-4 px-5 py-3">
              <span className="w-8 font-mono text-[12px] text-fg-3 uppercase">{l.code}</span>
              <span className="min-w-0 flex-1 text-[13px] font-medium">
                {l.name} {loc.default === l.code && <Badge tone="accent">Default</Badge>}
              </span>
              <div className="hidden w-48 items-center gap-2 sm:flex">
                <Progress value={l.completeness} size="sm" tone={l.completeness >= 95 ? 'success' : l.completeness >= 70 ? 'warning' : 'danger'} className="flex-1" />
                <span className="tabular w-9 text-right text-[12px] text-fg-2">{l.completeness}%</span>
              </div>
              {loc.default !== l.code ? (
                <span className="flex gap-1">
                  <Button size="xs" variant="ghost" onClick={() => setLoc({ ...loc, default: l.code })}>
                    Make default
                  </Button>
                  <Button size="xs" variant="ghost" icon aria-label={`Remove ${l.name}`} onClick={() => setLoc({ ...loc, enabled: loc.enabled.filter((x) => x.code !== l.code) })}>
                    <Trash2 />
                  </Button>
                </span>
              ) : (
                <span className="w-[118px]" />
              )}
            </div>
          ))}
        </div>
        <CardBody className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <Field label="Add a language" className="w-56">
            <Select inputSize="sm" value={add} onChange={(e) => setAdd(e.target.value)} options={[{ value: '', label: 'Choose…' }, ...addable.map((l) => ({ value: l.code, label: l.name }))]} />
          </Field>
          <Button
            size="sm"
            leading={<Plus />}
            disabled={!add}
            onClick={() => {
              const l = AVAILABLE_LOCALES.find((x) => x.code === add)
              if (l) setLoc({ ...loc, enabled: [...loc.enabled, { ...l, completeness: 0 }] })
              setAdd('')
            }}
          >
            Add
          </Button>
          <span className="text-[12px] text-fg-3">New languages start at 0% and fall back to {loc.enabled.find((l) => l.code === loc.default)?.name ?? loc.default} until translated.</span>
        </CardBody>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------------- */
function CheckoutSection({ c }: { c: StorefrontEditorView }) {
  const [co, setCo] = useState(c.checkout)
  const methods = usePaymentMethods()
  const dirty = !sameContent(co, c.checkout)
  const save = useInstMutation(() => storefrontAdminService.updateSettings({ checkout: co }), { success: 'Checkout settings applied to the live storefront' })
  const customerFacing = (methods.data ?? []).filter((m) => m.customerFacing)
  // Checkout is live, so it may only link to a page that is already public on the live site.
  const livePages = c.pages.filter((p) => p.visibility === 'public' && c.publishing.pageStates[p.id] !== 'new')
  return (
    <>
      <PublishBar />
      <Card className="max-w-3xl">
        <CardHeader title="Checkout" description="How storefront visitors pay. Gateways are simulated in this prototype." actions={<SimulatedBadge />} />
        <CardBody className="grid gap-4">
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <ToggleField checked={co.guestCheckout} onChange={(v) => setCo({ ...co, guestCheckout: v })} label="Allow guest checkout" />
            <p className="mt-1.5 pl-1 text-[12px] text-fg-3">Guests enter an email and receive a private tracking link. A lightweight guest account is created so payments still land in the ledger.</p>
          </div>
          <Field label="Payment methods offered on the storefront" hint="Only methods enabled in Finance → Payments can be offered. Signed-in customers can also pay from their wallet.">
            <div className="grid gap-2 sm:grid-cols-2">
              {methods.isLoading && <span className="text-[12px] text-fg-3">Loading methods…</span>}
              {customerFacing.map((m) => (
                <div key={m.id} className={cn('rounded-lg border p-2.5', co.methods.includes(m.id) ? 'border-accent/40 bg-accent/5' : 'border-line')}>
                  <Checkbox
                    checked={co.methods.includes(m.id)}
                    disabled={!m.enabled}
                    onChange={(v) => setCo({ ...co, methods: v ? [...co.methods, m.id] : co.methods.filter((x) => x !== m.id) })}
                    label={m.name}
                    description={`${m.gateway} · ${m.enabled ? m.settlement.replace(/_/g, ' ') : 'disabled in Finance'}`}
                  />
                </div>
              ))}
            </div>
          </Field>
          <Field label="Terms page" hint="Linked under the order button — only pages already live can be chosen">
            <Select inputSize="sm" value={co.termsPageId ?? ''} onChange={(e) => setCo({ ...co, termsPageId: e.target.value || null })} options={[{ value: '', label: 'None' }, ...livePages.map((p) => ({ value: p.id, label: `${p.title} — /${p.slug}` }))]} />
          </Field>
          {!co.guestCheckout && !co.methods.length && <div className="text-[12px] text-warning">With guest checkout off and no methods, only signed-in customers paying from their wallet can order.</div>}
        </CardBody>
        <LiveSaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={() => setCo(c.checkout)} />
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------------- */
const SECTION_LABEL: Record<ServiceTemplateSection, string> = {
  form: 'Order form & checkout',
  description: 'Description & what you need',
  result_preview: 'Example result',
  turnaround: 'Delivery time',
  faq: 'FAQ',
  related: 'Related services',
  trust: 'Trust badges',
}
const ALL_SECTIONS = Object.keys(SECTION_LABEL) as ServiceTemplateSection[]

function TemplatesSection({ c }: { c: StorefrontConfig }) {
  const [tpls, setTpls] = useState(c.templates)
  const dirty = !sameContent(tpls, c.templates)
  const invalid = tpls.some((t) => !t.name.trim() || !t.sections.includes('form')) || tpls.filter((t) => t.isDefault).length !== 1
  const save = useInstMutation(() => storefrontAdminService.saveDraft({ templates: tpls }), { success: 'Service templates saved to the draft' })
  const set = (i: number, patch: Partial<ServiceTemplate>) => setTpls(tpls.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  return (
    <>
      <PublishBar dirty={dirty} saving={save.isPending} onSaveDraft={() => save.mutate()} onRevert={() => setTpls(c.templates)} saveBlockedReason={invalid ? 'Each template needs a name and the order form, and exactly one template must be the default' : undefined} />
      <div className="grid gap-4">
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg-2">
          Templates define the order of sections on every service detail page. The content of each section (fields, price, result schema, availability) always comes from the catalog. A service picks its template in Services; services without one use the default.
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {tpls.map((t, i) => {
            const missing = ALL_SECTIONS.filter((s) => !t.sections.includes(s))
            return (
              <Card key={t.id}>
                <CardBody className="grid gap-3 pt-4">
                  <div className="flex items-center gap-2">
                    <Input inputSize="sm" value={t.name} invalid={!t.name.trim()} onChange={(e) => set(i, { name: e.target.value })} className="flex-1" />
                    <label className="flex items-center gap-1.5 text-[12.5px] text-fg-2">
                      <input type="radio" name="tpl-default" checked={t.isDefault} onChange={() => setTpls(tpls.map((x, j) => ({ ...x, isDefault: j === i })))} className="accent-[var(--accent)]" />
                      Default
                    </label>
                    <Button size="xs" variant="ghost" icon aria-label="Remove template" disabled={t.isDefault || tpls.length < 2} onClick={() => setTpls(tpls.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <Input inputSize="sm" value={t.description} placeholder="Description" onChange={(e) => set(i, { description: e.target.value })} />
                  <ol className="grid gap-1.5">
                    {t.sections.map((s, k) => (
                      <li key={s} className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px]', s === 'form' ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface-2')}>
                        <span className="w-4 font-mono text-[11px] text-fg-3">{k + 1}</span>
                        <span className="flex-1">{SECTION_LABEL[s]}</span>
                        <Button size="xs" variant="ghost" icon aria-label="Up" disabled={k === 0} onClick={() => set(i, { sections: move(t.sections, k, -1) })}>
                          <ArrowUp />
                        </Button>
                        <Button size="xs" variant="ghost" icon aria-label="Down" disabled={k === t.sections.length - 1} onClick={() => set(i, { sections: move(t.sections, k, 1) })}>
                          <ArrowDown />
                        </Button>
                        <Button size="xs" variant="ghost" icon aria-label="Remove" disabled={s === 'form'} onClick={() => set(i, { sections: t.sections.filter((x) => x !== s) })}>
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ol>
                  {missing.length > 0 && (
                    <Select inputSize="sm" value="" onChange={(e) => e.target.value && set(i, { sections: [...t.sections, e.target.value as ServiceTemplateSection] })} options={[{ value: '', label: '+ Add section…' }, ...missing.map((s) => ({ value: s, label: SECTION_LABEL[s] }))]} />
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" leading={<Plus />} onClick={() => setTpls([...tpls, { id: uid('tpl'), name: 'New template', description: '', sections: ['form', 'description', 'faq'], isDefault: false }])}>
            Add template
          </Button>
          <PermissionHint permission="storefront.manage" />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------------- */
function MediaSection({ c }: { c: StorefrontConfig }) {
  return (
    <Card>
      <CardHeader
        title="Media library"
        description="Images used by hero and image blocks. Demo assets are generated previews."
        actions={
          <Button size="sm" variant="secondary" leading={<Upload />} disabled title="Uploads are disabled in the demo">
            Upload
          </Button>
        }
      />
      <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {c.media.map((m) => {
          const usedIn = c.pages.filter((p) => p.blocks.some((b) => (b.type === 'hero' && b.mediaId === m.id) || (b.type === 'image' && b.mediaId === m.id)))
          return (
            <div key={m.id} className="overflow-hidden rounded-lg border border-line">
              <div className="aspect-[4/3] w-full" style={{ background: m.preview }} role="img" aria-label={m.alt} />
              <div className="grid gap-0.5 p-2.5">
                <div className="truncate text-[12.5px] font-medium">{m.name}</div>
                <div className="text-[11.5px] text-fg-3">
                  {m.kind} · {m.width}×{m.height} · {bytes(m.sizeKb * 1024)}
                </div>
                <div className="truncate text-[11.5px] text-fg-3">{usedIn.length ? `Used on ${usedIn.map((p) => p.title).join(', ')}` : 'Not used'}</div>
              </div>
            </div>
          )
        })}
      </CardBody>
      <CardFooter>Uploads are disabled in this demo — assets are stored on your own installation in production.</CardFooter>
    </Card>
  )
}

function DomainSection({ c }: { c: StorefrontConfig }) {
  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader icon={<Globe />} title="Domain" description="The storefront is served by your installation's own web server" />
        <CardBody>
          <DescriptionList
            items={[
              { label: 'Primary domain', value: c.domain.primary, mono: true },
              { label: 'Aliases', value: c.domain.aliases.join(', ') || '—', mono: true },
              {
                label: 'TLS certificate',
                value: (
                  <Badge tone={c.domain.tls === 'active' ? 'success' : 'warning'} dot icon={<Lock className="size-3" />}>
                    {c.domain.tls === 'active' ? 'Active · auto-renew' : 'Pending'}
                  </Badge>
                ),
              },
              { label: 'Verified', value: c.domain.verifiedAt ? dateTime(c.domain.verifiedAt) : 'Not verified' },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="DNS records" description="Point these at your installation (example values)" />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-fg-3">
              <tr>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Value</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono">
              <tr>
                <td className="px-5 py-2">A</td>
                <td className="px-5 py-2">{c.domain.primary}</td>
                <td className="px-5 py-2">203.0.113.24</td>
                <td className="px-5 py-2 font-sans">
                  <Badge tone="success">OK</Badge>
                </td>
              </tr>
              {c.domain.aliases.map((a) => (
                <tr key={a}>
                  <td className="px-5 py-2">CNAME</td>
                  <td className="px-5 py-2">{a}</td>
                  <td className="px-5 py-2">{c.domain.primary}</td>
                  <td className="px-5 py-2 font-sans">
                    <Badge tone="success">OK</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardFooter>Domain changes are made by the installation owner in System → Installation (not editable from this screen in the prototype).</CardFooter>
      </Card>
    </div>
  )
}
