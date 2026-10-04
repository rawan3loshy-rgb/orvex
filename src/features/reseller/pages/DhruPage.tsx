import { ArrowRight, CircleCheck, KeyRound, PlugZap, TriangleAlert } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CodeBlock, CopyButton, EmptyState, Skeleton } from '@/components/ui'
import { usePortalApiKeys } from '@/hooks/installation'
import { DHRU_MAPPING_TABLE } from '@/core/edge/dhru'
import { relative } from '@/lib/format'
import { ApiSectionHeader, ErrorCard, NoAccess } from '../kit'
import { DHRU_ENDPOINT, usePortalSession } from '../kitUtils'

const DHRU_LABEL: Record<number, string> = { 0: 'New / pending', 1: 'In process', 3: 'Rejected', 4: 'Success' }

export default function DhruPage() {
  const { me, can, role } = usePortalSession()
  const keys = usePortalApiKeys()

  const header = <ApiSectionHeader title="DHRU connection" description="Already integrated with a DHRU Fusion panel? Point it at UnlockDesk — same request format, your UnlockDesk prices and orders." />
  if (me && !can.api)
    return (
      <div>
        {header}
        <NoAccess need="api" role={role} />
      </div>
    )

  const dhruKeys = (keys.data ?? []).filter((k) => k.dhruCompat && k.status === 'active')
  const username = me?.dhruUsername

  return (
    <div>
      {header}
      {!me ? (
        <Skeleton className="h-[180px] rounded-xl" />
      ) : !username ? (
        <Card>
          <EmptyState icon={<TriangleAlert />} title="DHRU access isn’t enabled for your account" description="Ask UnlockDesk to enable the DHRU-compatible channel. Your native API keys keep working either way." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader icon={<PlugZap />} title="Connection settings" description="Enter these in your DHRU panel or POS (server type: DHRU Fusion)." actions={<Badge tone="success" dot>Enabled</Badge>} />
              <dl className="divide-y divide-line border-t border-line">
                <Setting label="API URL" value={DHRU_ENDPOINT} />
                <Setting label="Username" value={username} hint="Your account email" />
                <Setting label="API access key" value={dhruKeys[0] ? `${dhruKeys[0].prefix}_••••${dhruKeys[0].last4}` : 'Create a DHRU-compatible key'} hint="A full key with DHRU compatibility switched on" copy={false} />
                <Setting label="Request format" value="JSON" copy={false} />
              </dl>
            </Card>

            <Card>
              <CardHeader title="Example: place an IMEI order" description="Form-encoded POST, exactly like a DHRU Fusion server." />
              <div className="px-5 pb-5">
                <CodeBlock
                  lang="bash"
                  wrap
                  code={`curl -X POST ${DHRU_ENDPOINT} \\
  -d username=${username} \\
  -d apiaccesskey=orx_live_… \\
  -d action=placeimeiorder \\
  -d requestformat=JSON \\
  --data-urlencode 'parameters=<PARAMETERS><ID>4001</ID><IMEI>356938035643809</IMEI></PARAMETERS>'`}
                />
                <p className="mt-3 text-[12px] text-fg-3">
                  Supported actions: <code className="font-mono">accountinfo</code>, <code className="font-mono">imeiservicelist</code>, <code className="font-mono">placeimeiorder</code>, <code className="font-mono">getimeiorder</code>. The service <code className="font-mono">ID</code> is the service ID shown on the Services page.
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Status codes you’ll receive" description="How UnlockDesk order states map to DHRU status numbers" />
              <ul className="divide-y divide-line border-t border-line">
                {DHRU_MAPPING_TABLE.map((m) => (
                  <li key={m.dhru} className="flex items-start gap-3 px-5 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-[13px] font-semibold ring-1 ring-line">{m.dhru}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{DHRU_LABEL[m.dhru]}</div>
                      <div className="text-[12px] text-fg-3">{m.orvex.map((s) => (s === 'needs_review' ? 'processing (being verified)' : s.replace(/_/g, ' '))).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="min-w-0">
            <Card>
              <CardHeader icon={<KeyRound />} title="DHRU-compatible keys" description="Only these keys are accepted on the DHRU endpoint." />
              {keys.error ? (
                <ErrorCard error={keys.error} onRetry={() => keys.refetch()} className="m-4" />
              ) : keys.isLoading ? (
                <div className="space-y-2 px-5 pb-5">{[0, 1].map((i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : dhruKeys.length ? (
                <ul className="divide-y divide-line border-t border-line">
                  {dhruKeys.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                      <CircleCheck className="size-4 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{k.name}</div>
                        <div className="font-mono text-[11.5px] text-fg-3">
                          {k.prefix}_••••{k.last4}
                        </div>
                      </div>
                      <span className="text-[11.5px] text-fg-3">{k.lastUsedAt ? relative(k.lastUsedAt) : 'never used'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No DHRU-compatible key" description="Create a key and switch on “DHRU-compatible”." />
              )}
              <div className="border-t border-line px-5 py-3">
                <Button to="/portal/api/keys" size="sm" trailing={<ArrowRight />}>
                  Manage keys
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Setting({ label, value, hint, copy = true }: { label: string; value: string; hint?: string; copy?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-[12.5px] text-fg-3">
        {label}
        {hint && <span className="block text-[11px]">{hint}</span>}
      </dt>
      <dd className="flex min-w-0 items-center gap-1 font-mono text-[12.5px] break-all">
        {value}
        {copy && <CopyButton value={value} />}
      </dd>
    </div>
  )
}
