import type { HttpMethod } from '@/types/installation'

export interface ApiRequest {
  method: HttpMethod
  path: string
  query?: Record<string, unknown>
  body?: unknown
}

/**
 * A transport moves an ApiRequest to a backend and resolves the JSON payload.
 * The prototype uses in-browser mock transports; production uses HTTP.
 */
export interface Transport {
  request<T>(req: ApiRequest): Promise<T>
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function toQueryString(query?: Record<string, unknown>) {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === 'all') continue
    params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}
