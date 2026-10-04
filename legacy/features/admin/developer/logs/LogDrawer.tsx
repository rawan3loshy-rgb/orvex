import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { ArrowUpRight, Terminal } from 'lucide-react'
import type { ApiLogEntry } from '@/types/installation'
import { Button, CodeBlock, CopyButton, Drawer, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dateShort, dateTime, ms, pct, time } from '@/lib/format'
import { toast } from '@/stores/toast'
import { CRITICAL_MS, MethodBadge, SLOW_MS, StatusCode, curlFromLog, endpointLabel, orderedServiceId, prettyJson } from '../shared'

/** Graphite for every phase; the slowest one is called out in signal coral. */
const PHASE = 'color-mix(in oklab, var(--fg) 38%, transparent)'
const PHASE_SLOWEST = 'var(--accent)'

export function LogDrawer({ entry: l, open, onClose, serviceName }: { entry: ApiLogEntry | undefined; open: boolean; onClose: () => void; serviceName?: Map<string, string> }) {
  const copyCurl = () => {
    if (!l) return
    navigator.clipboard?.writeText(curlFromLog(l)).catch(() => undefined)
    toast.success('Copied as cURL', 'The API key is referenced as $RESELLER_API_KEY')
  }

  return (
    <Drawer
      open={open && !!l}
      onClose={onClose}
      width="xl"
      title={
        l && (
          <span className="flex min-w-0 items-center gap-2.5">
            <MethodBadge method={l.method} />
            <span className="truncate font-mono text-[14px]">{l.path}</span>
          </span>
        )
      }
      description={
        l && (
          <span className="inline-flex items-center gap-1 font-mono text-[11.5px]">
            {l.requestId}
            <CopyButton value={l.requestId} label="Copy request ID" className="size-5" />
          </span>
        )
      }
      actions={
        <Button size="sm" variant="secondary" leading={<Terminal />} onClick={copyCurl} className="mr-1">
          <span className="hidden sm:inline">Copy as cURL</span>
          <span className="sm:hidden">cURL</span>
        </Button>
      }
    >
      {l && <LogDetails entry={l} serviceName={serviceName} />}
    </Drawer>
  )
}

function LogDetails({ entry: l, serviceName }: { entry: ApiLogEntry; serviceName?: Map<string, string> }) {
  const navigate = useNavigate()
  const orderId = l.path.match(/ord_\d+/)?.[0] ?? (l.status < 300 && l.method === 'POST' ? safeOrderId(l.responseBody) : null)
  const svcId = orderedServiceId(l)
  const svc = svcId ? (serviceName?.get(svcId) ?? svcId) : null
  const imei = l.requestBody ? safeImei(l.requestBody) : null

  return (
    <div className="space-y-7">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Cell label="Status">
          <StatusCode status={l.status} phrase className="text-[13px]" />
        </Cell>
        <Cell label="Latency">
          <span className={cn('font-mono text-[13px] tabular', l.latencyMs > CRITICAL_MS ? 'text-danger' : l.latencyMs > SLOW_MS ? 'text-accent-ink' : 'text-fg')}>{ms(l.latencyMs)}</span>
        </Cell>
        <Cell label="Reseller">
          {l.clientId !== 'internal' ? (
            <button type="button" onClick={() => navigate(`/admin/resellers/${l.clientId}`)} className="max-w-full truncate hover:text-accent-ink">
              {l.clientName}
            </button>
          ) : (
            l.clientName
          )}
        </Cell>
        <Cell label="Time">
          <span title={dateTime(l.at)}>
            {time(l.at, true)} <span className="text-fg-3">· {dateShort(l.at)}</span>
          </span>
        </Cell>
        <Cell label="API key">
          <span className="font-mono text-[12px]">
            {l.apiKeyPrefix}
            <span className="text-fg-3">••••</span>
          </span>
        </Cell>
        <Cell label="IP address">
          <span className="font-mono text-[12px]">{l.ip}</span>
        </Cell>
        <Cell label="Operation" className="col-span-2">
          <span className="text-[13px]">
            {endpointLabel(l.endpoint)}
            <span className="ml-2 font-mono text-[11.5px] text-fg-3">{l.endpoint}</span>
          </span>
        </Cell>
        <Cell label="User agent" className="col-span-2 sm:col-span-4">
          <span className="font-mono text-[12px] text-fg-2">{l.userAgent}</span>
        </Cell>
      </section>

      {(orderId || svc) && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            {orderId && (
              <div className="text-fg-2">
                Linked order <span className="font-mono text-fg">{orderId}</span>
              </div>
            )}
            {svc && (
              <div className="truncate text-[12px] text-fg-3">
                <span className="font-mono">{svcId}</span> · {svc}
                {imei && (
                  <>
                    {' '}
                    · IMEI <span className="font-mono text-fg-2">{imei}</span>
                  </>
                )}
              </div>
            )}
          </div>
          {orderId && (
            <Button size="sm" variant="ghost" trailing={<ArrowUpRight />} onClick={() => navigate(`/admin/orders/${orderId}`)} className="self-start sm:self-auto">
              Open order
            </Button>
          )}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h4 className="text-[13px] font-semibold">Latency breakdown</h4>
          <span className="font-mono text-[12px] text-fg-3">total {ms(l.latencyMs)}</span>
        </div>
        <Waterfall entry={l} />
      </section>

      <section>
        <h4 className="mb-2.5 text-[13px] font-semibold">Request headers</h4>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[12px]">
            <tbody className="divide-y divide-line">
              {Object.entries(l.requestHeaders).map(([k, v]) => (
                <tr key={k} className="transition-colors hover:bg-surface-2/50">
                  <td className="w-[36%] px-3.5 py-2 align-top font-mono text-fg-3">{k}</td>
                  <td className="px-3.5 py-2 font-mono break-all text-fg">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5">
        {l.requestBody ? (
          <CodeBlock title="Request body" lang="json" code={prettyJson(l.requestBody)} maxHeight={280} />
        ) : (
          <div className="rounded-xl border border-dashed border-line px-4 py-3 text-[12.5px] text-fg-3">No request body · {l.method} request</div>
        )}
        <CodeBlock title={`Response · ${l.status}`} lang="json" code={prettyJson(l.responseBody)} maxHeight={360} lineNumbers />
      </section>
    </div>
  )
}

function safeOrderId(body: string) {
  try {
    const j = JSON.parse(body) as { id?: unknown }
    return typeof j.id === 'string' && j.id.startsWith('ord_') ? j.id : null
  } catch {
    return null
  }
}

function safeImei(body: string) {
  try {
    const j = JSON.parse(body) as { fields?: { imei?: unknown } }
    return typeof j.fields?.imei === 'string' ? j.fields.imei : null
  } catch {
    return null
  }
}

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 bg-surface px-4 py-3', className)}>
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 truncate text-[13px] text-fg">{children}</div>
    </div>
  )
}

/** Waterfall of request phases: each bar starts where the previous phase ended. */
function Waterfall({ entry: l }: { entry: ApiLogEntry }) {
  const total = Math.max(1, l.timeline.reduce((a, s) => a + s.ms, 0))
  const slowest = l.timeline.reduce((best, s, i) => (s.ms > (l.timeline[best]?.ms ?? -1) ? i : best), 0)
  let offset = 0
  return (
    <div className="space-y-1.5 rounded-xl border border-line p-4">
      {l.timeline.map((s, i) => {
        const left = (offset / total) * 100
        const width = Math.max(0.8, (s.ms / total) * 100)
        offset += s.ms
        const hot = i === slowest
        const color = hot ? PHASE_SLOWEST : PHASE
        return (
          <div key={`${s.label}-${i}`} className="grid grid-cols-[112px_minmax(0,1fr)_50px] items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)_56px]">
            <span className={cn('flex items-center gap-2 truncate text-[12px]', hot ? 'text-fg' : 'text-fg-2')}>
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
              {s.label}
            </span>
            <div className="relative h-5 rounded-[3px] bg-hatch bg-fg/[0.02]">
              <div className="absolute inset-y-1" style={{ left: `${left}%`, width: `${width}%` }}>
                <Tooltip content={`${s.label} · ${ms(s.ms)} (${pct((s.ms / total) * 100, 0)}) · starts at ${ms((left / 100) * total)}${hot ? ' · slowest phase' : ''}`} className="flex h-full w-full">
                  <motion.span
                    className="block h-full rounded-[2px]"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.45, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                  />
                </Tooltip>
              </div>
            </div>
            <span className={cn('text-right font-mono text-[11.5px] tabular', hot ? 'text-accent-ink' : 'text-fg-2')}>{ms(s.ms)}</span>
          </div>
        )
      })}
      <div className="grid grid-cols-[112px_minmax(0,1fr)_50px] gap-3 pt-1 sm:grid-cols-[150px_minmax(0,1fr)_56px]">
        <span />
        <div className="flex justify-between font-mono text-[10px] text-fg-3">
          <span>0ms</span>
          <span>{ms(total / 2)}</span>
          <span>{ms(total)}</span>
        </div>
        <span />
      </div>
    </div>
  )
}
