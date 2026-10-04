/** ISO-8601 timestamp string. */
export type ISODate = string

/** Monetary amount in the installation's base currency (USD in the demo). */
export type Money = number

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface PageQuery {
  page?: number
  pageSize?: number
  search?: string
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface TimePoint {
  t: ISODate
  v: number
}

/** A generic labelled series used by reusable charts. */
export interface Series {
  key: string
  label: string
  color?: string
  points: TimePoint[]
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
