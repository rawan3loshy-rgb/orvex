# ORVEX prototype — contributor guide

High-fidelity, **interactive product prototype** of **ORVEX** — a licensed, self-hostable platform
for running a digital-service resale business (GSM services in the demo). The first potential
customer will use it as the product demonstration. Everything external (suppliers, payments, DHRU,
email/Telegram/WhatsApp, license server, webhooks) is **simulated**; the domain logic is real.

Read `docs/ALIGNMENT_PLAN.md` for the why. This file is the how.

---

## 1. Product in one paragraph

Each customer runs an independent ORVEX installation (own server, own PostgreSQL, own data). Inside
it they connect **suppliers** (DHRU Fusion HTTP driver, generic REST, manual), sync supplier
catalogs, build **services** (versioned field schemas from the GSM vertical pack), map supplier
**offers** in priority order, price per **pricing tier** (Retail / Silver / Gold / Platinum), and
sell through every channel: **storefront** (catalog-driven website + checkout), **reseller portal**,
**native API v1**, **DHRU-compatible endpoint**, and **admin**. Every channel enters the same
`PlaceOrder` command. Money moves only through a **double-entry ledger** (wallet holds → capture).
Routing is **priority + guarded failover**; an **UNKNOWN** supplier outcome (timeout) is never
failed over — the order goes to **needs_review**. The vendor platform (`/account`) is separate and
holds no operational data.

Demo installation: **UnlockDesk Demo Ltd.** (`ORVEX-DEMO-001`, storefront brand **UnlockDesk**,
emerald). Operator: **Alex Morgan** (Owner). Reseller of the demo story: **ABC GSM** (Gold, $842.50
available, $27.00 held, $250 credit). Suppliers: **DHRU Supplier Alpha** (healthy), Beta Unlock
Source, GammaCheck IMEI API, Delta GSM Server (degraded), Epsilon Code Factory (auth error), Zeta
Device Data (low balance), Eta Unlock Hub (circuit open), Theta Carrier Desk (half-open), Iota
Warranty Network (maintenance), Kappa Manual Desk. Scenarios **A–L** are scripted (see
`src/mock/installation/seed.ts` and `/admin/demo`).

## 2. Code architecture

```
src/
  core/                 ORVEX Core domain (pure TS — what core-api/worker would run)
    money.ts            Micros (integer micro-units), formatMoney, parseMoney, usd()
    domain/*            entity types + constants (single source of truth)
    fields.ts           field-type registry + validateField / validateInput / inputSchema
    verticals/gsm.ts    GSM pack: imei (15 digits + Luhn), serial, brand, model, carrier, result schemas
    services/*          PricingEngine, RoutingEngine, LedgerService, SupplierService, … (server-side)
    commands/*          PlaceOrder, Cancel, Refund, ResolveReview, Verify, … (server-side)
    edge/dhru.ts        DHRU status mapping (edge only)
    ports.ts            repository / driver / gateway interfaces
  mock/installation/    simulated infrastructure: repositories, drivers, gateway, scheduler,
                        seed replay (30 days through real commands), scenarios, API routes
  api/                  transport (mock ⇄ HTTP)
  services/installation typed API functions (admin / portal / store / demo)
  hooks/installation    React Query hooks ← UI reads data ONLY through these
  types/installation.ts API contract (DTOs) — re-exports domain types
  components/ui         design-system kit (unchanged)
  components/domain     shared ORVEX components (Money, badges, FieldForm, PriceSteps, LedgerEntries, …)
  components/layout     shells (admin sidebar/topbar, command palette, journey navigator)
  features/             screens, one folder per area
legacy/features/        the previous UI — reference only, NOT compiled; port good parts, never import
```

### Import rules

* UI **never** imports from `@/mock`, `@/api`, `@/core/services`, `@/core/commands` (server-side).
* UI **may** import: types from `@/types/installation`; money helpers from `@/core/money`
  (`formatMoney`, `formatBps`, `parseMoney`, `usd`, `add`, `sub`, `toUnits`); validation from
  `@/core/fields`; constants from `@/core/domain` (`ORDER_STATUS_LABEL`, `FINANCIAL_STATUS_LABEL`,
  `LEDGER_GROUPS`, `ACCOUNT_TIER_LABEL`, `OPEN_STATUSES`), `@/core/verticals/gsm` (`GSM_BRANDS`,
  `GSM_CARRIERS`, `carrierLabel`, `luhnValid`) and `@/core/edge/dhru` (`DHRU_MAPPING_TABLE`, `toDhruStatus`).
* Note: `@/types/installation` re-exports domain **types only** (`export type *`). Import runtime
  constants from `@/core/domain`.
* Write with `useInstMutation(fn, { success: '…' })` wrapping a function from `@/services/installation`.
  Mutations invalidate every installation query and toast errors (with the API message).
* TypeScript strict, `noUnusedLocals`. Path alias `@/` → `src/`. Icons: `lucide-react` v1
  (`TriangleAlert`, `CircleCheck`, `CircleX`, `Building`, `CloudDownload`, `ChartColumn`, `CodeXml`…;
  if tsc says an icon is not exported, pick another).

## 3. Money — integer micros

* Every installation amount is `Micros` (branded integer: 1 USD = 1 000 000). DTO fields like
  `price`, `cost`, `balance.available`, `amount` are micros.
* Display: `<Money value={m} />` from `@/components/domain` or `formatMoney(m)` from `@/core/money`
  (sub-cent costs show 4 decimals automatically, e.g. `$0.0425`). Options: `{ sign, compact }`.
* Inputs: parse with `parseMoney(text)` → `Micros | null`. Build constants with `usd(12.5)`.
* Charts may convert with `toUnits(m)`. Never do arithmetic on `toUnits` results and send them back.
* `money()` in `@/lib/format` is **decimal** and only for the vendor portal (`/account`). Do not use it
  for installation data.

## 4. Statuses (never invent new strings)

* Order fulfilment: `awaiting_payment · queued · processing · needs_review · completed · rejected · cancelled`
* Financial (separate!): `none · held · captured · released · partially_refunded · refunded`
* Attempt: `sending · accepted · succeeded · rejected · not_accepted · unknown · confirmed_not_received`
* Supplier health: `healthy · degraded · auth_error · low_balance · circuit_open · half_open · maintenance · disabled`
* Payment intent: `requires_payment · pending · succeeded · failed · cancelled`
* Verification: `open · awaiting_supplier · approved · rejected`
* Customers (portal/storefront/API) see `processing` + `statusDetail: 'under_review'` instead of `needs_review`.
* Use `<StatusBadge status=… />` (kit) or `OrderStatusBadge` / `FinancialBadge` / `HealthBadge` (domain).
* DHRU numbers (0/1/3/4) appear only on DHRU screens.

## 5. Data access

### Hooks (`@/hooks/installation`)
Cockpit `useCockpit` · Orders `useOrders(q)`, `useOrderStats`, `useOrder(idOrRef)`, `useVerifications(status)` ·
Accounts `useAccounts(q)`, `useAccount(id)`, `useAccountsSummary` · Catalog `useCategories`, `useServices(q)`,
`useService(id)`, `useProducts(q)`, `usePricing`, `usePriceMatrix(q)`, `useQuote(serviceId, tierId)` ·
Suppliers `useDrivers`, `useSuppliers`, `useSupplier(id)`, `useSyncChanges(q)`, `useSyncRuns` ·
Finance `useLedgerTransactions(q)`, `useLedgerAccounts`, `useIntegrity`, `useReconciliation`, `useFinanceSummary`,
`usePaymentMethods`, `usePayments(q)`, `useRefunds`, `useChargebacks` · Developer `useApiKeys`, `useApiLogs(q)`,
`useApiLogStats`, `useDhru`, `useWebhooks`, `useWebhookDeliveries(q)`, `useInboundWebhooks(q)`, `useNotifications(q)`,
`useNotificationConfig`, `useAudit(q)` · System `useMe`, `usePermissionCatalog`, `useUsers`, `useRoles`, `useHealth`,
`useInstallation`, `useLicense`, `useUpdates`, `useSettings`, `useGoLive`, `useStorefrontAdmin`, `useMigration` ·
Portal `usePortalMe`, `usePortalDashboard`, `usePortalServices`, `usePortalService`, `usePortalOrders`, `usePortalOrder`,
`usePortalWallet`, `usePortalStatements`, `usePortalApiKeys`, `usePortalWebhooks`, `usePortalApiLogs`, `usePortalMembers` ·
Storefront `useStoreConfig(preview)`, `useStoreCatalog(query)`, `useStoreSearch(q)`, `useStoreService(slug)`,
`useStoreTracking(token)`, `useStoreAccount(enabled)` · Demo `useDemoState`.

### Services (`@/services/installation`)
`cockpitService, ordersService, verificationsService, accountsService, catalogService, pricingService,
suppliersService, financeService, developerService, notificationsService, auditService, systemService,
storefrontAdminService, migrationService, portalService, storeService, demoService`. Read the file —
every function is typed with its DTO. The DTOs live in `src/types/installation.ts`.

Sensitive commands are permission-checked **server-side** (403 `permission_denied` with a clear
message). In the UI, wrap sensitive buttons with `Guarded` / show `PermissionHint` (see below), so the
"act as role" demo control visibly changes what an operator may do.

## 6. Shared domain components (`@/components/domain`)

`Money`, `Bps`, `OrderStatusBadge`, `FinancialBadge`, `HealthBadge`, `ChannelBadge`, `CHANNEL_META`,
`SimulatedBadge`, `ScenarioTag`, `useCan(perm)`, `PermissionHint`, `Guarded`, `useFieldForm(fields)`,
`FieldInput`, `FieldList`, `FieldChecks` (✓ 15 digits ✓ Luhn valid), `PriceSteps` ("Why this price?"),
`MarginGuardBadge`, `LedgerEntries` (DR/CR table), `ledgerAccountName`, `ledgerKindLabel`, `ResultView`
(order result by result schema), `OrderTimeline`, `EVENT_ICON`. Reuse them — do not fork.

## 7. Design system

Premium, precise, technical, editorial. Graphite + warm off-white + a single **signal coral**
(`#FF5A36`) used as an ACCENT only (primary actions, active indicators, key series, live states).
**No blue** in the identity. Dark is default; **everything must look right in light theme** (tokens
handle it — never hard-code surface/text colours). Not crypto, not generic AI purple, not neon, not a
2018 admin template. Density and clarity beat decoration; avoid chart overload and glassmorphism.

| Purpose | Classes |
|---|---|
| Page background | `bg-bg`, `bg-bg-subtle` |
| Surfaces | `bg-surface` (cards), `bg-surface-2` (hover/inset), `bg-surface-3` (pressed) |
| Borders | `border-line`, `border-line-strong` |
| Text | `text-fg`, `text-fg-2`, `text-fg-3` |
| Accent | `bg-accent`, `bg-accent/10`, **`text-accent-ink`** for coral text |
| Status | `success`, `warning`, `danger`, `info` (`/10` for soft backgrounds) |
| Charts | `var(--c1)`…`var(--c6)` (c1 coral key series) |
| Fonts | `font-display` (Archivo, headings/big numbers), default Geist, `font-mono` (Geist Mono) |

Utilities: `mono-label`, `tabular`, `bg-grid`, `bg-dots`, `bg-hatch` (use hatch + dashed warning
border for anything DEMO-only), `skeleton`, `no-scrollbar`, `animate-fade-up`, `animate-pulse-ring`.
Page title via `PageHeader`; card title 14px semibold; body 13–13.5px; meta 12px `text-fg-3`.
Cards: `rounded-xl border-line`. Grids: `grid gap-4`. Subtle motion via `motion/react`.

### Kit (`@/components/ui`)
`Button` (variant primary|accent|secondary|outline|ghost|danger|link, size xs|sm|md|lg, `icon`,
`loading`, `leading`, `trailing`, `to`, `href`), `Badge`, `Dot`, `StatusBadge`, `Card`/`CardHeader`/
`CardBody`/`CardFooter`/`Divider`, `Input`/`Textarea`/`Select`/`Field`/`SearchInput`/`Switch`/`Checkbox`,
`Tabs`/`Segmented`, `Drawer`/`Modal`/`ConfirmDialog`, `Tooltip`/`Popover`/`MenuItem`, `Avatar`, `Kbd`,
`Skeleton`, `EmptyState`, `Progress`, `Meter`, `ProgressRing`, `PageHeader`, `DescriptionList`,
`Timeline`, `CopyButton`, `MonoValue`, `SecretField`, `Stat`, `SectionTitle`, `DemoTag`, `CodeBlock`,
`DataTable` (+ `Pagination`), `KpiCard`. Charts (`@/components/charts`): `TimeChart`, `ChartLegend`,
`Sparkline`, `Donut`, `UptimeBars`, `BarList`, `Heatmap`. Toasts: `toast.success/error/info/warning`.

Every data view needs loading (skeletons), empty (`EmptyState`) and error states, hover states, and
works down to tablet width (admin is desktop-first; storefront and reseller portal must be fully
responsive). Lists over ~50 rows paginate (server pagination via `page`/`pageSize`).

## 8. Demo honesty

* Never claim a live connection. External systems show `SimulatedBadge` / "Demo Card Gateway" /
  "simulated" wording. Demo-only controls live in `/admin/demo` (hatched, dashed warning border).
* Mark demo figures with `DemoTag` where helpful. Scenario orders carry `ScenarioTag`.
* Legitimate GSM services only — never mention activation-lock bypass, FRP/account removal,
  blacklist removal or IMEI modification as offered services.

## 9. Working agreements (parallel contributors)

* Only edit files inside the folders you own (listed in your task). Shared layers (`src/core`,
  `src/mock`, `src/api`, `src/services`, `src/hooks`, `src/types`, `src/components`, `src/stores`,
  `src/lib`, `src/config`, `src/app`) belong to the lead — do not modify them. Need a helper? Put it
  in your feature folder. Missing data or a backend bug? Work around it client-side and report it in
  your hand-off notes (file + what you needed).
* Each page file must `export default` its component (routes already point at them).
* Type-check: `npx tsc -p tsconfig.app.json --noEmit` and fix every error in your folders.
* Lint: `npm run lint` must report 0 errors and 0 warnings. Fix the cause — no `eslint-disable`, `@ts-ignore` or `any`.
  Component files (`.tsx`) export only components; put helpers, hooks and constants in a sibling `.ts` module.
* Storefront content is never edited live: editor screens save to the **draft** revision and only
  `publish` changes `/site`. Catalog data (prices, fields, availability) never goes into content.
* Do not start dev servers or browsers. Do not commit, push or deploy.
* Port good ideas from `legacy/features/**` (copy + adapt into your folder); never import from it.
