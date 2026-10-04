import { Check, Lock } from 'lucide-react'
import { Card, CardHeader, Meter, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { AdminUser, InstallationLicense } from '@/types/installation'

export function EntitlementsCard({ license, users }: { license: InstallationLicense | undefined; users: AdminUser[] | undefined }) {
  const included = license?.modules.filter((m) => m.included) ?? []
  const excluded = license?.modules.filter((m) => !m.included) ?? []
  const seatLimit = Number.parseInt(license?.limits.find((l) => /admin users/i.test(l.label))?.value ?? '', 10)
  const seatsUsed = users?.filter((u) => u.status !== 'disabled').length

  return (
    <Card className="h-full">
      <CardHeader title="Entitlements" description={license ? `${license.plan} plan · modules and limits enforced locally from the signed license` : 'Loading…'} />
      {!license ? (
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 px-5 pb-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <div className="mono-label mb-2.5">Modules</div>
            <ul className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              {[...included, ...excluded].map((m) => (
                <li key={m.id} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px]', m.included ? 'border-line bg-surface' : 'border-dashed border-line text-fg-3')}>
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', m.included ? 'bg-success/15 text-success' : 'bg-surface-2 text-fg-3')}>
                    {m.included ? <Check className="size-3" strokeWidth={3} /> : <Lock className="size-2.5" />}
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate', m.included ? 'text-fg' : 'text-fg-3')}>{m.name}</span>
                  {!m.included && <span className="shrink-0 text-[11px] text-fg-3">Not included</span>}
                </li>
              ))}
            </ul>
            {excluded.length > 0 && <p className="mt-2.5 text-[12px] text-fg-3">Additional modules become available when you upgrade your plan in your ORVEX Systems account — a new signed license is issued, no reinstall.</p>}
          </div>
          <div>
            <div className="mono-label mb-2.5">Limits</div>
            <dl className="divide-y divide-line rounded-xl border border-line">
              {license.limits.map((l) => (
                <div key={l.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <dt className="text-[12.5px] text-fg-2">{l.label}</dt>
                  <dd className="font-mono text-[12.5px] text-fg tabular">{l.value}</dd>
                </div>
              ))}
            </dl>
            {Number.isFinite(seatLimit) && seatsUsed != null && <Meter className="mt-4" label="Admin seats in use" value={seatsUsed} max={seatLimit} />}
          </div>
        </div>
      )}
    </Card>
  )
}
