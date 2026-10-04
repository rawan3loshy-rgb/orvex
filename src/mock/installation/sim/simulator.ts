/**
 * DEMO / SIMULATION — supplier behaviour and remote supplier state.
 *
 * Every simulated supplier is a tiny remote system: it has its own balance,
 * credential state, catalog and order book. Drivers talk to it exactly like a
 * real driver would talk to an HTTP API. This is what lets a timed-out order
 * later be *found* at the supplier (Lookup Supplier), and why the supplier's
 * balance can drift from our ledger while an outcome is unknown.
 *
 * The behaviour simulator lets the demo force outcomes per supplier:
 *   success · rejected (terminal) · rejected (failover-safe) · timeout · unknown
 *   · rate limited · insufficient funds · authentication error
 *   · transient network failure · slow response
 */
import type { Micros } from '@/core/money'
import type { OrderResult } from '@/core/domain'
import type { RemoteOrderState, RemoteProduct } from '@/core/ports'

export type SimBehaviour =
  | 'auto'
  | 'success'
  | 'rejected'
  | 'rejected_safe'
  | 'timeout'
  | 'unknown'
  | 'rate_limited'
  | 'insufficient_funds'
  | 'auth_error'
  | 'network_error'
  | 'slow'

export const SIM_BEHAVIOURS: { id: SimBehaviour; label: string; effect: string }[] = [
  { id: 'auto', label: 'Auto (realistic)', effect: 'Outcome follows the supplier’s health profile' },
  { id: 'success', label: 'Success', effect: 'Supplier accepts and returns a result' },
  { id: 'rejected', label: 'Rejected (terminal)', effect: 'Definitive rejection — the order is rejected, no failover' },
  { id: 'rejected_safe', label: 'Rejected (failover-safe)', effect: 'Definitive rejection mapped as safe — guarded failover to the next offer' },
  { id: 'timeout', label: 'Timeout', effect: 'Request sent, no answer — outcome UNKNOWN, order goes to Needs Review' },
  { id: 'unknown', label: 'Unknown (bad response)', effect: 'HTTP 502 after the request was sent — UNKNOWN, Needs Review' },
  { id: 'rate_limited', label: 'Rate limited', effect: 'HTTP 429 before acceptance — failover-safe' },
  { id: 'insufficient_funds', label: 'Insufficient funds', effect: 'Supplier credit too low — failover-safe, low-balance alert' },
  { id: 'auth_error', label: 'Authentication error', effect: 'Credentials rejected — failover-safe, supplier marked auth error' },
  { id: 'network_error', label: 'Transient network failure', effect: 'Connection refused — request never reached the supplier, failover-safe' },
  { id: 'slow', label: 'Slow response', effect: 'Accepted, but 3–5× slower than usual' },
]

export interface SimRule {
  supplierId: string
  behaviour: SimBehaviour
  /** null = until changed; otherwise applies to the next N attempts. */
  remaining: number | null
  setAt: string
  /** timeout / unknown only: did the request actually reach the supplier? (default: timeout yes, unknown random) */
  received?: boolean
  /** Only apply to this order (scenario scripting). */
  orderRef?: string
}

export interface RemoteOrder {
  externalRef: string
  orderId: string
  orderRef: string
  state: RemoteOrderState
  createdAt: number
  completeAt: number
  cost: Micros
  charged: boolean
  result: OrderResult | null
  rejectMessage: string | null
}

export interface RemoteSupplierState {
  supplierId: string
  balance: Micros
  credentialsValid: boolean
  maintenance: boolean
  catalog: RemoteProduct[]
  orders: Record<string, RemoteOrder>
  /** Our order ref → supplier reference (we send our ref as the REFERENCE parameter). */
  byOrderRef: Record<string, string>
  /** Supplier → our callback endpoint is signed (for inbound webhook logs). */
  nextRef: number
}

export interface SimulationState {
  rules: SimRule[]
  remote: Record<string, RemoteSupplierState>
  /** Live traffic generator. */
  traffic: { enabled: boolean; perMinute: number }
  /** Payment outcome override for the next storefront checkout. */
  nextPayment: 'succeed' | 'fail' | 'pending' | 'auto'
  /** Next verification reply: supplier confirms the result was faulty? */
  verificationFaulty: boolean
}

export function createSimulationState(): SimulationState {
  return { rules: [], remote: {}, traffic: { enabled: true, perMinute: 2 }, nextPayment: 'auto', verificationFaulty: true }
}

/** Consume the active rule for a supplier, if any. */
export function takeBehaviour(sim: SimulationState, supplierId: string, orderRef?: string): { behaviour: SimBehaviour; received?: boolean } | null {
  let i = sim.rules.findIndex((r) => r.supplierId === supplierId && r.orderRef && r.orderRef === orderRef)
  if (i < 0) i = sim.rules.findIndex((r) => r.supplierId === supplierId && !r.orderRef)
  if (i < 0) return null
  const rule = sim.rules[i]!
  if (rule.behaviour === 'auto') return null
  if (rule.remaining != null) {
    rule.remaining--
    if (rule.remaining <= 0) sim.rules.splice(i, 1)
  }
  return { behaviour: rule.behaviour, received: rule.received }
}

export function setBehaviour(sim: SimulationState, supplierId: string, behaviour: SimBehaviour, remaining: number | null, at: string, opts?: { received?: boolean; orderRef?: string }) {
  sim.rules = sim.rules.filter((r) => !(r.supplierId === supplierId && (r.orderRef ?? null) === (opts?.orderRef ?? null)))
  if (behaviour !== 'auto') sim.rules.push({ supplierId, behaviour, remaining, setAt: at, received: opts?.received, orderRef: opts?.orderRef })
}
