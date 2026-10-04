import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowRight, Building, Database, FileKey, LifeBuoy, Package, Receipt, Server, ShieldCheck } from 'lucide-react'
import { LogoMark, TenantMark } from '@/components/brand'
import { cn } from '@/lib/cn'
import { EASE } from './kitUtils'

function Chip({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-fg-2 [&_svg]:size-3.5 [&_svg]:text-fg-3', className)}>
      {icon}
      {children}
    </span>
  )
}

/**
 * Who owns what: the customer's installation holds all operational data;
 * the vendor platform only knows the commercial relationship.
 */
export function DataOwnership() {
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.25fr)_auto_minmax(0,1fr)]">
      {/* Customer side */}
      <motion.div initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }} className="relative overflow-hidden rounded-xl border border-success/25 bg-success/[0.04] p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <TenantMark />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-fg">Your infrastructure</p>
            <p className="text-[12px] text-fg-3">UnlockDesk Demo Ltd. · servers you control</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface p-3">
            <p className="mono-label flex items-center gap-1.5">
              <Server className="size-3" /> ORVEX Core
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>core-api</Chip>
              <Chip>core-worker</Chip>
              <Chip>core-scheduler</Chip>
              <Chip>Caddy</Chip>
              <Chip>Admin users & roles</Chip>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-3">
            <p className="mono-label flex items-center gap-1.5">
              <Database className="size-3" /> Your PostgreSQL
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>Orders & results</Chip>
              <Chip>Accounts & wallets</Chip>
              <Chip>Ledger & payments</Chip>
              <Chip>Supplier credentials</Chip>
              <Chip>Catalog & pricing</Chip>
              <Chip>Audit log</Chip>
            </div>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-success">
          <ShieldCheck className="size-3.5" /> Operational data never leaves this boundary.
        </p>
      </motion.div>

      {/* Connector */}
      <div className="flex flex-row items-center justify-center gap-3 py-1 lg:flex-col lg:px-2">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-mono text-[10.5px] text-fg-3">heartbeat</span>
          <span className="grid size-7 place-items-center rounded-full border border-line bg-surface text-fg-3">
            <ArrowRight className="hidden size-3.5 lg:block" />
            <ArrowDown className="size-3.5 lg:hidden" />
          </span>
          <span className="max-w-[120px] text-[11px] leading-tight text-fg-3">license ID, installation ID, version, domain</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-mono text-[10.5px] text-fg-3">pull</span>
          <span className="grid size-7 place-items-center rounded-full border border-line bg-surface text-fg-3">
            <ArrowRight className="hidden size-3.5 rotate-180 lg:block" />
            <ArrowDown className="size-3.5 rotate-180 lg:hidden" />
          </span>
          <span className="max-w-[120px] text-[11px] leading-tight text-fg-3">signed release packages</span>
        </div>
      </div>

      {/* Vendor side */}
      <motion.div initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.08 }} className="rounded-xl border border-line bg-surface-2/50 p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-fg">ORVEX Systems</p>
            <p className="text-[12px] text-fg-3">account.orvex.io · this portal</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip icon={<Building />}>Account & team</Chip>
          <Chip icon={<FileKey />}>Licenses</Chip>
          <Chip icon={<Server />}>Installation metadata</Chip>
          <Chip icon={<Receipt />}>Billing</Chip>
          <Chip icon={<Package />}>Releases</Chip>
          <Chip icon={<LifeBuoy />}>Support</Chip>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-fg-3">We see that an installation exists and which version it runs — never an order, a customer, a wallet balance or a supplier credential it holds.</p>
      </motion.div>
    </div>
  )
}

/**
 * One-line reminder of the vendor portal's scope, shown on pages where a
 * customer might expect operational data.
 */
export function VendorScopeNote({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-3', className)}>
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-fg-2" />
      <p>
        <span className="font-medium text-fg-2">Vendor portal — commercial data only.</span> ORVEX Systems has no access to your installation’s orders, customers, supplier credentials, wallet balances or database. Those live only on your server, in your admin.
      </p>
    </div>
  )
}
