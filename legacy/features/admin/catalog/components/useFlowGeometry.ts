import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface FlowRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Measures registered nodes relative to a container so SVG connectors can be
 * drawn between them. Re-measures on resize and, for a short window, after
 * `settleKey` changes (to follow layout animations such as reordering).
 */
export function useFlowGeometry(settleKey: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLElement>())
  const [rects, setRects] = useState<Record<string, FlowRect>>({})
  const [size, setSize] = useState({ w: 0, h: 0 })

  const measure = useCallback(() => {
    const c = containerRef.current
    if (!c) return
    const cr = c.getBoundingClientRect()
    const out: Record<string, FlowRect> = {}
    nodes.current.forEach((el, k) => {
      const r = el.getBoundingClientRect()
      out[k] = { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }
    })
    setRects((prev) => (same(prev, out) ? prev : out))
    setSize((prev) => (prev.w === cr.width && prev.h === cr.height ? prev : { w: cr.width, h: cr.height }))
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = () => {
      measure()
      if (performance.now() - start < 900) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [settleKey, measure])

  const register = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el)
      else nodes.current.delete(key)
    },
    [],
  )

  return { containerRef, register, rects, size, measure }
}

function same(a: Record<string, FlowRect>, b: Record<string, FlowRect>) {
  const ak = Object.keys(a)
  if (ak.length !== Object.keys(b).length) return false
  for (const k of ak) {
    const x = a[k]!
    const y = b[k]
    if (!y || Math.abs(x.x - y.x) > 0.5 || Math.abs(x.y - y.y) > 0.5 || Math.abs(x.w - y.w) > 0.5 || Math.abs(x.h - y.h) > 0.5) return false
  }
  return true
}

/** Smooth horizontal S-curve between two points. */
export function hCurve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(24, (x2 - x1) * 0.5)
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}

/** Rail elbow: down from (x, y1) then round into the target at (x2, y2). */
export function railElbow(x: number, y1: number, x2: number, y2: number, r = 10) {
  if (y2 - y1 < r) return `M${x},${y1} L${x},${y2} L${x2},${y2}`
  return `M${x},${y1} L${x},${y2 - r} Q${x},${y2} ${x + r},${y2} L${x2},${y2}`
}
