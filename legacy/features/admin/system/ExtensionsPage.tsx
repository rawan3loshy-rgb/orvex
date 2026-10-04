import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Puzzle, SearchX, TriangleAlert } from 'lucide-react'
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, SearchInput, Select, Skeleton, Tabs } from '@/components/ui'
import { useQueryClient } from '@tanstack/react-query'
import { INST, useInstallation, useInstMutation, useProviders, useUpdates } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import type { ExtensionKind, InstalledExtension } from '@/types/extensions'
import type { InstallationInfo } from '@/types/installation'
import { ArchitectureHero } from './extensions/ArchitectureHero'
import { ExtensionRow, KindIcon } from './extensions/ExtensionRow'
import { ExtensionDrawer } from './extensions/ExtensionDrawer'
import { InstallExtensionModal } from './extensions/InstallExtensionModal'
import { authorLabel, KIND_META, KIND_ORDER } from './extensions/meta'
import type { CompatContext } from './extensions/Compat'

type KindFilter = 'all' | ExtensionKind

export default function ExtensionsPage() {
  const installation = useInstallation()
  const updates = useUpdates()
  const providers = useProviders()
  const [kind, setKind] = useState<KindFilter>('all')
  const [source, setSource] = useState<'all' | InstalledExtension['source']>('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [confirm, setConfirm] = useState<{ ext: InstalledExtension; usedBy: string[] } | null>(null)

  const extensions = installation.data?.extensions
  const ctx: CompatContext = { current: installation.data?.version ?? updates.data?.currentVersion ?? '2.4.1', next: updates.data?.available?.version ?? null }

  const qc = useQueryClient()
  const toggle = useInstMutation((v: { id: string; status: InstalledExtension['status'] }) => systemService.updateExtension(v.id, { status: v.status }), {
    success: (d) => `${d.name} ${d.status === 'enabled' ? 'enabled' : 'disabled'}`,
    // Optimistic: flip the switch immediately, roll back on error.
    onMutate: (v) => {
      qc.setQueryData<InstallationInfo>([INST, 'installation'], (old) => (old ? { ...old, extensions: old.extensions.map((e) => (e.id === v.id ? { ...e, status: v.status } : e)) } : old))
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: [INST, 'installation'] })
    },
  })

  const requestToggle = (ext: InstalledExtension, enabled: boolean) => {
    const usedBy = (providers.data ?? []).filter((p) => p.adapterId === ext.id).map((p) => p.name)
    if (!enabled && (usedBy.length || ext.kind === 'business-rule')) {
      setConfirm({ ext, usedBy })
      return
    }
    toggle.mutate({ id: ext.id, status: enabled ? 'enabled' : 'disabled' })
  }

  const counts = useMemo(() => {
    const c: Partial<Record<ExtensionKind, number>> = {}
    for (const e of extensions ?? []) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [extensions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (extensions ?? []).filter(
      (e) =>
        (kind === 'all' || e.kind === kind) &&
        (source === 'all' || e.source === source) &&
        (!q || [e.name, e.id, authorLabel(e.author), e.description, ...e.permissions].some((s) => s.toLowerCase().includes(q))),
    )
  }, [extensions, kind, source, search])

  const groups = useMemo(() => KIND_ORDER.map((k) => ({ kind: k, items: filtered.filter((e) => e.kind === k) })).filter((g) => g.items.length), [filtered])
  const incompatibleNext = (extensions ?? []).filter((e) => ctx.next && !e.compatibleWithNext && e.status !== 'disabled')
  const opened = extensions?.find((e) => e.id === openId) ?? null
  const enabledCount = (extensions ?? []).filter((e) => e.status === 'enabled').length

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Puzzle />}
        title="Extensions"
        description="Supplier adapters (REST/JSON, SOAP/XML for DHRU-compatible gateways, GraphQL), IMEI field types, business rules, modules and themes installed on this ORVEX Core installation."
        actions={
          <Button variant="primary" leading={<Plus />} onClick={() => setInstallOpen(true)}>
            Install extension
          </Button>
        }
      />

      <ArchitectureHero coreVersion={installation.data?.version} extensionCount={extensions?.length} customCount={extensions?.filter((e) => e.source === 'custom').length} domain={installation.data?.domain} />

      <AnimatePresence>
        {incompatibleNext.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="text-[13px]">
                  <p className="font-medium text-fg">
                    {incompatibleNext.map((e) => e.name).join(', ')} {incompatibleNext.length === 1 ? 'is' : 'are'} not compatible with Core {ctx.next}
                  </p>
                  <p className="mt-0.5 text-fg-2">It will be disabled automatically during the update. Everything else keeps working — affected orders fall back to your standard routing rules.</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" to="/admin/system/updates" className="shrink-0">
                View update pre-flight
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 pt-4 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-[14px] font-semibold tracking-[-0.01em]">Installed extensions</h3>
            <p className="mt-0.5 text-[12.5px] text-fg-3">{extensions ? `${extensions.length} installed · ${enabledCount} enabled` : 'Loading…'}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, id, permission…" className="sm:w-[260px]" />
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="sm:w-[150px]"
              options={[
                { value: 'all', label: 'All sources' },
                { value: 'core', label: 'Core' },
                { value: 'official', label: 'Official' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </div>
        </div>
        <Tabs
          className="px-3"
          size="sm"
          value={kind}
          onChange={setKind}
          items={[{ value: 'all' as KindFilter, label: 'All', count: extensions?.length }, ...KIND_ORDER.map((k) => ({ value: k as KindFilter, label: KIND_META[k].plural, count: counts[k] ?? 0 }))]}
        />

        {!extensions ? (
          <div>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="No extensions match"
            description="Try a different kind, source or search term."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setKind('all')
                  setSource('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          groups.map((g) => (
            <div key={g.kind}>
              {kind === 'all' && (
                <div className="flex items-center gap-2.5 border-b border-line bg-bg-subtle/60 px-5 py-2">
                  <KindIcon kind={g.kind} size="sm" />
                  <span className="text-[12.5px] font-medium text-fg">{KIND_META[g.kind].plural}</span>
                  <span className="hidden truncate text-[12px] text-fg-3 sm:inline">· {KIND_META[g.kind].blurb}</span>
                  <span className="ml-auto font-mono text-[11px] text-fg-3">{g.items.length}</span>
                </div>
              )}
              {g.items.map((e, i) => (
                <ExtensionRow
                  key={e.id}
                  ext={e}
                  ctx={ctx}
                  index={i}
                  pending={toggle.isPending && toggle.variables?.id === e.id}
                  onOpen={() => setOpenId(e.id)}
                  onToggle={(on) => requestToggle(e, on)}
                />
              ))}
            </div>
          ))
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12px] text-fg-3">
          <span>Disabling an extension never deletes its configuration.</span>
          <Link to="/admin/system/activity" className="text-accent-ink hover:underline">
            Extension changes in activity →
          </Link>
        </div>
      </Card>

      <ExtensionDrawer ext={opened} ctx={ctx} providers={providers.data ?? []} pending={toggle.isPending && toggle.variables?.id === opened?.id} onClose={() => setOpenId(null)} onToggle={requestToggle} />
      <InstallExtensionModal open={installOpen} onClose={() => setInstallOpen(false)} coreVersion={installation.data?.version} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Disable ${confirm?.ext.name ?? 'extension'}?`}
        description={
          confirm?.usedBy.length
            ? `${confirm.usedBy.join(', ')} ${confirm.usedBy.length === 1 ? 'uses' : 'use'} this adapter. Orders routed to ${confirm.usedBy.length === 1 ? 'it' : 'them'} will fail over to the next supplier in each service’s chain.`
            : 'Routing will fall back to your standard rules while this business rule is disabled.'
        }
        confirmLabel="Disable"
        tone="danger"
        loading={toggle.isPending}
        onConfirm={() => {
          if (!confirm) return
          toggle.mutate({ id: confirm.ext.id, status: 'disabled' }, { onSettled: () => setConfirm(null) })
        }}
      />
    </div>
  )
}
