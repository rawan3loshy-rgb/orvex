/**
 * Job runner — the worker side of the PostgreSQL job queue (simulated).
 * Each handler is idempotent: it re-reads state and does nothing if the job is stale.
 */
import type { CoreContext, SubmitResponse } from '../ports'
import type { Job } from '../domain'
import { dispatch, onAttemptResponse, pollAttempt } from './worker'
import { expirePayment } from './payments'
import { supplierVerificationReply } from './verification'
import { deliver } from '../services/webhooks'

export interface JobHooks {
  /** Decide a simulated supplier verification reply (demo infrastructure). */
  verificationOutcome(verificationId: string): boolean
}

export function runJob(ctx: CoreContext, job: Job, hooks: JobHooks) {
  switch (job.kind) {
    case 'order.dispatch':
      return dispatch(ctx, job.payload.orderId!)
    case 'attempt.response':
      return onAttemptResponse(ctx, job.payload.orderId!, job.payload.attemptId!, JSON.parse(job.payload.response!) as SubmitResponse)
    case 'attempt.poll':
      return pollAttempt(ctx, job.payload.orderId!, job.payload.attemptId!)
    case 'webhook.deliver':
      return deliver(ctx, job.payload.deliveryId!)
    case 'order.expire_payment':
      return expirePayment(ctx, job.payload.orderId!)
    case 'verification.supplier_reply':
      return supplierVerificationReply(ctx, job.payload.verificationId!, hooks.verificationOutcome(job.payload.verificationId!))
    case 'payment.settle':
    case 'supplier.probe':
      return
  }
}
