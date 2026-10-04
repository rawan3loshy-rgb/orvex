/**
 * Money — integer micro-units.
 *
 * Every amount inside ORVEX Core is an integer number of micro-units of the
 * installation currency (1 USD = 1 000 000 micros). Floats never carry money:
 * supplier costs like $0.0425 stay exact, sums never drift, and rounding only
 * happens where a business rule says so (pricing rounding, display).
 *
 * `Micros` is a branded number so the compiler refuses to mix it with plain
 * decimals. Build values with `usd(0.72)` (decimal → micros) or `micros(n)`.
 */

declare const MICROS: unique symbol
export type Micros = number & { readonly [MICROS]: true }

export const MICROS_PER_UNIT = 1_000_000
export const CURRENCY = 'USD' as const

export const ZERO = 0 as Micros
export const CENT = 10_000 as Micros

/** Wrap an integer that is already in micros. */
export const micros = (n: number) => Math.round(n) as Micros

/** Decimal currency units → micros (`usd(0.72)` → 720 000). */
export const usd = (units: number) => Math.round(units * MICROS_PER_UNIT) as Micros

/** Micros → decimal units, for charts and CSV only. Never compute with the result. */
export const toUnits = (m: Micros) => m / MICROS_PER_UNIT

export const add = (...xs: Micros[]) => xs.reduce((a, b) => a + b, 0) as Micros
export const sub = (a: Micros, b: Micros) => (a - b) as Micros
export const neg = (a: Micros) => -a as Micros
export const abs = (a: Micros) => Math.abs(a) as Micros
export const min = (a: Micros, b: Micros) => Math.min(a, b) as Micros
export const max = (a: Micros, b: Micros) => Math.max(a, b) as Micros
export const sum = (xs: readonly Micros[]) => xs.reduce((a, b) => a + b, 0) as Micros
export const sumBy = <T>(xs: readonly T[], f: (x: T) => Micros) => xs.reduce((a, x) => a + f(x), 0) as Micros
export const times = (a: Micros, n: number) => Math.round(a * n) as Micros

/** Apply a percentage expressed in basis points (3000 bps = 30%). */
export const ofBps = (a: Micros, bps: number) => Math.round((a * bps) / 10_000) as Micros

/** Ratio a/b in basis points (margin 2 200 bps = 22%). */
export const bpsOf = (a: Micros, b: Micros) => (b === 0 ? 0 : Math.round((a / b) * 10_000))

export type RoundingMode = 'up' | 'nearest' | 'down'

/** Round to a commercial increment (e.g. 1 cent, 5 cents, 0.50). */
export function roundTo(a: Micros, increment: Micros, mode: RoundingMode = 'nearest'): Micros {
  if (increment <= 0) return a
  const q = a / increment
  const r = mode === 'up' ? Math.ceil(q - 1e-9) : mode === 'down' ? Math.floor(q + 1e-9) : Math.round(q)
  return (r * increment) as Micros
}

/* ------------------------------------------------------------------------- */
/*  Formatting                                                               */
/* ------------------------------------------------------------------------- */
const LOCALE = 'en-US'
const fmt2 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt4 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 4 })
const fmtCompact = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, notation: 'compact', maximumFractionDigits: 1 })

export interface MoneyFormat {
  /** Prefix positive values with "+". */
  sign?: boolean
  /** Compact notation for large values ($12.4K). */
  compact?: boolean
  /** Show sub-cent precision when present (supplier costs). Default true. */
  precise?: boolean
}

/** "$0.94", "$0.0425", "-$11.00", "+$100.00", "$12.4K". */
export function formatMoney(m: Micros | null | undefined, opts?: MoneyFormat): string {
  if (m == null || Number.isNaN(m)) return '—'
  const v = m / MICROS_PER_UNIT
  let s: string
  if (opts?.compact && Math.abs(v) >= 10_000) s = fmtCompact.format(v)
  else if (opts?.precise !== false && m % CENT !== 0) s = fmt4.format(v)
  else s = fmt2.format(v)
  if (opts?.sign && m > 0) s = `+${s}`
  return s
}

/** Percentage from basis points: 2250 → "22.5%". */
export function formatBps(bps: number | null | undefined, decimals = 1) {
  if (bps == null || Number.isNaN(bps)) return '—'
  return `${(bps / 100).toFixed(decimals)}%`
}

/** Parse a user-typed decimal ("12", "0.85", "$1,250.50") into micros; null when invalid. */
export function parseMoney(input: string): Micros | null {
  const clean = input.replace(/[$,\s]/g, '')
  if (!/^-?\d+(\.\d{0,6})?$/.test(clean)) return null
  return usd(Number(clean))
}
