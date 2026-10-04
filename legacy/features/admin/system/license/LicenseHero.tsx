import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { CalendarClock } from 'lucide-react'
import { Badge, Card, MonoValue, SecretField, Skeleton, StatusBadge } from '@/components/ui'
import { LogoMark } from '@/components/brand'
import { date, num, relative } from '@/lib/format'
import type { InstallationLicense } from '@/types/installation'

const DAY = 86400_000

export function LicenseHero({ license, coreVersion }: { license: InstallationLicense | undefined; coreVersion?: string }) {
  if (!license) return <HeroSkeleton />
  const start = new Date(license.activatedAt).getTime()
  const end = new Date(license.updatesUntil).getTime()
  const total = Math.max(1, end - start)
  const left = Math.max(0, end - Date.now())
  const daysLeft = Math.ceil(left / DAY)
  const remainingRatio = left / total
  const elapsedRatio = 1 - remainingRatio

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
                <StatusBadge status={license.status} size="md" />
                <Badge tone="neutral" variant="outline" size="md">
                  ORVEX Core {license.licensedVersion}
                </Badge>
                {coreVersion && <span className="text-[12px] text-fg-3">running {coreVersion}</span>}
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="mono-label">Licensed to</div>
            <p className="mt-1 text-[14px] font-medium text-fg">{license.customer}</p>
            <p className="font-mono text-[12px] text-fg-3">{license.domain}</p>
          </div>
        </div>

        {/* Spec sheet */}
        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          <Item label="License ID">
            <MonoValue value={license.licenseId} className="text-[13px] text-fg" />
          </Item>
          <Item label="Domain">
            <MonoValue value={license.domain} className="text-[13px] text-fg" />
          </Item>
          <Item label="Installation ID">
            <MonoValue value={license.installationId} className="text-[13px] text-fg" />
          </Item>
          <Item label="Activated">
            <span className="text-[13.5px] text-fg">{date(license.activatedAt)}</span>
          </Item>
          <Item label="Expires">
            <span className="text-[13.5px] text-fg">{date(license.expiresAt)}</span>
            <span className="ml-1.5 truncate text-[12px] text-fg-3">{relative(license.expiresAt)}</span>
          </Item>
          <Item label="Licensed version">
            <span className="text-[13.5px] text-fg">{license.licensedVersion} · all 2.x releases</span>
          </Item>
        </dl>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mono-label mb-1.5">License key</div>
            <SecretField masked={license.licenseKeyMasked} label="The license key" />
            <p className="mt-1.5 text-[11.5px] text-fg-3">Stored in the LICENSE_KEY environment variable — never returned by the API.</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="mono-label">Update eligibility</span>
              <span className="text-[12px] text-fg-3 tabular">{num(daysLeft)} days left</span>
            </div>
            <div className="flex items-center gap-2 text-[13.5px] text-fg">
              <CalendarClock className="size-4 text-fg-3" />
              Updates included until <span className="font-medium">{date(license.updatesUntil)}</span>
            </div>
            {/* Term track: elapsed in graphite ink, remaining as hatched track, today marked */}
            <div className="relative mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-hatch shadow-[inset_0_0_0_1px_var(--line)]">
                <motion.div className="h-full rounded-full bg-accent-2/80" initial={{ width: 0 }} animate={{ width: `${elapsedRatio * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
              </div>
              <motion.span aria-hidden className="absolute -top-1 h-3.5 w-px bg-fg" initial={{ left: 0, opacity: 0 }} animate={{ left: `${elapsedRatio * 100}%`, opacity: 1 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <div className="mt-1.5 flex justify-between gap-2 font-mono text-[10.5px] text-fg-3">
              <span>{date(license.activatedAt)}</span>
              <span className="hidden sm:inline">{Math.round(remainingRatio * 100)}% of term remaining</span>
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

function HeroSkeleton() {
  return (
    <Card className="h-full p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="size-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-9 w-full" />
    </Card>
  )
}
