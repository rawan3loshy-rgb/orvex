import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useInView } from 'motion/react'
import { useSession } from '@/stores/session'

/** House easing — fast out, long settle. */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/* ORVEX ring geometry: an open ring with a gap at the top-right and a signal node in the gap. */
const rad = (deg: number) => (deg * Math.PI) / 180
export const ringPoint = (r: number, deg: number): [number, number] => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r]
/** SVG arc of the open ring (centered on 0,0). */
export const ringArc = (r: number) => {
  const [sx, sy] = ringPoint(r, -15)
  const [ex, ey] = ringPoint(r, -75)
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`
}

export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

/** Signs in to the demo installation and opens its operator console. */
export function useStartDemo() {
  const navigate = useNavigate()
  return () => {
    useSession.getState().signInInstallation('alex@unlockdesk-demo.com', 'Alex Morgan')
    navigate('/admin')
  }
}

/**
 * Self-advancing step machine that only runs while its element is on screen.
 * `durations` may vary per step (e.g. a deliberate pause on a timeout).
 */
export function useAutoStep<T extends Element = HTMLDivElement>(count: number, durations: number | ((step: number) => number), enabled = true) {
  const ref = useRef<T>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const [step, setStep] = useState(0)
  const dur = useRef(durations)
  // Keep the latest durations without restarting the running timer.
  useEffect(() => {
    dur.current = durations
  })
  useEffect(() => {
    if (!inView || !enabled) return
    const d = typeof dur.current === 'function' ? dur.current(step) : dur.current
    const t = setTimeout(() => setStep((s) => (s + 1) % count), d)
    return () => clearTimeout(t)
  }, [inView, enabled, step, count])
  return { ref, step, setStep, inView }
}

/**
 * Ticks while on screen; returns a monotonically increasing counter.
 * `onTick` runs from the timer with the new count — use it to advance state per tick.
 */
export function useTicker<T extends Element = HTMLDivElement>(interval: number, enabled = true, onTick?: (tick: number) => void) {
  const ref = useRef<T>(null)
  const inView = useInView(ref, { amount: 0.15 })
  const [tick, setTick] = useState(0)
  const count = useRef(0)
  const onTickRef = useRef(onTick)
  useEffect(() => {
    onTickRef.current = onTick
  })
  useEffect(() => {
    if (!inView || !enabled) return
    const t = setInterval(() => {
      const n = ++count.current
      setTick(n)
      onTickRef.current?.(n)
    }, interval)
    return () => clearInterval(t)
  }, [inView, enabled, interval])
  return { ref, tick, inView }
}
