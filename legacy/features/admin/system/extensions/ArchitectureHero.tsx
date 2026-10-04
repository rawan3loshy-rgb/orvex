import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Database, Equal, FileKey, Plus, Puzzle, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Card } from '@/components/ui'
import { LogoMark, TenantMark } from '@/components/brand'
import { cn } from '@/lib/cn'

export function ArchitectureHero({ coreVersion, extensionCount, customCount, domain }: { coreVersion?: string; extensionCount?: number; customCount?: number; domain?: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative grid gap-5 border-b border-line p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-end lg:gap-10">
        <div className="max-w-2xl">
          <div className="mono-label">Extension architecture</div>
          <h2 className="mt-1.5 font-display text-[21px] leading-snug font-semibold tracking-[-0.02em] text-fg sm:text-[23px]">
            Customisations live in extensions, <span className="text-fg-2">so Core updates never overwrite them.</span>
          </h2>
          <p className="mt-1.5 text-[13.5px] text-fg-2">
            ORVEX Core is replaced as a whole on every signed release. Your catalog, supplier mappings and routing stay in your own database — and everything specific to your business, like the DSN Batch Adapter or VIP routing for TechRepair Pro, ships as a versioned extension that declares which Core versions it supports.
          </p>
        </div>
        <ul className="grid gap-2 text-[12.5px] text-fg-2">
          <Fact icon={<FileKey />}>Packages are signed (Ed25519) and verified before install.</Fact>
          <Fact icon={<ShieldCheck />}>Each extension declares a Core range — checked before every update.</Fact>
          <Fact icon={<Database />}>Extension config lives in your database, next to your orders.</Fact>
        </ul>
      </div>

      <div className="relative grid items-stretch gap-2 bg-bg-subtle/50 p-5 sm:p-6 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.15fr]">
        <Block i={0} n="01" icon={<LogoMark className="size-5" />} title="Core" value={coreVersion ? `ORVEX Core ${coreVersion}` : 'ORVEX Core'} detail="Signed releases from ORVEX Systems. Replaced as a whole on update." />
        <Operator i={1}>
          <Plus />
        </Operator>
        <Block i={2} n="02" icon={<SlidersHorizontal />} title="Configuration" value="Catalog, mappings, routing, pricing" detail="Stored in your PostgreSQL. Migrations upgrade it — never reset it." />
        <Operator i={3}>
          <Plus />
        </Operator>
        <Block
          i={4}
          n="03"
          icon={<Puzzle />}
          title="Extensions"
          value={extensionCount != null ? `${extensionCount} installed · ${customCount ?? 0} custom` : 'Adapters, field types, rules'}
          detail="Supplier adapters, field types and rules with a declared Core range."
        />
        <Operator i={5}>
          <Equal />
        </Operator>
        <Block i={6} n="04" highlight icon={<TenantMark className="size-5 text-[10px]" />} title="Your installation" value={domain ?? 'portal.unlockdesk-demo.com'} detail="Your server, your database, your resellers — updated independently." />
      </div>
    </Card>
  )
}

function Block({ icon, n, title, value, detail, highlight, i }: { icon: ReactNode; n: string; title: string; value: string; detail: string; highlight?: boolean; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative flex flex-col gap-2.5 overflow-hidden rounded-xl border bg-surface p-3.5 shadow-card sm:flex-row sm:items-center sm:gap-4 xl:flex-col xl:items-stretch xl:gap-2.5',
        highlight ? 'border-accent/45' : 'border-line',
      )}
    >
      {highlight && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
      <div className="flex items-center gap-2.5 sm:w-52.5 sm:shrink-0 xl:w-auto">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{icon}</span>
        <span className="mono-label">
          <span className={cn('mr-1.5', highlight ? 'text-accent-ink' : 'text-fg-3/70')}>{n}</span>
          {title}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold text-fg">{value}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{detail}</p>
      </div>
    </motion.div>
  )
}

/** Operator on a hairline — vertical when blocks stack, horizontal on wide screens. */
function Operator({ children, i }: { children: ReactNode; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 + i * 0.06, type: 'spring', stiffness: 400, damping: 22 }}
      className="relative grid place-items-center py-0.5 xl:px-0.5"
    >
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line-strong xl:hidden" />
      <span aria-hidden className="absolute inset-x-0 top-1/2 hidden h-px -translate-y-1/2 bg-line-strong xl:block" />
      <span className="relative grid size-7 place-items-center rounded-full border border-line bg-surface text-fg-3 [&_svg]:size-3.5">{children}</span>
    </motion.div>
  )
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-3">
      {icon}
      <span>{children}</span>
    </li>
  )
}
