import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { BarList, ChartLegend, Donut, TimeChart } from '@/components/charts'
import { DemoTag, Segmented } from '@/components/ui'
import { createRng } from '@/lib/random'
import { date, dateShort, money, num, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Container, MockFrame, Reveal, Section, SectionHeader } from './shared'
import { SUPPLIERS, type SupplierKey } from './demo'

type Range = '7d' | '30d' | '90d'
const DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

interface Pt {
  date: string
  completed: number
  recovered: number
  failed: number
}

/** Locally generated sample series — illustrative only. */
function generate(days: number, seed: number): Pt[] {
  const rng = createRng(seed)
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end.getTime() - (days - 1 - i) * 86_400_000)
    const dow = d.getUTCDay()
    const weekly = dow === 0 ? 0.68 : dow === 6 ? 0.76 : 1
    const trend = 1 + (i / Math.max(1, days - 1)) * (days > 30 ? 0.42 : 0.12)
    const base = 1680 * weekly * trend * (0.93 + rng.next() * 0.14)
    const recovered = base * (0.018 + rng.next() * 0.012)
    const failed = base * (0.006 + rng.next() * 0.006)
    return { date: d.toISOString(), completed: Math.round(base - recovered - failed), recovered: Math.round(recovered), failed: Math.round(failed) }
  })
}

const SERIES = [
  { key: 'completed', label: 'Completed on first offer', color: 'var(--c1)' },
  { key: 'recovered', label: 'Completed after guarded failover', color: 'var(--c2)' },
  { key: 'failed', label: 'Rejected · funds released', color: 'var(--c5)' },
]

const DELTAS: Record<Range, number[]> = { '7d': [6.2, 7.9, 0.6, -12.4], '30d': [11.8, 14.1, 1.2, -18.2], '90d': [38.4, 41.7, 2.1, -26.5] }

export function AnalyticsSection() {
  const [range, setRange] = useState<Range>('30d')
  const data = useMemo(() => generate(DAYS[range], range === '7d' ? 7 : range === '30d' ? 30 : 90), [range])

  const totals = useMemo(() => {
    const c = data.reduce((a, d) => a + d.completed, 0)
    const r = data.reduce((a, d) => a + d.recovered, 0)
    const f = data.reduce((a, d) => a + d.failed, 0)
    const all = c + r + f
    return { all, revenue: all * 1.94, margin: 31.4 + (all % 7) / 10, recovered: r }
  }, [data])

  const kpis = [
    { label: 'Orders', value: num(totals.all, { compact: true }) },
    { label: 'Revenue', value: money(totals.revenue, { compact: true }) },
    { label: 'Gross margin', value: pct(totals.margin, 1) },
    { label: 'Needs Review · median resolve', value: `${range === '7d' ? 14 : range === '30d' ? 18 : 21} min` },
  ]

  const share = ([
    ['alpha', 31],
    ['gamma', 26],
    ['beta', 19],
    ['delta', 12],
    ['zeta', 7],
    ['kappa', 5],
  ] as [SupplierKey, number][]).map(([k, value]) => ({ key: k, label: SUPPLIERS[k].short, value, color: SUPPLIERS[k].color }))
  const scale = totals.all / 52_000
  const top = [
    { key: '1', label: 'IMEI Blacklist Check (GSMA)', value: Math.round(16_840 * scale) },
    { key: '2', label: 'iPhone 15 Carrier Check', value: Math.round(14_210 * scale) },
    { key: '3', label: 'IMEI Full Report', value: Math.round(9_930 * scale) },
    { key: '4', label: 'Apple Warranty & AppleCare Check', value: Math.round(7_470 * scale) },
    { key: '5', label: 'Samsung Network Unlock Code (NCK)', value: Math.round(3_120 * scale) },
  ]

  return (
    <Section id="analytics">
      <Container>
        <SectionHeader
          index="13"
          eyebrow="Analytics"
          title="See the whole operation at a glance."
          description="Order volume, revenue and margin from the ledger, supplier share, guarded failovers and Needs Review — computed inside your installation from your own database, and exportable whenever you need them."
        />
        <Reveal delay={0.08} className="mt-12 lg:mt-14">
          <MockFrame
            path="portal.unlockdesk-demo.com/admin/reports"
            right={
              <span className="flex items-center gap-2">
                <DemoTag />
              </span>
            }
          >
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <div className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Operations overview</div>
                <div className="text-[12.5px] text-fg-3">UnlockDesk · sample data generated for this preview</div>
              </div>
              <Segmented size="sm" items={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }]} value={range} onChange={setRange} />
            </div>

            <div className="grid grid-cols-2 border-b border-line lg:grid-cols-4">
              {kpis.map((k, i) => {
                const delta = DELTAS[range][i]!
                const good = i === 3 ? delta < 0 : delta > 0
                return (
                  <div key={k.label} className={cn('border-line p-4 sm:px-5', i % 2 === 0 && 'border-r', i < 2 && 'border-b lg:border-b-0', i === 1 && 'lg:border-r', i === 2 && 'lg:border-r')}>
                    <div className="text-[12.5px] text-fg-3">{k.label}</div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-display text-[24px] leading-none font-semibold tracking-[-0.025em] text-fg tabular">{k.value}</span>
                      <span className={cn('inline-flex items-center text-[11.5px] font-medium tabular', good ? 'text-success' : 'text-danger')}>
                        {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                        {pct(Math.abs(delta))}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 border-line p-4 sm:p-5 lg:border-r">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13.5px] font-semibold text-fg">Order volume</span>
                  <ChartLegend items={SERIES.map((s) => ({ label: s.label, color: s.color }))} />
                </div>
                <TimeChart
                  key={range}
                  data={data}
                  x={(d) => d.date}
                  series={SERIES}
                  kind="area"
                  stacked
                  height={270}
                  yFormat={(v) => num(v, { compact: true })}
                  xFormat={(l) => dateShort(l)}
                  tooltipTitle={(d) => date(d.date)}
                  tooltipFormat={(v) => num(v)}
                  xLabelCount={range === '7d' ? 7 : 6}
                />
              </div>
              <div className="space-y-6 border-t border-line p-4 sm:p-5 lg:border-t-0">
                <div>
                  <div className="mb-3 text-[13.5px] font-semibold text-fg">Top services</div>
                  <BarList items={top} format={(v) => num(v, { compact: true })} />
                </div>
                <div>
                  <div className="mb-3 text-[13.5px] font-semibold text-fg">Supplier share</div>
                  <div className="flex items-center gap-5">
                    <Donut
                      segments={share}
                      size={116}
                      thickness={14}
                      center={
                        <div>
                          <div className="font-display text-[17px] font-semibold tabular">{share.length}</div>
                          <div className="text-[10.5px] text-fg-3">suppliers</div>
                        </div>
                      }
                    />
                    <ul className="min-w-0 flex-1 space-y-1.5">
                      {share.map((s) => (
                        <li key={s.key} className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="flex min-w-0 items-center gap-1.5 text-fg-2">
                            <span className="size-2 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                            <span className="truncate">{s.label}</span>
                          </span>
                          <span className="font-mono text-fg tabular">{pct(s.value, 0)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </MockFrame>
        </Reveal>
      </Container>
    </Section>
  )
}
