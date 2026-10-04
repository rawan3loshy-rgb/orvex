import { ApiError, toQueryString, type Transport } from './transport'

/**
 * Real HTTP transport. Drop-in replacement for the mock transport once a
 * backend exists. Auth uses an httpOnly session cookie issued by the
 * installation (admin) or the vendor platform (account portal).
 */
export function createHttpTransport(baseUrl: string): Transport {
  return {
    async request<T>({ method, path, query, body }: Parameters<Transport['request']>[0]): Promise<T> {
      const res = await fetch(`${baseUrl}${path}${toQueryString(query)}`, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : null
      if (!res.ok) {
        throw new ApiError(res.status, json?.error?.code ?? 'http_error', json?.error?.message ?? res.statusText, json?.error?.details)
      }
      return json as T
    },
  }
}
