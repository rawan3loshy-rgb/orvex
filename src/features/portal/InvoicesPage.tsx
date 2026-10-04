import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CalendarClock, ChevronRight, CircleCheck, CreditCard, Download, FileSearch, FileText, Receipt, Wallet } from 'lucide-react'
import { Button, Card, ConfirmDialog, DataTable, Drawer, EmptyState, KpiCard, PageHeader, SearchInput, Segmented, Skeleton, StatusBadge, type Column } from '@/components/ui'
import { useInvoice, useInvoices, usePayments, useSubscription, useVendorAccount, useVendorMutation } from '@/hooks/vendor'
import { billingService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { date, dateShort, money, plural } from '@/lib/format'
import type { Invoice } from '@/types/vendor'
import { Reveal } from './components/kit'
import { daysUntil } from './components/kitUtils'
import { InvoiceDocument } from './components/InvoiceDocument'

type Filter = 'all' | 'open' | 'paid'

function period(inv: Invoice) {
  if (inv.periodStart === inv.periodEnd) return date(inv.periodStart)
  return `${dateShort(inv.periodStart)} – ${date(inv.periodEnd)}`
}

export default function InvoicesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const invoices = useInvoices()
  const sub = useSubscription()
  const account = useVendorAccount()
  const payments = usePayments()
  const detail = useInvoice(id)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [confirmPay, setConfirmPay] = useState(false)

  // Keep the last invoice rendered while the drawer animates out (state adjusted during render).
  const [last, setLast] = useState<Invoice | undefined>(undefined)
  if (detail.data && detail.data !== last) setLast(detail.data)
  const shown = id ? (detail.data ?? (last?.id === id ? last : undefined)) : last

  const pay = useVendorMutation(billingService.payInvoice, {
    onSuccess: (inv) => {
      setConfirmPay(false)
      const billing = account.data?.team.find((m) => m.role === 'Billing')
      toast.success(`${inv.number} paid`, `${money(inv.total)} charged. A receipt was sent to ${billing?.email ?? 'your billing contact'}.`)
    },
  })

  const all = invoices.data
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return all
      ?.filter((i) => (filter === 'all' ? true : filter === 'open' ? i.status === 'open' : i.status === 'paid'))
      .filter((i) => !term || i.number.toLowerCase().includes(term) || i.lines.some((l) => l.description.toLowerCase().includes(term)))
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }, [all, filter, q])

  const open = all?.filter((i) => i.status === 'open') ?? []
  const outstanding = open.reduce((a, i) => a + i.total, 0)
  const year = new Date().getFullYear()
  const paidYear = all?.filter((i) => i.status === 'paid' && new Date(i.issuedAt).getFullYear() === year) ?? []
  const pm = sub.data?.paymentMethod
  const pmLabel = pm ? `${pm.brand} •••• ${pm.last4}` : 'your card on file'
  const paidWith = shown ? payments.data?.find((p) => p.invoiceId === shown.id && p.status === 'succeeded')?.method : undefined

  const close = () => navigate('/account/invoices')

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice',
      sortValue: (i) => i.number,
      cell: (i) => (
        <div className="min-w-0">
          <p className="font-mono text-[12.5px] font-medium text-fg">{i.number}</p>
          <p className="max-w-[280px] truncate text-[12px] text-fg-3">{i.lines[0]?.description}</p>
        </div>
      ),
    },
    { key: 'period', header: 'Period', hideBelow: 'md', cell: (i) => <span className="whitespace-nowrap text-fg-2">{period(i)}</span> },
    { key: 'issued', header: 'Issued', sortValue: (i) => i.issuedAt, cell: (i) => <span className="whitespace-nowrap text-fg-2 tabular">{date(i.issuedAt)}</span> },
    {
      key: 'due',
      header: 'Due',
      hideBelow: 'lg',
      sortValue: (i) => i.dueAt,
      cell: (i) => {
        const overdue = i.status === 'open' && daysUntil(i.dueAt) < 0
        return <span className={cn('whitespace-nowrap tabular', overdue ? 'font-medium text-danger' : i.status === 'open' ? 'text-warning' : 'text-fg-3')}>{date(i.dueAt)}</span>
      },
    },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (i) => i.total, cell: (i) => <span className="font-medium text-fg">{money(i.total)}</span> },
    { key: 'status', header: 'Status', align: 'right', cell: (i) => <StatusBadge status={i.status} /> },
    { key: 'go', header: '', width: 'w-10', cell: () => <ChevronRight className="ml-auto size-4 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" /> },
  ]

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Invoices"
          description="Every invoice ORVEX Systems has issued to your company — subscriptions, add-ons and professional services."
          actions={
            <Button variant="secondary" leading={<Download />} onClick={() => toast.success('Demo: export ready', `${plural(all?.length ?? 0, 'invoice')} exported to invoices-${year}.csv`)}>
              Export CSV
            </Button>
          }
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Outstanding"
            icon={<Wallet />}
            loading={!all}
            value={<span className={cn(outstanding > 0 && 'text-warning')}>{money(outstanding)}</span>}
            footer={open.length ? `${plural(open.length, 'open invoice')} · due ${date(open[0]!.dueAt)}` : 'All invoices are settled'}
            onClick={open.length ? () => navigate(`/account/invoices/${open[0]!.id}`) : undefined}
          />
          <KpiCard label={`Paid in ${year}`} icon={<CircleCheck />} loading={!all} value={money(paidYear.reduce((a, i) => a + i.total, 0))} footer={`${plural(paidYear.length, 'invoice')} · ${pmLabel}`} />
          <KpiCard
            label="Next invoice"
            icon={<CalendarClock />}
            loading={!sub.data}
            value={sub.data ? date(sub.data.nextRenewalAt) : '—'}
            footer={sub.data ? `${money(sub.data.amount)} · ${sub.data.planName} + ${sub.data.addOns.map((a) => a.name).join(', ')}` : undefined}
          />
        </div>
      </Reveal>

      <Reveal delay={0.1} className="mt-5">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <Segmented
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: 'All', count: all?.length },
                { value: 'open', label: 'Open', count: all?.filter((i) => i.status === 'open').length },
                { value: 'paid', label: 'Paid', count: all?.filter((i) => i.status === 'paid').length },
              ]}
            />
            <SearchInput value={q} onChange={setQ} placeholder="Search number or description…" className="sm:w-[280px]" />
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            loading={invoices.isLoading}
            rowKey={(i) => i.id}
            onRowClick={(i) => navigate(`/account/invoices/${i.id}`)}
            selectedKey={id ?? null}
            minWidth={560}
            skeletonRows={6}
            empty={<EmptyState compact icon={<FileSearch />} title="No invoices match" description={q ? `Nothing found for “${q}”.` : 'No invoices with this status.'} />}
          />
        </Card>
      </Reveal>

      <Drawer
        open={!!id}
        onClose={close}
        width="lg"
        icon={<FileText />}
        title={shown ? <span className="font-mono">{shown.number}</span> : 'Invoice'}
        description={shown ? `${money(shown.total)} · issued ${date(shown.issuedAt)}` : id}
        bodyClassName="bg-bg-subtle/60"
        footer={
          shown && (
            <>
              <span className="mr-auto hidden text-[12px] text-fg-3 sm:block">{shown.status === 'paid' ? `Paid ${date(shown.paidAt)}` : `Due ${date(shown.dueAt)}`}</span>
              <Button variant="secondary" leading={<Download />} onClick={() => toast.success('Demo: PDF generated', `${shown.number}.pdf — no file is downloaded in the prototype.`)}>
                Download PDF
              </Button>
              {shown.status === 'open' && (
                <Button variant="accent" leading={<CreditCard />} onClick={() => setConfirmPay(true)}>
                  Pay {money(shown.total)}
                </Button>
              )}
            </>
          )
        }
      >
        {detail.isError && !shown ? (
          <EmptyState icon={<Receipt />} title="Invoice not found" description={`We couldn’t find invoice ${id}.`} action={<Button onClick={close}>Back to invoices</Button>} />
        ) : shown ? (
          <InvoiceDocument invoice={shown} account={account.data} paidWith={paidWith} />
        ) : (
          <div className="space-y-5 rounded-xl border border-line bg-surface p-6">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-14" />
            <Skeleton className="h-28" />
            <Skeleton className="ml-auto h-20 w-60" />
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmPay && !!shown}
        onClose={() => setConfirmPay(false)}
        title={shown ? `Pay ${shown.number}?` : 'Pay invoice'}
        description={shown ? `${money(shown.total)} will be charged to ${pmLabel}.` : undefined}
        confirmLabel={shown ? `Pay ${money(shown.total)}` : 'Pay'}
        loading={pay.isPending}
        onConfirm={() => shown && pay.mutate(shown.id)}
      >
        <p className="text-[12.5px] text-fg-3">Payments are processed by our payment provider. A receipt is emailed to your billing contacts.</p>
      </ConfirmDialog>
    </div>
  )
}
