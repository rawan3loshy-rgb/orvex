/**
 * MockPaymentGateway — card, PayPal, bank transfer and manual payments, all simulated.
 * It never talks to a real processor. `complete` returns the webhook events a
 * real gateway would POST back; they go through the normal inbound handler.
 */
import type { Rng } from '@/lib/random'
import type { IdGenerator } from '@/core/ids'
import type { Clock, PaymentGateway } from '@/core/ports'
import type { GatewayEvent, PaymentIntent } from '@/core/domain'

const GATEWAY_NAME: Record<PaymentIntent['method'], string> = {
  card: 'Demo Card Gateway',
  paypal: 'Demo PayPal (sandbox)',
  bank_transfer: 'Bank transfer (manual confirmation)',
  manual: 'Manual payment',
}

export function createMockGateway(deps: { ids: IdGenerator; clock: Clock; rng: Rng }): PaymentGateway {
  const evt = (intent: PaymentIntent, type: GatewayEvent['type']): GatewayEvent => ({
    id: `evt_${deps.ids.token(20)}`,
    gateway: GATEWAY_NAME[intent.method],
    type,
    receivedAt: deps.clock.iso(),
    paymentIntentId: intent.id,
    signature: 'valid',
    status: 'processed',
    duplicateOf: null,
    payload: JSON.stringify({ type, data: { object: 'payment_intent', id: intent.gatewayRef, amount: (intent.amount / 1e6).toFixed(2), currency: 'usd', metadata: { orvex_payment: intent.ref } } }, null, 2),
  })
  return {
    createIntent(intent) {
      const prefix = intent.method === 'paypal' ? 'PAYID-' : intent.method === 'card' ? 'pi_demo_' : intent.method === 'bank_transfer' ? 'BT-' : 'MAN-'
      return { gatewayRef: `${prefix}${deps.ids.token(14)}` }
    },
    complete(intent, outcome) {
      if (outcome === 'fail') return [evt(intent, 'payment.failed')]
      const manual = intent.method === 'bank_transfer' || intent.method === 'manual'
      // Bank transfers / manual payments: the payer's "I have paid" only makes them pending;
      // an operator confirmation (second call) makes them succeed.
      if (outcome === 'pending' || (manual && intent.status === 'requires_payment')) return intent.status === 'requires_payment' ? [evt(intent, 'payment.pending')] : []
      return [evt(intent, 'payment.succeeded')]
    },
    refund(intent) {
      return { ok: true, gatewayRef: `re_demo_${deps.ids.token(12)}`, message: `Refund accepted by ${GATEWAY_NAME[intent.method]} (simulated)` }
    },
  }
}
