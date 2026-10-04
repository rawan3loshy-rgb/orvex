import { Link } from 'react-router'
import { CircleCheck, Code, KeyRound, Lock, PlugZap, Settings2, TriangleAlert } from 'lucide-react'
import { Badge, Button, CodeBlock, DescriptionList, Drawer, EmptyState, SectionTitle, StatusBadge } from '@/components/ui'
import { ProviderMark } from '@/components/brand'
import { cn } from '@/lib/cn'
import { date, relative, titleCase } from '@/lib/format'
import type { InstalledExtension } from '@/types/extensions'
import type { Provider } from '@/types/installation'
import { ADAPTER_CONTRACT, ADAPTER_WIRE, authorLabel, KIND_META, PERMISSION_META } from './meta'
import { KindIcon, SourceBadge } from './ExtensionRow'
import { compatFor, type CompatContext } from './Compat'

function manifestOf(ext: InstalledExtension) {
  return JSON.stringify(
    {
      id: ext.id,
      name: ext.name,
      kind: ext.kind,
      version: ext.version,
      coreRange: ext.coreRange,
      author: ext.author,
      source: ext.source,
      description: ext.description,
      permissions: ext.permissions,
      ...(ext.kind === 'provider-adapter' ? { entry: 'dist/adapter.js', implements: 'ProviderAdapter@2' } : { entry: 'dist/index.js' }),
      signature: { algorithm: 'Ed25519', signedBy: ext.source === 'custom' ? 'UnlockDesk Demo Ltd. publisher key' : 'ORVEX Release Key 2026' },
    },
    null,
    2,
  )
}

export function ExtensionDrawer({
  ext,
  ctx,
  providers,
  pending,
  onClose,
  onToggle,
}: {
  ext: InstalledExtension | null
  ctx: CompatContext
  providers: Provider[]
  pending: boolean
  onClose: () => void
  onToggle: (ext: InstalledExtension, enabled: boolean) => void
}) {
  const open = !!ext
  const usedBy = ext ? providers.filter((p) => p.adapterId === ext.id) : []
  const compat = ext ? compatFor(ext, ctx) : null
  const enabled = ext?.status === 'enabled'

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      icon={ext ? <KindIcon kind={ext.kind} size="sm" /> : undefined}
      title={ext?.name}
      description={ext ? <span className="font-mono text-[12px]">{ext.id}</span> : undefined}
      footer={
        ext && (
          <>
            <span className="mr-auto hidden text-[12px] text-fg-3 sm:block">Changes are recorded in the activity log.</span>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {ext.status !== 'incompatible' && (
              <Button variant={enabled ? 'secondary' : 'primary'} loading={pending} onClick={() => onToggle(ext, !enabled)}>
                {enabled ? 'Disable extension' : 'Enable extension'}
              </Button>
            )}
          </>
        )
      }
    >
      {ext && compat && (
        <div className="space-y-7">
          {/* Summary */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ext.status} />
              <SourceBadge source={ext.source} />
              <Badge tone="neutral" variant="outline">
                {KIND_META[ext.kind].label}
              </Badge>
              <span className="font-mono text-[12px] text-fg-2">v{ext.version}</span>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-fg-2">{ext.description}</p>
            <div className={cn('mt-4 flex items-start gap-3 rounded-xl border p-3.5', compat.ok ? 'border-success/25 bg-success/[0.05]' : 'border-warning/30 bg-warning/[0.06]')}>
              {compat.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />}
              <div className="min-w-0 text-[12.5px]">
                <p className="font-medium text-fg">{compat.label}</p>
                <p className="mt-0.5 text-fg-3">{compat.hint}</p>
                {!compat.ok && (
                  <Link to="/admin/system/updates" className="mt-1.5 inline-block text-accent-ink hover:underline">
                    Review update pre-flight checks →
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div>
            <SectionTitle title="Package" />
            <DescriptionList
              columns={2}
              items={[
                { label: 'Version', value: ext.version, mono: true },
                { label: 'Core range', value: ext.coreRange, mono: true },
                { label: 'Author', value: authorLabel(ext.author) },
                { label: 'Source', value: titleCase(ext.source) },
                { label: 'Installed', value: date(ext.installedAt) },
                { label: 'Last updated', value: relative(ext.updatedAt) },
              ]}
            />
          </div>

          <div>
            <SectionTitle title="Permissions" description="Capabilities granted when the extension was installed." />
            {ext.permissions.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {ext.permissions.map((p) => (
                  <li key={p} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-3">
                      <Lock className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-fg">{p}</p>
                      <p className="text-[12px] text-fg-3">{PERMISSION_META[p] ?? 'Custom capability'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[12.5px] text-fg-3">No permissions requested — runs fully sandboxed.</p>
            )}
          </div>

          <div>
            <SectionTitle title="Configuration" description="Values stored in your database. Secrets are never shown." />
            {ext.config && Object.keys(ext.config).length ? (
              <DescriptionList items={Object.entries(ext.config).map(([k, v]) => ({ label: <span className="font-mono text-[12px]">{k}</span>, value: String(v), mono: true }))} />
            ) : (
              <EmptyState compact icon={<Settings2 />} title="No configuration" description="This extension runs with its defaults." className="rounded-xl border border-dashed border-line" />
            )}
          </div>

          {ext.kind === 'provider-adapter' && (
            <div>
              <SectionTitle title="Adapter contract" description="Core never calls a supplier directly — it calls these methods on the adapter." />
              {ADAPTER_WIRE[ext.id] && (
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
                  <span className="mono-label mt-px shrink-0">Wire</span>
                  <p className="text-[12.5px] leading-relaxed text-fg-2">{ADAPTER_WIRE[ext.id]}</p>
                </div>
              )}
              <ul className="overflow-hidden rounded-xl border border-line">
                {ADAPTER_CONTRACT.map((m) => (
                  <li key={m.name} className="flex flex-col gap-1 border-b border-line px-3.5 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
                    <div className="flex shrink-0 items-center gap-2 sm:w-[190px]">
                      <Code className="size-3.5 text-fg-3" />
                      <span className="font-mono text-[12.5px] font-medium text-fg">{m.name}</span>
                      {m.optional && <Badge tone="neutral">optional</Badge>}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[11.5px] text-fg-2">{m.signature}</p>
                      <p className="mt-0.5 text-[12px] text-fg-3">{m.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <p className="mb-2 text-[12.5px] font-medium text-fg">Used by</p>
                {usedBy.length ? (
                  <div className="flex flex-wrap gap-2">
                    {usedBy.map((p) => (
                      <Link key={p.id} to={`/admin/providers/${p.id}`} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-2.5 pl-1 text-[12.5px] text-fg transition-colors hover:border-line-strong">
                        <ProviderMark id={p.id} name={p.name} size="xs" />
                        {p.name}
                        <StatusBadge status={p.status} className="ml-1" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-[12.5px] text-fg-3">
                    <PlugZap className="size-3.5" /> Not used by any provider yet.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <SectionTitle title="Manifest" description="extension.json — verified against the package signature at install time." />
            <CodeBlock code={manifestOf(ext)} lang="json" title="extension.json" maxHeight={340} />
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-fg-3">
              <KeyRound className="size-3" /> Signature verified locally — no call to ORVEX Systems is needed to load an extension.
            </p>
          </div>
        </div>
      )}
    </Drawer>
  )
}
