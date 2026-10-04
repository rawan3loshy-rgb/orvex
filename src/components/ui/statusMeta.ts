import type { Tone } from '@/types/common'

/**
 * Single mapping from every domain status string to a tone + label,
 * so statuses look identical everywhere in the product.
 */
export const STATUS_META: Record<string, { tone: Tone; label: string; pulse?: boolean }> = {
  // orders (fulfilment)
  awaiting_payment: { tone: 'warning', label: 'Awaiting payment' },
  queued: { tone: 'neutral', label: 'Queued' },
  needs_review: { tone: 'danger', label: 'Needs review', pulse: true },
  rejected: { tone: 'danger', label: 'Rejected' },
  // orders (financial)
  none: { tone: 'neutral', label: 'Not funded' },
  held: { tone: 'warning', label: 'Held' },
  captured: { tone: 'success', label: 'Captured' },
  released: { tone: 'neutral', label: 'Released' },
  partially_refunded: { tone: 'info', label: 'Partially refunded' },
  // supplier attempts
  sending: { tone: 'accent', label: 'Sending', pulse: true },
  accepted: { tone: 'info', label: 'Accepted' },
  not_accepted: { tone: 'warning', label: 'Not accepted' },
  unknown: { tone: 'danger', label: 'Unknown', pulse: true },
  confirmed_not_received: { tone: 'neutral', label: 'Not received' },
  // supplier health
  auth_error: { tone: 'danger', label: 'Auth error', pulse: true },
  low_balance: { tone: 'warning', label: 'Low balance' },
  circuit_open: { tone: 'danger', label: 'Circuit open', pulse: true },
  half_open: { tone: 'warning', label: 'Half-open' },
  maintenance: { tone: 'info', label: 'Maintenance' },
  // payments, verification, sync, misc
  requires_payment: { tone: 'neutral', label: 'Requires payment' },
  awaiting_supplier: { tone: 'info', label: 'Awaiting supplier', pulse: true },
  approved: { tone: 'success', label: 'Approved' },
  applied: { tone: 'success', label: 'Applied' },
  ignored: { tone: 'neutral', label: 'Ignored' },
  review_required: { tone: 'warning', label: 'Review required' },
  no_changes: { tone: 'neutral', label: 'No changes' },
  frozen: { tone: 'danger', label: 'Frozen' },
  processed: { tone: 'success', label: 'Processed' },
  duplicate_ignored: { tone: 'neutral', label: 'Duplicate ignored' },
  sent: { tone: 'success', label: 'Sent' },
  suppressed: { tone: 'neutral', label: 'Suppressed' },
  won: { tone: 'success', label: 'Won' },
  lost: { tone: 'danger', label: 'Lost' },
  updates_expired: { tone: 'warning', label: 'Updates expired' },
  guest: { tone: 'neutral', label: 'Guest' },
  // legacy / vendor
  created: { tone: 'neutral', label: 'Created' },
  processing: { tone: 'accent', label: 'Processing', pulse: true },
  pending: { tone: 'warning', label: 'Pending' },
  // pending also used for account status
  success: { tone: 'success', label: 'Success' },
  failed: { tone: 'danger', label: 'Failed' },
  refunded: { tone: 'neutral', label: 'Refunded' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
  // providers / health
  operational: { tone: 'success', label: 'Operational' },
  degraded: { tone: 'warning', label: 'Degraded', pulse: true },
  outage: { tone: 'danger', label: 'Outage', pulse: true },
  disabled: { tone: 'neutral', label: 'Disabled' },
  connected: { tone: 'success', label: 'Connected' },
  disconnected: { tone: 'neutral', label: 'Disconnected' },
  error: { tone: 'danger', label: 'Error' },
  healthy: { tone: 'success', label: 'Healthy' },
  down: { tone: 'danger', label: 'Down', pulse: true },
  attention: { tone: 'accent', label: 'Available' },
  // generic lifecycle
  active: { tone: 'success', label: 'Active' },
  suspended: { tone: 'danger', label: 'Suspended' },
  paused: { tone: 'warning', label: 'Paused' },
  draft: { tone: 'neutral', label: 'Draft' },
  deprecated: { tone: 'neutral', label: 'Deprecated' },
  revoked: { tone: 'danger', label: 'Revoked' },
  expired: { tone: 'neutral', label: 'Expired' },
  failing: { tone: 'danger', label: 'Failing', pulse: true },
  enabled: { tone: 'success', label: 'Enabled' },
  incompatible: { tone: 'warning', label: 'Incompatible' },
  invited: { tone: 'info', label: 'Invited' },
  published: { tone: 'success', label: 'Published' },
  // webhooks
  delivered: { tone: 'success', label: 'Delivered' },
  retrying: { tone: 'warning', label: 'Retrying', pulse: true },
  // vendor
  paid: { tone: 'success', label: 'Paid' },
  open: { tone: 'warning', label: 'Open' },
  void: { tone: 'neutral', label: 'Void' },
  uncollectible: { tone: 'danger', label: 'Uncollectible' },
  succeeded: { tone: 'success', label: 'Succeeded' },
  past_due: { tone: 'danger', label: 'Past due' },
  trialing: { tone: 'info', label: 'Trial' },
  grace: { tone: 'warning', label: 'Grace period' },
  online: { tone: 'success', label: 'Online', pulse: true },
  offline: { tone: 'danger', label: 'Offline' },
  awaiting_customer: { tone: 'warning', label: 'Awaiting you' },
  in_progress: { tone: 'accent', label: 'In progress' },
  resolved: { tone: 'success', label: 'Resolved' },
  closed: { tone: 'neutral', label: 'Closed' },
  investigating: { tone: 'danger', label: 'Investigating', pulse: true },
  monitoring: { tone: 'warning', label: 'Monitoring' },
  completed: { tone: 'success', label: 'Completed' },
  rolled_back: { tone: 'warning', label: 'Rolled back' },
  pass: { tone: 'success', label: 'Pass' },
  warn: { tone: 'warning', label: 'Warning' },
  fail: { tone: 'danger', label: 'Fail' },
  valid: { tone: 'success', label: 'Valid' },
  invalid: { tone: 'danger', label: 'Invalid' },
}

export function statusTone(status: string): Tone {
  return STATUS_META[status]?.tone ?? 'neutral'
}

export function statusLabel(status: string) {
  return STATUS_META[status]?.label ?? status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
