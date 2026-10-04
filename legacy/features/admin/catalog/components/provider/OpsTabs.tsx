import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, CircleCheck, Cpu, HeartPulse, Inbox, Radio, ScrollText, ShieldCheck, ShieldOff, Wallet, Webhook } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { ChartLegend, TimeChart, UptimeBars } from '@/components/charts'
import { Badge, Button, Card, CardBody, CardHeader, CodeBlock, CopyButton, Dot, EmptyState, SearchInput, Segmented, Select, Skeleton, Switch, Tooltip } from '@/components/ui'
import { useInstMutation, useOrders, useProviderLogs } from '@/hooks/installation'
import { providersService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { dateShort, money, ms, num, pct, relative, time } from '@/lib/format'
import type { Provider, ProviderLogEntry } from '@/types/installation'
import { FlowConnector } from '../RoutingBits'
import { Callout, KeyValue, MetricStrip, balanceState } from '../shared'

const DAY = 86400_000

/* ------------------------------------------------------------------------- */
/*  Health                                                                   */
/* ------------------------------------------------------------------------- */

export function HealthTab({ provider: p }: { provider: Provider }) {
  const logs = useProviderLogs(p.id)
  const hc = useMemo(
    () =>
      (logs.data ?? [])
        .filter((l) => l.operation === 'health_check')
        .slice()
        .reverse()
        .map((l) => ({ t: l.at, latency: l.latencyMs, threshold: p.latencyP95 })),
    [logs.data, p.latencyP95],
  )
  const recent = useMemo(() => {
    const since = Date.now() - 36 * 3600_000
    const sub = (logs.data ?? []).filter((l) => l.operation === 'submit_order' && new Date(l.at).getTime() >= since)
    const timeouts = sub.filter((l) => l.status === 504).length
    const errors = sub.filter((l) => l.level === 'error').length
    return { total: sub.length, timeouts, errors }
  }, [logs.data])
  const days = p.uptimeHistory
  const counts = { operational: days.filter((d) => d.status === 'operational').length, degraded: days.filter((d) => d.status === 'degraded').length, outage: days.filter((d) => d.status === 'outage').length }
  const degraded = p.status === 'degraded' || p.status === 'outage'

  return (
    <div className="space-y-5">
      {degraded ? (
        <Callout tone="warning" title={p.id === 'prv_gsmsolutions' ? 'Incident · elevated timeouts on the XML gateway in the last 36h' : `Incident · ${p.name} is ${p.status}`}>
          {p.name} is responding slowly{recent.total ? ` — ${num(recent.timeouts)} of ${num(recent.total)} recent submissions timed out (${pct((recent.timeouts / Math.max(1, recent.total)) * 100, 0)})` : ''}. p50 latency is {ms(p.latencyP50)} against a {ms(p.timeoutMs)} timeout. Unlock and code orders fail over to the next supplier in each chain automatically; consider lowering {p.shortName}’s priority until the supplier confirms recovery.
        </Callout>
      ) : (
        <Callout tone="success" icon={<CircleCheck />} title="No active incidents">
          {counts.degraded + counts.outage ? `${counts.degraded + counts.outage} day${counts.degraded + counts.outage === 1 ? '' : 's'} below 99% in the last 90 days, all resolved.` : 'Every day in the last 90 days met the 99% availability target.'}
        </Callout>
      )}
      <MetricStrip
        cols="grid-cols-2 lg:grid-cols-4"
        items={[
          { label: 'Uptime · 30d', value: pct(p.uptime30d, 2), tone: p.uptime30d >= 99.9 ? 'success' : p.uptime30d >= 99 ? undefined : 'warning', sub: 'Health checks every 5 minutes' },
          { label: 'Latency p50', value: ms(p.latencyP50), tone: p.latencyP50 > 600 ? 'warning' : undefined, sub: 'Median submit round-trip' },
          { label: 'Latency p95', value: ms(p.latencyP95), tone: p.latencyP95 > 2000 ? 'warning' : undefined, sub: `Timeout at ${ms(p.timeoutMs)}` },
          { label: 'Success rate', value: pct(p.successRate), tone: p.successRate < 95 ? 'warning' : 'success', sub: 'Accepted ÷ attempts, 30d' },
        ]}
      />
      <Card>
        <CardHeader icon={<HeartPulse />} title="90-day availability" description={`${counts.operational} operational · ${counts.degraded} degraded · ${counts.outage} outage days`} />
        <CardBody>
          <UptimeBars height={44} items={days.map((h) => ({ label: dateShort(h.date), value: h.uptime, status: h.status }))} />
          <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] text-fg-3">
            <span>{days[0] ? dateShort(days[0].date) : ''}</span>
            <ChartLegend
              items={[
                { label: '≥ 99%', color: 'var(--success)' },
                { label: '95–99%', color: 'var(--warning)' },
                { label: '< 95%', color: 'var(--danger)' },
              ]}
            />
            <span>Today</span>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={<Radio />} title="Health check latency" description={`Last 2 hours of adapter pings to ${p.shortName}. Dashed line marks the supplier’s p95.`} actions={<Badge dot pulse tone="success">Live</Badge>} />
        <CardBody>
          {logs.isLoading ? (
            <Skeleton className="h-[200px] rounded-lg" />
          ) : (
            <TimeChart
              data={hc}
              x={(d) => d.t}
              kind="line"
              height={200}
              yFormat={(v) => `${Math.round(v)}ms`}
              xFormat={(l) => time(l)}
              tooltipTitle={(d) => time(d.t, true)}
              tooltipFormat={(v) => ms(v)}
              series={[
                { key: 'latency', label: 'Latency', color: p.status === 'operational' ? 'var(--accent)' : 'var(--warning)', type: 'area' },
                { key: 'threshold', label: 'p95', color: 'var(--fg-3)', dashed: true },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Logs                                                                     */
/* ------------------------------------------------------------------------- */

const OPS: ProviderLogEntry['operation'][] = ['submit_order', 'get_status', 'list_services', 'health_check', 'webhook_in', 'balance']

export function LogsTab({ provider: p }: { provider: Provider }) {
  const q = useProviderLogs(p.id)
  const [level, setLevel] = useState<'all' | ProviderLogEntry['level']>('all')
  const [op, setOp] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(40)
  const all = q.data ?? []
  const counts = { all: all.length, info: all.filter((l) => l.level === 'info').length, warn: all.filter((l) => l.level === 'warn').length, error: all.filter((l) => l.level === 'error').length }
  const rows = all.filter((l) => (level === 'all' || l.level === level) && (!op || l.operation === op) && (!search || `${l.message} ${l.orderId ?? ''} ${l.status}`.toLowerCase().includes(search.toLowerCase())))

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<ScrollText />}
        title="Adapter logs"
        description={`Every call ${p.adapterName} made to ${p.shortName} — order submissions, status polls, balance and service-list syncs. Payloads are redacted; credentials never reach logs.`}
        actions={
          <span className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
            <Dot tone="success" pulse /> Live · {q.dataUpdatedAt ? `updated ${relative(q.dataUpdatedAt)}` : 'connecting'}
          </span>
        }
      />
      <div className="flex flex-col gap-2 border-y border-line bg-surface-2/40 px-5 py-3 lg:flex-row lg:items-center">
        <Segmented
          value={level}
          onChange={setLevel}
          items={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'info', label: 'Info', count: counts.info },
            { value: 'warn', label: 'Warn', count: counts.warn },
            { value: 'error', label: 'Error', count: counts.error },
          ]}
        />
        <div className="flex flex-1 gap-2">
          <Select inputSize="sm" value={op} onChange={(e) => setOp(e.target.value)} options={[{ value: '', label: 'All operations' }, ...OPS.map((o) => ({ value: o, label: o }))]} className="w-[170px] shrink-0" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search message, order or supplier ref…" className="flex-1 [&_input]:h-8" />
        </div>
      </div>
      {q.isLoading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-fg-3">
                <th className="py-2 pl-5 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">Operation</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Latency</th>
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="py-2 pr-5 text-right font-medium">Order</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.slice(0, limit).map((l) => (
                <tr key={l.id} className={cn('border-b border-line last:border-0 hover:bg-surface-2/50', l.level === 'error' && 'bg-danger/[0.025]')}>
                  <td className="py-2 pl-5 whitespace-nowrap text-fg-3 tabular" title={new Date(l.at).toISOString()}>
                    {time(l.at, true)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={l.level === 'error' ? 'danger' : l.level === 'warn' ? 'warning' : 'neutral'} className="font-sans">
                      {l.level}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-fg-2">{l.operation}</td>
                  <td className={cn('px-3 py-2 text-right tabular', l.status >= 500 ? 'text-danger' : l.status >= 400 ? 'text-warning' : l.status < 200 ? 'text-info' : 'text-success')}>{l.status}</td>
                  <td className={cn('px-3 py-2 text-right tabular', l.latencyMs > p.latencyP95 ? 'text-warning' : 'text-fg-2')}>{ms(l.latencyMs)}</td>
                  <td className="max-w-[380px] truncate px-3 py-2 font-sans text-fg" title={l.message}>
                    {l.message}
                  </td>
                  <td className="py-2 pr-5 text-right">
                    {l.orderId ? (
                      <Link to={`/admin/orders/${l.orderId}`} className="text-accent-ink hover:underline">
                        {l.orderId}
                      </Link>
                    ) : (
                      <span className="text-fg-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="border-t border-line px-5 py-3 text-center">
              <Button size="sm" variant="ghost" onClick={() => setLimit((n) => n + 40)}>
                Show more · {num(rows.length - limit)} remaining
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState compact icon={<Inbox />} title="No log entries match" description="Try a different level, operation or search." />
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Inbound webhooks                                                         */
/* ------------------------------------------------------------------------- */

/** Example supplier callback + the adapter's normalised result, per adapter family. */
function inboundSample(p: Provider): { lang: 'html' | 'json'; code: string; normalised: Record<string, unknown>; outcome: string } {
  if (p.protocol === 'SOAP / XML') {
    // DHRU-compatible XML gateway (e.g. GSM Solutions): status 4 = completed, CODE carries the unlock code.
    return {
      lang: 'html',
      code: `<?xml version="1.0" encoding="UTF-8"?>
<!-- DHRU-compatible XML callback -->
<RESULT>
  <ACTION>imeiorderstatus</ACTION>
  <USERNAME>udesk_••••</USERNAME>
  <ID>GS-77310452</ID>
  <REFERENCE>ord_48213</REFERENCE>
  <SERVICEID>3110</SERVICEID>
  <IMEI>356938035643809</IMEI>
  <STATUS>4</STATUS>
  <CODE>NCK 61029384</CODE>
  <COMMENTS>Code verified on supplier calculator</COMMENTS>
  <TIMESTAMP>2026-10-01T09:13:21Z</TIMESTAMP>
</RESULT>`,
      normalised: { externalRef: 'GS-77310452', state: 'completed', result: { nck: '61029384', summary: 'NCK 61029384' } },
      outcome: 'NCK 61029384 delivered',
    }
  }
  if (p.protocol === 'GraphQL') {
    // Queue-based server-service supplier (e.g. Mobile API): FRP / Mi Account / GSX jobs.
    return {
      lang: 'json',
      code: JSON.stringify({ event: 'jobCompleted', data: { job: { id: 'job_8f2a91', clientReference: 'ord_48213', service: 'FRP_SAM', imei: '356938035643809', state: 'DONE', outcome: { frpRemoved: true, message: 'FRP removed — device ready for setup' } } }, sentAt: '2026-10-01T09:13:21Z' }, null, 2),
      normalised: { externalRef: 'job_8f2a91', state: 'completed', result: { frp_removed: true, summary: 'FRP removed — device ready for setup' } },
      outcome: 'FRP removed — device ready for setup',
    }
  }
  if (p.adapterId.startsWith('ext.')) {
    // Custom batch adapter (e.g. Device Services Network): many device-data results per callback.
    return {
      lang: 'json',
      code: JSON.stringify({ batch_id: 'b_20261001_0913', items: [{ ref: 'ord_48213', status: 'ok', imei: '356938035643809', data: { brand: 'samsung', in_warranty: true, coverage_end: '2027-04-08' } }], signature_alg: 'hmac-sha256' }, null, 2),
      normalised: { externalRef: 'b_20261001_0913:ord_48213', state: 'completed', result: { in_warranty: true, coverage_end: '2027-04-08', summary: 'In warranty until 08 Apr 2027' } },
      outcome: 'Warranty report stored',
    }
  }
  if (p.id === 'prv_imeihub') {
    return {
      lang: 'json',
      code: JSON.stringify({ type: 'check.completed', id: 'ih_evt_a1c2e3', reference: 'ord_48213', service: 'IH-104', imei: '356938035643809', result: { gsma: 'CLEAN', blacklisted: false, lostStolen: false }, created: 1791105201 }, null, 2),
      normalised: { externalRef: 'ih_evt_a1c2e3', state: 'completed', result: { gsma_status: 'clean', blacklisted: false, summary: 'CLEAN — not on the GSMA blacklist' } },
      outcome: 'CLEAN — not on the GSMA blacklist',
    }
  }
  return {
    lang: 'json',
    code: JSON.stringify({ type: 'order.completed', id: 'gu_evt_a1c2e3', reference: 'ord_48213', service_id: 312, imei: '356938035643809', network: 'att_us', status: 'UNLOCKED', message: 'Unlocked — whitelisted on carrier database', created: 1791105201 }, null, 2),
    normalised: { externalRef: 'gu_evt_a1c2e3', state: 'completed', result: { unlocked: true, network: 'att_us', summary: 'Unlocked — whitelisted on carrier database' } },
    outcome: 'Unlock confirmed',
  }
}

export function ProviderWebhooksTab({ provider: p }: { provider: Provider }) {
  const toggle = useInstMutation((v: boolean) => providersService.update(p.id, { webhookSigning: v }), { success: (d) => (d.webhookSigning ? 'Signature verification enabled' : 'Signature verification disabled') })
  const sample = inboundSample(p)
  const normalised = JSON.stringify(sample.normalised, null, 2)
  const hasSecret = p.credentials.some((c) => /webhook|hmac/i.test(c.key))
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Webhook />} title="Inbound callback endpoint" description={`${p.shortName} posts asynchronous results here — unlock confirmations, codes and server-job outcomes.`} />
          <CardBody className="space-y-4 pt-0">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-2/60 pr-1.5 pl-3">
              <span className="rounded bg-success/12 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-success">POST</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{p.callbackUrl}</span>
              <CopyButton value={p.callbackUrl} />
            </div>
            <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', p.webhookSigning ? 'border-success/25 bg-success/[0.04]' : 'border-warning/30 bg-warning/[0.05]')}>
              {p.webhookSigning ? <ShieldCheck className="size-5 shrink-0 text-success" /> : <ShieldOff className="size-5 shrink-0 text-warning" />}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">Signature verification {p.webhookSigning ? 'on' : 'off'}</div>
                <div className="text-[12px] text-fg-3">{p.webhookSigning ? `Callbacks must carry a valid signature${hasSecret ? ' made with the stored signing secret' : ''}.` : `Requests are accepted from ${p.shortName}’s egress IPs only — DHRU-style gateways rarely sign callbacks.`}</div>
              </div>
              <Switch checked={p.webhookSigning} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} label="Webhook signing" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Cpu />} title="Delivery guarantees" />
          <CardBody className="pt-0">
            <KeyValue k="Accepted from" v="Supplier egress IPs (allow-list)" />
            <KeyValue k="Replay protection" v="Timestamp ± 5 min, nonce cache" />
            <KeyValue k="Idempotency" v="Deduplicated on supplier order ID" />
            <KeyValue k="Unknown references" v="Logged as webhook_in · 404" />
            <KeyValue k="Fallback" v={`Polling via getOrderStatus every ${p.protocol === 'SOAP / XML' ? '60s' : '30s'}`} />
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="How the adapter normalises a callback" description={`${p.adapterName} → parseWebhook() turns ${p.shortName}’s payload into one Core result shape — the same for every supplier.`} />
        <div className="flex flex-col border-t border-line p-5 xl:flex-row xl:items-stretch">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <ProviderMark id={p.id} size="xs" />
              <span className="mono-label">1 · {p.shortName} sends</span>
            </div>
            <CodeBlock code={sample.code} lang={sample.lang} maxHeight={320} />
          </motion.div>
          <FlowConnector breakpoint="xl" color="var(--accent)" />
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="min-w-0 flex-1">
            <div className="mb-2 mono-label">2 · Adapter returns</div>
            <CodeBlock code={normalised} lang="json" maxHeight={320} />
            <p className="mt-2 text-[12px] text-fg-3">
              <span className="font-mono">AdapterStatusResult</span> — identical for every supplier.
            </p>
          </motion.div>
          <FlowConnector breakpoint="xl" color="var(--success)" delay={0.4} />
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="min-w-0 flex-1 xl:max-w-[260px]">
            <div className="mb-2 mono-label">3 · Core reacts</div>
            <ol className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-3.5 text-[12.5px]">
              {[`Order ord_48213 → success · ${sample.outcome}`, 'Result stored · supplier cost settled', 'order.completed sent to the reseller webhook', `${p.shortName} success rate & latency updated`].map((t, i) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success/15 font-mono text-[9.5px] text-success">{i + 1}</span>
                  <span className="text-fg-2">{t}</span>
                </li>
              ))}
            </ol>
            <Button size="sm" variant="ghost" to="/admin/developer/webhooks" trailing={<ArrowRight />} className="mt-2 -ml-2">
              Outbound webhooks
            </Button>
          </motion.div>
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Usage                                                                    */
/* ------------------------------------------------------------------------- */

export function UsageTab({ provider: p }: { provider: Provider }) {
  const q = useOrders({ providerId: p.id, range: '30d', pageSize: 200 })
  const agg = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const t0 = start.getTime() - 29 * DAY
    const days = Array.from({ length: 30 }, (_, i) => ({ t: new Date(t0 + i * DAY).toISOString(), fulfilled: 0, failover: 0, cost: 0 }))
    let cost = 0
    let fulfilled = 0
    let failover = 0
    for (const o of q.data?.items ?? []) {
      const b = days[Math.floor((new Date(o.createdAt).getTime() - t0) / DAY)]
      const mine = o.providerId === p.id
      if (mine && o.status === 'success') {
        fulfilled++
        cost += o.cost
        if (b) {
          b.fulfilled++
          b.cost = +(b.cost + o.cost).toFixed(2)
        }
      } else if (!mine || o.status === 'failed') {
        failover++
        if (b) b.failover++
      }
    }
    const active = days.filter((d) => d.fulfilled + d.failover > 0).length || 1
    return { days, cost, fulfilled, failover, perDay: cost / active }
  }, [q.data, p.id])

  const total = q.data?.total ?? 0
  const sampled = total > (q.data?.items.length ?? 0)
  const bal = balanceState(p)
  const runway = agg.perDay > 0 ? p.balance / agg.perDay : null
  const scaleMax = Math.max(p.balance, p.lowBalanceThreshold * 4)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Orders per day"
            description={sampled ? `Most recent ${q.data?.items.length} of ${num(total)} orders that touched ${p.shortName} in 30 days.` : `${num(total)} orders touched ${p.shortName} in the last 30 days.`}
            actions={sampled ? <Badge tone="warning">Sampled · 200 cap</Badge> : undefined}
          />
          <CardBody>
            {q.isLoading ? (
              <Skeleton className="h-[220px] rounded-lg" />
            ) : (
              <>
                <TimeChart
                  data={agg.days}
                  x={(d) => d.t}
                  kind="bar"
                  stacked
                  height={220}
                  xFormat={(l) => dateShort(l)}
                  tooltipTitle={(d) => dateShort(d.t)}
                  series={[
                    { key: 'fulfilled', label: `Fulfilled by ${p.shortName}`, color: p.color },
                    { key: 'failover', label: 'Failed over / failed', color: 'var(--c6)' },
                  ]}
                />
                <ChartLegend
                  className="mt-3"
                  items={[
                    { label: `Fulfilled by ${p.shortName}`, color: p.color, value: num(agg.fulfilled) },
                    { label: 'Failed over / failed', color: 'var(--c6)', value: num(agg.failover) },
                  ]}
                />
              </>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Wallet />} title="Supplier credit" description={`Prepaid balance at ${p.shortName}, debited per completed order.`} />
          <CardBody className="pt-0">
            <div className="font-display text-[32px] leading-none font-semibold tracking-[-0.03em] tabular">{money(p.balance)}</div>
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              <Badge tone={bal.tone} dot>
                {bal.label}
              </Badge>
              <span className="text-fg-3">alert below {money(p.lowBalanceThreshold)}</span>
            </div>
            <div className="relative mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-fg/[0.07]">
                <motion.div className={cn('h-full rounded-full', bal.tone === 'success' ? 'bg-success/80' : bal.tone === 'warning' ? 'bg-warning' : 'bg-danger')} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (p.balance / scaleMax) * 100)}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
              </div>
              <div className="absolute -top-1 -translate-x-1/2" style={{ left: `${(p.lowBalanceThreshold / scaleMax) * 100}%` }}>
                <Tooltip content={`Low-balance threshold ${money(p.lowBalanceThreshold)}`} placement="top">
                  <span className="block h-4 w-0.5 rounded-full bg-fg" />
                </Tooltip>
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-fg-3">
                <span>$0</span>
                <span>{money(scaleMax, { compact: true })}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-1">
              <KeyValue k="Spend (sample)" v={money(agg.cost)} />
              <KeyValue k="Avg per active day" v={money(agg.perDay)} />
              <KeyValue k="Runway at this pace" v={runway == null ? '—' : <span className={cn(runway < 14 ? 'text-warning' : 'text-fg')}>{runway > 365 ? '> 1 year' : `${Math.floor(runway)} days`}</span>} />
            </div>
            <Button size="sm" variant="ghost" to="/admin/transactions" trailing={<ArrowRight />} className="mt-2 -ml-2">
              Supplier settlements
            </Button>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Cost per day" description={`What ${p.shortName} charged for orders it completed (from the same sample).`} />
        <CardBody>
          {q.isLoading ? (
            <Skeleton className="h-[180px] rounded-lg" />
          ) : (
            <TimeChart data={agg.days} x={(d) => d.t} kind="area" height={180} xFormat={(l) => dateShort(l)} tooltipTitle={(d) => dateShort(d.t)} yFormat={(v) => `$${Math.round(v)}`} tooltipFormat={(v) => money(v)} series={[{ key: 'cost', label: 'Supplier cost', color: p.color }]} />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

