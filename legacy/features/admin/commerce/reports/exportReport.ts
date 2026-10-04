import type { ReportSummary } from '@/types/installation'
import { downloadCsv, fileDate, toCsv, type CsvCell } from './csv'

const CHANNEL: Record<string, string> = { api: 'Reseller API', website: 'Website', admin: 'Admin' }
const day = (iso: string) => iso.slice(0, 10)
const r2 = (n: number) => n.toFixed(2)
const pctOf = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : '0.0')

/** Multi-section CSV of everything shown on the Reports screen. */
export function exportReportCsv(report: ReportSummary, opts: { org?: string } = {}) {
  const rows: CsvCell[][] = []
  const section = (title: string, header: CsvCell[], body: CsvCell[][]) => {
    if (rows.length) rows.push([])
    rows.push([`# ${title}`])
    rows.push(header)
    rows.push(...body)
  }

  section('Summary', ['metric', 'value'], [
    ['organization', opts.org ?? 'UnlockDesk Demo Ltd.'],
    ['range', report.range],
    ['generated_at', new Date().toISOString()],
    ['revenue_usd', r2(report.revenue)],
    ['provider_cost_usd', r2(report.cost)],
    ['gross_margin_usd', r2(report.margin)],
    ['gross_margin_pct', pctOf(report.margin, report.revenue)],
    ['orders', report.orders],
    ['success_rate_pct', report.successRate.toFixed(1)],
    ['avg_order_value_usd', r2(report.avgOrderValue)],
  ])

  section(
    'Daily',
    ['date', 'orders', 'success', 'failed', 'other', 'revenue_usd', 'cost_usd', 'margin_usd'],
    report.daily.map((d) => [day(d.t), d.success + d.failed + d.other, d.success, d.failed, d.other, r2(d.revenue), r2(d.cost), r2(d.revenue - d.cost)]),
  )

  section(
    'By service',
    ['service_id', 'service', 'orders', 'revenue_usd', 'margin_usd', 'margin_pct'],
    report.byService.map((s) => [s.serviceId, s.name, s.orders, r2(s.revenue), r2(s.margin), pctOf(s.margin, s.revenue)]),
  )

  section(
    'By reseller',
    ['reseller_id', 'reseller', 'orders', 'revenue_usd'],
    report.byReseller.map((r) => [r.resellerId ?? 'direct', r.name, r.orders, r2(r.revenue)]),
  )

  section(
    'By provider',
    ['provider_id', 'provider', 'accepted_orders', 'cost_usd', 'attempt_success_pct'],
    report.byProvider.map((p) => [p.providerId, p.name, p.orders, r2(p.cost), p.successRate.toFixed(1)]),
  )

  section(
    'By channel',
    ['channel', 'orders', 'revenue_usd'],
    report.byChannel.map((c) => [CHANNEL[c.channel] ?? c.channel, c.orders, r2(c.revenue)]),
  )

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  section(
    'Orders by weekday and hour',
    ['weekday', ...Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)],
    report.heatmap.map((row, i) => [DAYS[i], ...row]),
  )

  const filename = `orvex-report-${report.range}-${fileDate()}.csv`
  downloadCsv(filename, toCsv(rows))
  return filename
}
