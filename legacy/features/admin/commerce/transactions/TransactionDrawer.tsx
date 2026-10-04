import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, ReceiptText } from 'lucide-react'
import { ProviderMark, ServiceIcon } from '@/components/brand'
import { Button, DescriptionList, Drawer, MonoValue, StatusBadge } from '@/components/ui'
import { useOrder, useServices } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { date, money, relative, time } from '@/lib/format'
import type { Provider, Reseller, Transaction } from '@/types/installation'
import { deviceOf } from '@/features/admin/orders/lib'
import { ResellerAvatar } from '../resellers/shared'
import { METHOD_META, TYPE_META, TypeGlyph, orderNumber, refundKind } from './meta'

function LinkRow({ to, icon, title, sub }: { to: string; icon: ReactNode; title: ReactNode; sub: ReactNode }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3 transition-colors hover:border-line-strong hover:bg-surface-2">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{title}</p>
        <p className="truncate text-[12px] text-fg-3">{sub}</p>
      </div>
      <ArrowUpRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
    </Link>
  )
}

export function TransactionDrawer({ tx: current, onClose, resellers, providers }: { tx: Transaction | null; onClose: () => void; resellers: Map<string, Reseller>; providers: Map<string, Provider> }) {
  const open = !!current
  // Keep the last transaction rendered while the drawer animates out.
  const [tx, setTx] = useState(current)
  useEffect(() => {
    if (current) setTx(current)
  }, [current])
  const reseller = tx?.resellerId ? resellers.get(tx.resellerId) : undefined
  const provider = tx?.providerId ? providers.get(tx.providerId) : undefined
  // Pull the linked order so the ledger line reads as a GSM job: service + IMEI.
  const order = useOrder(tx?.orderId ?? undefined)
  const services = useServices()
  const linked = order.data && order.data.id === tx?.orderId ? order.data : undefined
  const linkedIcon = linked ? (services.data?.find((s) => s.id === linked.serviceId)?.icon ?? 'box') : 'box'
  const device = linked ? deviceOf(linked.input) : null
  const kind = tx ? refundKind(tx) : null
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="md"
      icon={tx ? <TypeGlyph type={tx.type} /> : undefined}
      title={tx ? TYPE_META[tx.type].label : ''}
      description={tx ? <MonoValue value={tx.id} /> : undefined}
      footer={
        tx && (
          <>
            {tx.orderId && (
              <Button variant="secondary" size="sm" to={`/admin/orders/${tx.orderId}`} leading={<ReceiptText />}>
                Open order
              </Button>
            )}
            {tx.resellerId && (
              <Button variant="primary" size="sm" to={`/admin/resellers/${tx.resellerId}`}>
                Open reseller
              </Button>
            )}
            {tx.providerId && (
              <Button variant="primary" size="sm" to={`/admin/providers/${tx.providerId}`}>
                Open supplier
              </Button>
            )}
          </>
        )
      }
    >
      {tx && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="rounded-xl border border-line bg-surface-2/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mono-label">Amount</div>
                <div className={cn('mt-1.5 font-display text-[30px] leading-none font-semibold tracking-[-0.025em] tabular', tx.amount > 0 ? 'text-success' : 'text-fg')}>{money(tx.amount, { sign: true })}</div>
                <div className="mt-2 text-[12.5px] text-fg-3">
                  {tx.amount > 0 ? 'Credit' : 'Debit'} · {kind ?? TYPE_META[tx.type].hint}
                </div>
              </div>
              <StatusBadge status={tx.status} size="md" />
            </div>
          </div>

          <section>
            <h3 className="mb-1 mono-label">Details</h3>
            <DescriptionList
              items={[
                { label: 'Description', value: tx.description },
                { label: 'Date', value: date(tx.at), hint: `${time(tx.at, true)} · ${relative(tx.at)}` },
                { label: 'Type', value: TYPE_META[tx.type].label },
                { label: 'Method', value: METHOD_META[tx.method].label },
                { label: 'Balance after', value: tx.balanceAfter == null ? <span className="text-fg-3">Not tracked</span> : money(tx.balanceAfter) },
                { label: 'Transaction ID', value: <MonoValue value={tx.id} className="text-fg" /> },
              ]}
            />
          </section>

          {(tx.resellerId || tx.providerId || tx.orderId) && (
            <section className="space-y-2">
              <h3 className="mono-label">Linked records</h3>
              {tx.resellerId && (
                <LinkRow
                  to={`/admin/resellers/${tx.resellerId}`}
                  icon={<ResellerAvatar reseller={{ id: tx.resellerId, name: reseller?.name ?? tx.resellerId }} />}
                  title={reseller?.name ?? tx.resellerId}
                  sub={reseller ? `Reseller · current balance ${money(reseller.balance)}` : 'Reseller'}
                />
              )}
              {tx.providerId && (
                <LinkRow to={`/admin/providers/${tx.providerId}`} icon={<ProviderMark id={tx.providerId} size="md" />} title={provider?.name ?? tx.providerId} sub={provider ? `Supplier · wallet ${money(provider.balance)}` : 'Supplier'} />
              )}
              {tx.orderId && (
                <LinkRow
                  to={`/admin/orders/${tx.orderId}`}
                  icon={
                    linked ? (
                      <ServiceIcon icon={linkedIcon} category={linked.serviceCategory} className="size-8" />
                    ) : (
                      <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-fg-2">
                        <ReceiptText className="size-4" />
                      </span>
                    )
                  }
                  title={linked ? `Order #${linked.number} · ${linked.serviceName}` : `Order #${orderNumber(tx.orderId)}`}
                  sub={
                    <span className="flex min-w-0 items-center gap-2">
                      {device ? (
                        <span className="font-mono tabular">
                          {device.label} {device.display}
                        </span>
                      ) : (
                        <span className="font-mono">{tx.orderId}</span>
                      )}
                      {linked && <StatusBadge status={linked.status} />}
                    </span>
                  }
                />
              )}
            </section>
          )}

          {tx.status === 'pending' && <p className="rounded-lg border border-warning/25 bg-warning/[0.06] px-3 py-2.5 text-[12.5px] text-fg-2">Awaiting confirmation from the payment method. The balance updates automatically once the funds settle.</p>}
          {tx.status === 'failed' && <p className="rounded-lg border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-[12.5px] text-fg-2">This payment did not complete. No balance change was applied.</p>}
        </div>
      )}
    </Drawer>
  )
}
