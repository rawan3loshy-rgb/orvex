import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, CircleCheck, CloudDownload, KeyRound, Lock, PlugZap, TriangleAlert } from 'lucide-react'
import { Button, Field, Input, SecretField, Skeleton } from '@/components/ui'
import { PermissionHint, SimulatedBadge } from '@/components/domain'
import { useDrivers, useInstMutation } from '@/hooks/installation'
import { suppliersService } from '@/services/installation'
import type { DriverId, SupplierView, SyncRun } from '@/types/installation'
import { num } from '@/lib/format'
import { Drawer } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Callout, ConnectionSteps, type TestStep } from '../catalog/kit'
import { DRIVER_CREDENTIAL } from '../catalog/helpers'

type Phase = 'form' | 'testing' | 'done'

export function ConnectSupplierDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const drivers = useDrivers()
  const [driver, setDriver] = useState<DriverId>('dhru_fusion')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('https://')
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [created, setCreated] = useState<SupplierView | null>(null)
  const [steps, setSteps] = useState<TestStep[] | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [animDone, setAnimDone] = useState(false)
  const [syncRun, setSyncRun] = useState<SyncRun | null>(null)

  const cred = DRIVER_CREDENTIAL[driver]
  const test = useInstMutation(suppliersService.test, {
    onSuccess: (r) => {
      setSteps(r.steps)
      setResult({ ok: r.ok, message: r.message })
      setRunKey((k) => k + 1)
    },
    onError: () => setPhase('done'),
  })
  const sync = useInstMutation((id: string) => suppliersService.sync(id), {
    success: (r) => (r.status === 'failed' ? `Sync failed${r.error ? `: ${r.error}` : ''}` : `Catalog fetched — ${r.remoteProducts} services discovered`),
    onSuccess: setSyncRun,
  })
  const connect = useInstMutation(suppliersService.connect, {
    success: (v) => `${v.supplier.name} saved — testing connection`,
    onSuccess: (v) => {
      setCreated(v)
      setSecret('')
      setPhase('testing')
      setSteps(null)
      setAnimDone(false)
      test.mutate(v.supplier.id)
    },
  })

  const reset = () => {
    setPhase('form')
    setCreated(null)
    setSteps(null)
    setResult(null)
    setName('')
    setUrl('https://')
    setUsername('')
    setSecret('')
    setAnimDone(false)
    setSyncRun(null)
  }
  const close = () => {
    onClose()
    setTimeout(reset, 300)
  }

  const urlOk = /^https:\/\/[^\s/]+\.[^\s]+/.test(url)
  const valid = name.trim().length >= 2 && urlOk && (driver === 'manual' || secret.trim().length >= 6)

  return (
    <Drawer
      open={open}
      onClose={close}
      width="lg"
      icon={<PlugZap />}
      title="Connect provider API"
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          ORVEX consumes the provider’s API through a structured adapter. <SimulatedBadge label="Simulated in this demo" />
        </span>
      }
      footer={
        phase === 'form' ? (
          <>
            <PermissionHint permission="suppliers.manage" className="mr-auto" />
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!valid}
              loading={connect.isPending}
              onClick={() => connect.mutate({ name: name.trim(), driver, url: url.trim(), username: username.trim() || null, credentials: secret.trim() ? [{ key: cred.key, label: cred.label, value: secret.trim() }] : [] })}
            >
              Save &amp; test connection
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Close
            </Button>
            {created && (syncRun && syncRun.status !== 'failed' ? (
              <Button variant="accent" trailing={<ArrowRight />} onClick={() => navigate(`/admin/catalog/sync?supplier=${created.supplier.id}&tab=new`)}>
                Review &amp; apply
              </Button>
            ) : (
              <Button variant={animDone && result?.ok ? 'secondary' : 'accent'} trailing={<ArrowRight />} disabled={!animDone && test.isPending} onClick={() => navigate(`/admin/suppliers/${created.supplier.id}`)}>
                Open supplier
              </Button>
            ))}
          </>
        )
      }
    >
      {phase === 'form' ? (
        <div className="grid gap-5">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium">Adapter</div>
            <div className="grid gap-2">
              {drivers.isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              {drivers.data?.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDriver(d.id)}
                  className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors', driver === d.id ? 'border-accent/50 bg-accent/[0.05] ring-3 ring-accent/10' : 'border-line hover:border-line-strong hover:bg-surface-2/50')}
                >
                  <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', driver === d.id ? 'border-accent bg-accent' : 'border-line-strong')}>{driver === d.id && <span className="size-1.5 rounded-full bg-white" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      {d.name} <span className="font-mono text-[11px] text-fg-3">v{d.version}</span>
                    </span>
                    <span className="block text-[12px] text-fg-3">{d.protocol}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-fg-3 tabular">{d.suppliers} connected</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lambda Unlock Supply" />
            </Field>
            <Field label="API URL" error={url.length > 8 && !urlOk ? 'Must be an https:// URL' : undefined}>
              <Input mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder={driver === 'dhru_fusion' ? 'https://supplier.example/api/index.php' : 'https://api.supplier.example/v1'} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {cred.usernameLabel && (
              <Field label={cred.usernameLabel} optional={driver !== 'dhru_fusion'}>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
              </Field>
            )}
            <Field label={cred.label} optional={driver === 'manual'} hint="Write-only — never shown again after saving.">
              <Input type="password" mono leading={<KeyRound />} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={cred.placeholder} autoComplete="new-password" />
            </Field>
          </div>
          <Callout icon={<Lock />} title="Secrets are encrypted and write-only">
            Credentials are encrypted at rest (AES-256-GCM). The API only ever returns a mask; to change a key you replace it. Values are never written to logs or the audit trail.
          </Callout>
          <Callout tone="warning" icon={<TriangleAlert />}>
            Prototype: no real network connection is made. The simulated supplier answers the {cred.label.toLowerCase()} test with realistic timings.
          </Callout>
        </div>
      ) : (
        <div className="grid gap-5">
          {created && (
            <div className="rounded-xl border border-line bg-surface-2/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold">{created.supplier.name}</div>
                  <div className="font-mono text-[11.5px] text-fg-3">{created.supplier.connection.url}</div>
                </div>
                <SimulatedBadge />
              </div>
              {created.supplier.connection.credentials.map((c) => (
                <div key={c.key} className="mt-3">
                  <div className="mb-1 text-[11.5px] text-fg-3">{c.label}</div>
                  <SecretField masked={c.masked} label={c.label} />
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="mb-2 text-[12.5px] font-medium">Test connection · {created?.driver.name}</div>
            <ConnectionSteps steps={steps} pending={test.isPending} runKey={runKey} onDone={() => setAnimDone(true)} />
          </div>
          {animDone && result && (
            <Callout tone={result.ok ? 'success' : 'danger'} icon={result.ok ? <CircleCheck /> : <TriangleAlert />} title={result.ok ? 'Connected (simulated)' : 'Connection test failed'}>
              {result.message} {result.ok && 'Next: sync the provider catalog to discover its services.'}
            </Callout>
          )}
          {animDone && result?.ok && created && (
            <div className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium">Sync catalog</div>
                  <div className="text-[12px] text-fg-3">syncCatalog() fetches the provider’s full service list. Nothing is applied until you review it.</div>
                </div>
                <Button variant={syncRun ? 'secondary' : 'accent'} leading={<CloudDownload />} loading={sync.isPending} onClick={() => sync.mutate(created.supplier.id)}>
                  {syncRun ? 'Sync again' : 'Sync catalog'}
                </Button>
              </div>
              {syncRun && syncRun.status !== 'failed' && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface-2/60 px-2 py-2">
                    <div className="font-display text-[20px] font-semibold tabular">{num(syncRun.remoteProducts)}</div>
                    <div className="text-[11.5px] text-fg-3">services discovered</div>
                  </div>
                  <div className="rounded-lg bg-surface-2/60 px-2 py-2">
                    <div className="font-display text-[20px] font-semibold text-success tabular">{num(syncRun.counts.new)}</div>
                    <div className="text-[11.5px] text-fg-3">new to review</div>
                  </div>
                  <div className="rounded-lg bg-surface-2/60 px-2 py-2">
                    <div className="font-display text-[20px] font-semibold tabular">{num(syncRun.counts.price + syncRun.counts.fields + syncRun.counts.removed)}</div>
                    <div className="text-[11.5px] text-fg-3">changed / removed</div>
                  </div>
                </div>
              )}
              {syncRun?.status === 'failed' && <p className="mt-2 text-[12px] text-danger">{syncRun.error ?? 'Catalog unavailable'}</p>}
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
