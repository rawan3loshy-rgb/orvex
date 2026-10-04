/** Shared domain primitives. */
export type ISODate = string

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

/** Who performed an action. Every command records its actor. */
export interface Actor {
  type: 'admin' | 'member' | 'api_key' | 'guest' | 'dhru' | 'system' | 'supplier' | 'gateway'
  id: string
  name: string
  /** Admin role or member role at the time of the action. */
  role?: string
}

export const SYSTEM: Actor = { type: 'system', id: 'system', name: 'ORVEX Core' }
export const WORKER: Actor = { type: 'system', id: 'worker', name: 'Order worker' }

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
