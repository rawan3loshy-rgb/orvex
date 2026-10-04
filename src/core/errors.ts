/**
 * Domain errors. Each carries a stable machine code and the HTTP status the
 * API layer maps it to (the native API, portal API and admin API all share them).
 */
export class DomainError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(code: string, message: string, status = 422, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

export const notFound = (entity: string, id: string) => new DomainError('not_found', `${entity} ${id} not found`, 404)
export const invalid = (message: string, details?: unknown) => new DomainError('validation_failed', message, 422, details)
export const conflict = (code: string, message: string, details?: unknown) => new DomainError(code, message, 409, details)
export const forbidden = (code: string, message: string, details?: unknown) => new DomainError(code, message, 403, details)
export const paymentRequired = (message: string, details?: unknown) => new DomainError('insufficient_balance', message, 402, details)

export function assert(cond: unknown, err: () => DomainError): asserts cond {
  if (!cond) throw err()
}
