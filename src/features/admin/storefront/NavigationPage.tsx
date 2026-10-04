import { useState } from 'react'
import { ArrowDown, ArrowUp, Navigation, Plus, Trash2 } from 'lucide-react'
import { useInstMutation, useStorefrontAdmin } from '@/hooks/installation'
import { storefrontAdminService } from '@/services/installation'
import { PermissionHint } from '@/components/domain'
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Switch } from '@/components/ui'
import type { StorefrontConfig, StorefrontNavItem } from '@/types/installation'
import { cn } from '@/lib/cn'
import { onColor } from '@/features/storefront/lib/theme'
import { EditorSkeleton, LoadFailed, StorefrontTabs, TargetEditor } from './shared'
import { move, sameContent, uid, useTargetPath } from './editorUtils'
import { PublishBar } from './PublishBar'

export default function NavigationPage() {
  const q = useStorefrontAdmin()
  if (q.isLoading) return <EditorSkeleton />
  if (q.isError || !q.data) return <LoadFailed message={q.error?.message} onRetry={() => void q.refetch()} />
  return <NavEditor key={JSON.stringify([q.data.nav, q.data.footerNav])} config={q.data} />
}

function NavEditor({ config }: { config: StorefrontConfig }) {
  const [nav, setNav] = useState(config.nav)
  const [footer, setFooter] = useState(config.footerNav)
  const dirty = !sameContent([nav, footer], [config.nav, config.footerNav])
  const invalid = [...nav, ...footer].some((n) => !n.label.trim() || (n.target.kind === 'url' && !/^(https?:\/\/|mailto:|tel:)/i.test(n.target.url)) || (n.target.kind === 'service' && !n.target.serviceId) || (n.target.kind === 'category' && !n.target.categoryId))
  const save = useInstMutation(() => storefrontAdminService.saveDraft({ nav, footerNav: footer }), { success: 'Navigation saved to the draft — preview it, then publish' })
  const pathOf = useTargetPath(config)

  return (
    <div>
      <PageHeader
        icon={<Navigation />}
        title="Navigation"
        description="Header and footer links with typed targets — links to pages, categories and services keep working when slugs or prices change."
      />
      <StorefrontTabs />
      <PublishBar
        dirty={dirty}
        saving={save.isPending}
        onSaveDraft={() => save.mutate()}
        onRevert={() => {
          setNav(config.nav)
          setFooter(config.footerNav)
        }}
        saveBlockedReason={invalid ? 'Every link needs a label and a complete target (valid URL, service or category)' : undefined}
      />

      <Card className="mb-4 overflow-hidden">
        <div className="mono-label border-b border-line px-5 py-2">Header preview</div>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-5 py-3">
          <span className="mr-3 text-[14px] font-semibold">{config.theme.logoText}</span>
          {nav.filter((n) => !n.highlight).map((n) => (
            <span key={n.id} className="shrink-0 rounded-md px-2.5 py-1 text-[12.5px] text-fg-2">
              {n.label || '—'}
            </span>
          ))}
          <span className="ml-auto flex shrink-0 gap-1.5">
            {nav.filter((n) => n.highlight).map((n) => (
              <span key={n.id} className="rounded-md px-2.5 py-1 text-[12px] font-semibold" style={{ background: config.theme.colors.primary, color: onColor(config.theme.colors.primary) }}>
                {n.label}
              </span>
            ))}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <NavList title="Header" description="Main menu. The first highlighted item becomes the header button." items={nav} onChange={setNav} config={config} pathOf={pathOf} allowHighlight />
        <NavList title="Footer" description="Company links in the footer. Categories are listed automatically." items={footer} onChange={setFooter} config={config} pathOf={pathOf} />
      </div>
      <div className="mt-4">
        <PermissionHint permission="storefront.manage" />
      </div>
    </div>
  )
}

function NavList({ title, description, items, onChange, config, pathOf, allowHighlight }: { title: string; description: string; items: StorefrontNavItem[]; onChange: (n: StorefrontNavItem[]) => void; config: StorefrontConfig; pathOf: ReturnType<typeof useTargetPath>; allowHighlight?: boolean }) {
  const set = (i: number, patch: Partial<StorefrontNavItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          <Button size="xs" variant="secondary" leading={<Plus />} onClick={() => onChange([...items, { id: uid('n'), label: 'New link', target: { kind: 'track' } }])}>
            Add link
          </Button>
        }
      />
      <div className="grid gap-2 border-t border-line p-3">
        {items.map((n, i) => (
          <div key={n.id} className={cn('grid gap-2 rounded-lg border bg-surface p-3', n.highlight ? 'border-accent/40' : 'border-line')}>
            <div className="flex items-center gap-2">
              <span className="w-5 text-center font-mono text-[11px] text-fg-3">{i + 1}</span>
              <Input inputSize="sm" value={n.label} invalid={!n.label.trim()} placeholder="Label" onChange={(e) => set(i, { label: e.target.value })} className="flex-1" />
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
            <TargetEditor value={n.target} config={config} onChange={(target) => set(i, { target })} />
            <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
              <span className="font-mono text-[11.5px] text-fg-3">→ {pathOf(n.target) || '—'}</span>
              {allowHighlight && (
                <span className="flex items-center gap-2">
                  {n.highlight && <Badge tone="accent">Button</Badge>}
                  <Switch size="sm" checked={!!n.highlight} onChange={(v) => set(i, { highlight: v || undefined })} label="Highlight" />
                </span>
              )}
            </div>
          </div>
        ))}
        {!items.length && <EmptyState compact title="No links" description="Add a link to a page, category, service or the tracking page." />}
      </div>
    </Card>
  )
}
