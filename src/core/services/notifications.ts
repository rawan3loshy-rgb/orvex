/**
 * NotificationService — renders templates and dispatches to channels.
 * All channels are simulated in the prototype: records are stored and shown in
 * the notification center; nothing is sent to a real SMTP server, bot or phone.
 */
import { formatMoney } from '../money'
import type { CoreContext } from '../ports'
import type { NotificationChannel, NotificationRecord, NotificationTemplate, Order } from '../domain'

export interface NotifyInput {
  template: NotificationTemplate
  orderId?: string | null
  accountId?: string | null
  supplierId?: string | null
  /** Extra template variables. */
  vars?: Record<string, string>
  at?: number
}

function render(ctx: CoreContext, n: NotifyInput, order: Order | undefined): { subject: string; body: string } {
  const v = n.vars ?? {}
  const supplier = n.supplierId ? ctx.repo.suppliers.get(n.supplierId)?.name : v.supplier
  switch (n.template) {
    case 'order.completed':
      return { subject: `Your order ${order?.ref} is complete`, body: `${order?.serviceName}: ${order?.result?.summary ?? 'result ready'}.` }
    case 'order.rejected':
      return { subject: `Order ${order?.ref} could not be completed`, body: `${order?.rejection?.message ?? 'The order was rejected.'} Your ${formatMoney(order?.price.amount)} hold has been released.` }
    case 'order.needs_review':
      return { subject: `Needs review: ${order?.ref}`, body: `Supplier outcome is unknown (${v.supplier ?? supplier}). Automatic failover is blocked; funds remain held.` }
    case 'payment.received':
      return { subject: `Payment received — ${v.amount}`, body: `We received your payment ${v.ref} (${v.method}).` }
    case 'refund.issued':
      return { subject: `Refund issued — ${v.amount}`, body: `A refund for order ${order?.ref} was issued to your ${v.destination}.` }
    case 'verification.updated':
      return { subject: `Update on your verification request ${v.ref}`, body: v.message ?? 'Your request was updated.' }
    case 'supplier.low_balance':
      return { subject: `Low balance at ${supplier}`, body: `Reported balance ${v.balance} is below the ${v.threshold} threshold. Top up to avoid rejected submissions.` }
    case 'supplier.auth_error':
      return { subject: `Authentication failing at ${supplier}`, body: `${v.message ?? 'The supplier rejected our credentials.'} Orders are routed to the next offer.` }
    case 'supplier.circuit_open':
      return { subject: `Circuit opened for ${supplier}`, body: `${v.failures ?? 'Several'} consecutive failures. Traffic is paused until a half-open probe succeeds.` }
    case 'api.error_spike':
      return { subject: 'API error rate above threshold', body: v.message ?? 'Elevated 4xx/5xx responses on the native API.' }
    case 'webhook.failing':
      return { subject: `Webhook endpoint failing`, body: `${v.url}: ${v.message ?? 'deliveries are failing'}.` }
    case 'account.low_balance':
      return { subject: `Low wallet balance`, body: `Available balance is ${v.balance}. Top up to keep orders flowing.` }
  }
}

/** Dispatch a notification on every channel configured for its template. */
export function notify(ctx: CoreContext, n: NotifyInput): NotificationRecord[] {
  const route = ctx.repo.notificationRoutes.find((r) => r.template === n.template)
  if (!route || !route.enabled) return []
  const order = n.orderId ? ctx.repo.orders.get(n.orderId) : undefined
  const account = n.accountId ? ctx.repo.accounts.get(n.accountId) : order ? ctx.repo.accounts.get(order.accountId) : undefined
  // Customer notifications only for people who buy through the storefront or portal;
  // API and DHRU integrations are informed through webhooks / polling instead.
  if (route.audience === 'customer') {
    if (!account) return []
    if (order && (order.channel === 'api' || order.channel === 'dhru')) return []
  }
  const { subject, body } = render(ctx, n, order)
  const out: NotificationRecord[] = []
  for (const channel of route.channels) {
    const cfg = ctx.repo.notificationChannels.find((c) => c.channel === channel)
    if (!cfg) continue
    const recipient = route.audience === 'customer' ? recipientFor(channel, account!) : cfg.target
    out.push(
      ctx.repo.notifications.insert({
        id: ctx.ids.id('ntf'),
        at: ctx.clock.iso(n.at),
        channel,
        audience: route.audience,
        template: n.template,
        recipient,
        subject,
        body,
        status: cfg.enabled ? 'sent' : 'suppressed',
        orderId: order?.id ?? null,
        accountId: account?.id ?? null,
        supplierId: n.supplierId ?? null,
      }),
    )
  }
  return out
}

function recipientFor(channel: NotificationChannel, a: { email: string; phone: string | null; name: string }) {
  if (channel === 'email') return a.email
  if (channel === 'whatsapp') return a.phone ?? a.email
  return `@${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}
