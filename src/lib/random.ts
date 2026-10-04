/**
 * Deterministic pseudo-random utilities used by the mock data seeders.
 * A fixed seed keeps demo data stable between reloads while still looking organic.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof createRng>

export function createRng(seed: number) {
  const next = mulberry32(seed)
  const rng = {
    next,
    float: (min = 0, max = 1) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    bool: (p = 0.5) => next() < p,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]!,
    weighted: <T>(items: readonly T[], weights: readonly number[]): T => {
      const total = weights.reduce((a, b) => a + b, 0)
      let r = next() * total
      for (let i = 0; i < items.length; i++) {
        r -= weights[i]!
        if (r <= 0) return items[i]!
      }
      return items[items.length - 1]!
    },
    shuffle: <T>(arr: readonly T[]): T[] => {
      const a = arr.slice()
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[a[i], a[j]] = [a[j]!, a[i]!]
      }
      return a
    },
    /** Approximately normal distribution (Box–Muller). */
    normal: (mean = 0, sd = 1) => {
      const u = 1 - next()
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    hex: (len: number) => {
      let s = ''
      for (let i = 0; i < len; i++) s += Math.floor(next() * 16).toString(16)
      return s
    },
    base62: (len: number) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let s = ''
      for (let i = 0; i < len; i++) s += chars[Math.floor(next() * chars.length)]
      return s
    },
  }
  return rng
}

/** Non-deterministic helpers for live simulation & generated secrets. */
export const liveRng = createRng((Date.now() ^ 0x5f3759df) >>> 0)

export function sleep(msDelay: number) {
  return new Promise<void>((r) => setTimeout(r, msDelay))
}
