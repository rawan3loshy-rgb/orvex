# Roadmap: from prototype to production V1

This is a pragmatic path from today's high-fidelity prototype (UI + in-browser mock backends +
architecture) to **ORVEX Core V1**: a self-hosted product that real customers install, operate and
update. Durations are indicative for a small senior team (4–6 engineers) and overlap where noted.

Core stays industry-agnostic. The initial target market is **GSM service businesses** (device and
blacklist checks, carrier/SIM-lock status, warranty, carrier-authorised unlock codes) — served by the
**GSM vertical pack** (IMEI with Luhn check, serial, brand, model, carrier, result schemas), the
**DHRU Fusion driver** for suppliers and the **DHRU-compatible endpoint + importer** for operators
migrating from DHRU panels.

## Where we are

| Done in the prototype | Reused in production |
|---|---|
| Complete UI: vendor portal, operator console, storefront with checkout, reseller portal | As-is (`src/features`, `src/components`) |
| Domain core (`src/core`): accounts, catalog, pricing, routing, order state machine, ledger, payments, after-care | Ported into `core-api` / `core-worker` behind real repositories (`src/core/ports.ts`) |
| Mock REST handlers (`src/mock/*/routes`), native API v1 and DHRU-compatible handlers | Executable specification of every API |
| Transport abstraction (`VITE_API_MODE=mock\|http`) | UI switches to real backends without changes |
| Architecture, API contract, schemas, deployment package | This repo: `docs/`, `db/`, `deploy/` |

## Guiding decisions

* **One language end to end:** Node.js 22 LTS + TypeScript (strict) for Core, workers, CLI, vendor
  services. Types shared with the SPA.
* **PostgreSQL only** (14–17), no extensions, queue on `SKIP LOCKED`. No Redis in V1.
* **Small, proven dependencies:** an HTTP framework (Fastify or Hono), `pg` with a typed query builder
  (Kysely), Zod/JSON Schema validation generated from `src/types`, `@node-rs/argon2`, OpenTelemetry.
  Native crypto (`node:crypto`) for AES-GCM, HKDF, Ed25519, HMAC.
* **Contract first:** the mock routes and `docs/API_CONTRACT.md` define behaviour; contract tests run
  the same suite against mock and real backends.

---

## Phase 1: Core backend foundation (6–8 weeks)

Goal: a real `core-api` that serves the existing admin UI with `VITE_API_MODE=http` for catalog,
resellers, settings, users and audit.

* Repository layout: `core/` (api, worker, scheduler entry points in one image), `packages/shared`
  (types, schemas), `packages/sdk` (extension SDK).
* **Migration runner** implementing the contract in `db/README.md` (ordering, checksums, transactions,
  advisory lock on the direct URL, `schema_migrations`, `--require-backup`), with tests against
  PostgreSQL 14, 15, 16, 17 and against Supabase/Neon/RDS in nightly CI.
* Config loader (environment only, validated at boot, secrets never logged), structured logging,
  `/healthz`, `/readyz`.
* Admin auth: Argon2id passwords, sessions, TOTP MFA, CSRF, lockout, RBAC with wildcard permissions,
  audit log written in the same transaction as changes.
* Key ring (HKDF from `ENCRYPTION_KEY`), AES-256-GCM helpers, key rotation job.
* Admin API for accounts & members, services & revisions, suppliers (encrypted credentials), offers,
  pricing tiers & rules, settings, users, roles, audit, storefront pages/blocks/theme.
* Contract test harness: shared service-level suite runs against the mock transport and `core-api`.

**Exit:** the admin UI works against `core-api` for every non-order screen; migrations apply cleanly
on all supported PostgreSQL versions and hosting options.

## Phase 2: Order engine, ledger and APIs (6–8 weeks, overlaps Phase 1 by ~2 weeks)

Goal: real orders end to end.

* Job queue (`jobs`, leases, retries, dead letters, `NOTIFY` + polling), `core-worker`,
  `core-scheduler` with `scheduled_tasks`.
* **Driver SDK** (`SupplierDriver`, capability-scoped context), built-in **DHRU Fusion driver** (HTTP
  form-POST + JSON), REST driver, manual driver, sandbox driver for tests and smoke orders, driver
  conformance kit; catalog sync with change review.
* Order engine per `docs/ARCHITECTURE.md § 7`: one `PlaceOrder` command for every channel, price
  snapshot, wallet holds in the **double-entry ledger** (integer micros), priority routing with
  guarded failover, UNKNOWN → needs review, review resolution, settlement, refunds, verification,
  sensitive-input encryption and purge; integrity checks and supplier reconciliation.
* Payment gateway modules feeding the ledger (every payment funds a wallet), de-duplicated gateway
  webhooks, refunds to wallet or original method, chargebacks.
* Native API v1 (hashed keys, scopes, IP allow-lists, rate limits, account-scoped idempotency, batch
  orders), DHRU-compatible endpoint, API request logs (monthly partitions).
* Webhooks (Standard Webhooks signing), delivery attempts, retries, replay, failure detection.
* Load test target: 50 orders/s sustained on 4 vCPU / 16 GB with p95 order creation < 150 ms
  (excluding provider time).

**Exit:** the full demo journey runs on real backends with sandbox suppliers; ledger integrity passes
under load and chaos tests (supplier timeouts → needs review, worker kills, database failover).

## Phase 3: Vendor platform services (6 weeks, parallel to Phase 2)

Goal: customers can buy, license and download.

* Account portal backend over `db/vendor/migrations` (accounts, members, subscriptions, invoices,
  payments, tickets) serving the existing portal UI.
* Billing integration with a payment provider (hosted checkout and webhooks; no card data on our
  servers), invoicing, dunning.
* **License server**: activation, validation receipts, installation binding with instance keys, domain
  management, abuse detection, signed documents with HSM/KMS-held keys.
* **Release pipeline with signing**: reproducible multi-arch image builds, SBOM, Ed25519-signed
  manifests (RFC 8785 canonical JSON), cosign image signatures, staged rollout and withdrawal tooling,
  `releases.orvex.io` and license-scoped registry tokens.

**Exit:** a new customer can sign up, pay, receive a license, and pull a signed release.

## Phase 4: Distribution and operations (5–6 weeks)

Goal: install, update and recover without the vendor.

* **Installer CLI `orvexctl`**: `init` (schema, migrations, identity, activation, first Owner),
  `migrate`, `backup create|list|verify|restore`, `update` (pre-flight, maintenance mode, verify,
  install, migrate, restart, health, journal, automatic rollback), `rollback`, `maintenance`,
  `support bundle`, `db doctor`; `orvexctl agent` (systemd) for updates requested from the UI.
* Deployment package (`deploy/`) hardened and tested on Debian/Ubuntu/RHEL, amd64/arm64; Caddy and
  Nginx variants.
* **Observability**: Prometheus metrics, OpenTelemetry traces, health checks and incidents, log
  redaction tests, Grafana dashboard JSON shipped in the package.
* Update rehearsals: every release is automatically upgraded from every supported earlier version
  (including failure injection at each step) before publication.
* Documentation site: install guides per database provider, operations runbooks, API reference
  generated from the contract, adapter SDK guide.

**Exit:** an external pilot customer installs, updates 2.x → 2.y, restores a backup and rolls back,
using only the docs.

## Phase 5: Hardening and V1 launch (4–6 weeks)

* **Security review**: threat model review, external penetration test (admin, native API, DHRU
  endpoint, storefront checkout, license protocol, update path), dependency and container scanning gates, secrets
  scanning, signing key ceremony and rotation drill.
* Privacy review (data retention defaults, DPA template stating ORVEX Systems has no access to
  installation data), accessibility review of the admin UI.
* Performance and soak tests (72 h), disaster-recovery drills, documentation freeze.
* Pilot programme with 3–5 customers across different database providers (self-hosted, Neon, RDS),
  including one vendor-assisted installation.

**V1 GA criteria:** all journeys of the prototype work on real backends; zero known high/critical
security findings; update and rollback proven across the fleet of pilots; reconciliation and backup
verification green for 30 days.

---

## After V1

| Theme | Items |
|---|---|
| Extensions | Signed extension registry and permission review UI (2.6 beta), process-level extension sandbox, more official supplier drivers and vertical packs |
| Scale & HA | `multi_installation` module: multiple `core-api` replicas, PostgreSQL-backed rate limits, read replicas, zero-downtime updates for additive migrations |
| Access management | SSO (OIDC/SAML) for installation admins and portal users, SCIM |
| Commerce | Multi-currency wallets, more payment gateway modules, promotions, reseller sub-accounts |
| Operations | Fleet-wide release health dashboards (opt-in signals only), air-gapped installation bundles, ARM-optimised images |
| Routing | Measured-data features (cost/latency-aware ordering) only once V1 priority routing has production data |
| Developer experience | Official SDKs for the native API (Node, Python, PHP, Go), OpenAPI publication, webhook CLI for local testing |

## Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Customer environments vary widely | Narrow supported matrix (Linux + Docker + PostgreSQL 14–17), pre-flight checks, `db doctor`, provider-specific CI |
| A bad release reaches many installations | Staged rollout, upgrade rehearsals from every supported version, automatic rollback, withdrawal |
| Lost `ENCRYPTION_KEY` | Installer forces an explicit key backup confirmation; key fingerprint shown in the admin; documentation |
| Extension quality | Signing, `coreRange`, conformance kit, disable-on-incompatibility instead of blocking updates |
| License circumvention | Practical enforcement (binding, signed updates, integrity reporting) plus contracts; never risk customer data |
