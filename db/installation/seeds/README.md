# Installation seeds

There are **no demo seed SQL files here, on purpose.**

## Demo data lives in the prototype's mock layer

The demo installation (UnlockDesk Demo Ltd. · `portal.unlockdesk-demo.com` · Core 2.4.1, schema 017) is
generated in the browser by the prototype's mock backend. The schema is generic; the demo data
represents the initial target market, a **GSM service business** (all names fictional, marked DEMO
in the UI):

| Entity | Demo content |
|---|---|
| Providers (5) | `prv_globalunlock` Global Unlock Provider (carrier unlocks) · `prv_imeihub` IMEI Services Hub (instant IMEI checks) · `prv_gsmsolutions` GSM Solutions Provider (codes over a DHRU-compatible XML gateway, *degraded*) · `prv_mobileapi` Mobile API Supplier (server services) · `prv_devicenet` Device Services Network (device data, custom adapter `ext.unlockdesk.dsn-adapter`) |
| Categories | `IMEI Services` · `Unlocking` · `Server Services` · `Codes` · `Other Services` (the `CHECK` in `005_services.sql`) |
| Services (25) | `SVC-1001`…`SVC-1025`, e.g. IMEI Check — Full Report, IMEI Blacklist Check (GSMA), iCloud / FMI Status, iPhone Unlock — USA Carriers, Samsung FRP Removal, Apple Activation Status (GSX), NCK Code — Alcatel / ZTE, SP Code, Carrier Lookup (Phone number); one paused, one deprecated, one draft |
| Field keys | `imei` (15 digits, Luhn), `serial_number`, `model`, `network`, `country`, `phone_number` (sensitive), `brand` |
| Resellers (12) | MobileHub (`rsl_482`, Distributor), PhoneFix Center, UnlockZone (suspended), CellPoint Repairs, Asia GSM Hub, Gulf Mobile Services, Movil Express, TechRepair Pro (Contract), GSM Corner (pending), SmartFix Store, Celular Brasil, Istanbul GSM Market |
| Pricing groups (4) | Standard (default), Dealer, Distributor, Contract |
| API keys | `orx_live_…` / `orx_test_…`, e.g. "GSM Reseller — Main" (MobileHub) |
| Results | "NCK 48213907", "CLEAN — not on the GSMA blacklist", "FMI: OFF — clean", "FRP removed — device ready for setup" |

Sources:

| Data | Source |
|---|---|
| Providers, services, service fields, mappings | `src/mock/installation/seed/catalog.ts` |
| Pricing groups, resellers, roles, users | `src/mock/installation/seed/accounts.ts` |
| API keys, webhook endpoints, audit log | `src/mock/installation/seed/activity.ts` |
| Routing rules, extensions, installation, license, update center, settings | `src/mock/installation/seed/system.ts` |
| Website (theme, sections, pages, navigation) | `src/mock/installation/seed/website.ts` |
| Orders, attempts, transactions, webhook deliveries, API logs | generated deterministically by `src/mock/installation/db.ts` + `engine.ts` (seed `20261001`) |

`db.ts` keeps one in-memory collection per table of this schema, so the mock data has the same shape
and the same invariants (costs below prices, balances consistent with the ledger, one charge per order).
Use **Reset demo** in the Journey panel to re-seed it.

## What a real installation starts with

A fresh production installation contains only **Core reference data**, inserted by the migrations
themselves:

| Data | Migration |
|---|---|
| Permission catalog, system roles *Owner* and *Administrator* | `002_identity_access.sql` |
| Default settings sections | `003_installation_settings.sql` |
| Scheduled maintenance tasks | `012_job_queue.sql` |
| Built-in adapters `adapter.rest-json`, `adapter.soap-xml` | `015_extensions.sql` |
| Default pricing group *Standard* | `016_pricing.sql` |
| Default website theme row | `017_site_builder.sql` |

Everything customer-specific is created **at runtime inside the customer's infrastructure**:

1. `orvexctl init` writes the `installation` row (installation id, name, domain, environment) and
   activates the license, which creates the `license_state` row.
2. The first-run wizard creates the first *Owner* user (Argon2id password, MFA enrolment).
3. Providers, services, resellers and the website are configured in the admin UI.

Neither the vendor nor this repository ever ships customer data, and the vendor never writes to a
customer database.

## Optional: demo/staging fixtures (roadmap)

A `orvexctl demo seed` command is planned for sales demos and staging. It will be generated from the
same TypeScript seed modules (single source of truth) and refuses to run when
`installation.environment = 'production'`.
