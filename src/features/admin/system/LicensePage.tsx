import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BadgeCheck,
  CalendarClock,
  Check,
  CircleCheck,
  CircleSlash,
  CloudOff,
  EyeOff,
  FileKey,
  Globe,
  Infinity as InfinityIcon,
  KeyRound,
  LoaderCircle,
  Minus,
  Power,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, CopyButton, MonoValue, PageHeader, SecretField, Skeleton, StatusBadge } from '@/components/ui'
import { Guarded } from '@/components/domain'
import { LogoMark } from '@/components/brand'
import { useInstallation, useInstMutation, useLicense, useUpdates } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { date, dateTime, num, relative } from '@/lib/format'
import type { InstallationLicense } from '@/types/installation'
import { Callout, CardSkeleton, QueryError } from './shared'
import { useNow, wait } from './helpers'

const DAY = 86400_000

const STATUS_LABEL: Record<InstallationLicense['status'], string> = { active: 'Active', updates_expired: 'Updates expired', grace: 'Grace period', invalid: 'Invalid' }
const STATUS_BADGE: Record<InstallationLicense['status'], string> = { active: 'active', updates_expired: 'warn', grace: 'grace', invalid: 'invalid' }

export default function LicensePage() {
  const license = useLicense()
  const installation = useInstallation()
  const updates = useUpdates()
  const lic = license.data

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BadgeCheck />}
        eyebrow="System"
        title="License"
        description="A signed license for this installation. It is verified on your server; the license server only receives the installation ID, version and domain."
      />

      {license.isError && !lic ? (
        <QueryError onRetry={() => license.refetch()} />
      ) : (
        <>
          {lic?.status === 'updates_expired' && (
            <Callout tone="warning" icon={<TriangleAlert />} title={`Update entitlement ended ${date(lic.updatesUntil)} — this installation keeps running`}>
              Orders, payments, storefront, reseller portal, Native API and the DHRU endpoint work exactly as before on {installation.data?.version ?? 'the installed version'}. New releases
              {updates.data?.available ? ` (like ${updates.data.available.version})` : ''} and vendor support are unavailable until the entitlement is renewed.
            </Callout>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <LicenseHero license={lic} running={installation.data?.version} />
            <ValidationPanel license={lic} />
          </div>

          <EntitlementEndsCard license={lic} running={installation.data?.version} />

          <div className="grid gap-4 lg:grid-cols-3">
            <EntitlementsCard license={lic} />
            <LimitsCard license={lic} />
            <PrivacyCard />
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function LicenseHero({ license, running }: { license: InstallationLicense | undefined; running?: string }) {
  const [now] = useState(() => Date.now())
  if (!license) return <CardSkeleton rows={6} />
  const start = new Date(license.activatedAt).getTime()
  const end = new Date(license.updatesUntil).getTime()
  const total = Math.max(1, end - start)
  const left = Math.max(0, end - now)
  const daysLeft = Math.ceil(left / DAY)
  const elapsedRatio = Math.min(1, 1 - left / total)
  const expired = license.status === 'updates_expired' || left === 0

  return (
    <Card className="h-full overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
              <LogoMark className="size-6" />
            </span>
            <div>
              <div className="mono-label">ORVEX license · {license.licenseId}</div>
              <h2 className="mt-1 font-display text-[28px] leading-none font-semibold tracking-[-0.03em] text-fg">{license.plan}</h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={STATUS_BADGE[license.status]} label={STATUS_LABEL[license.status]} size="md" />
                {license.perpetualUse && (
                  <Badge tone="neutral" variant="outline" size="md" icon={<InfinityIcon />}>
                    Perpetual use · ORVEX Core {license.licensedMajor}
                  </Badge>
                )}
                {running && <span className="text-[12px] text-fg-3">running {running}</span>}
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="mono-label">Licensed to</div>
            <p className="mt-1 text-[14px] font-medium text-fg">{license.customer}</p>
            <p className="font-mono text-[12px] text-fg-3">{license.domain}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          <Item label="Installation ID">
            <MonoValue value={license.installationId} className="text-[13px] text-fg" />
          </Item>
          <Item label="License ID">
            <MonoValue value={license.licenseId} className="text-[13px] text-fg" />
          </Item>
          <Item label="Activated">
            <span className="text-[13.5px] text-fg">{date(license.activatedAt)}</span>
          </Item>
          <Item label="Right to use">
            <span className="text-[13.5px] text-fg">{license.perpetualUse ? `Perpetual — all ${license.licensedMajor} releases installed` : 'Term licence'}</span>
          </Item>
          <Item label="Updates until">
            <span className="text-[13.5px] text-fg">{date(license.updatesUntil)}</span>
          </Item>
          <Item label="Support until">
            <span className="text-[13.5px] text-fg">{date(license.supportUntil)}</span>
          </Item>
        </dl>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mono-label mb-1.5">License key</div>
            <SecretField masked={license.licenseKeyMasked} label="The license key" />
            <p className="mt-1.5 text-[11.5px] text-fg-3">Stored in the LICENSE_KEY environment variable on your server — never returned by the API.</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="mono-label">Updates & support</span>
              <span className={cn('text-[12px] tabular', expired ? 'text-warning' : 'text-fg-3')}>{expired ? 'ended' : `${num(daysLeft)} days left`}</span>
            </div>
            <div className="flex items-center gap-2 text-[13.5px] text-fg">
              <CalendarClock className="size-4 text-fg-3" />
              {expired ? 'Ended' : 'Included until'} <span className="font-medium">{date(license.updatesUntil)}</span>
            </div>
            <div className="relative mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-hatch shadow-[inset_0_0_0_1px_var(--line)]">
                <motion.div className={cn('h-full rounded-full', expired ? 'bg-warning' : 'bg-accent-2/80')} initial={{ width: 0 }} animate={{ width: `${(expired ? 1 : elapsedRatio) * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </div>
            <div className="mt-1.5 flex justify-between gap-2 font-mono text-[10.5px] text-fg-3">
              <span>{date(license.activatedAt)}</span>
              <span>{date(license.updatesUntil)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-3.5 py-3">
      <dt className="mono-label">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-baseline">{children}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
type Phase = 'idle' | 'local' | 'remote' | 'done'
const PHASES: { id: Exclude<Phase, 'idle'>; label: string; icon: typeof FileKey }[] = [
  { id: 'local', label: 'Verify Ed25519 signature locally', icon: FileKey },
  { id: 'remote', label: 'Check in with license server (simulated)', icon: Globe },
  { id: 'done', label: 'Refresh validation cache', icon: CircleCheck },
]

function ValidationPanel({ license }: { license: InstallationLicense | undefined }) {
  useNow(15_000)
  const [phase, setPhase] = useState<Phase>('idle')
  const validate = useInstMutation(() => systemService.validateLicense(), { success: 'License validated', error: 'License validation failed' })

  const run = async () => {
    if (phase !== 'idle') return
    setPhase('local')
    await wait(700)
    setPhase('remote')
    try {
      await Promise.all([validate.mutateAsync(), wait(900)])
      setPhase('done')
      await wait(1800)
    } catch {
      /* toast handled by the mutation */
    }
    setPhase('idle')
  }

  if (!license) {
    return (
      <Card className="h-full p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </Card>
    )
  }
  const v = license.validation
  const online = v.mode === 'online'
  const busy = phase !== 'idle'
  const phaseIndex = phase === 'idle' ? -1 : PHASES.findIndex((p) => p.id === phase)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Validation"
        description="Signed license, verified on this server"
        actions={
          <Badge tone={online ? 'success' : 'warning'} dot pulse={online} size="md" icon={online ? undefined : <CloudOff />}>
            {online ? 'Online' : 'Cached'}
          </Badge>
        }
      />
      <div className="flex-1 px-5">
        <AnimatePresence mode="wait" initial={false}>
          {busy ? (
            <motion.ol key="run" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-2.5 rounded-xl border border-line bg-surface-2/50 p-4">
              {PHASES.map((p, i) => {
                const state = phaseIndex > i || phase === 'done' ? 'done' : phaseIndex === i ? 'active' : 'pending'
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-full ring-1', state === 'done' ? 'bg-success/15 text-success ring-success/30' : state === 'active' ? 'bg-accent/15 text-accent-ink ring-accent/30' : 'bg-surface text-fg-3 ring-line')}>
                      {state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : state === 'active' ? <LoaderCircle className="size-3.5 animate-spin" /> : <p.icon className="size-3.5" />}
                    </span>
                    <span className={cn('text-[13px]', state === 'pending' ? 'text-fg-3' : 'text-fg')}>{p.label}</span>
                  </li>
                )
              })}
            </motion.ol>
          ) : (
            <motion.dl key="facts" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="divide-y divide-line">
              <Row label="Mode" value={online ? 'Online validation' : 'Cached (offline)'} />
              <Row label="Last validated" value={relative(v.lastValidatedAt)} hint={dateTime(v.lastValidatedAt)} />
              <Row label="Next validation" value={relative(v.nextValidationAt)} />
              <Row label="Offline grace" value={`${v.gracePeriodDays} days`} />
              <Row label="Cache valid until" value={date(v.cacheValidUntil)} />
              <Row label="Signature" value={<span className="font-mono text-[12px]">{v.signature}</span>} copy={v.signature} />
              <Row label="License server" value={<span className="font-mono text-[12px]">{v.licenseServer.replace('https://', '')}</span>} />
            </motion.dl>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <span className="text-[12px] text-fg-3">If the server is unreachable, the cached validation keeps the installation running.</span>
        <Guarded permission="system.manage">
          {(allowed) => (
            <Button variant="primary" size="sm" onClick={run} disabled={busy || !allowed} leading={<RefreshCw className={cn(busy && phase !== 'done' && 'animate-spin')} />}>
              {phase === 'done' ? 'Validated' : busy ? 'Validating…' : 'Validate now'}
            </Button>
          )}
        </Guarded>
      </div>
    </Card>
  )
}

function Row({ label, value, hint, copy }: { label: string; value: ReactNode; hint?: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[12.5px] text-fg-3">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 text-right text-[13px] text-fg">
        <span className="min-w-0 truncate" title={hint}>
          {value}
        </span>
        {copy && <CopyButton value={copy} />}
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function EntitlementEndsCard({ license, running }: { license: InstallationLicense | undefined; running?: string }) {
  const until = license ? date(license.updatesUntil) : '31 Dec 2026'
  const version = running ?? 'the installed version'
  const cols: { title: string; tone: 'success' | 'warning' | 'neutral'; icon: ReactNode; items: string[] }[] = [
    {
      title: 'Keeps working',
      tone: 'success',
      icon: <CircleCheck />,
      items: [`ORVEX Core ${version} keeps running — perpetual right to use`, 'Orders from storefront, portal, Native API and DHRU endpoint', 'Payments, wallets, ledger, refunds and reconciliation', 'Your PostgreSQL data — always yours, always on your server'],
    },
    {
      title: 'Becomes unavailable',
      tone: 'warning',
      icon: <Minus />,
      items: ['Installing new releases (feature and security updates)', 'Vendor support tickets', 'New official extensions that need a newer Core'],
    },
    {
      title: 'Never happens',
      tone: 'neutral',
      icon: <X />,
      items: ['No shutdown, read-only mode or remote kill switch', 'No data is deleted, exported or locked', 'No access to your installation by the vendor'],
    },
  ]
  const toneCls = { success: 'text-success bg-success/10', warning: 'text-warning bg-warning/12', neutral: 'text-fg-2 bg-surface-3' }
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="max-w-2xl">
          <div className="mono-label">Licensing principle</div>
          <h2 className="mt-1.5 font-display text-[20px] leading-snug font-semibold tracking-[-0.02em] text-fg sm:text-[22px]">
            What happens when the update entitlement ends <span className="text-fg-2">({until})</span>
          </h2>
          <p className="mt-1 text-[13.5px] text-fg-2">Your business keeps operating. Expiry only stops new releases — never operations.</p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-fg-3">
          <Power className="size-3.5" /> Operations: <span className="font-medium text-success">continue</span>
        </div>
      </div>
      <div className="grid gap-px bg-line md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.title} className="bg-surface p-5">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
              <span className={cn('grid size-6 place-items-center rounded-md [&_svg]:size-3.5', toneCls[c.tone])}>{c.icon}</span>
              {c.title}
            </p>
            <ul className="mt-3 space-y-2">
              {c.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-[12.5px] text-fg-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-3" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line bg-surface-2/40 px-5 py-3.5 text-[12px] text-fg-3 sm:px-6">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-accent" /> Today — updates included
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-warning" /> {until} — entitlement ends, {version} keeps running
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-success" /> Renewal — install the latest release; data and configuration carry over
        </span>
      </div>
    </Card>
  )
}

function EntitlementsCard({ license }: { license: InstallationLicense | undefined }) {
  if (!license) return <CardSkeleton />
  return (
    <Card>
      <CardHeader icon={<ShieldCheck />} title="Entitlements" description={`${license.entitlements.filter((e) => e.included).length} of ${license.entitlements.length} included in ${license.plan}`} />
      <ul className="divide-y divide-line px-5 pb-3">
        {license.entitlements.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2">
            <span className={cn('text-[13px]', e.included ? 'text-fg' : 'text-fg-3')}>{e.name}</span>
            {e.included ? <CircleCheck className="size-4 shrink-0 text-success" /> : <CircleSlash className="size-4 shrink-0 text-fg-3" />}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function LimitsCard({ license }: { license: InstallationLicense | undefined }) {
  if (!license) return <CardSkeleton />
  return (
    <Card>
      <CardHeader icon={<Server />} title="Limits" description="Enforced by the signed license file" />
      <dl className="divide-y divide-line px-5 pb-3">
        {license.limits.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[12.5px] text-fg-3">{l.label}</dt>
            <dd className="font-mono text-[13px] text-fg">{l.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function PrivacyCard() {
  return (
    <Card>
      <CardHeader icon={<EyeOff />} title="What the license server sees" description="Outbound-only check, HTTPS" />
      <div className="space-y-3 px-5 pb-5 text-[12.5px]">
        <div>
          <p className="mono-label mb-1.5">Sent</p>
          <ul className="space-y-1 text-fg-2">
            {['Installation ID and license ID', 'Installed version', 'Domain'].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <KeyRound className="size-3.5 text-fg-3" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mono-label mb-1.5">Never sent</p>
          <ul className="space-y-1 text-fg-2">
            {['Orders, customers, IMEIs or results', 'Ledger, wallets, payments', 'Supplier credentials or API keys'].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <X className="size-3.5 text-fg-3" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
