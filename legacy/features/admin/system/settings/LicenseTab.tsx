import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Badge, Button, Card, DescriptionList, StatusBadge } from '@/components/ui'
import { LogoMark } from '@/components/brand'
import { useLicense } from '@/hooks/installation'
import { date, relative } from '@/lib/format'
import { FormSkeleton } from './form'

export function LicenseTab() {
  const license = useLicense()
  const l = license.data
  if (!l) return <FormSkeleton rows={4} />
  const included = l.modules.filter((m) => m.included).length

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
              <LogoMark className="size-5" />
            </span>
            <div>
              <div className="mono-label">ORVEX license</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mt-0.5 font-display text-[20px] font-semibold tracking-[-0.02em] text-fg">{l.plan}</span>
                <StatusBadge status={l.status} />
                <Badge tone="neutral" variant="outline">
                  {l.validation.mode === 'online' ? 'Validated online' : 'Cached validation'}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-[12.5px] text-fg-2">
                {l.licenseId} <span className="font-sans text-fg-3">· {l.customer}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" to="/account/license" trailing={<ArrowUpRight />}>
              Manage subscription
            </Button>
            <Button variant="secondary" to="/admin/system/license" trailing={<ArrowRight />}>
              License details
            </Button>
          </div>
        </div>
        <div className="border-t border-line px-5 py-2">
          <DescriptionList
            columns={2}
            items={[
              { label: 'Domain', value: l.domain, mono: true },
              { label: 'Licensed version', value: `ORVEX Core ${l.licensedVersion}` },
              { label: 'Activated', value: date(l.activatedAt) },
              { label: 'Expires', value: `${date(l.expiresAt)} · ${relative(l.expiresAt)}` },
              { label: 'Updates until', value: date(l.updatesUntil) },
              { label: 'Modules', value: `${included} of ${l.modules.length} included` },
              { label: 'Last validated', value: relative(l.validation.lastValidatedAt) },
              { label: 'Grace period', value: `${l.validation.gracePeriodDays} days if the license server is unreachable` },
            ]}
          />
        </div>
      </Card>
      <p className="text-[12.5px] text-fg-3">The license is a signed file issued by ORVEX Systems and verified on this server. Only the license ID, installation ID, domain and Core version are sent during validation — never orders, IMEIs or reseller data.</p>
    </div>
  )
}
