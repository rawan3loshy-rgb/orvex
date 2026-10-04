import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CircleCheck, Database, Equal, FileKey, Plus, Puzzle, ShieldCheck, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { Badge, Card, CodeBlock, ConfirmDialog, Drawer, EmptyState, PageHeader, StatusBadge, Switch } from '@/components/ui'
import { Guarded, PermissionHint } from '@/components/domain'
import { LogoMark, TenantMark } from '@/components/brand'
import { useInstallation, useInstMutation, useUpdates } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { date } from '@/lib/format'
import type { InstalledExtension } from '@/types/extensions'
import { CardSkeleton, QueryError } from './shared'

const GROUPS: { id: string; title: string; description: string; match: (e: InstalledExtension) => boolean }[] = [
  { id: 'drivers', title: 'Supplier drivers', description: 'Implement the SupplierDriver port — Core never talks to a supplier directly.', match: (e) => e.source !== 'custom' && e.kind === 'supplier-driver' },
  { id: 'packs', title: 'Vertical pack (GSM)', description: 'Field types (IMEI + Luhn, serial, carrier), result schemas and service templates.', match: (e) => e.source !== 'custom' && e.kind === 'vertical-pack' },
  { id: 'payments', title: 'Payment gateways', description: 'Gateway modules post to the ledger through Core — simulated in this demo.', match: (e) => e.source !== 'custom' && e.kind === 'payment-gateway' },
  { id: 'themes', title: 'Themes & website components', description: 'Storefront rendering — typed blocks, catalog-driven.', match: (e) => e.source !== 'custom' && (e.kind === 'theme' || e.kind === 'website-component') },
  { id: 'modules', title: 'Modules & business rules', description: 'Optional features shipped as versioned packages.', match: (e) => e.source !== 'custom' && (e.kind === 'module' || e.kind === 'business-rule' || e.kind === 'service-type') },
  { id: 'custom', title: 'Custom', description: 'Built for this customer. Declares its Core range like every other extension — Core is never forked.', match: (e) => e.source === 'custom' },
]

export default function ExtensionsPage() {
  const installation = useInstallation()
  const updates = useUpdates()
  const [open, setOpen] = useState<InstalledExtension | null>(null)
  const [confirm, setConfirm] = useState<InstalledExtension | null>(null)
  const toggle = useInstMutation((v: { id: string; status: InstalledExtension['status'] }) => systemService.updateExtension(v.id, { status: v.status }), {
    success: (e) => `${e.name} ${e.status === 'enabled' ? 'enabled' : 'disabled'}`,
  })
  const inst = installation.data
  const next = updates.data?.available?.version

  const setStatus = (e: InstalledExtension, enabled: boolean) => {
    if (!enabled) setConfirm(e)
    else toggle.mutate({ id: e.id, status: 'enabled' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Puzzle />}
        eyebrow="System"
        title="Extensions"
        description="Everything specific to a business lives in versioned extensions with a declared Core range — so Core updates never overwrite customisations."
        actions={<PermissionHint permission="system.manage" />}
      />

      <ArchitectureHero coreVersion={inst?.version} count={inst?.extensions.length} custom={inst?.extensions.filter((e) => e.source === 'custom').length} domain={inst?.domain} />

      {installation.isError && !inst ? (
        <QueryError onRetry={() => installation.refetch()} />
      ) : !inst ? (
        <div className="space-y-4">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
        </div>
      ) : inst.extensions.length === 0 ? (
        <Card>
          <EmptyState icon={<Puzzle />} title="No extensions installed" />
        </Card>
      ) : (
        GROUPS.map((g) => {
          const items = inst.extensions.filter(g.match)
          if (!items.length) return null
          return (
            <section key={g.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-semibold">
                  {g.title} <span className="ml-1 font-mono text-[12px] font-normal text-fg-3">{items.length}</span>
                </h2>
                <p className="text-[12.5px] text-fg-3">{g.description}</p>
              </div>
              <Card className="divide-y divide-line">
                {items.map((e) => (
                  <ExtensionRow key={e.id} ext={e} next={next} onOpen={() => setOpen(e)} onToggle={(v) => setStatus(e, v)} busy={toggle.isPending && toggle.variables?.id === e.id} />
                ))}
              </Card>
            </section>
          )
        })
      )}

      <ExtensionDrawer ext={open} next={next} onClose={() => setOpen(null)} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        tone="danger"
        title={`Disable ${confirm?.name}?`}
        description={
          confirm?.kind === 'supplier-driver'
            ? 'Suppliers connected through this driver stop receiving new attempts; orders route to the next eligible offer or wait. In-flight attempts are not affected.'
            : confirm?.kind === 'payment-gateway'
              ? 'Checkout stops offering this payment method. Existing payments and the ledger are not affected.'
              : 'The extension stays installed with its configuration and can be re-enabled at any time.'
        }
        confirmLabel="Disable"
        loading={toggle.isPending}
        onConfirm={() => confirm && toggle.mutate({ id: confirm.id, status: 'disabled' }, { onSettled: () => setConfirm(null) })}
      />
    </div>
  )
}

function ExtensionRow({ ext, next, onOpen, onToggle, busy }: { ext: InstalledExtension; next?: string; onOpen: () => void; onToggle: (v: boolean) => void; busy: boolean }) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-fg hover:underline">{ext.name}</span>
          <span className="font-mono text-[11.5px] text-fg-3">v{ext.version}</span>
          <Badge tone={ext.source === 'custom' ? 'accent' : 'neutral'} variant="outline">
            {ext.source}
          </Badge>
          {ext.status === 'incompatible' && <StatusBadge status="incompatible" />}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-fg-3">{ext.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-fg-3">core {ext.coreRange}</span>
          <span className="text-fg-3">·</span>
          <span className="text-[11.5px] text-fg-3">{ext.author}</span>
          <span className="text-fg-3">·</span>
          {ext.permissions.map((p) => (
            <span key={p} className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[10.5px] text-fg-2">
              {p}
            </span>
          ))}
        </div>
      </button>
      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        {ext.compatibleWithNext ? (
          <Badge tone="success" variant="soft" icon={<CircleCheck />}>
            {next ? `Ready for ${next}` : 'Compatible'}
          </Badge>
        ) : (
          <Badge tone="warning" variant="soft" icon={<TriangleAlert />}>
            {next ? `Not declared for ${next}` : 'Check before update'}
          </Badge>
        )}
        <Guarded permission="system.manage">
          {(allowed) => (
            <div className="flex items-center gap-2">
              <span className="w-14 text-right text-[12px] text-fg-3">{ext.status === 'enabled' ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={ext.status === 'enabled'} onChange={onToggle} disabled={!allowed || busy} label={`Enable ${ext.name}`} />
            </div>
          )}
        </Guarded>
      </div>
    </div>
  )
}

function ExtensionDrawer({ ext, next, onClose }: { ext: InstalledExtension | null; next?: string; onClose: () => void }) {
  const [last, setLast] = useState(ext)
  if (ext && ext !== last) setLast(ext)
  const e = ext ?? last
  return (
    <Drawer open={!!ext} onClose={onClose} width="md" icon={<Puzzle />} title={e?.name} description={e ? `${e.id} · v${e.version}` : undefined}>
      {e && (
        <div className="space-y-5">
          <p className="text-[13.5px] text-fg-2">{e.description}</p>
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            {[
              ['Kind', e.kind],
              ['Source', e.source],
              ['Author', e.author],
              ['Core range', e.coreRange],
              ['Installed', date(e.installedAt)],
              ['Updated', date(e.updatedAt)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line px-3 py-2">
                <div className="mono-label">{k}</div>
                <div className="mt-0.5 truncate text-fg">{v}</div>
              </div>
            ))}
          </div>
          <div className={cn('rounded-xl border p-3.5 text-[12.5px]', e.compatibleWithNext ? 'border-success/30 bg-success/[0.05]' : 'border-warning/30 bg-warning/[0.06]')}>
            {e.compatibleWithNext
              ? `Declares a Core range that includes ${next ?? 'the next release'} — it keeps running after the update.`
              : `Declares ${e.coreRange}, which does not include ${next ?? 'the next release'}. The update preflight warns and disables it until a compatible version is published.`}
          </div>
          <div>
            <div className="mono-label mb-2">Requested capabilities</div>
            <div className="flex flex-wrap gap-1.5">
              {e.permissions.map((p) => (
                <Badge key={p} tone="neutral" variant="outline">
                  {p}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-fg-3">Reviewed on install. Extensions call Core through its ports — they cannot write the ledger or the database directly.</p>
          </div>
          <div>
            <div className="mono-label mb-2">Manifest</div>
            <CodeBlock lang="json" code={JSON.stringify({ id: e.id, name: e.name, kind: e.kind, version: e.version, coreRange: e.coreRange, author: e.author, source: e.source, permissions: e.permissions }, null, 2)} />
          </div>
        </div>
      )}
    </Drawer>
  )
}

/* ------------------------------------------------------------------ */
function ArchitectureHero({ coreVersion, count, custom, domain }: { coreVersion?: string; count?: number; custom?: number; domain?: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-5 border-b border-line p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-end lg:gap-10">
        <div className="max-w-2xl">
          <div className="mono-label">Extension architecture</div>
          <h2 className="mt-1.5 font-display text-[21px] leading-snug font-semibold tracking-[-0.02em] text-fg sm:text-[23px]">
            One Core for every customer. <span className="text-fg-2">Differences live in configuration and extensions — never in a fork.</span>
          </h2>
          <p className="mt-1.5 text-[13.5px] text-fg-2">
            ORVEX Core is replaced as a whole on every signed release. Catalog, pricing, suppliers and routing are configuration in your PostgreSQL. Everything else — supplier drivers, the GSM pack, payment gateways, a custom ERP export — ships as an extension that
            declares which Core versions it supports.
          </p>
        </div>
        <ul className="grid gap-2 text-[12.5px] text-fg-2">
          <HeroFact icon={<FileKey />}>Packages are signed and verified before install.</HeroFact>
          <HeroFact icon={<ShieldCheck />}>Each extension declares a Core range — checked in every update preflight.</HeroFact>
          <HeroFact icon={<Database />}>Extension configuration lives in your database.</HeroFact>
        </ul>
      </div>
      <div className="grid items-stretch gap-2 bg-bg-subtle/50 p-5 sm:p-6 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.15fr]">
        <Block i={0} n="01" icon={<LogoMark className="size-5" />} title="Core" value={coreVersion ? `ORVEX Core ${coreVersion}` : 'ORVEX Core'} detail="Orders, ledger, routing, catalog. Same code everywhere." />
        <Operator i={1}>
          <Plus />
        </Operator>
        <Block i={2} n="02" icon={<SlidersHorizontal />} title="Configuration" value="Services, pricing, suppliers" detail="Stored in your PostgreSQL. Migrations upgrade it — never reset it." />
        <Operator i={3}>
          <Plus />
        </Operator>
        <Block i={4} n="03" icon={<Puzzle />} title="Extensions" value={count != null ? `${count} installed · ${custom ?? 0} custom` : 'Drivers, packs, gateways'} detail="Versioned packages with a declared Core range." />
        <Operator i={5}>
          <Equal />
        </Operator>
        <Block i={6} n="04" highlight icon={<TenantMark className="size-5 text-[10px]" />} title="Installation" value={domain ?? '—'} detail="Your server, your data — updated independently." />
      </div>
    </Card>
  )
}

function Block({ icon, n, title, value, detail, highlight, i }: { icon: ReactNode; n: string; title: string; value: string; detail: string; highlight?: boolean; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn('relative flex flex-col gap-2.5 overflow-hidden rounded-xl border bg-surface p-3.5 shadow-card sm:flex-row sm:items-center sm:gap-4 xl:flex-col xl:items-stretch xl:gap-2.5', highlight ? 'border-accent/45' : 'border-line')}
    >
      {highlight && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
      <div className="flex items-center gap-2.5 sm:w-52 sm:shrink-0 xl:w-auto">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{icon}</span>
        <span className="mono-label">
          <span className={cn('mr-1.5', highlight ? 'text-accent-ink' : 'text-fg-3/70')}>{n}</span>
          {title}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold text-fg">{value}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{detail}</p>
      </div>
    </motion.div>
  )
}

function Operator({ children, i }: { children: ReactNode; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 + i * 0.06, type: 'spring', stiffness: 400, damping: 22 }} className="relative grid place-items-center py-0.5 xl:px-0.5">
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line-strong xl:hidden" />
      <span aria-hidden className="absolute inset-x-0 top-1/2 hidden h-px -translate-y-1/2 bg-line-strong xl:block" />
      <span className="relative grid size-7 place-items-center rounded-full border border-line bg-surface text-fg-3 [&_svg]:size-3.5">{children}</span>
    </motion.div>
  )
}

function HeroFact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-3">
      {icon}
      <span>{children}</span>
    </li>
  )
}
