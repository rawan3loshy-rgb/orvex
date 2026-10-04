/**
 * Demo persistence for the in-browser mock backends.
 *
 * Configuration the reviewer changes (catalog, routing, keys, website,
 * settings, applied updates…) is kept in localStorage so a page reload does not
 * undo it. High-volume operational data (orders, logs, deliveries) is
 * regenerated from the deterministic seed instead. Bump `version` to discard
 * snapshots after a seed change.
 */
export function createDemoStore<T>(key: string, version: number) {
  const storageKey = `orvex.demo.${key}`
  let timer: ReturnType<typeof setTimeout> | null = null

  const read = (): T | null => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { v: number; data: T }
      return parsed.v === version ? parsed.data : null
    } catch {
      return null
    }
  }

  const write = (data: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ v: version, savedAt: new Date().toISOString(), data }))
    } catch {
      /* storage full or blocked — persistence is best-effort */
    }
  }

  return {
    read,
    /** Debounced save; `snapshot` is evaluated when the save runs. */
    saveSoon(snapshot: () => T, delay = 400) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => write(snapshot()), delay)
    },
    clear() {
      if (timer) clearTimeout(timer)
      timer = null
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* ignore */
      }
    },
  }
}
