import { Pencil, TriangleAlert } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { pricingService } from '@/services/installation'
import type { PriceRow, PricingGroup } from '@/types/installation'
import { Button, Card, CardFooter, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { money, num } from '@/lib/format'
import { GroupChip } from '../resellers/shared'
import { previewRow } from './shared'

const MAX = 60

export function DiscountEditor({ group, rows, draft, setDraft, onEdit }: { group?: PricingGroup; rows: PriceRow[]; draft: number; setDraft: (v: number) => void; onEdit: () => void }) {
  const save = useInstMutation((discountPercent: number) => pricingService.updateGroup(group!.id, { discountPercent }), { success: (g) => `${g.name} discount set to ${g.discountPercent}%` })

  if (!group)
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-10 w-24" />
        <Skeleton className="mt-6 h-2 w-full" />
      </Card>
    )

  const dirty = Math.abs(draft - group.discountPercent) > 0.001
  const ruleRows = rows.filter((r) => !r.overridden)
  const preview = ruleRows.map((r) => previewRow(r, draft))
  const belowCost = preview.filter((r) => r.margin < 0)
  const invalid = Number.isNaN(draft) || draft < 0 || draft > 90
  const revenueDelta = ruleRows.length ? preview.reduce((a, r, i) => a + (r.groupPrice - ruleRows[i]!.groupPrice), 0) / ruleRows.length : 0

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-4.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold tracking-[-0.01em]">Group discount</h3>
            <GroupChip group={group} />
          </div>
          <p className="mt-1 text-[12.5px] text-fg-3">{group.description || 'No description'}</p>
        </div>
        <Button size="sm" variant="ghost" icon onClick={onEdit} aria-label="Edit group details">
          <Pencil />
        </Button>
      </div>

      <div className="px-5 pt-5 pb-5">
        <div className="flex items-end justify-between gap-3">
          <div className="font-display text-[40px] leading-none font-semibold tracking-[-0.035em] text-fg tabular">
            {draft ? '−' : ''}
            {num(draft, { decimals: draft % 1 ? 1 : 0 })}
            <span className="text-[24px] text-fg-3">%</span>
          </div>
          <div className="relative w-[96px]">
            <input
              type="number"
              min={0}
              max={90}
              step={0.5}
              value={Number.isNaN(draft) ? '' : draft}
              onChange={(e) => setDraft(e.target.value === '' ? Number.NaN : Number(e.target.value))}
              aria-label="Discount percent"
              className={cn(
                'h-9 w-full rounded-lg border bg-surface pr-7 pl-3 text-right font-mono text-[13px] text-fg tabular transition-colors outline-none focus:ring-3',
                invalid ? 'border-danger/60 focus:ring-danger/15' : 'border-line hover:border-line-strong focus:border-accent/60 focus:ring-accent/15',
              )}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-fg-3">%</span>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={MAX}
          step={0.5}
          value={Number.isNaN(draft) ? 0 : Math.min(MAX, draft)}
          onChange={(e) => setDraft(Number(e.target.value))}
          aria-label="Discount slider"
          className="mt-5 h-1.5 w-full cursor-pointer appearance-auto accent-accent"
          style={{ accentColor: group.color }}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-fg-3">
          {[0, 15, 30, 45, 60].map((t) => (
            <button key={t} type="button" onClick={() => setDraft(t)} className="hover:text-fg">
              {t}%
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2 rounded-xl border border-line bg-surface-2/50 p-3.5 text-[12.5px]">
          <div className="flex justify-between gap-3">
            <span className="text-fg-3">Applies to</span>
            <span className="text-fg tabular">
              {ruleRows.length} services · {num(group.resellersCount)} resellers
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-fg-3">Contract prices (unchanged)</span>
            <span className="text-fg tabular">{rows.length - ruleRows.length}</span>
          </div>
          {dirty && (
            <div className="flex justify-between gap-3">
              <span className="text-fg-3">Avg. price change</span>
              <span className={cn('tabular', revenueDelta < 0 ? 'text-warning' : 'text-success')}>
                {revenueDelta >= 0 ? '+' : '−'}
                {money(Math.abs(revenueDelta))} / order
              </span>
            </div>
          )}
        </div>

        {belowCost.length > 0 && (
          <p className="mt-3 flex items-start gap-2 text-[12.5px] text-danger">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {belowCost.length} service{belowCost.length === 1 ? '' : 's'} would sell below supplier cost ({belowCost.slice(0, 2).map((r) => r.serviceName).join(', ')}
            {belowCost.length > 2 ? '…' : ''}). Lower the discount or add contract prices first.
          </p>
        )}
      </div>

      <CardFooter className="mt-auto">
        <span>{dirty ? <span className="text-accent-ink">Previewing in table</span> : `Current: ${group.discountPercent}%`}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(group.discountPercent)}>
            Reset
          </Button>
          <Button size="sm" variant="primary" disabled={!dirty || invalid || belowCost.length > 0} loading={save.isPending} onClick={() => save.mutate(Math.round(draft * 10) / 10)}>
            Save discount
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
