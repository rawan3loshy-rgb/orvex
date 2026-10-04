import { Badge, StatusBadge } from '@/components/ui'
import type { FinancialStatus, OrderChannel, OrderStatus, SupplierHealth } from '@/types/installation'
import { CHANNEL_META } from './channelMeta'

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />
}

export function FinancialBadge({ status, className }: { status: FinancialStatus; className?: string }) {
  return <StatusBadge status={status} className={className} noPulse />
}

export function HealthBadge({ health, className }: { health: SupplierHealth; className?: string }) {
  return <StatusBadge status={health} className={className} />
}

export function ChannelBadge({ channel, className }: { channel: OrderChannel; className?: string }) {
  const m = CHANNEL_META[channel]
  const Icon = m.icon
  return (
    <Badge tone="neutral" variant="outline" className={className} icon={<Icon />} title={m.hint}>
      {m.label}
    </Badge>
  )
}

/** Marks anything that talks to an external system the prototype only simulates. */
export function SimulatedBadge({ className, label = 'Simulated' }: { className?: string; label?: string }) {
  return (
    <Badge tone="neutral" variant="outline" className={className} title="Prototype: this external system is simulated — no real connection is made">
      {label}
    </Badge>
  )
}

export function ScenarioTag({ id, className }: { id: string; className?: string }) {
  return (
    <Badge tone="accent" variant="soft" className={className} title="Demo scenario — see DEMO / SIMULATION → Scenarios">
      Scenario {id}
    </Badge>
  )
}
