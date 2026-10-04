import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Boxes, Infinity as InfinityIcon, ListChecks } from 'lucide-react'
import { useInstMutation, usePrices, useServices } from '@/hooks/installation'
import { resellersService } from '@/services/installation'
import type { Reseller, Service, ServiceCategory } from '@/types/installation'
import { Button, Card, CardFooter, CardHeader, Checkbox, EmptyState, SearchInput, Skeleton, StatusBadge, Switch } from '@/components/ui'
import { ServiceIcon, categoryColor } from '@/components/brand'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

const CATEGORY_ORDER: ServiceCategory[] = ['IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services']

export function ServicesTab({ reseller }: { reseller: Reseller }) {
  const services = useServices()
  const prices = usePrices(reseller.pricingGroupId)
  const storedAll = reseller.allowedServiceIds === 'all'
  const storedKey = storedAll ? 'all' : [...(reseller.allowedServiceIds as string[])].sort().join(',')

  const [allMode, setAllMode] = useState(storedAll)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(storedAll ? [] : (reseller.allowedServiceIds as string[])))
  const [search, setSearch] = useState('')

  useEffect(() => {
    setAllMode(storedKey === 'all')
    setSelected(new Set(storedKey === 'all' ? [] : storedKey.split(',').filter(Boolean)))
  }, [storedKey])

  const catalog = useMemo(() => (services.data ?? []).filter((s) => s.status !== 'draft'), [services.data])
  const priceOf = useMemo(() => new Map((prices.data ?? []).map((p) => [p.serviceId, p.groupPrice])), [prices.data])

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const m = new Map<ServiceCategory, Service[]>()
    for (const s of catalog) {
      if (q && !`${s.name} ${s.id} ${s.category}`.toLowerCase().includes(q)) continue
      const arr = m.get(s.category) ?? []
      arr.push(s)
      m.set(s.category, arr)
    }
    return CATEGORY_ORDER.filter((c) => m.has(c)).map((c) => ({ category: c, items: m.get(c)! }))
  }, [catalog, search])

  const currentKey = allMode ? 'all' : [...selected].sort().join(',')
  const dirty = currentKey !== storedKey
  const invalid = !allMode && selected.size === 0

  const save = useInstMutation((body: Partial<Reseller>) => resellersService.update(reseller.id, body), { success: 'Service access updated' })

  const toggleAll = (on: boolean) => {
    setAllMode(on)
    if (!on && selected.size === 0) setSelected(new Set(catalog.filter((s) => s.status === 'active').map((s) => s.id)))
  }
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const toggleCategory = (items: Service[], on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur)
      for (const s of items) {
        if (on) next.add(s.id)
        else next.delete(s.id)
      }
      return next
    })

  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<Boxes />} title="Allowed services" description="Which IMEI checks, unlocks, server services and codes this shop can list and order. Requests for anything else fail with 403 service_not_allowed." />

      <div className="mx-5 mb-4 flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/50 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border [&_svg]:size-4', allMode ? 'border-accent/30 bg-accent/10 text-accent-ink' : 'border-line bg-surface text-fg-3')}>{allMode ? <InfinityIcon /> : <ListChecks />}</span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-fg">All services</p>
            <p className="text-[12.5px] text-fg-3">{allMode ? 'Every active service, including services you add to the catalog later.' : `Explicit allowlist · ${selected.size} of ${catalog.length} services selected · prices at the shop's group rate`}</p>
          </div>
        </div>
        <Switch checked={allMode} onChange={toggleAll} label="Allow all services" />
      </div>

      <AnimatePresence initial={false}>
        {!allMode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput value={search} onChange={setSearch} placeholder="Filter services…" className="sm:w-[260px]" />
              <div className="flex items-center gap-1">
                <Button size="xs" variant="ghost" onClick={() => setSelected(new Set(catalog.map((s) => s.id)))}>
                  Select all
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
            {services.isLoading ? (
              <div className="space-y-3 px-5 pb-5">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <EmptyState compact icon={<Boxes />} title="No services match" description="Try a different search term." />
            ) : (
              <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
                {grouped.map(({ category, items }) => {
                  const on = items.filter((s) => selected.has(s.id)).length
                  return (
                    <div key={category} className="bg-surface p-4">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-fg">
                          <span className="size-2 rounded-[3px]" style={{ background: categoryColor(category) }} />
                          {category}
                          <span className="font-normal text-fg-3 tabular">
                            {on}/{items.length}
                          </span>
                        </span>
                        <Button size="xs" variant="ghost" onClick={() => toggleCategory(items, on < items.length)}>
                          {on < items.length ? 'Select all' : 'Clear'}
                        </Button>
                      </div>
                      <div className="space-y-0.5">
                        {items.map((s) => {
                          const checked = selected.has(s.id)
                          return (
                            <div key={s.id} className={cn('flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors', checked ? 'bg-accent/[0.04]' : 'hover:bg-surface-2')}>
                              <Checkbox checked={checked} onChange={(v) => toggle(s.id, v)} className="flex-1" label={<span className="flex items-center gap-2.5"><ServiceIcon icon={s.icon} category={s.category} size="sm" /><span className="min-w-0"><span className="block truncate text-[13px] text-fg">{s.name}</span><span className="block font-mono text-[10.5px] text-fg-3">{s.id}</span></span></span>} />
                              {s.status !== 'active' && <StatusBadge status={s.status} />}
                              <span className="w-[56px] text-right text-[12px] text-fg-2 tabular">{priceOf.has(s.id) ? money(priceOf.get(s.id)) : ''}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CardFooter>
        <span>{invalid ? <span className="text-danger">Select at least one service, or allow all services.</span> : dirty ? <span className="text-warning">Unsaved changes</span> : allMode ? 'All services allowed' : `${selected.size} services allowed`}</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!dirty}
            onClick={() => {
              setAllMode(storedKey === 'all')
              setSelected(new Set(storedKey === 'all' ? [] : storedKey.split(',').filter(Boolean)))
            }}
          >
            Discard
          </Button>
          <Button size="sm" variant="primary" disabled={!dirty || invalid} loading={save.isPending} onClick={() => save.mutate({ allowedServiceIds: allMode ? 'all' : [...selected] })}>
            Save access
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
