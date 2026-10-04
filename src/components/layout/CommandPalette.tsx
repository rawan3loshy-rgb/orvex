import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Boxes, CornerDownLeft, FlaskConical, Hash, KeyRound, Moon, Plus, Search, CloudDownload, Truck, Users } from 'lucide-react'
import { useUi } from '@/stores/ui'
import { ADMIN_NAV_FLAT } from '@/features/admin/nav'
import { useAccounts, useServices, useSuppliers } from '@/hooks/installation'
import { Kbd } from '@/components/ui'
import { cn } from '@/lib/cn'

interface Cmd {
  id: string
  group: string
  label: string
  hint?: string
  icon: ReactNode
  keywords?: string
  run: () => void
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, toggleTheme } = useUi()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const services = useServices()
  const accounts = useAccounts({ kind: 'customer', pageSize: 200 })
  const suppliers = useSuppliers()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(!useUi.getState().commandOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen])

  // Reset the query and selection each time the palette opens (adjusting state during render).
  const [wasOpen, setWasOpen] = useState(commandOpen)
  if (commandOpen !== wasOpen) {
    setWasOpen(commandOpen)
    if (commandOpen) {
      setQ('')
      setIdx(0)
    }
  }

  const go = useCallback(
    (to: string) => () => {
      navigate(to)
      setCommandOpen(false)
    },
    [navigate, setCommandOpen],
  )

  const commands = useMemo<Cmd[]>(() => {
    const nav: Cmd[] = ADMIN_NAV_FLAT.map((n) => {
      const Icon = n.icon
      return { id: `nav-${n.id}`, group: 'Navigate', label: n.label, hint: n.group ?? undefined, icon: <Icon />, keywords: n.keywords, run: go(n.to) }
    })
    const actions: Cmd[] = [
      { id: 'act-order', group: 'Actions', label: 'Create admin order', icon: <Plus />, keywords: 'new order test', run: go('/admin/orders?create=1') },
      { id: 'act-review', group: 'Actions', label: 'Open Needs Review queue', icon: <Hash />, keywords: 'unknown timeout', run: go('/admin/orders?status=needs_review') },
      { id: 'act-key', group: 'Actions', label: 'Create API key', icon: <KeyRound />, keywords: 'new token', run: go('/admin/developer/keys?create=1') },
      { id: 'act-account', group: 'Actions', label: 'Create account', icon: <Users />, keywords: 'new reseller customer', run: go('/admin/accounts?create=1') },
      { id: 'act-demo', group: 'Actions', label: 'Simulate a supplier timeout', icon: <FlaskConical />, keywords: 'demo simulation failover', run: go('/admin/demo') },
      { id: 'act-update', group: 'Actions', label: 'Open update center', icon: <CloudDownload />, keywords: 'upgrade release', run: go('/admin/system/updates') },
      { id: 'act-theme', group: 'Actions', label: 'Toggle dark / light theme', icon: <Moon />, keywords: 'appearance', run: () => (toggleTheme(), setCommandOpen(false)) },
    ]
    const svc: Cmd[] = (services.data ?? []).map((r) => ({ id: `svc-${r.service.id}`, group: 'Services', label: r.service.name, hint: r.service.code, icon: <Boxes />, keywords: `${r.categoryName} ${r.service.tags.join(' ')}`, run: go(`/admin/services/${r.service.id}`) }))
    const acc: Cmd[] = (accounts.data?.items ?? []).map((r) => ({ id: `acc-${r.account.id}`, group: 'Accounts', label: r.account.name, hint: `${r.account.number} · ${r.tierName}`, icon: <Users />, keywords: `${r.account.email} ${r.account.tier}`, run: go(`/admin/accounts/${r.account.id}`) }))
    const sup: Cmd[] = (suppliers.data ?? []).map((v) => ({ id: `sup-${v.supplier.id}`, group: 'Suppliers', label: v.supplier.name, hint: v.health.replace('_', ' '), icon: <Truck />, keywords: v.driver.name, run: go(`/admin/suppliers/${v.supplier.id}`) }))
    return [...nav, ...actions, ...svc, ...sup, ...acc]
  }, [go, toggleTheme, setCommandOpen, services.data, accounts.data, suppliers.data])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = !s ? commands.filter((c) => c.group === 'Navigate' || c.group === 'Actions') : commands.filter((c) => `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(s))
    const raw = q.trim()
    if (/^ord-[a-z0-9]{4,}$/i.test(raw)) base.unshift({ id: 'order-jump', group: 'Orders', label: `Open order ${raw.toUpperCase()}`, icon: <Hash />, run: go(`/admin/orders/${raw.toUpperCase()}`) })
    else if (/^\d{8,15}$/.test(raw) || raw.length >= 3) base.push({ id: 'order-search', group: 'Orders', label: `Search orders for “${raw}”`, hint: 'reference, IMEI, account, idempotency key', icon: <Search />, run: go(`/admin/orders?search=${encodeURIComponent(raw)}`) })
    return base.slice(0, 40)
  }, [q, commands, go])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const groups = filtered.reduce<Record<string, Cmd[]>>((acc, c) => ((acc[c.group] ??= []).push(c), acc), {})
  let running = -1

  return createPortal(
    <AnimatePresence>
      {commandOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-overlay backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCommandOpen(false)} />
          <motion.div
            className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(filtered.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                filtered[idx]?.run()
              } else if (e.key === 'Escape') setCommandOpen(false)
            }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-fg-3" />
              <input autoFocus value={q} onChange={(e) => {
                  setQ(e.target.value)
                  setIdx(0)
                }} placeholder="Search pages, services, suppliers, accounts — or an order ref / IMEI…" className="h-13 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-3" />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">No matches for “{q}”</div>}
              {Object.entries(groups).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-2.5 pt-2 pb-1 mono-label">{group}</div>
                  {items.map((c) => {
                    running++
                    const i = running
                    return (
                      <button
                        key={c.id}
                        data-idx={i}
                        onMouseMove={() => setIdx(i)}
                        onClick={c.run}
                        className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] [&>svg]:size-4', i === idx ? 'bg-surface-3 text-fg' : 'text-fg-2')}
                      >
                        <span className="grid size-5 shrink-0 place-items-center text-fg-3 [&_svg]:size-4">{c.icon}</span>
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.hint && <span className="truncate font-mono text-[11px] text-fg-3">{c.hint}</span>}
                        {i === idx && <ArrowRight className="size-3.5 text-fg-3" />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-fg-3">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>{' '}
                open
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
