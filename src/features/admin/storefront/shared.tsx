/** Shared pieces of the storefront editor (operator console). */
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { useCategories, useServices } from '@/hooks/installation'
import { Button, Card, EmptyState, Input, Select, Skeleton, Switch } from '@/components/ui'
import type { StorefrontConfig, StorefrontTarget } from '@/types/installation'
import { cn } from '@/lib/cn'
import { defaultTarget, TARGET_KINDS } from './editorUtils'

const TABS = [
  { to: '/admin/storefront', label: 'Overview', end: true },
  { to: '/admin/storefront/pages', label: 'Pages & blocks' },
  { to: '/admin/storefront/theme', label: 'Theme' },
  { to: '/admin/storefront/navigation', label: 'Navigation' },
  { to: '/admin/storefront/settings', label: 'Settings' },
]

export function StorefrontTabs() {
  return (
    <nav aria-label="Storefront sections" className="no-scrollbar -mt-2 mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => cn('relative -mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors', isActive ? 'border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg')}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** A switch with its label visible next to it (the kit Switch only sets aria-label). */
export function ToggleField({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
      <span className="text-[13px] text-fg-2">{label}</span>
    </span>
  )
}

export function EditorSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

export function LoadFailed({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <Card>
      <EmptyState icon={<TriangleAlert />} title="Storefront configuration could not be loaded" description={message} action={<Button onClick={onRetry}>Try again</Button>} />
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Typed link targets                                                       */
/* ------------------------------------------------------------------------- */
export function TargetEditor({ value, onChange, config, compact }: { value: StorefrontTarget; onChange: (t: StorefrontTarget) => void; config: StorefrontConfig; compact?: boolean }) {
  const cats = useCategories()
  const services = useServices()
  const catOptions = (cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))
  const svcOptions = (services.data ?? []).filter((s) => s.service.visibility.storefront).map((s) => ({ value: s.service.id, label: `${s.service.name}${s.available ? '' : ' (unavailable)'}` }))
  const pageOptions = config.pages.map((p) => ({ value: p.id, label: `${p.title} — /${p.slug}${p.visibility === 'hidden' ? ' (hidden)' : ''}` }))
  let detail: ReactNode
  switch (value.kind) {
    case 'page':
      detail = <Select inputSize="sm" value={value.pageId} onChange={(e) => onChange({ kind: 'page', pageId: e.target.value })} options={pageOptions} />
      break
    case 'category':
      detail = <Select inputSize="sm" value={value.categoryId} onChange={(e) => onChange({ kind: 'category', categoryId: e.target.value })} options={[{ value: '', label: 'Select category…' }, ...catOptions]} />
      break
    case 'service':
      detail = <Select inputSize="sm" value={value.serviceId} onChange={(e) => onChange({ kind: 'service', serviceId: e.target.value })} options={[{ value: '', label: services.isLoading ? 'Loading services…' : 'Select service…' }, ...svcOptions]} />
      break
    case 'search':
      detail = <Input inputSize="sm" value={value.query} placeholder="e.g. iPhone 15 unlock" onChange={(e) => onChange({ kind: 'search', query: e.target.value })} />
      break
    case 'url':
      detail = <Input inputSize="sm" mono value={value.url} placeholder="https:// or mailto:" onChange={(e) => onChange({ kind: 'url', url: e.target.value })} />
      break
    default:
      detail = <div className="flex h-8 items-center text-[12.5px] text-fg-3">No settings needed</div>
  }
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-[140px_1fr]' : 'sm:grid-cols-[160px_1fr]')}>
      <Select inputSize="sm" value={value.kind} onChange={(e) => onChange(defaultTarget(e.target.value as StorefrontTarget['kind'], config, catOptions[0]?.value, svcOptions[0]?.value))} options={TARGET_KINDS} aria-label="Link type" />
      {detail}
    </div>
  )
}

export function ServicePicker({ value, onChange, imeiOnly }: { value: string; onChange: (id: string) => void; imeiOnly?: boolean }) {
  const services = useServices()
  const list = (services.data ?? []).filter((s) => s.service.visibility.storefront)
  const current = list.find((s) => s.service.id === value)
  return (
    <div className="grid gap-1">
      <Select
        inputSize="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: '', label: services.isLoading ? 'Loading services…' : 'Select a service…' }, ...list.map((s) => ({ value: s.service.id, label: `${s.service.name} · ${s.categoryName}` }))]}
      />
      {current && (
        <span className={cn('text-[11.5px]', current.available ? 'text-fg-3' : 'text-warning')}>
          {current.service.code} · {current.available ? 'available' : 'currently unavailable — storefront shows “Temporarily unavailable”'}
          {imeiOnly && ' · needs an IMEI field'}
        </span>
      )}
    </div>
  )
}
