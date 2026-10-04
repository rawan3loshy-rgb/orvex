/**
 * Identifiers.
 *
 * Internal ids are prefixed and opaque (`ord_8k2f…`). Public references shown to
 * customers are short, unambiguous Crockford base-32 codes (`ORD-7K3P9Q`) that
 * are random — never sequential — so they cannot be enumerated. Guest order
 * tracking uses a separate long random token; a reference alone never reveals
 * an order's result.
 */
import type { Rng } from '@/lib/random'

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const LOWER = 'abcdefghijkmnpqrstuvwxyz23456789'

export interface IdGenerator {
  /** `ord_k3p9q2m8x1` */
  id(prefix: string): string
  /** `ORD-7K3P9Q` */
  ref(prefix: string, len?: number): string
  /** 32-char URL-safe random token. */
  token(len?: number): string
  /** Random hex string. */
  hex(len: number): string
}

export function createIdGenerator(rng: Rng): IdGenerator {
  const pick = (alphabet: string, len: number) => {
    let s = ''
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(rng.next() * alphabet.length)]
    return s
  }
  const issued = new Set<string>()
  const unique = (make: () => string) => {
    for (let i = 0; i < 20; i++) {
      const v = make()
      if (!issued.has(v)) {
        issued.add(v)
        return v
      }
    }
    throw new Error('id space exhausted')
  }
  return {
    id: (prefix) => unique(() => `${prefix}_${pick(LOWER, 10)}`),
    ref: (prefix, len = 6) => unique(() => `${prefix}-${pick(CROCKFORD, len)}`),
    token: (len = 32) => pick(BASE62, len),
    hex: (len) => rng.hex(len),
  }
}

/** Stable short hash (FNV-1a) — used for request fingerprints in idempotency checks. */
export function fingerprint(value: unknown): string {
  const s = typeof value === 'string' ? value : stableStringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`
}
