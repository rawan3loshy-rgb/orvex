import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Webhook } from 'lucide-react'
import { CodeBlock, Select } from '@/components/ui'
import { duration } from '@/lib/format'
import { FormSkeleton, SaveBar, SettingRow, SettingsCard, useSectionForm } from './form'

const BACKOFFS = ['Exponential (30s → 6h)', 'Exponential (10s → 1h)', 'Linear (every 5m)', 'Fixed (60s)']

const unit = (n: number, u: string) => n * (u === 'h' ? 3600 : u === 'm' ? 60 : 1)

/** Delay before each retry, in seconds. */
function schedule(backoff: string, attempts: number) {
  const out: number[] = []
  const exp = /Exponential \((\d+)([smh]) → (\d+)([smh])\)/.exec(backoff)
  const lin = /Linear \(every (\d+)([smh])\)/.exec(backoff)
  const fix = /Fixed \((\d+)([smh])\)/.exec(backoff)
  for (let i = 0; i < attempts - 1; i++) {
    if (exp) out.push(Math.min(unit(+exp[1]!, exp[2]!) * 2 ** i, unit(+exp[3]!, exp[4]!)))
    else if (lin) out.push(unit(+lin[1]!, lin[2]!) * (i + 1))
    else if (fix) out.push(unit(+fix[1]!, fix[2]!))
    else out.push(60)
  }
  return out
}

export function WebhooksTab() {
  const f = useSectionForm('webhooks', 'Webhook')
  if (!f.values) return <FormSkeleton rows={4} />
  const v = f.values
  const delays = schedule(v.backoff, v.maxAttempts)
  let acc = 0
  const points = [0, ...delays.map((d) => (acc += d))]
  const total = points[points.length - 1] ?? 0
  const algo = v.signingAlgorithm.replace('HMAC-', '').toLowerCase()

  return (
    <div>
      <SettingsCard
        icon={<Webhook />}
        title="Delivery"
        description="Defaults for every endpoint that receives order events — e.g. a reseller’s panel waiting for an unlock result."
        footer={
          <>
            <span>Endpoints, events and delivery logs are under Developer.</span>
            <Link to="/admin/developer/webhooks" className="font-medium text-accent-ink hover:underline">
              Webhooks →
            </Link>
          </>
        }
      >
        <SettingRow label="Signing algorithm" description="Each delivery carries a timestamped signature your receivers verify with the endpoint secret." changed={f.isChanged('signingAlgorithm')}>
          <Select value={v.signingAlgorithm} onChange={(e) => f.set('signingAlgorithm', e.target.value)} options={['HMAC-SHA256', 'HMAC-SHA512'].map((a) => ({ value: a, label: a }))} className="w-56" />
        </SettingRow>
        <SettingRow label="Timeout" description="A delivery counts as failed if the reseller’s endpoint doesn’t answer 2xx in time." changed={f.isChanged('timeoutMs')}>
          <Select value={String(v.timeoutMs)} onChange={(e) => f.set('timeoutMs', Number(e.target.value))} options={[5000, 10000, 15000, 30000].map((t) => ({ value: String(t), label: `${t / 1000} seconds` }))} className="w-56" />
        </SettingRow>
        <SettingRow label="Max attempts" description="Including the first delivery." changed={f.isChanged('maxAttempts')}>
          <Select value={String(v.maxAttempts)} onChange={(e) => f.set('maxAttempts', Number(e.target.value))} options={[3, 5, 8, 10, 12].map((n) => ({ value: String(n), label: `${n} attempts` }))} className="w-56" />
        </SettingRow>
        <SettingRow label="Retry backoff" changed={f.isChanged('backoff')}>
          <Select value={v.backoff} onChange={(e) => f.set('backoff', e.target.value)} options={BACKOFFS.map((b) => ({ value: b, label: b }))} className="w-64" />
        </SettingRow>
        <div className="border-t border-line px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-medium text-fg">Retry schedule</p>
            <p className="text-[12px] text-fg-3">Gives up after {duration(total)} — then the endpoint is marked failing and you can replay deliveries.</p>
          </div>
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {points.map((t, i) => (
              <motion.div key={`${v.backoff}-${v.maxAttempts}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex shrink-0 flex-col items-center rounded-lg border border-line bg-surface-2/60 px-2.5 py-1.5">
                <span className="font-mono text-[10.5px] text-fg-3">#{i + 1}</span>
                <span className="font-mono text-[12px] text-fg tabular">{i === 0 ? 'now' : `+${duration(t)}`}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </SettingsCard>

      <div className="mt-5">
        <p className="mb-2 text-[12.5px] text-fg-3">Headers on every delivery · example: order.completed to reseller MobileHub</p>
        <CodeBlock
          lang="http"
          title="POST https://api.mobilehub.example/hooks/unlockdesk"
          code={`Content-Type: application/json\nWebhook-Event: order.completed\nWebhook-Delivery: dlv_8f2k1q\nWebhook-Signature: t=1759312800,v1=${algo}:9b1f…c04e`}
        />
      </div>

      <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} onDiscard={f.discard} onSave={f.save} />
    </div>
  )
}
