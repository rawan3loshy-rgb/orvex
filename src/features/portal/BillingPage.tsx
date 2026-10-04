import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { BadgeCheck, Building, CircleCheck, CreditCard, ExternalLink, Landmark, LockKeyhole, Mail, MapPin, Pencil, Receipt, ShieldCheck, Users } from 'lucide-react'
import { Avatar, Badge, Button, Card, CardBody, CardHeader, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, Stat, StatusBadge, type Column } from '@/components/ui'
import { useInvoices, usePayments, useSubscription, useVendorAccount, useVendorMutation } from '@/hooks/vendor'
import { accountService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { date, money } from '@/lib/format'
import type { Payment, Subscription } from '@/types/vendor'
import { CardSkeleton, IconTile, Reveal, SignalRings } from './components/kit'
import { BILLING_ADDRESS, COUNTRIES } from './components/kitUtils'

/* ------------------------------------------------------------------ */

function CardVisual({ pm, holder }: { pm: Subscription['paymentMethod']; holder: string }) {
  return (
    <div className="[perspective:900px]">
      <motion.div
        whileHover={{ rotateX: 5, rotateY: -7, y: -2 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="relative aspect-[1.586] w-full max-w-[340px] overflow-hidden rounded-2xl bg-fg p-5 text-bg shadow-pop"
      >
        <SignalRings className="absolute -right-24 -bottom-16 h-60 w-95 opacity-[0.22]" count={7} node={null} />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <span aria-hidden className="relative grid h-7 w-9 grid-cols-3 gap-px overflow-hidden rounded-md bg-bg/25 p-0.75 ring-1 ring-bg/30 ring-inset">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="rounded-xs bg-bg/20" />
              ))}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase opacity-70">
              <span className="size-1.5 rounded-full bg-accent" />
              Default
            </span>
          </div>
          <p className="font-mono text-[16px] tracking-[0.2em] tabular sm:text-[17px]">•••• •••• •••• {pm.last4}</p>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[9px] tracking-[0.16em] uppercase opacity-50">Card holder</p>
              <p className="truncate text-[12.5px] font-medium tracking-wide uppercase">{holder}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-[0.16em] uppercase opacity-50">Expires</p>
              <p className="font-mono text-[12.5px] tabular">
                {String(pm.expMonth).padStart(2, '0')}/{String(pm.expYear).slice(-2)}
              </p>
            </div>
            <span className="font-display text-[20px] leading-none font-bold tracking-tight italic">{pm.brand.toUpperCase()}</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function UpdatePaymentModal({ open, onClose, pm }: { open: boolean; onClose: () => void; pm?: Subscription['paymentMethod'] }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<CreditCard />}
      title="Update payment method"
      description="Card details are collected on our payment provider’s secure, hosted page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            loading={busy}
            trailing={<ExternalLink />}
            onClick={() => {
              setBusy(true)
              setTimeout(() => {
                setBusy(false)
                onClose()
                toast.info('Demo: hosted payment page', 'In production you’d continue on the payment provider’s page and return here when done.')
              }, 900)
            }}
          >
            Continue to secure page
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/60 p-4">
          <IconTile icon={<LockKeyhole />} tone="success" />
          <div className="text-[13px]">
            <p className="font-medium text-fg">ORVEX never sees your full card number</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">The provider tokenizes the card. We only keep the brand, last four digits and expiry — today that’s {pm ? `${pm.brand} •••• ${pm.last4}, exp ${String(pm.expMonth).padStart(2, '0')}/${pm.expYear}` : 'your current card'}.</p>
          </div>
        </div>
        <ol className="space-y-3">
          {[
            ['Continue to the secure page', 'Opens in this tab on the provider’s domain.'],
            ['Enter your new card', 'Your bank may ask you to confirm with 3-D Secure.'],
            ['Return to your account', 'The new card becomes the default for renewals and open invoices.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface font-mono text-[11px] text-fg-2">{i + 1}</span>
              <div className="pt-0.5">
                <p className="text-[13px] font-medium text-fg">{t}</p>
                <p className="text-[12.5px] text-fg-3">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-1.5">
          <Badge icon={<ShieldCheck />}>PCI DSS Level 1 provider</Badge>
          <Badge icon={<BadgeCheck />}>3-D Secure 2</Badge>
          <Badge icon={<LockKeyhole />}>Tokenized</Badge>
        </div>
        <p className="text-[12px] text-fg-3">
          Prefer SEPA bank transfer?{' '}
          <Link to="/account/support?new=1" onClick={onClose} className="text-accent-ink hover:underline">
            Ask our billing team
          </Link>
          .
        </p>
      </div>
    </Modal>
  )
}

function EditBillingModal({ open, onClose, company, country, vatId }: { open: boolean; onClose: () => void; company: string; country: string; vatId: string }) {
  const [form, setForm] = useState({ company, country, vat: '' })
  // Reset the form when the modal opens or the saved details change (adjusted during render).
  const [prev, setPrev] = useState({ open, company, country })
  if (prev.open !== open || prev.company !== company || prev.country !== country) {
    setPrev({ open, company, country })
    if (open) setForm({ company, country, vat: '' })
  }
  const save = useVendorMutation(accountService.updateAccount, {
    success: 'Billing details updated',
    onSuccess: onClose,
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Building />}
      title="Edit billing details"
      description="Used on future invoices. Past invoices are not changed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} disabled={!form.company.trim()} onClick={() => save.mutate({ company: form.company.trim(), country: form.country, ...(form.vat.trim() ? { vatId: form.vat.trim().toUpperCase() } : {}) })}>
            Save details
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Legal company name">
          <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </Field>
        <Field label="Country">
          <Select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} options={COUNTRIES} />
        </Field>
        <Field label="VAT ID" optional hint={`Current: ${vatId}. Leave empty to keep it — new IDs are validated against VIES.`}>
          <Input mono value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} placeholder="NL000000000B01" />
        </Field>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

export default function BillingPage() {
  const sub = useSubscription()
  const account = useVendorAccount()
  const payments = usePayments()
  const invoices = useInvoices()
  const [updateOpen, setUpdateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const pm = sub.data?.paymentMethod
  const acc = account.data
  const invoiceNo = Object.fromEntries((invoices.data ?? []).map((i) => [i.id, i.number]))
  const year = new Date().getFullYear()
  const succeeded = payments.data?.filter((p) => p.status === 'succeeded') ?? []
  const paidThisYear = succeeded.filter((p) => new Date(p.at).getFullYear() === year).reduce((a, p) => a + p.amount, 0)
  const failed = payments.data?.filter((p) => p.status === 'failed') ?? []
  const lastPayment = succeeded.slice().sort((a, b) => b.at.localeCompare(a.at))[0]
  const contacts = acc?.team.filter((m) => m.role === 'Billing' || m.role === 'Owner') ?? []

  const recoveryOf = (p: Payment) => payments.data?.find((x) => x.invoiceId === p.invoiceId && x.status === 'succeeded' && x.at > p.at)

  const columns: Column<Payment>[] = [
    { key: 'at', header: 'Date', cell: (p) => <span className="whitespace-nowrap text-fg-2 tabular">{date(p.at)}</span>, sortValue: (p) => p.at, width: 'w-[130px]' },
    {
      key: 'description',
      header: 'Description',
      cell: (p) => {
        const rec = p.status === 'failed' ? recoveryOf(p) : undefined
        return (
          <div className="min-w-0">
            <p className="truncate text-fg">{p.description}</p>
            {rec && (
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-success">
                <CircleCheck className="size-3" /> Recovered — retried {date(rec.at)} with {rec.method}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'method',
      header: 'Method',
      hideBelow: 'md',
      cell: (p) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-fg-2">
          {p.method.startsWith('SEPA') ? <Landmark className="size-3.5 text-fg-3" /> : <CreditCard className="size-3.5 text-fg-3" />}
          {p.method}
        </span>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice',
      hideBelow: 'lg',
      cell: (p) => (
        <Link to={`/account/invoices/${p.invoiceId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] text-fg-2 hover:text-accent-ink hover:underline">
          {invoiceNo[p.invoiceId] ?? p.invoiceId}
        </Link>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (p) => p.amount, cell: (p) => <span className={cn('font-medium', p.status === 'failed' ? 'text-fg-3 line-through decoration-fg-3/50' : 'text-fg')}>{money(p.amount)}</span> },
    { key: 'status', header: 'Status', align: 'right', cell: (p) => <StatusBadge status={p.status} /> },
  ]

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Billing"
          description="Payment method, billing details and payment history for your ORVEX subscription."
          actions={
            <Button variant="secondary" to="/account/invoices" leading={<Receipt />}>
              Invoices
            </Button>
          }
        />
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Payment method */}
        <Reveal delay={0.05} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader icon={<CreditCard />} title="Payment method" description="Charged automatically for renewals and invoices" />
            <CardBody className="space-y-5">
              {pm && acc ? <CardVisual pm={pm} holder={acc.company} /> : <Skeleton className="aspect-[1.586] w-full max-w-[340px] rounded-2xl" />}
              {pm ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-fg">
                      {pm.brand} ending in {pm.last4}
                    </p>
                    <p className="text-[12.5px] text-fg-3">
                      Expires {String(pm.expMonth).padStart(2, '0')}/{pm.expYear} · Default
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setUpdateOpen(true)}>
                    Update payment method
                  </Button>
                </div>
              ) : (
                <Skeleton className="h-9 w-full" />
              )}
            </CardBody>
          </Card>
        </Reveal>

        {/* Billing details */}
        <Reveal delay={0.1} className="lg:col-span-3">
          {acc ? (
            <Card className="h-full">
              <CardHeader
                icon={<Building />}
                title="Billing details"
                description="Printed on every invoice from ORVEX Systems"
                actions={
                  <Button size="sm" variant="ghost" leading={<Pencil />} onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                }
              />
              <CardBody>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="mono-label mb-1.5">Company</p>
                      <p className="text-[13.5px] font-medium text-fg">{acc.company}</p>
                    </div>
                    <div>
                      <p className="mono-label mb-1.5 flex items-center gap-1.5">
                        <MapPin className="size-3" /> Billing address
                      </p>
                      <div className="text-[13px] leading-relaxed text-fg-2">
                        {BILLING_ADDRESS.slice(0, 2).map((l) => (
                          <p key={l}>{l}</p>
                        ))}
                        <p>{acc.country}</p>
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-fg-3">
                        Updated 2 Jun 2026 via{' '}
                        <Link to="/account/support/TCK-1902" className="font-mono text-fg-2 hover:text-accent-ink hover:underline">
                          TCK-1902
                        </Link>
                      </p>
                    </div>
                    <div>
                      <p className="mono-label mb-1.5">VAT ID</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] text-fg">{acc.vatId}</span>
                        <Badge tone="success" icon={<BadgeCheck />}>
                          VIES verified
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11.5px] text-fg-3">EU reverse charge applies — invoices show 0% VAT.</p>
                    </div>
                  </div>
                  <div>
                    <p className="mono-label mb-2 flex items-center gap-1.5">
                      <Users className="size-3" /> Billing contacts
                    </p>
                    <div className="space-y-2">
                      {contacts.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                          <Avatar name={c.name} size="sm" color={c.role === 'Billing' ? 'var(--c2)' : 'var(--c1)'} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                            <p className="flex items-center gap-1 truncate text-[12px] text-fg-3">
                              <Mail className="size-3 shrink-0" />
                              {c.email}
                            </p>
                          </div>
                          <Badge>{c.role === 'Billing' ? 'Invoices' : 'Alerts'}</Badge>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] text-fg-3">
                      Invoices and receipts go to Billing members; payment failures also alert the Owner.{' '}
                      <Link to="/account/settings#team" className="text-accent-ink hover:underline">
                        Manage team
                      </Link>
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <CardSkeleton rows={7} className="h-full" />
          )}
        </Reveal>
      </div>

      {/* Payment history */}
      <Reveal delay={0.15} className="mt-5">
        <Card className="overflow-hidden">
          <CardHeader icon={<Receipt />} title="Payment history" description="Every charge and attempt on your account" />
          <div className="grid grid-cols-1 gap-px border-y border-line bg-line sm:grid-cols-3">
            <div className="bg-surface px-5 py-4">
              {payments.data ? <Stat label={`Paid in ${year}`} value={money(paidThisYear)} sub={`${succeeded.filter((p) => new Date(p.at).getFullYear() === year).length} successful payments`} /> : <Skeleton className="h-14 w-40" />}
            </div>
            <div className="bg-surface px-5 py-4">
              {payments.data ? <Stat label="Last payment" value={lastPayment ? date(lastPayment.at) : '—'} sub={lastPayment ? `${money(lastPayment.amount)} · ${lastPayment.method}` : undefined} /> : <Skeleton className="h-14 w-40" />}
            </div>
            <div className="bg-surface px-5 py-4">
              {payments.data ? (
                <Stat
                  label="Failed payments"
                  value={failed.length}
                  tone={failed.some((f) => !recoveryOf(f)) ? 'danger' : undefined}
                  sub={failed.length === 0 ? 'None — all charges succeeded' : failed.every((f) => recoveryOf(f)) ? 'All recovered by automatic retry' : 'Action needed'}
                />
              ) : (
                <Skeleton className="h-14 w-40" />
              )}
            </div>
          </div>
          <DataTable
            columns={columns}
            rows={payments.data}
            loading={payments.isLoading}
            rowKey={(p) => p.id}
            minWidth={560}
            skeletonRows={6}
            rowClassName={(p) => (p.status === 'failed' ? 'bg-danger/[0.035]' : undefined)}
            empty={<EmptyState compact icon={<Receipt />} title="No payments yet" description="Charges will appear here after your first invoice." />}
          />
        </Card>
      </Reveal>

      <UpdatePaymentModal open={updateOpen} onClose={() => setUpdateOpen(false)} pm={pm} />
      {acc && <EditBillingModal open={editOpen} onClose={() => setEditOpen(false)} company={acc.company} country={acc.country} vatId={acc.vatId} />}
    </div>
  )
}
