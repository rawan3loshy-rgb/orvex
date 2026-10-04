import { useEffect, useState } from 'react'

/** Re-renders the caller on an interval so relative times ("12s ago") stay fresh. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Keeps a boolean "busy" flag on for at least `minMs` so quick operations still read as deliberate. */
export async function withMinDuration<T>(promise: Promise<T>, minMs: number): Promise<T> {
  const started = Date.now()
  try {
    return await promise
  } finally {
    const left = minMs - (Date.now() - started)
    if (left > 0) await new Promise((r) => setTimeout(r, left))
  }
}
