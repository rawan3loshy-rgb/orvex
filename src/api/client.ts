import type { Transport } from './transport'

export interface ApiClient {
  get<T>(path: string, query?: object): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  delete<T>(path: string): Promise<T>
}

export function createApiClient(transport: Transport): ApiClient {
  return {
    get: (path, query) => transport.request({ method: 'GET', path, query: query as Record<string, unknown> | undefined }),
    post: (path, body) => transport.request({ method: 'POST', path, body }),
    put: (path, body) => transport.request({ method: 'PUT', path, body }),
    patch: (path, body) => transport.request({ method: 'PATCH', path, body }),
    delete: (path) => transport.request({ method: 'DELETE', path }),
  }
}
