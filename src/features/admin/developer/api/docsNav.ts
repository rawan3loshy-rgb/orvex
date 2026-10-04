/** API reference navigation: section ids, scroll-spy and smooth jump. Rendered by the components in `./docs`. */
import { useEffect, useState } from 'react'
import { ENDPOINTS } from './samples'

/* ------------------------------------------------------------------------- */
/*  Navigation                                                               */
/* ------------------------------------------------------------------------- */
export const DOC_NAV: { group: string; items: { id: string; label: string; method?: string }[] }[] = [
  {
    group: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'authentication', label: 'Authentication & keys' },
      { id: 'idempotency', label: 'Idempotency' },
      { id: 'errors', label: 'Errors' },
      { id: 'money', label: 'Money format' },
      { id: 'statuses', label: 'Status model' },
    ],
  },
  { group: 'Endpoints', items: ENDPOINTS.map((e) => ({ id: e.id, label: e.title, method: e.method })) },
  {
    group: 'Webhooks',
    items: [
      { id: 'webhook-events', label: 'Events' },
      { id: 'webhook-signatures', label: 'Signatures' },
      { id: 'webhook-retries', label: 'Retries & replay' },
    ],
  },
  { group: 'Legacy', items: [{ id: 'dhru', label: 'DHRU compatibility' }] },
]

const ALL_IDS = DOC_NAV.flatMap((g) => g.items.map((i) => i.id))

export function useScrollSpy(enabled: boolean) {
  const [active, setActive] = useState(ALL_IDS[0]!)
  useEffect(() => {
    if (!enabled) return
    const els = ALL_IDS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
    if (!els.length) return
    const visible = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        }
        const first = ALL_IDS.find((id) => visible.has(id))
        if (first) setActive(first)
      },
      { rootMargin: '-80px 0px -55% 0px', threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [enabled])
  return active
}

export function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `${location.pathname}${location.search}#${id}`)
}
