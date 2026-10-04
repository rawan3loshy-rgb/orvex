import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, BookOpen, CalendarClock, Clock, Headset, HeartPulse, Inbox, LifeBuoy, Mail, MessagesSquare, Paperclip, Plus, Send, Server, Tag, UserRound } from 'lucide-react'
import { LogoMark } from '@/components/brand'
import { Avatar, Badge, Button, Card, CardBody, CardFooter, CardHeader, EmptyState, Kbd, PageHeader, SearchInput, Segmented, Select, Skeleton, StatusBadge, Textarea } from '@/components/ui'
import { useTicket, useTickets, useVendorInstallations, useVendorMutation } from '@/hooks/vendor'
import { supportService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import { brand } from '@/config/brand'
import { cn } from '@/lib/cn'
import { date, dateTime, plural, relative } from '@/lib/format'
import type { InstallationRef, SupportTicket } from '@/types/vendor'
import { Callout, EnvBadge, PriorityBars, Reveal } from './components/kit'
import { categoryLabel, installationLabel, isOpenTicket, splitAuthor, TICKET_CATEGORIES } from './components/kitUtils'
import { NewTicketModal } from './components/NewTicketModal'

type Filter = 'open' | 'awaiting' | 'resolved' | 'all'

const matches = (t: SupportTicket, f: Filter) => (f === 'all' ? true : f === 'open' ? isOpenTicket(t) : f === 'awaiting' ? t.status === 'awaiting_customer' : !isOpenTicket(t))

/* ------------------------------------------------------------------ */

function TicketRow({ t, installs, active, compact }: { t: SupportTicket; installs?: InstallationRef[]; active?: boolean; compact?: boolean }) {
  const inst = installationLabel(t.installationId, installs)
  const last = t.messages[t.messages.length - 1]
  return (
    <Link
      to={`/account/support/${t.id}`}
      className={cn('group relative block px-5 py-4 transition-colors', active ? 'bg-accent/[0.06]' : 'hover:bg-surface-2/60')}
      aria-current={active ? 'page' : undefined}
    >
      {active && <motion.span layoutId="ticket-active" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" />}
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-[13.5px] font-medium text-fg', compact ? 'line-clamp-2' : 'line-clamp-1')}>{t.subject}</p>
        {!compact && <span className="shrink-0 text-[12px] whitespace-nowrap text-fg-3">{relative(t.updatedAt)}</span>}
      </div>
      {!compact && last && (
        <p className="mt-1 line-clamp-1 text-[12.5px] text-fg-3">
          <span className="text-fg-2">{last.role === 'support' ? 'ORVEX' : splitAuthor(last.author).name}:</span> {last.body}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge status={t.status} />
        {!compact && <PriorityBars priority={t.priority} />}
        {!compact && <span className="text-[12px] text-fg-3">{categoryLabel(t.category)}</span>}
        {!compact && inst && (
          <span className="inline-flex items-center gap-1 text-[12px] text-fg-3">
            <Server className="size-3" />
            {inst.name}
          </span>
        )}
        <span className="font-mono text-[11.5px] text-fg-3">{t.id}</span>
        {compact && <span className="text-[11.5px] text-fg-3">· {relative(t.updatedAt)}</span>}
      </div>
    </Link>
  )
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 px-5 py-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Thread({ id, installs }: { id: string; installs?: InstallationRef[] }) {
  const q = useTicket(id)
  const [reply, setReply] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const send = useVendorMutation((body: string) => supportService.reply(id, body), {
    onSuccess: () => {
      setReply('')
      toast.success('Reply sent', 'Support has been notified by email.')
    },
  })
  const count = q.data?.messages.length ?? 0
  const prev = useRef(count)
  useEffect(() => {
    if (prev.current && count > prev.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    prev.current = count
  }, [count])

  const submit = () => reply.trim() && !send.isPending && send.mutate(reply.trim())

  if (q.isError) {
    return (
      <Card>
        <EmptyState icon={<Inbox />} title="Ticket not found" description={`We couldn’t find ticket ${id}.`} action={<Button to="/account/support">Back to tickets</Button>} />
      </Card>
    )
  }

  const t = q.data
  if (!t) {
    return (
      <Card className="p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-6 w-2/3" />
        <div className="mt-8 space-y-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={cn('flex gap-3', i % 2 === 0 && 'flex-row-reverse')}>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-20 w-3/4 rounded-2xl" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const inst = installationLabel(t.installationId, installs)
  const closed = !isOpenTicket(t)

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <Link to="/account/support" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg lg:hidden">
          <ArrowLeft className="size-3.5" /> All tickets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[12px] text-fg-3">{t.id}</p>
            <h2 className="mt-1 text-[18px] leading-snug font-semibold tracking-[-0.015em] text-fg">{t.subject}</h2>
          </div>
          <StatusBadge status={t.status} size="md" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-fg-3">
          <PriorityBars priority={t.priority} />
          <span className="inline-flex items-center gap-1.5">
            <Tag className="size-3.5" />
            {categoryLabel(t.category)}
          </span>
          {inst ? (
            <span className="inline-flex items-center gap-1.5">
              <Server className="size-3.5" />
              {inst.name}
              <EnvBadge env={inst.environment} />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" /> Account-level
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" />
            Opened {date(t.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Updated {relative(t.updatedAt)}
          </span>
        </div>
      </div>

      <div className="space-y-6 bg-bg-subtle/40 px-4 py-6 sm:px-6">
        <AnimatePresence initial={false}>
          {t.messages.map((m) => {
            const mine = m.role === 'customer'
            const { name, team } = splitAuthor(m.author)
            return (
              <motion.div key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
                {mine ? (
                  <Avatar name={m.author} size="md" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line">
                    <LogoMark className="size-5" />
                  </span>
                )}
                <div className={cn('flex max-w-[88%] min-w-0 flex-col sm:max-w-[76%]', mine && 'items-end')}>
                  <div className={cn('flex flex-wrap items-baseline gap-x-2 text-[12px]', mine && 'justify-end')}>
                    <span className="font-medium text-fg">{name}</span>
                    {team ? <span className="text-accent-ink">{team}</span> : <span className="text-fg-3">UnlockDesk Demo Ltd.</span>}
                    <span className="text-fg-3">· {dateTime(m.at)}</span>
                  </div>
                  <div
                    className={cn(
                      'mt-1.5 rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg',
                      mine ? 'rounded-tr-md bg-surface-3 ring-1 ring-line' : 'rounded-tl-md border border-line bg-surface shadow-card',
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-4 sm:px-6">
        {t.status === 'awaiting_customer' && (
          <Callout tone="warning" icon={<MessagesSquare />} className="mb-3 py-2.5">
            Support is waiting for your reply.
          </Callout>
        )}
        {closed && (
          <Callout tone="neutral" icon={<LifeBuoy />} className="mb-3 py-2.5">
            This ticket is {t.status}. Reply to follow up, or open a new ticket for a different issue.
          </Callout>
        )}
        <Textarea
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={`Reply to ${t.messages.find((m) => m.role === 'support') ? splitAuthor(t.messages.filter((m) => m.role === 'support').at(-1)!.author).name : 'ORVEX support'}…`}
          aria-label="Reply"
        />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            <Button variant="ghost" size="sm" icon aria-label="Attach file" onClick={() => toast.info('Demo: attachments', 'In production you can attach screenshots or a diagnostics bundle exported from System → Health.')}>
              <Paperclip />
            </Button>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>↵</Kbd> to send
            </span>
          </div>
          <Button variant="accent" size="sm" leading={<Send />} loading={send.isPending} disabled={!reply.trim()} onClick={submit}>
            Send reply
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function SlaCard({ tickets }: { tickets?: SupportTicket[] }) {
  const engineers = (tickets ?? []).flatMap((t) => t.messages.filter((m) => m.role === 'support' && m.author.includes('Support')).map((m) => splitAuthor(m.author).name))
  const named = engineers.sort((a, b) => engineers.filter((x) => x === b).length - engineers.filter((x) => x === a).length)[0] ?? 'Jonas'
  return (
    <Card className="relative overflow-hidden">
      <CardHeader icon={<Headset />} title="Your support plan" description="Professional · Priority support add-on" />
      <CardBody className="relative">
        <div className="flex items-end gap-2">
          <span className="font-display text-[40px] leading-none font-semibold tracking-[-0.04em] text-fg">4h</span>
          <span className="pb-1 text-[12.5px] text-fg-3">first response target</span>
        </div>
        <div className="mt-4 divide-y divide-line rounded-lg border border-line text-[12.5px]">
          {[
            ['Coverage', 'Mon–Fri · 08:00–18:00 CET'],
            ['Named engineer', named],
            ['Channels', 'Portal tickets & email'],
            ['Plan baseline', '8h without add-on'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-fg-3">{k}</span>
              <span className="text-right font-medium text-fg">{v}</span>
            </div>
          ))}
        </div>
      </CardBody>
      <CardFooter>
        <span>24/7 with a 1h critical SLA on Enterprise</span>
        <Link to="/account/subscription#plans" className="shrink-0 font-medium text-fg-2 hover:text-fg">
          Compare
        </Link>
      </CardFooter>
    </Card>
  )
}

export default function SupportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tickets = useTickets()
  const installs = useVendorInstallations()
  const [filter, setFilter] = useState<Filter>('open')
  const [category, setCategory] = useState('all')
  const [q, setQ] = useState('')
  const [newOpen, setNewOpen] = useState(false)

  // `?new=1` opens the new-ticket modal (adjusted during render), then the param is stripped from the URL.
  const newRequested = !!params.get('new')
  if (newRequested && !newOpen) setNewOpen(true)
  useEffect(() => {
    if (!newRequested) return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [newRequested, params, setParams])

  const all = tickets.data
  const counts = {
    open: all?.filter((t) => matches(t, 'open')).length,
    awaiting: all?.filter((t) => matches(t, 'awaiting')).length,
    resolved: all?.filter((t) => matches(t, 'resolved')).length,
    all: all?.length,
  }
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return all
      ?.filter((t) => matches(t, filter))
      .filter((t) => category === 'all' || t.category === category)
      .filter((t) => !term || t.subject.toLowerCase().includes(term) || t.id.toLowerCase().includes(term) || t.messages.some((m) => m.body.toLowerCase().includes(term)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [all, filter, category, q])

  const filters = (
    <Segmented
      size="sm"
      value={filter}
      onChange={setFilter}
      items={[
        { value: 'open', label: 'Open', count: counts.open },
        { value: 'awaiting', label: 'Awaiting you', count: counts.awaiting },
        { value: 'resolved', label: 'Resolved', count: counts.resolved },
        { value: 'all', label: 'All', count: counts.all },
      ]}
    />
  )

  const empty = (
    <EmptyState
      compact
      icon={<Inbox />}
      title={q || category !== 'all' ? 'No tickets match' : filter === 'awaiting' ? 'Nothing waiting on you' : 'No tickets here'}
      description={q || category !== 'all' ? 'Try a different search or category.' : 'When you open a ticket it shows up here with every reply.'}
      action={
        <Button size="sm" variant="secondary" leading={<Plus />} onClick={() => setNewOpen(true)}>
          New ticket
        </Button>
      }
    />
  )

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Support"
          description="Tickets with ORVEX Systems support and professional services — Core, supplier drivers, licensing and billing. We have no access to your installation’s orders, accounts or balances — for those, use its admin."
          actions={
            <>
              <Button variant="secondary" href={brand.docsUrl} leading={<BookOpen />}>
                Docs
              </Button>
              <Button variant="accent" leading={<Plus />} onClick={() => setNewOpen(true)}>
                New ticket
              </Button>
            </>
          }
        />
      </Reveal>

      {id ? (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Reveal delay={0.05} className="hidden lg:block">
            <Card className="sticky top-32 overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <Segmented
                  size="xs"
                  value={filter}
                  onChange={setFilter}
                  className="w-full [&>button]:flex-1 [&>button]:justify-center"
                  items={[
                    { value: 'open', label: 'Open', count: counts.open },
                    { value: 'resolved', label: 'Resolved', count: counts.resolved },
                    { value: 'all', label: 'All' },
                  ]}
                />
              </div>
              <div className="max-h-[calc(100dvh-220px)] divide-y divide-line overflow-y-auto">{rows ? rows.length ? rows.map((t) => <TicketRow key={t.id} t={t} installs={installs.data} active={t.id === id} compact />) : empty : <ListSkeleton rows={4} />}</div>
            </Card>
          </Reveal>
          <Reveal delay={0.08} className="min-w-0">
            <Thread key={id} id={id} installs={installs.data} />
          </Reveal>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Reveal delay={0.05} className="min-w-0">
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="no-scrollbar -mx-1 overflow-x-auto px-1">{filters}</div>
                <div className="flex gap-2">
                  <Select inputSize="sm" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...TICKET_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))]} className="w-[160px] shrink-0" />
                  <SearchInput value={q} onChange={setQ} placeholder="Search tickets…" className="min-w-0 flex-1 xl:w-[220px]" />
                </div>
              </div>
              <div className="divide-y divide-line">{rows ? rows.length ? rows.map((t) => <TicketRow key={t.id} t={t} installs={installs.data} />) : empty : <ListSkeleton />}</div>
            </Card>
          </Reveal>
          <div className="space-y-5">
            <Reveal delay={0.1}>
              <SlaCard tickets={all} />
            </Reveal>
            <Reveal delay={0.15}>
              <Card>
                <CardHeader icon={<LifeBuoy />} title="Before you open a ticket" />
                <CardBody className="space-y-1 pt-0">
                  {[
                    { icon: <BookOpen />, t: 'Self-hosting docs', d: 'Install, upgrade and troubleshoot', href: brand.docsUrl },
                    { icon: <HeartPulse />, t: 'Installation health', d: 'System → Health and provider status in your admin', to: '/admin/login' },
                    { icon: <Mail />, t: brand.supportEmail, d: 'Email creates a ticket too' },
                  ].map((l) =>
                    l.href ? (
                      <a key={l.t} href={l.href} target="_blank" rel="noreferrer" className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2">
                        <span className="text-fg-3 [&_svg]:size-4">{l.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-fg">{l.t}</span>
                          <span className="block text-[12px] text-fg-3">{l.d}</span>
                        </span>
                      </a>
                    ) : l.to ? (
                      <button key={l.t} type="button" onClick={() => navigate(l.to!)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2">
                        <span className="text-fg-3 [&_svg]:size-4">{l.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-fg">{l.t}</span>
                          <span className="block text-[12px] text-fg-3">{l.d}</span>
                        </span>
                      </button>
                    ) : (
                      <div key={l.t} className="-mx-2 flex items-center gap-3 px-2 py-2">
                        <span className="text-fg-3 [&_svg]:size-4">{l.icon}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[12.5px] text-fg">{l.t}</span>
                          <span className="block text-[12px] text-fg-3">{l.d}</span>
                        </span>
                      </div>
                    ),
                  )}
                </CardBody>
              </Card>
            </Reveal>
            {all && (
              <Reveal delay={0.2}>
                <p className="px-1 text-[12px] text-fg-3">
                  {plural(all.length, 'ticket')} since {date(all.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]!.createdAt)} ·{' '}
                  <Badge tone="neutral" className="align-middle">
                    {counts.resolved} resolved
                  </Badge>
                </p>
              </Reveal>
            )}
          </div>
        </div>
      )}

      <NewTicketModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
