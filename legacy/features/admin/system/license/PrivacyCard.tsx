import { ArrowUpRight, EyeOff, Lock, X } from 'lucide-react'
import { Button, Card, CardHeader, CodeBlock } from '@/components/ui'
import type { InstallationLicense } from '@/types/installation'

const NEVER = ['Orders, IMEI numbers and results', 'Resellers, balances and pricing', 'Supplier credentials and API keys', 'Users of this installation', 'Database contents and backups']

export function PrivacyCard({ license, version }: { license: InstallationLicense | undefined; version?: string }) {
  const payload = JSON.stringify(
    {
      license_id: license?.licenseId ?? 'LIC-…',
      installation_id: license?.installationId ?? 'inst_…',
      domain: license?.domain ?? '…',
      version: version ?? '…',
    },
    null,
    2,
  )
  return (
    <Card>
      <CardHeader icon={<EyeOff />} title="What validation sends" description="Customer data never leaves your installation." />
      <div className="space-y-4 px-5 pb-5">
        <CodeBlock code={payload} lang="json" title={`POST ${license?.validation.licenseServer.replace('https://', '') ?? 'license server'}/v1/validate`} />
        <div>
          <div className="mono-label mb-2">Never sent</div>
          <ul className="space-y-1.5">
            {NEVER.map((n) => (
              <li key={n} className="flex items-center gap-2 text-[12.5px] text-fg-2">
                <X className="size-3.5 shrink-0 text-fg-3" />
                {n}
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-start gap-2 text-[12px] text-fg-3">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          The response is a signed validation token — ORVEX Core verifies it with the bundled public key before caching it.
        </p>
      </div>
    </Card>
  )
}

export function VendorCard() {
  return (
    <Card className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-hatch [mask-image:linear-gradient(90deg,transparent,#000)]" />
      <div className="relative p-5">
        <div className="mono-label">ORVEX Systems · account.orvex.io</div>
        <p className="mt-1.5 text-[14px] font-semibold text-fg">Subscription & billing</p>
        <p className="mt-1 text-[12.5px] text-fg-3">Plan changes, renewals and invoices are managed in your ORVEX Systems account — separate from this installation, its users and its data.</p>
        <Button className="mt-4" variant="secondary" size="sm" to="/account/license" trailing={<ArrowUpRight />}>
          Manage subscription
        </Button>
      </div>
    </Card>
  )
}
