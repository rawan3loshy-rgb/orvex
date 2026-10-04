import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  BadgeCheck,
  CircleCheck,
  CloudOff,
  Download,
  FileKey,
  Globe,
  Infinity as InfinityIcon,
  KeyRound,
  Link2,
  Lock,
  RefreshCw,
  Scale,
  Server,
  ShieldCheck,
  Signature,
  Timer,
} from 'lucide-react'
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, CodeBlock, CopyButton, DescriptionList, MonoValue, PageHeader, Progress, SecretField, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { usePlans, useVendorLicense } from '@/hooks/vendor'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { date, dateTime, plural } from '@/lib/format'
import type { VendorLicense } from '@/types/vendor'
import { CardSkeleton, EnvBadge, Heartbeat, IconTile, Reveal, SignalRings, TopGlow } from './components/kit'
import { daysBetween, daysUntil, EASE, periodProgress } from './components/kitUtils'
import { NewTicketModal } from './components/NewTicketModal'

function licensePayload(l: VendorLicense) {
  return JSON.stringify(
    {
      license_id: l.id,
      licensee: 'UnlockDesk Demo Ltd.',
      plan: l.plan.toLowerCase(),
      max_installations: l.maxInstallations,
      domains: l.licensedDomains,
      modules: l.modules.filter((m) => m.included).map((m) => m.id),
      licensed_version: l.licensedVersion,
      installations: l.installations.map((i) => i.id),
      issued_at: l.issuedAt,
      perpetual_use: true,
      updates_until: l.updatesUntil,
      support_until: l.updatesUntil,
      validation: { interval_hours: 24, offline_cache_days: 30, enforcement: 'notice_only' },
      issuer: l.signature.issuedBy,
      key_id: l.signature.publicKeyId,
      signature: `${l.signature.algorithm.toLowerCase()}:Rk3v…Q8aZ`,
    },
    null,
    2,
  )
}

const HOW = [
  {
    icon: <Signature />,
    title: 'Signed license file',
    body: 'Issued by license.orvex.io and signed with Ed25519. Every installation verifies the signature locally with the public key built into Core.',
  },
  {
    icon: <Link2 />,
    title: 'Bound to installation and domain',
    body: 'Activation ties the license to an installation ID (e.g. ORVEX-DEMO-001) and its APP_URL domain. Moving domains is a quick re-bind via support.',
  },
  {
    icon: <RefreshCw />,
    title: 'Metadata-only validation',
    body: 'Every 24 hours each installation sends license ID, installation ID, Core version and domain. Never orders, customers, balances or supplier credentials.',
  },
  {
    icon: <InfinityIcon />,
    title: 'Perpetual use',
    body: 'The right to run the versions you installed never expires. When the update entitlement ends, only newer releases become unavailable — operations never stop.',
  },
  {
    icon: <Scale />,
    title: 'No kill switch',
    body: 'No DRM, no remote shutdown. If validation fails for a long time the admin shows a notice and update downloads pause — orders, payments and the storefront keep running.',
  },
]

type StageTone = 'success' | 'warning' | 'neutral'

const STAGES_ENTITLEMENT: { tone: StageTone; label: string; detail: string; icon: ReactNode }[] = [
  { tone: 'success', label: 'Entitled', detail: 'All releases and security patches for Core 2.x can be installed.', icon: <CircleCheck /> },
  { tone: 'neutral', label: 'Updates expired', detail: 'Everything keeps operating on the installed version. New releases are not offered.', icon: <InfinityIcon /> },
  { tone: 'success', label: 'Renewed', detail: 'Renew any time and update straight to the latest release.', icon: <RefreshCw /> },
]

const STAGES_OFFLINE: { tone: StageTone; label: string; detail: string; icon: ReactNode }[] = [
  { tone: 'success', label: 'Validated', detail: 'Last check succeeded. Cached locally and re-checked every 24h.', icon: <CircleCheck /> },
  { tone: 'warning', label: 'Cached · 30 days', detail: 'Everything keeps working from the cached validation. The admin retries hourly.', icon: <Timer /> },
  { tone: 'neutral', label: 'Notice', detail: 'Orders and payments continue. The admin shows a notice; update downloads pause until validation succeeds.', icon: <CloudOff /> },
]

function Stage({ tone, label, detail, icon }: { tone: StageTone; label: string; detail: string; icon: ReactNode }) {
  return (
    <div>
      <div className={cn('h-1.5 rounded-full', tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-fg/15')} />
      <div className="mt-3 flex items-start gap-2">
        <span className={cn('mt-0.5 [&_svg]:size-3.5', tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-fg-3')}>{icon}</span>
        <div>
          <p className="text-[12.5px] font-medium text-fg">{label}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{detail}</p>
        </div>
      </div>
    </div>
  )
}

export default function LicensePage() {
  const q = useVendorLicense()
  const plans = usePlans()
  const [ticketOpen, setTicketOpen] = useState(false)
  const l = q.data
  const enterpriseModules = plans.data?.find((p) => p.id === 'enterprise')?.modules ?? []
  const termPct = l ? periodProgress(l.activatedAt, l.updatesUntil) : 0
  const termDays = l ? daysBetween(l.activatedAt, l.updatesUntil) : 0
  const left = l ? Math.max(0, daysUntil(l.updatesUntil)) : 0
  const used = l?.installations.length ?? 0

  const download = () => l && toast.success('Demo: license file generated', `${l.id}.lic — signed ${l.signature.algorithm}, key ${l.signature.publicKeyId}. Upload it in System → License on your installation.`)

  return (
    <div>
      <Reveal>
        <PageHeader
          eyebrow={
            l ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-[12px]">
                <FileKey className="size-3.5" /> {l.id}
              </span>
            ) : undefined
          }
          title="License"
          description="Your signed ORVEX Core license. The right to run installed versions is perpetual; the update & support entitlement runs until the date below. Nothing on your installation stops when it passes."
          actions={
            <>
              {l && (
                <Button variant="secondary" leading={<Globe />} onClick={() => setTicketOpen(true)}>
                  Change domains
                </Button>
              )}
              <Button variant="primary" leading={<Download />} onClick={download} disabled={!l}>
                Download license file
              </Button>
            </>
          }
        />
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* License certificate */}
        <Reveal delay={0.05} className="lg:col-span-2">
          {l ? (
            <Card className="relative h-full overflow-hidden">
              <TopGlow />
              <SignalRings className="absolute -top-12 -right-24 h-60 w-[440px] text-fg-3 opacity-50 mask-fade-b" count={7} node={3} />
              <div className="relative p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <IconTile icon={<KeyRound />} tone="accent" size="lg" />
                    <div>
                      <p className="mono-label">ORVEX Core license</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2.5">
                        <h2 className="font-mono text-[22px] leading-none font-semibold tracking-tight text-fg">{l.id}</h2>
                        <StatusBadge status={l.status} />
                      </div>
                      <p className="mt-2 text-[13px] text-fg-2">
                        {l.plan} plan · UnlockDesk Demo Ltd. · licensed for Core {l.licensedVersion}
                      </p>
                    </div>
                  </div>
                  <Badge tone="success" icon={<BadgeCheck />} size="md">
                    Signature valid
                  </Badge>
                </div>

                <div className="mt-6">
                  <p className="mb-1.5 text-[12.5px] font-medium text-fg">License key</p>
                  <SecretField revealable value={l.key} masked={l.keyMasked} className="h-10 max-w-md" />
                  <p className="mt-1.5 text-[12px] text-fg-3">Used as LICENSE_KEY when deploying an installation. Treat it like a password.</p>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-[12px] text-fg-3">
                    <span>Update & support entitlement</span>
                    <span className="tabular">{plural(left, 'day')} of updates remaining</span>
                  </div>
                  <div className="relative">
                    <Progress value={termPct * 100} />
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5, ease: EASE }}
                      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_20%,transparent)]"
                      style={{ left: `${termPct * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11.5px] text-fg-3 tabular">
                    <span>Activated {date(l.activatedAt)}</span>
                    <span>
                      Day {Math.round(termPct * termDays)} of {termDays}
                    </span>
                    <span>Updates until {date(l.updatesUntil)}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-3 rounded-xl border border-success/25 bg-success/[0.05] px-3.5 py-3">
                  <InfinityIcon className="mt-0.5 size-4 shrink-0 text-success" />
                  <p className="text-[12.5px] leading-relaxed text-fg-2">
                    <span className="font-medium text-fg">Perpetual use of installed versions.</span> After {date(l.updatesUntil)} your installations keep running the Core version they have — orders, payments, storefront, reseller portal and API included. Only releases published after that date become unavailable until you renew.
                  </p>
                </div>

                <DescriptionList
                  className="mt-6"
                  columns={2}
                  items={[
                    { label: 'Issued', value: date(l.issuedAt) },
                    { label: 'Activated', value: dateTime(l.activatedAt) },
                    { label: 'Right to use', value: 'Perpetual · installed versions' },
                    { label: 'Updates & support until', value: date(l.updatesUntil) },
                    { label: 'Licensed version', value: `Core ${l.licensedVersion}`, mono: true },
                    { label: 'Plan', value: l.plan },
                  ]}
                />
              </div>
            </Card>
          ) : (
            <CardSkeleton rows={9} className="h-full" />
          )}
        </Reveal>

        {/* Installations bound */}
        <Reveal delay={0.1}>
          {l ? (
            <Card className="flex h-full flex-col">
              <CardHeader icon={<Server />} title="Installations bound" description="Activations against this license" />
              <CardBody className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[34px] leading-none font-semibold tracking-[-0.03em] text-fg tabular">{used}</span>
                  <span className="text-[14px] text-fg-3">of {l.maxInstallations} slots</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  {Array.from({ length: l.maxInstallations }, (_, i) => (
                    <motion.span
                      key={i}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.2 + i * 0.12, duration: 0.5, ease: EASE }}
                      className={cn('h-1.5 flex-1 origin-left rounded-full', i < used ? 'bg-accent' : 'bg-fg/[0.08]')}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-fg-3">{used >= l.maxInstallations ? 'All slots in use. Deactivate one or upgrade to add another.' : `${l.maxInstallations - used} slot available.`}</p>
                <div className="mt-5 space-y-2">
                  {l.installations.map((i) => (
                    <div key={i.id} className="rounded-lg border border-line px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-medium text-fg">{i.name}</p>
                        <EnvBadge env={i.environment} />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-2">{i.domain}</p>
                      <Heartbeat status={i.status} at={i.lastHeartbeatAt} className="mt-1 text-[11.5px]" />
                    </div>
                  ))}
                </div>
              </CardBody>
              <CardFooter>
                <span>Installation IDs are fingerprinted at activation.</span>
              </CardFooter>
            </Card>
          ) : (
            <CardSkeleton rows={6} className="h-full" />
          )}
        </Reveal>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Modules */}
        <Reveal delay={0.15} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader icon={<ShieldCheck />} title="Modules" description="What this license enables inside Core" />
            <CardBody>
              {l ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {l.modules.map((m) => (
                    <div key={m.id} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5', m.included ? 'border-line' : 'border-dashed border-line bg-surface-2/40')}>
                      {m.included ? <CircleCheck className="size-4 shrink-0 text-success" /> : <Lock className="size-4 shrink-0 text-fg-3" />}
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-[13px]', m.included ? 'font-medium text-fg' : 'text-fg-3')}>{m.name}</p>
                        <p className="truncate font-mono text-[10.5px] text-fg-3">{m.id}</p>
                      </div>
                      {!m.included && enterpriseModules.includes(m.id) && (
                        <Badge tone="neutral" variant="outline">
                          Enterprise
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-[52px] rounded-lg" />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </Reveal>

        {/* Domains */}
        <Reveal delay={0.18}>
          <Card className="flex h-full flex-col">
            <CardHeader icon={<Globe />} title="Licensed domains" description="Core only activates on these hosts" />
            <CardBody className="flex-1 space-y-2">
              {l
                ? l.licensedDomains.map((d) => {
                    const inst = l.installations.find((i) => i.domain === d)
                    return (
                      <div key={d} className="group flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                        <Globe className="size-4 shrink-0 text-fg-3" />
                        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{d}</span>
                        {inst && <EnvBadge env={inst.environment} />}
                        <CopyButton value={d} className="opacity-0 group-hover:opacity-100" />
                      </div>
                    )
                  })
                : Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
            </CardBody>
            <CardFooter>
              <button type="button" onClick={() => setTicketOpen(true)} className="font-medium text-fg-2 hover:text-fg">
                Request a domain change
              </button>
              <span>~1 business day</span>
            </CardFooter>
          </Card>
        </Reveal>
      </div>

      {/* Signature */}
      <Reveal delay={0.2} className="mt-5">
        <Card>
          <CardHeader icon={<Signature />} title="Signature" description="How your installation knows this license is genuine" />
          <CardBody>
            {l ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <div>
                  <DescriptionList
                    items={[
                      { label: 'Algorithm', value: l.signature.algorithm },
                      { label: 'Public key ID', value: <MonoValue value={l.signature.publicKeyId} /> },
                      { label: 'Issuer', value: <MonoValue value={l.signature.issuedBy} /> },
                      { label: 'Format', value: 'Signed JSON (.lic)' },
                      { label: 'Verification', value: 'Offline, on every boot' },
                    ]}
                  />
                  <p className="mt-3 text-[12px] leading-relaxed text-fg-3">The public key ships inside Core, so verification works without network access. Rotated keys are announced in release notes a full release in advance.</p>
                </div>
                <CodeBlock title={`${l.id}.lic`} lang="json" code={licensePayload(l)} maxHeight={320} />
              </div>
            ) : (
              <Skeleton className="h-64 rounded-xl" />
            )}
          </CardBody>
        </Card>
      </Reveal>

      {/* How licensing works */}
      <Reveal delay={0.25} className="mt-10">
        <div className="mb-4">
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">How licensing works for self-hosted Core</h2>
          <p className="mt-0.5 max-w-2xl text-[13px] text-fg-3">Designed so neither a network hiccup on our side nor a lapsed renewal ever becomes an outage on yours.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {HOW.map((h, i) => (
            <motion.div key={h.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}>
              <Card className="h-full p-4">
                <div className="flex items-center justify-between">
                  <IconTile icon={h.icon} size="sm" tone={i === 3 ? 'accent' : 'neutral'} />
                  <span className="font-mono text-[11px] text-fg-3 tabular">0{i + 1}</span>
                </div>
                <p className="mt-3 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{h.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{h.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card className="p-5">
            <p className="mb-4 text-[13px] font-medium text-fg">When the update entitlement ends</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {STAGES_ENTITLEMENT.map((st) => (
                <Stage key={st.label} {...st} />
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="mb-4 text-[13px] font-medium text-fg">If license.orvex.io can’t be reached</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {STAGES_OFFLINE.map((st) => (
                <Stage key={st.label} {...st} />
              ))}
            </div>
            <Tooltip content="Heartbeats carry only license ID, installation ID, Core version and domain.">
              <p className="mt-4 inline-flex cursor-help items-center gap-1.5 text-[12px] text-fg-3 underline decoration-dotted underline-offset-4">What exactly is sent?</p>
            </Tooltip>
          </Card>
        </div>
      </Reveal>

      <NewTicketModal
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        icon={<Globe />}
        title="Request a domain change"
        description="We re-bind the license and you re-validate from the installation."
        submitLabel="Send request"
        defaults={{
          subject: 'Licensed domain change',
          category: 'Licensing',
          priority: 'low',
          body: `Please update the licensed domains for ${l?.id ?? 'our license'}.\n\nCurrent: ${l?.licensedDomains.join(', ') ?? ''}\nNew: `,
        }}
      />
    </div>
  )
}
