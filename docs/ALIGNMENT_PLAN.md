# ORVEX prototype — architecture alignment plan

Status: working document for the 2026-10 prototype refactor ("first customer demo").
Scope: prototype only — every external system stays simulated. No deploy, no commits.

---

## A. Existing architecture (as audited)

```
UI (React 19, features/*)  ──►  hooks/* (React Query)  ──►  services/* (typed fns)
      ──►  api/* (Transport: mock ⇄ HTTP)  ──►  mock/installation/routes/* (REST handlers)
      ──►  mock/installation/db.ts + engine.ts (in-memory collections, order "plans")
```

* Clean transport boundary already exists (`VITE_API_MODE=http` swaps mock for HTTP). **Keep.**
* Two backends: installation (customer-owned) and vendor (ORVEX Systems). **Keep.**
* Design system (graphite + coral, Geist/Archivo/Geist Mono, light+dark tokens), UI kit, charts,
  shells, command palette, Journey navigator. High quality. **Keep.**
* Mock "engine" pre-plans each order's whole life (`planOrder`) and projects it onto time
  (`observeOrder`). Ledger is a list of `Transaction` rows with a mutable `reseller.balance`.

## B. Existing features

Admin: dashboard (charts), orders + detail (timeline, routing card), services (10 tabs), providers
(8 tabs), mappings (matrix/visual), routing (5 strategies + condition rules + simulator), resellers,
pricing groups (discount % + overrides), transactions, reports, Reseller API docs + Try-it, API keys,
webhooks, API logs, website builder (raw HTML/CSS/JS sections, CodeMirror), health, activity/audit,
extensions, settings (13 tabs), updates (scripted run), license.
Vendor portal (/account): subscription, billing, invoices, license, installation, releases, updates,
support, account. Marketing landing (/). Public site (/site) rendered from sanitized HTML sections.

## C. What already aligns

* Self-hosted model, vendor/installation separation, vendor DB has no operational tables.
* Typed transport + services + hooks (UI never touches mock) — this is the "API boundary".
* Order timeline/attempt concepts, provider credentials masked + write-only, API key prefixes,
  IP allow-lists, audit log, update center with preflight/backups, license grace/caching concepts,
  Luhn validation of IMEIs before routing, catalog-driven `service-catalog` site block.

## D. What must change (the 20 known corrections, confirmed present)

| # | Problem found | Correction |
|---|---|---|
| 1 | `reseller.balance` mutable number, `adjustBalance` writes it | Double-entry ledger; balances are projections |
| 2 | Resellers are a separate model; website orders have no account | One `Account` model (retail / reseller / business / api_only), members |
| 3 | GSM Solutions = "SOAP / XML Adapter" | `dhru_fusion` HTTP driver (form-POST + JSON) |
| 4 | Timeout → automatic fallback (engine + docs + routing UI) | Timeout = UNKNOWN → `needs_review`; failover blocked |
| 5 | Floats + `toFixed(2)` everywhere | Integer micro-units (`Micros`, branded) + `@/core/money` |
| 6 | GSM fields/results hard-coded in engine (`SVC-1001` switch) | GSM vertical pack registers field types + result schemas |
| 7 | Seed site HTML contains copied prices | Typed blocks reference services by id/query; prices resolved live |
| 8 | Raw HTML/CSS/JS sections are the site architecture | Typed blocks; custom code only as a sandboxed "custom embed" block |
| 9 | Idempotency scoped to API key | Scope = account (actor's account) + key, across all channels |
| 10 | `Webhook-Signature: t=,v1=` + `Webhook-Event` mix | Standard Webhooks: `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<b64>` |
| 11 | Update steps lack worker drain; docs say expand/contract | Update flow: Preflight → Backup → Migration (expand) → Worker drain → Container swap → Health → Complete |
| 12 | Protocol union `REST | SOAP | GraphQL | gRPC` | Drivers: `dhru_fusion`, `orvex_rest` (generic JSON), `manual` |
| 13 | 5 routing strategies + condition rules | V1 priority routing + guarded failover + margin guard |
| 14 | No checkout | Storefront checkout (guest + signed-in) |
| 15 | No payments | Mock payment architecture (intents, gateways, refunds, chargebacks) |
| 16 | No reseller portal | `/portal` for accounts (ABC GSM) |
| 17 | No supplier reconciliation | Expected (ledger) vs actual (driver getBalance) + drift |
| 18 | "Held for review" faked via `pending + error.code` | Real `needs_review` status + review workspace |
| 19 | No verification workflow | Verification requests (after-care) |
| 20 | No DHRU importer | Scan → Dry run → Diff → Review → Import → Validate (mock) |

Extra finding: demo catalog contains activation-lock / account-removal services (Samsung FRP
removal, Xiaomi Mi Account removal, MDM removal). These are **removed** and replaced by legitimate
check / information / carrier-authorised unlock services.

## E. What must be added

Operations cockpit, needs-review workspace, verification requests, unified accounts with members,
ledger (accounts / transactions / entries / projections), financial integrity checks, supplier
reconciliation, catalog sync + change review, service revisions + field schema, offers + supplier
products, pricing tiers + rules + "why this price", payments (intents / transactions / refunds /
chargebacks), refunds (wallet / original method, capped, idempotent), notification center (email /
Telegram / WhatsApp, simulated), inbound + outbound webhook logs, Native API v1 console that mutates
state, DHRU compatibility endpoint + console, DHRU migration importer, storefront (search → detail →
form → checkout → payment → tracking → history), guest checkout with private tracking token,
reseller portal, role-based permission checks on sensitive commands, installation / go-live
checklist, demo/simulation control center + discoverable scenarios A–L.

## F. What should be removed / hidden

Routing strategies other than priority, routing condition rules (hold/exclude/set_timeout), mapping
weights, SOAP/GraphQL/gRPC adapters and protocol strings, raw-HTML-section-as-architecture,
`customHead` raw HTML injection (replaced by typed SEO + verified analytics id), floats in the
installation domain, numeric DHRU states inside Core, the questionable server services.

## G. Proposed mock domain model

```
src/core/                         ← would be core-api/worker code in production (pure TS, no React)
  money.ts                        Micros (branded int), arithmetic, rounding, formatting
  ids.ts, clock.ts                ids, public refs (ORD-7K3P9Q), tracking tokens, demo clock
  domain/                         types + invariants
    account.ts catalog.ts supplier.ts order.ts ledger.ts payment.ts ops.ts (notifications,
    webhooks, audit, verification, sync, storefront)
  fields/                         field-type registry + validation (core types)
  verticals/gsm.ts                GSM pack: imei (15 digits + Luhn), serial, brand, model, carrier;
                                  result schemas; demo result generators
  services/                       domain services
    PricingEngine RoutingEngine OrderStateMachine LedgerService SupplierService
    PaymentService NotificationService WebhookService AuditService CatalogSyncService
    ReconciliationService IntegrityService
  commands/                       application layer (one entry point per business action)
    PlaceOrder CancelOrder RefundOrder VerifyOrder ResolveReview SettleOrder
    TopUpWallet AdjustWallet ...
  ports.ts                        Repository / SupplierDriver / PaymentGateway interfaces
src/mock/installation/
  repositories/                   MockOrderRepository, MockLedgerRepository, ... (in-memory)
  drivers/                        MockDhruFusionDriver, MockOrvexRestDriver, ManualDriver
                                  (+ SupplierSimulator: success/rejected/timeout/unknown/…)
  gateways/                       MockPaymentGateway (card / PayPal / bank transfer / manual)
  data/                           seed definitions (suppliers, products, services, accounts…)
  scenarios/                      stories A–L, generated through the real commands
  scheduler.ts                    job queue (process order, poll attempt, webhook retry…)
  routes/                         admin API · portal API · storefront API · native API v1 · DHRU
```

Seed = **replay through the real commands** on a simulated clock (discrete-event scheduler), so
every order has consistent attempts, timeline, ledger entries, notifications and webhooks.

Key rules:
* Every order — storefront, portal, API, DHRU, admin — enters `PlaceOrder`.
* Fulfilment status: `awaiting_payment | queued | processing | needs_review | completed | rejected |
  cancelled`. Financial status (separate): `none | held | captured | released | partially_refunded |
  refunded` (`none` = awaiting payment; documented extension).
* Attempt outcome classification: `success`, `rejected` (terminal or failover-safe), `not_accepted`
  (rate limited / insufficient funds / auth / connect error — request provably not processed,
  failover-safe), `unknown` (timeout / ambiguous after send → needs_review, never failover).
* Price = PricingEngine(service, offer cost, account tier) → snapshotted on the order.
* Balances = sum of ledger entries per ledger account.

## H. Implementation order

1. Plan (this file) · 2. Core money/ids/clock/domain types · 3. Accounts · 4. Ledger · 5. Order
state machine + commands · 6. Supplier drivers + simulator + routing · 7. Catalog / revisions /
pricing · seed + scenarios + API routes + hooks (lead) → UI phases 8–14 (parallel feature owners,
one folder each) → 15 end-to-end QA (tsc, build, domain self-test, route smoke test).

## I. Risks / contradictions

* **Scale of UI change:** ~35k lines of admin UI depend on the old types. Mitigation: new types
  first, then rebuild page-by-page reusing kit components; tsc guides every break.
* **"Financial status" before payment:** spec lists 5 values; `awaiting_payment` orders have none
  yet → `none` added and documented.
* **Persistence:** full operational state is larger than localStorage; use IndexedDB snapshot,
  reseed when older than 12 h so "today" metrics stay current.
* **Time advancement:** implemented as "fast-forward the job queue" (jobs due in the next N minutes
  run now) instead of skewing the clock, so relative times stay truthful.
* **Docs drift:** `docs/ARCHITECTURE.md` §7.4 (timeout→fallback), webhook header names and
  protocol lists contradict the new model → updated in phase 15.
* No contradiction found with the business model (self-hosted, full platform). None changed.

## J. Files likely to change

New: `src/core/**`, `src/mock/installation/{repositories,drivers,gateways,data,scenarios}/**`,
`src/features/{portal-reseller → reseller}/**`, `src/features/storefront/**`, admin feature folders
for cockpit, review, verification, accounts, ledger, payments, reconciliation, integrity, sync,
dhru, migration, notifications, golive, demo.
Rewritten: `src/types/installation.ts`, `src/mock/installation/{db,engine,routes/*,seed/*}`,
`src/services/installation`, `src/hooks/installation`, `src/features/admin/{dashboard,orders,
catalog,commerce,developer,website}`, `src/features/site`, `src/app/router.tsx`,
`src/features/admin/nav.ts`, `JourneyNavigator`.
Adjusted: settings/updates/license/health/extensions, marketing copy (protocols, routing),
`docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `CONTRIBUTING.md`.
Untouched: vendor portal + vendor mock (except copy), UI kit, charts, tokens.
