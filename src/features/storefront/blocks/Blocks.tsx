/**
 * Typed block renderer. Catalog blocks hold only service ids / queries — names,
 * prices and availability are resolved live by the storefront API.
 */
import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import DOMPurify from 'dompurify'
import { ArrowRight, Check, ChevronDown, Quote, ScanBarcode, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useStoreCatalog, useStoreService } from '@/hooks/installation'
import { validateField } from '@/core/fields'
import '@/core/verticals/gsm'
import type { Block, FieldDef, StorefrontLink } from '@/types/installation'
import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useStore } from '../lib/storeContext'
import { turnaroundLabel } from '../lib/format'
import { SearchBox } from '../components/SearchBox'
import {
  Btn,
  cardCls,
  CardGridSkeleton,
  Checks,
  Container,
  EmptyBlock,
  ErrorState,
  IconTile,
  inputCls,
  Pill,
  Price,
  RowListSkeleton,
  Section,
  SectionHead,
  ServiceCard,
  ServiceRow,
  Skel,
  Turnaround,
  UnavailablePill,
} from '../ui'

type B<T extends Block['type']> = Extract<Block, { type: T }>

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </>
  )
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock b={block} />
    case 'rich_text':
      return <RichTextBlock b={block} />
    case 'image':
      return <ImageBlock b={block} />
    case 'faq':
      return <FaqBlock b={block} />
    case 'testimonials':
      return <TestimonialsBlock b={block} />
    case 'cta':
      return <CtaBlock b={block} />
    case 'catalog_grid':
      return <CatalogGridBlock b={block} />
    case 'service_spotlight':
      return <SpotlightBlock b={block} />
    case 'category_tiles':
      return <CategoryTilesBlock b={block} />
    case 'trust_bar':
      return <TrustBarBlock b={block} />
    case 'steps':
      return <StepsBlock b={block} />
    case 'quick_check':
      return <QuickCheckBlock b={block} />
    case 'custom_embed':
      return <CustomEmbedBlock b={block} />
  }
}

function LinkBtn({ link, variant = 'primary', size = 'lg' }: { link: StorefrontLink; variant?: 'primary' | 'secondary' | 'inverse' | 'ghost'; size?: 'md' | 'lg' }) {
  const { hrefOf } = useStore()
  return (
    <Btn href={hrefOf(link.target)} variant={variant} size={size} trailing={variant === 'primary' || variant === 'inverse' ? <ArrowRight /> : undefined}>
      {link.label}
    </Btn>
  )
}

/* ------------------------------------------------------------------------- */
/*  Hero                                                                     */
/* ------------------------------------------------------------------------- */
function HeroBlock({ b }: { b: B<'hero'> }) {
  const { config } = useStore()
  const media = b.mediaId ? config.media.find((m) => m.id === b.mediaId) : undefined
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_70%),radial-gradient(50%_50%_at_0%_100%,color-mix(in_oklab,var(--accent-2)_8%,transparent),transparent_70%)]" />
      <Container className={cn('relative grid items-center gap-12 py-14 sm:py-20', media && 'lg:grid-cols-[1.08fr_0.92fr] lg:gap-14')}>
        <div className={cn(!media && 'mx-auto max-w-3xl text-center')}>
          {b.eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-fg-2 shadow-card">
              <span className="size-1.5 rounded-full bg-accent" />
              {b.eyebrow}
            </span>
          )}
          <h1 className="sf-h mt-5 text-[38px] leading-[1.05] font-semibold text-balance text-fg sm:text-[50px] lg:text-[56px]">{b.title}</h1>
          {b.subtitle && <p className={cn('mt-5 max-w-xl text-[17px] leading-relaxed text-pretty text-fg-3 sm:text-[18.5px]', !media && 'mx-auto')}>{b.subtitle}</p>}
          {b.search && (
            <div className={cn('mt-8 max-w-xl', !media && 'mx-auto')}>
              <SearchBox />
            </div>
          )}
          <div className={cn('mt-6 flex flex-wrap items-center gap-3', !media && 'justify-center')}>
            <LinkBtn link={b.primary} size={b.search ? 'md' : 'lg'} />
            {b.secondary && <LinkBtn link={b.secondary} variant="secondary" size={b.search ? 'md' : 'lg'} />}
          </div>
          <ul className={cn('mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-medium text-fg-3', !media && 'justify-center')}>
            {['IMEI validated before you pay', 'Private tracking link', 'Funds released if we can’t deliver'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-success" strokeWidth={2.6} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        {media && (
          <div className="relative mx-auto w-full max-w-[520px] lg:mx-0">
            <div role="img" aria-label={media.alt} className="aspect-[5/4.4] w-full rounded-[var(--sf-r-lg)] shadow-pop" style={{ background: media.preview }}>
              <div className="h-full w-full rounded-[var(--sf-r-lg)] bg-[radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] [background-size:18px_18px]" />
            </div>
            <ExampleResultCard />
          </div>
        )}
      </Container>
    </section>
  )
}

/** Decorative, clearly-labelled example of what a check returns. */
function ExampleResultCard() {
  return (
    <div className="absolute right-4 bottom-[-18px] left-4 rounded-[var(--sf-r-lg)] border border-line bg-surface p-4 shadow-pop sm:left-auto sm:w-[330px] lg:right-[-18px]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold tracking-wide text-fg-3 uppercase">Example result</span>
        <Pill tone="success" dot>
          Clean
        </Pill>
      </div>
      <div className="sf-h mt-2 text-[20px] font-semibold">T-Mobile US</div>
      <div className="mt-0.5 font-mono text-[12.5px] text-fg-3">IMEI 35693803•••3809</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[13px]">
        <div>
          <dt className="text-fg-3">SIM-lock</dt>
          <dd className="font-semibold">Unlocked</dd>
        </div>
        <div>
          <dt className="text-fg-3">Blacklist</dt>
          <dd className="font-semibold text-success">Clean</dd>
        </div>
      </dl>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Content blocks                                                           */
/* ------------------------------------------------------------------------- */
function RichTextBlock({ b }: { b: B<'rich_text'> }) {
  const paras = b.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <Section>
      <div className="max-w-3xl">
        {b.title && <h2 className="sf-h text-[30px] leading-tight font-semibold sm:text-[38px]">{b.title}</h2>}
        <div className="sf-prose mt-4 text-[16.5px] leading-[1.75] text-fg-2">
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </Section>
  )
}

function ImageBlock({ b }: { b: B<'image'> }) {
  const { config } = useStore()
  const m = config.media.find((x) => x.id === b.mediaId)
  return (
    <Section className="py-8 sm:py-10">
      <figure className={cn(b.width === 'content' && 'max-w-3xl')}>
        <div role="img" aria-label={m?.alt ?? b.caption} className="w-full rounded-[var(--sf-r-lg)] border border-line" style={{ background: m?.preview ?? 'var(--surface-2)', aspectRatio: m ? `${m.width} / ${m.height}` : '16 / 9', maxHeight: 520 }} />
        {b.caption && <figcaption className="mt-3 text-[14px] text-fg-3">{b.caption}</figcaption>}
      </figure>
    </Section>
  )
}

function FaqBlock({ b }: { b: B<'faq'> }) {
  return (
    <Section>
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHead title={b.title || 'Frequently asked questions'} subtitle="Can’t find what you need? Track your order or contact us with your order reference." className="mb-0" />
        <Accordion items={b.items} />
      </div>
    </Section>
  )
}

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const id = useId()
  return (
    <div className={cn(cardCls, 'divide-y divide-line')}>
      {items.map((it, i) => {
        const isOpen = open === i
        return (
          <div key={i}>
            <h3>
              <button type="button" aria-expanded={isOpen} aria-controls={`${id}-${i}`} onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[16px] font-semibold text-fg transition-colors hover:bg-surface-2/60">
                {it.q}
                <ChevronDown className={cn('size-5 shrink-0 text-fg-3 transition-transform duration-200', isOpen && 'rotate-180 text-accent-ink')} />
              </button>
            </h3>
            <div id={`${id}-${i}`} hidden={!isOpen} className="px-5 pb-5 text-[15px] leading-relaxed text-fg-3">
              {it.a}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TestimonialsBlock({ b }: { b: B<'testimonials'> }) {
  return (
    <Section tone="subtle">
      <SectionHead title={b.title} center />
      <div className="grid gap-4 md:grid-cols-3">
        {b.items.map((t, i) => (
          <figure key={i} className={cn(cardCls, 'flex flex-col p-6')}>
            <Quote className="size-6 text-accent-ink opacity-70" aria-hidden />
            <blockquote className="mt-3 flex-1 text-[15.5px] leading-relaxed text-fg-2">“{t.quote}”</blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <span className="grid size-9 place-items-center rounded-full bg-accent/12 text-[13px] font-bold text-accent-ink">{t.name.slice(0, 1)}</span>
              <span>
                <span className="block text-[14px] font-semibold text-fg">{t.name}</span>
                <span className="block text-[13px] text-fg-3">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  )
}

function CtaBlock({ b }: { b: B<'cta'> }) {
  const brand = b.tone === 'brand'
  return (
    <Section>
      <div className={cn('relative overflow-hidden rounded-[var(--sf-r-lg)] px-6 py-10 sm:px-12 sm:py-14', brand ? 'bg-accent text-accent-fg' : cn(cardCls, 'bg-surface'))}>
        {brand && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_100%_0%,rgb(255_255_255/0.16),transparent_60%),radial-gradient(40%_70%_at_0%_100%,rgb(0_0_0/0.14),transparent_60%)]" />}
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="sf-h text-[26px] leading-tight font-semibold sm:text-[34px]">{b.title}</h2>
            {b.body && <p className={cn('mt-3 text-[16px] leading-relaxed', brand ? 'opacity-85' : 'text-fg-3')}>{b.body}</p>}
          </div>
          <LinkBtn link={b.cta} variant={brand ? 'inverse' : 'primary'} />
        </div>
      </div>
    </Section>
  )
}

function TrustBarBlock({ b }: { b: B<'trust_bar'> }) {
  return (
    <section className="border-b border-line bg-bg-subtle">
      <Container className="grid grid-cols-2 gap-y-6 py-8 md:grid-cols-4">
        {b.items.map((t, i) => (
          <div key={i} className={cn('px-2 text-center md:px-4', i > 0 && 'md:border-l md:border-line')}>
            <div className="sf-h text-[26px] font-semibold text-fg sm:text-[30px]">{t.value}</div>
            <div className="mt-1 text-[13.5px] text-fg-3">{t.label}</div>
          </div>
        ))}
      </Container>
    </section>
  )
}

function StepsBlock({ b }: { b: B<'steps'> }) {
  return (
    <Section tone="subtle">
      <SectionHead title={b.title} center />
      <ol className="grid gap-4 md:grid-cols-3">
        {b.items.map((s, i) => (
          <li key={i} className={cn(cardCls, 'relative p-6')}>
            <span className="sf-h grid size-10 place-items-center rounded-full bg-accent text-[16px] font-semibold text-accent-fg">{i + 1}</span>
            <h3 className="sf-h mt-4 text-[18px] font-semibold">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-3">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function CustomEmbedBlock({ b }: { b: B<'custom_embed'> }) {
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(b.html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta'],
        FORBID_ATTR: ['style', 'srcdoc'],
      }),
    [b.html],
  )
  return (
    <Section className="py-8 sm:py-10">
      <div className={cn(cardCls, 'sf-embed p-6 text-[15px] leading-relaxed text-fg-2')} aria-label={b.label} dangerouslySetInnerHTML={{ __html: clean }} />
    </Section>
  )
}

/* ------------------------------------------------------------------------- */
/*  Catalog blocks (live)                                                    */
/* ------------------------------------------------------------------------- */
function CatalogGridBlock({ b }: { b: B<'catalog_grid'> }) {
  const { config, to } = useStore()
  const q = useStoreCatalog(b.query)
  const cat = b.query.categoryId ? config.categories.find((c) => c.id === b.query.categoryId) : undefined
  const action = cat ? (
    <SfLink href={to(`/site/c/${cat.slug}`)} className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-accent-ink hover:underline">
      View all {cat.name.toLowerCase()} <ArrowRight className="size-4" />
    </SfLink>
  ) : undefined
  return (
    <Section className={b.layout === 'list' ? 'py-8 sm:py-10' : undefined}>
      {(b.title || b.subtitle) && <SectionHead title={b.title} subtitle={b.subtitle || undefined} action={b.layout === 'grid' ? action : undefined} className={b.layout === 'list' ? 'mb-5 sm:mb-6' : undefined} />}
      <CatalogResults layout={b.layout} showPrices={b.showPrices} query={q} skeleton={Math.min(b.query.limit || 6, 6)} />
    </Section>
  )
}

export function CatalogResults({ query, layout, showPrices, skeleton = 6 }: { query: ReturnType<typeof useStoreCatalog>; layout: 'grid' | 'list'; showPrices: boolean; skeleton?: number }) {
  if (query.isLoading) return layout === 'grid' ? <CardGridSkeleton count={skeleton} /> : <RowListSkeleton count={Math.min(skeleton, 4)} />
  if (query.isError) return <ErrorState title="Services could not be loaded" message={query.error?.message} onRetry={() => void query.refetch()} />
  const list = query.data ?? []
  if (!list.length) return <EmptyBlock icon={<ScanBarcode />} title="No services here right now" body="This collection is empty at the moment — try another category or search the catalog." />
  if (layout === 'list')
    return (
      <div className={cn(cardCls, 'divide-y divide-line overflow-hidden')}>
        {list.map((s) => (
          <ServiceRow key={s.id} card={s} showPrice={showPrices} />
        ))}
      </div>
    )
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((s) => (
        <ServiceCard key={s.id} card={s} showPrice={showPrices} />
      ))}
    </div>
  )
}

function SpotlightBlock({ b }: { b: B<'service_spotlight'> }) {
  const { to } = useStore()
  const q = useStoreCatalog({ serviceIds: [b.serviceId], limit: 1, sort: 'popular' })
  const s = q.data?.[0]
  if (q.isSuccess && !s) return null
  return (
    <Section>
      <div className={cn(cardCls, 'grid overflow-hidden md:grid-cols-[1.2fr_1fr]')}>
        <div className="p-7 sm:p-10">
          <Pill tone="brand" icon={<ShieldCheck />}>
            Featured service
          </Pill>
          <h2 className="sf-h mt-4 text-[26px] leading-tight font-semibold sm:text-[32px]">{b.title || s?.name}</h2>
          {b.body && <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-fg-3">{b.body}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            {s ? (
              <Btn href={to(`/site/services/${s.slug}`)} size="lg" trailing={<ArrowRight />} disabled={!s.available}>
                {s.available ? 'Order now' : 'Temporarily unavailable'}
              </Btn>
            ) : (
              <Skel className="h-[52px] w-40" />
            )}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-4 border-t border-line bg-bg-subtle p-7 sm:p-10 md:border-t-0 md:border-l">
          {!s ? (
            <>
              <Skel className="h-6 w-2/3" />
              <Skel className="h-10 w-28" />
              <Skel className="h-4 w-1/2" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <IconTile name={s.icon} />
                <div>
                  <div className="text-[15.5px] font-semibold text-fg">{s.name}</div>
                  <div className="text-[13px] text-fg-3">{s.categoryName}</div>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <Price value={s.price} unavailable={!s.available} className="text-[36px]" />
                <span className="text-[13.5px] text-fg-3">per device</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Turnaround card={s} />
                {!s.available && <UnavailablePill />}
              </div>
              <p className="text-[13px] text-fg-3">Price shown live from our catalog — you pay exactly this at checkout.</p>
            </>
          )}
        </div>
      </div>
    </Section>
  )
}

function CategoryTilesBlock({ b }: { b: B<'category_tiles'> }) {
  const { config, to } = useStore()
  const cats = [...config.categories].filter((c) => (b.categoryIds === 'all' ? true : b.categoryIds.includes(c.id))).sort((a, c) => a.sort - c.sort)
  return (
    <Section>
      <SectionHead title={b.title} action={<SfLink href={to('/site/services')} className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-accent-ink hover:underline">All services <ArrowRight className="size-4" /></SfLink>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <SfLink key={c.id} href={to(`/site/c/${c.slug}`)} className={cn(cardCls, 'group flex items-start gap-4 p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop')}>
            <IconTile name={c.icon} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="sf-h text-[17px] font-semibold text-fg">{c.name}</h3>
                <ArrowRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-ink" />
              </div>
              <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-fg-3">{c.description}</p>
              <div className="mt-2 text-[12.5px] font-semibold text-fg-3">{c.services} services</div>
            </div>
          </SfLink>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------------- */
/*  Quick check — inline IMEI validation, then continue with IMEI prefilled  */
/* ------------------------------------------------------------------------- */
const FALLBACK_IMEI: FieldDef = { key: 'imei', label: 'IMEI', type: 'gsm.imei', required: true, placeholder: '15-digit IMEI (dial *#06#)', help: 'Dial *#06# on the device, or find it in Settings → About.' }

function QuickCheckBlock({ b }: { b: B<'quick_check'> }) {
  const { to } = useStore()
  const navigate = useNavigate()
  const svc = useStoreService(b.serviceId)
  const field = svc.data?.fields.find((f) => f.type === 'gsm.imei') ?? FALLBACK_IMEI
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const v = validateField(field, value)
  const err = touched && value ? v.error : null
  const id = useId()
  const s = svc.data

  const submit = () => {
    setTouched(true)
    if (v.error || !s) return
    navigate(to(`/site/services/${s.slug}?${field.key}=${encodeURIComponent(v.value)}`))
  }

  return (
    <Section>
      <div className={cn(cardCls, 'relative grid gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center')}>
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-accent/[0.07] blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-wide text-accent-ink uppercase">
            <ScanBarcode className="size-4" /> Quick check
          </span>
          <h2 className="sf-h mt-3 text-[26px] leading-tight font-semibold sm:text-[32px]">{b.title}</h2>
          {b.body && <p className="mt-3 max-w-md text-[16px] leading-relaxed text-fg-3">{b.body}</p>}
          {s ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
              <span className="font-semibold text-fg">{s.name}</span>
              <Price value={s.price} unavailable={!s.available} className="text-[18px]" />
              <Turnaround card={s} />
            </div>
          ) : svc.isLoading ? (
            <Skel className="mt-5 h-5 w-64" />
          ) : null}
        </div>
        <form
          className="relative grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          noValidate
        >
          <label htmlFor={id} className="text-[14px] font-semibold text-fg">
            {field.label}
          </label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode="numeric"
              autoComplete="off"
              placeholder={field.placeholder ?? '15-digit IMEI'}
              aria-invalid={!!err}
              aria-describedby={`${id}-help`}
              className={cn(inputCls, 'h-[52px] font-mono text-[17px] tracking-wider')}
            />
            <Btn type="submit" size="lg" trailing={<ArrowRight />} disabled={!!s && !s.available}>
              Continue
            </Btn>
          </div>
          <div id={`${id}-help`} className="flex min-h-6 flex-wrap items-center justify-between gap-2">
            {value ? <Checks checks={v.checks} /> : <span className="text-[13px] text-fg-3">{field.help}</span>}
            {!value && (
              <button type="button" onClick={() => setValue('356938035643809')} className="text-[12.5px] font-semibold text-fg-3 underline decoration-dotted underline-offset-4 hover:text-fg">
                Use demo IMEI
              </button>
            )}
          </div>
          {err && (
            <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-danger" role="alert">
              <TriangleAlert className="size-3.5" />
              {err}
            </p>
          )}
          {s && !s.available && <p className="text-[13.5px] font-medium text-warning">This service is temporarily unavailable. Please check back soon.</p>}
          {s && <p className="text-[12.5px] text-fg-3">Validated instantly — you only pay once the IMEI passes. Typical result time: {turnaroundLabel(s.turnaround)}.</p>}
        </form>
      </div>
    </Section>
  )
}
