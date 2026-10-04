/**
 * DHRU compatibility edge.
 *
 * DHRU numeric states exist only here — at the protocol boundary — for legacy
 * reseller integrations (DHRU-compatible endpoint) and supplier drivers.
 * Inside Core everything uses named statuses.
 *
 *   DHRU 0 (new / pending) ← awaiting_payment, queued
 *   DHRU 1 (in process)    ← processing, needs_review
 *   DHRU 3 (rejected)      ← rejected, cancelled
 *   DHRU 4 (success)       ← completed
 */
import type { OrderStatus } from '../domain'
import type { RemoteOrderState } from '../ports'

export type DhruStatus = 0 | 1 | 3 | 4

export const DHRU_STATUS_LABEL: Record<DhruStatus, string> = { 0: 'New / pending', 1: 'In process', 3: 'Rejected', 4: 'Success' }

export function toDhruStatus(s: OrderStatus): DhruStatus {
  switch (s) {
    case 'awaiting_payment':
    case 'queued':
      return 0
    case 'processing':
    case 'needs_review':
      return 1
    case 'rejected':
    case 'cancelled':
      return 3
    case 'completed':
      return 4
  }
}

/** Supplier side: DHRU status → normalised remote state. */
export function fromDhruStatus(code: number): RemoteOrderState {
  if (code === 4) return 'completed'
  if (code === 3) return 'rejected'
  if (code === 1) return 'processing'
  return 'pending'
}

export const DHRU_MAPPING_TABLE: { dhru: DhruStatus; orvex: OrderStatus[]; note: string }[] = [
  { dhru: 0, orvex: ['awaiting_payment', 'queued'], note: 'Accepted, not yet sent to a supplier' },
  { dhru: 1, orvex: ['processing', 'needs_review'], note: 'Needs review is internal — DHRU clients just see "in process"' },
  { dhru: 3, orvex: ['rejected', 'cancelled'], note: 'Funds released back to the reseller wallet' },
  { dhru: 4, orvex: ['completed'], note: 'Result returned in CODE' },
]

/** DHRU-compatible actions accepted by the reseller endpoint. */
export const DHRU_ACTIONS = ['accountinfo', 'imeiservicelist', 'placeimeiorder', 'getimeiorder'] as const
export type DhruAction = (typeof DHRU_ACTIONS)[number]
