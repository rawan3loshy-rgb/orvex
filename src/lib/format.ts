/**
 * Formatting helpers. All UI formatting goes through here so locale and
 * currency can later be driven by installation settings (Settings → Localization).
 */
const LOCALE = 'en-US'

const currencyFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const currencyCompactFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const intFmt = new Intl.NumberFormat(LOCALE)
const compactFmt = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })

export function money(v: number | null | undefined, opts?: { compact?: boolean; sign?: boolean }) {
  if (v == null || Number.isNaN(v)) return '—'
  const s = opts?.compact && Math.abs(v) >= 10_000 ? currencyCompactFmt.format(v) : currencyFmt.format(v)
  if (opts?.sign && v > 0) return `+${s}`
  return s
}

export function num(v: number | null | undefined, opts?: { compact?: boolean; decimals?: number }) {
  if (v == null || Number.isNaN(v)) return '—'
  if (opts?.compact && Math.abs(v) >= 10_000) return compactFmt.format(v)
  if (opts?.decimals != null) return v.toLocaleString(LOCALE, { minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals })
  return intFmt.format(v)
}

export function pct(v: number | null | undefined, decimals = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v.toFixed(decimals)}%`
}

export function ms(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—'
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}s`
  if (v >= 1000) return `${(v / 1000).toFixed(2)}s`
  return `${Math.round(v)}ms`
}

export function bytes(v: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = v
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function duration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const dateShortFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false })
const timeSecFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

/** 12 Nov 2026 */
export function date(iso: string | number | Date | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  const parts = dateFmt.formatToParts(d)
  const day = parts.find((p) => p.type === 'day')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const year = parts.find((p) => p.type === 'year')?.value
  return `${day} ${month} ${year}`
}

/** 12 Nov */
export function dateShort(iso: string | number | Date) {
  const parts = dateShortFmt.formatToParts(new Date(iso))
  return `${parts.find((p) => p.type === 'day')?.value} ${parts.find((p) => p.type === 'month')?.value}`
}

export function time(iso: string | number | Date, seconds = false) {
  return (seconds ? timeSecFmt : timeFmt).format(new Date(iso))
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "Today 14:42", "Yesterday 09:10", "12 Nov 14:42" */
export function dateTime(iso: string | number | Date | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (isSameDay(d, now)) return `Today ${time(d)}`
  if (isSameDay(d, y)) return `Yesterday ${time(d)}`
  if (d.getFullYear() === now.getFullYear()) return `${dateShort(d)} ${time(d)}`
  return `${date(d)} ${time(d)}`
}

/** "just now", "2 minutes ago", "3 hours ago", "in 4 days" */
export function relative(iso: string | number | Date | null | undefined) {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const future = diff > 0
  const s = Math.round(abs / 1000)
  let out: string
  if (s < 45) return future ? 'in a few seconds' : 'just now'
  if (s < 3600) {
    const m = Math.max(1, Math.round(s / 60))
    out = `${m} minute${m === 1 ? '' : 's'}`
  } else if (s < 86400) {
    const h = Math.round(s / 3600)
    out = `${h} hour${h === 1 ? '' : 's'}`
  } else if (s < 86400 * 30) {
    const d = Math.round(s / 86400)
    out = `${d} day${d === 1 ? '' : 's'}`
  } else if (s < 86400 * 365) {
    const mo = Math.round(s / (86400 * 30))
    out = `${mo} month${mo === 1 ? '' : 's'}`
  } else {
    const yr = Math.round(s / (86400 * 365))
    out = `${yr} year${yr === 1 ? '' : 's'}`
  }
  return future ? `in ${out}` : `${out} ago`
}

/** Short relative: "2m", "3h", "4d" */
export function ago(iso: string | number | Date) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function titleCase(s: string) {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${num(n)} ${n === 1 ? word : pluralWord}`
}

export function truncateMiddle(s: string, head = 8, tail = 4) {
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}
