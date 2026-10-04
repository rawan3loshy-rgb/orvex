/**
 * Operational records: after-care (verification), notifications, webhooks,
 * API keys and request logs, idempotency, audit, admin identity and jobs.
 */
import type { Micros } from '../money'
import type { Actor, ISODate } from './common'

/* ------------------------------------------------------------------------- */
/*  Verification (after-care is part of the order lifecycle)                 */
/* ------------------------------------------------------------------------- */
export type VerificationReason = 'code_not_working' | 'wrong_result' | 'result_missing' | 'other'
export type VerificationStatus = 'open' | 'awaiting_supplier' | 'approved' | 'rejected'

export interface VerificationRequest {
  id: string
  ref: string
  orderId: string
  accountId: string
  reason: VerificationReason
  message: string
  status: VerificationStatus
  createdAt: ISODate
  updatedAt: ISODate
  /** Supplier verification request reference, when one was sent. */
  supplierTicket: string | null
  resolution: { action: 'refund_approved' | 'rejected' | 'result_corrected'; note: string; by: Actor; at: ISODate; refundId: string | null } | null
  events: { at: ISODate; title: string; detail: string; actor: Actor }[]
}

/* ------------------------------------------------------------------------- */
/*  Notifications (simulated channels)                                       */
/* ------------------------------------------------------------------------- */
export type NotificationChannel = 'email' | 'telegram' | 'whatsapp'
export type NotificationTemplate =
  | 'order.completed'
  | 'order.rejected'
  | 'order.needs_review'
  | 'payment.received'
  | 'refund.issued'
  | 'verification.updated'
  | 'supplier.low_balance'
  | 'supplier.auth_error'
  | 'supplier.circuit_open'
  | 'api.error_spike'
  | 'webhook.failing'
  | 'account.low_balance'

export interface NotificationRecord {
  id: string
  at: ISODate
  channel: NotificationChannel
  audience: 'customer' | 'operator'
  template: NotificationTemplate
  recipient: string
  subject: string
  body: string
  status: 'sent' | 'failed' | 'suppressed'
  orderId: string | null
  accountId: string | null
  supplierId: string | null
}

export interface NotificationRoute {
  template: NotificationTemplate
  audience: 'customer' | 'operator'
  channels: NotificationChannel[]
  enabled: boolean
}

export interface NotificationChannelConfig {
  channel: NotificationChannel
  enabled: boolean
  /** e.g. "SMTP (simulated)", "Telegram Bot (simulated)". */
  transport: string
  target: string
}

/* ------------------------------------------------------------------------- */
/*  API keys & request logs                                                  */
/* ------------------------------------------------------------------------- */
export type ApiScope = 'services:read' | 'orders:read' | 'orders:write' | 'account:read' | 'webhooks:manage'

export interface ApiKey {
  id: string
  accountId: string
  name: string
  /** Public prefix, e.g. `orx_live_4f2a`. */
  prefix: string
  last4: string
  /** Only a hash of the secret is stored (shown truncated). */
  hash: string
  environment: 'live' | 'test'
  scopes: ApiScope[]
  ipAllowlist: string[]
  rateLimitPerMin: number
  /** Key may also authenticate the DHRU-compatible endpoint (username + key). */
  dhruCompat: boolean
  status: 'active' | 'revoked'
  createdAt: ISODate
  createdBy: string
  lastUsedAt: ISODate | null
  expiresAt: ISODate | null
}

export interface ApiLogEntry {
  id: string
  requestId: string
  at: ISODate
  protocol: 'native' | 'dhru'
  method: string
  path: string
  /** Normalised endpoint, e.g. `POST /v1/orders`. */
  endpoint: string
  status: number
  latencyMs: number
  accountId: string | null
  apiKeyId: string | null
  keyPrefix: string | null
  ip: string
  userAgent: string
  idempotencyKey: string | null
  replayed: boolean
  errorCode: string | null
  requestBody: string | null
  responseBody: string
  orderId: string | null
}

/** Idempotency is scoped to the account, across channels and keys. */
export interface IdempotencyRecord {
  accountId: string
  key: string
  requestHash: string
  orderId: string | null
  channel: string
  createdAt: ISODate
  expiresAt: ISODate
  replays: number
}

/* ------------------------------------------------------------------------- */
/*  Webhooks (Standard Webhooks signing)                                     */
/* ------------------------------------------------------------------------- */
export type WebhookEventType =
  | 'order.created'
  | 'order.processing'
  | 'order.completed'
  | 'order.rejected'
  | 'order.needs_review'
  | 'order.cancelled'
  | 'order.refunded'
  | 'account.balance_low'
  | 'service.updated'

export interface WebhookEndpoint {
  id: string
  /** null = installation-level (operator) endpoint. */
  accountId: string | null
  url: string
  description: string
  events: WebhookEventType[]
  status: 'active' | 'disabled' | 'failing'
  secretMasked: string
  createdAt: ISODate
}

export interface WebhookDeliveryAttempt {
  n: number
  at: ISODate
  httpStatus: number | null
  latencyMs: number
  error: string | null
}

export interface WebhookDelivery {
  id: string
  endpointId: string
  /** `webhook-id` header — stable across retries, used by receivers to de-duplicate. */
  messageId: string
  event: WebhookEventType
  orderId: string | null
  accountId: string | null
  payload: string
  /** Standard Webhooks headers as sent. */
  headers: { 'webhook-id': string; 'webhook-timestamp': string; 'webhook-signature': string }
  status: 'pending' | 'delivered' | 'retrying' | 'failed'
  attempts: WebhookDeliveryAttempt[]
  nextRetryAt: ISODate | null
  createdAt: ISODate
}

/** Inbound webhook (supplier callback or payment gateway notification). */
export interface InboundWebhook {
  id: string
  source: 'supplier' | 'payment_gateway'
  sourceId: string
  sourceName: string
  receivedAt: ISODate
  type: string
  signature: 'valid' | 'invalid' | 'unsigned'
  status: 'processed' | 'duplicate_ignored' | 'rejected'
  note: string
  payload: string
  orderId: string | null
  paymentIntentId: string | null
}

/* ------------------------------------------------------------------------- */
/*  Admin identity, permissions, audit                                       */
/* ------------------------------------------------------------------------- */
export type Permission =
  | 'orders.read'
  | 'orders.manage'
  | 'orders.review'
  | 'refunds.create'
  | 'accounts.manage'
  | 'ledger.adjust'
  | 'payments.manage'
  | 'catalog.manage'
  | 'pricing.manage'
  | 'suppliers.manage'
  | 'suppliers.credentials'
  | 'storefront.manage'
  | 'developer.manage'
  | 'roles.manage'
  | 'system.manage'
  | 'audit.read'

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[] | ['*']
  system: boolean
}

export interface AdminSession {
  id: string
  device: string
  ip: string
  location: string
  createdAt: ISODate
  lastSeenAt: ISODate
  current: boolean
}

export interface AdminUser {
  id: string
  name: string
  email: string
  roleId: string
  status: 'active' | 'invited' | 'disabled'
  mfa: boolean
  lastActiveAt: ISODate | null
  createdAt: ISODate
  color: string
  sessions: AdminSession[]
}

export type AuditSeverity = 'info' | 'notice' | 'warning' | 'critical'

export interface AuditEvent {
  id: string
  at: ISODate
  actor: Actor
  action: string
  target: { type: string; id: string; label: string }
  summary: string
  reason: string | null
  ip: string
  device: string
  severity: AuditSeverity
  changes: { field: string; from: string; to: string }[]
  /** Permission that authorised the action. */
  permission: Permission | null
}

/* ------------------------------------------------------------------------- */
/*  Jobs (the PostgreSQL job queue, simulated)                               */
/* ------------------------------------------------------------------------- */
export type JobKind =
  | 'order.dispatch'
  | 'attempt.response'
  | 'attempt.poll'
  | 'payment.settle'
  | 'webhook.deliver'
  | 'verification.supplier_reply'
  | 'supplier.probe'
  | 'order.expire_payment'

export interface Job {
  id: string
  kind: JobKind
  dueAt: number
  payload: Record<string, string>
  createdAt: number
}

/* ------------------------------------------------------------------------- */
/*  Wallet statement line (projection for portals)                           */
/* ------------------------------------------------------------------------- */
export interface WalletLine {
  txId: string
  ref: string
  at: ISODate
  kind: string
  description: string
  orderId: string | null
  orderRef: string | null
  /** Change to available balance. */
  available: Micros
  /** Change to held balance. */
  held: Micros
  availableAfter: Micros
  heldAfter: Micros
}
