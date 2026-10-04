# ORVEX databases

ORVEX has **two databases that never mix**. They have different owners, live on different
infrastructure, and have separate schemas and migration tracks.

The schema is industry-agnostic: accounts, suppliers, supplier products, services with versioned field
schemas, offers, pricing tiers, orders, the double-entry ledger and payments work for any
API-delivered digital service. GSM specifics (IMEI with Luhn validation, carriers, result schemas)
come from the GSM vertical pack as data. `019_core_v2.sql` introduces the aligned model (unified
accounts, revisions, offers, tier pricing, ledger in integer micro-units, payments, verification,
account-scoped idempotency) — an expand-only migration; the matching "contract" migration that drops
the legacy reseller/mapping/routing/transactions tables ships one release later.

```
db/
├── installation/            ← one per customer installation, on the CUSTOMER's PostgreSQL
│   ├── migrations/          001 … 019 (Core schema versions; 019 = aligned Core v2 model)
│   └── seeds/README.md      where demo data comes from (spoiler: the prototype's mock layer)
└── vendor/                  ← one, on ORVEX Systems' infrastructure
    └── migrations/          001 … 007 (vendor platform schema)
```

| | Installation database | Vendor platform database |
|---|---|---|
| Owner / operator | The customer (e.g. UnlockDesk Demo Ltd.) | ORVEX Systems |
| Where | Customer's server or managed PostgreSQL (self-hosted, Supabase, Neon, AWS RDS, Hetzner…) | Vendor infrastructure |
| How many | One per installation (UnlockDesk Production, UnlockDesk Staging, … each its own) | One |
| Contents | Users & roles, accounts & members, suppliers & encrypted credentials, supplier products, services & revisions, offers, pricing tiers & rules, orders (IMEIs, codes, results), ledger transactions & entries, payments, refunds, verifications, API keys, webhooks, logs, settings, storefront | Accounts, portal users, plans, subscriptions, invoices, payments, licenses, installation activations, heartbeat metadata, releases, support tickets |
| Used by | `core-api`, `core-worker`, `core-scheduler` of that installation | `account.orvex.io`, `license.orvex.io`, `releases.orvex.io` |
| Multi-tenant? | **No.** No `tenant_id` anywhere; the database *is* the tenant boundary | Yes, by `account_id` — but only for commercial data |
| Schema versions | `001`–`019`, released with Core | Independent, deployed by the vendor |

## Why they never mix

* **Data sovereignty.** Customer operational data (orders, end-customer inputs such as IMEIs and
  phone numbers, unlock codes and check results, account/reseller data, supplier credentials, wallets and ledger) never leaves
  the customer's infrastructure. The vendor database contains no
  table that could hold it.
* **Failure isolation.** Installation A's database contains only A's data. A failure, migration
  problem or restore in A cannot affect B. A vendor-platform outage does not stop any installation
  (licenses are cached and signed — see `docs/ARCHITECTURE.md`).
* **No backdoor.** The vendor never connects to a customer database and never edits one by hand.
  Every schema change reaches an installation as a signed, checksummed migration file inside a
  release, applied by the installation's own updater after a backup.
* **What crosses the boundary** is explicit and small: license activation/validation, release
  manifests and artifacts (downloaded by the installation), and optional heartbeat metadata
  (installation id, versions, health summary, license-relevant counters). All of it is initiated
  outbound by the installation.

## Installation schema at a glance

| Version | Release | File | Contents |
|---|---|---|---|
| 001–012 | 1.x (consolidated) | `001_foundation` … `012_job_queue` | migration ledger, helpers, identity & RBAC, installation & settings, providers + encrypted connections, services, mappings, routing rules, resellers, API keys, audit + partitioned API logs, health/license/backups/updates, job queue |
| 013 | 2.0.0 | `013_orders_and_ledger` | orders, attempts, events, idempotency keys, append-only ledger |
| 014 | 2.1.0 | `014_webhooks` | webhook endpoints and deliveries |
| 015 | 2.2.0 | `015_extensions` | extension registry & trust store, `providers.adapter_id` |
| 016 | 2.3.0 | `016_pricing` | pricing groups, pricing rules (overrides), `resellers.pricing_group_id` |
| 017 | 2.4.0 | `017_site_builder` | first website builder (superseded by typed storefront blocks) |
| 018 | 2.4.0 | `018_webhook_delivery_attempts` | delivery attempts, webhook stats backfill, `orders (created_at DESC, status)` |
| **019** | **2.4.1** | `019_core_v2` | aligned Core model: unified accounts & members, service revisions, supplier products, offers, pricing tiers & rules, ledger transactions & entries (micros), payments, refunds, chargebacks, verifications, account-scoped idempotency — **schema of the demo installation** |
| 020–022 | 2.5.0 | *(release bundle)* | `020_order_review_lookups`, `021_webhook_message_ids`, `022_pricing_rule_min_margin` — expand-only |
| 023 | 2.6.0-beta.1 | *(beta channel, not in this repo)* | `extension_registry`, `extensions.permissions` |

The 019 → 022 steps match the 2.5.0 release in `src/mock/shared/releases.ts` one-to-one.

Conventions: `uuid` primary keys (`gen_random_uuid()`), `bigint` identity for append-heavy tables,
`timestamptz` everywhere, `bigint` micro-units for money (since 019; legacy tables used `numeric(12,4)`), `jsonb` for documents, `CHECK` constraints for
every enum, `COMMENT ON` for every table. API identifiers are derived from natural keys where the
product shows them (`SVC-1001`, `ord_10482`, `rsl_482`, `prv_globalunlock`, `grp_standard`, `role_owner`);
see `docs/API_CONTRACT.md § Identifiers`.

**No PostgreSQL extensions are required.** Everything uses built-ins available since PostgreSQL 13
(the supported range is 14 – 17), so the schema runs unchanged on any managed PostgreSQL.

## Migration runner contract

The runner ships inside the Core image (`orvexctl migrate`, also invoked by the installer and the
updater). Its contract:

1. **Forward-only.** There are no down migrations. Recovery from a bad update is a restore of the
   pre-update backup (or an application-only rollback when the release declares the schema change
   backward compatible — see `docs/ARCHITECTURE.md § Update architecture`).
2. **Ordered, exactly once.** Files are named `NNN_name.sql`; `NNN` is the schema version. Pending
   files (no row in `schema_migrations` for `component = 'core'`) run in ascending order. Gaps or an
   applied version missing from the release are fatal.
3. **Checksum-verified.** Each file's SHA-256 is listed in the signed release manifest. Before
   running anything the runner verifies (a) the manifest signature, (b) every pending file against
   the manifest, and (c) every *already applied* file against its stored `schema_migrations.checksum`.
   Any mismatch aborts before the first statement.
4. **Transactional where possible.** Each file runs in its own transaction together with the insert
   into `schema_migrations`; a failure rolls back that file completely and stops the run. A file that
   must run outside a transaction (e.g. `CREATE INDEX CONCURRENTLY`) declares
   `-- orvex:no-transaction` in its header and must be idempotent (`IF NOT EXISTS`). None of
   001–018 needs it.
5. **Single runner.** The runner takes a session-level advisory lock
   (`pg_advisory_lock(hashtext('orvex.migrate'))`) on a **direct** connection
   (`DATABASE_DIRECT_URL` when the main URL points at a transaction-mode pooler), so two runners can
   never interleave.
6. **Session settings.** `search_path` = `DATABASE_SCHEMA` (default `orvex`, created if missing),
   `client_encoding = UTF8`, `lock_timeout = '10s'`, `statement_timeout = '30min'`. Files never
   schema-qualify Core objects.
7. **Recorded.** `schema_migrations(component, version, name, checksum, core_version, applied_at,
   duration_ms, applied_by)`. Extensions use the same table with `component = <extension id>` and
   keep their objects in their own schema.
8. **Run automatically during updates — after the backup.** Update flow: *Backup → Download →
   Verify → Install → **Run migrations** → Restart → Health check → Complete*. The runner refuses to
   run in the updater context unless a verified pre-update backup for the current schema version
   exists. Core refuses to start when the database is *behind* the image (pending migrations) and
   starts with a warning when it is *ahead* within the window the release declares compatible.
9. **Never by hand.** Neither customers nor the vendor edit schema manually. Support may ask a
   customer to run read-only diagnostics (`orvexctl db doctor`), never ad-hoc DDL.

### Why a dedicated schema (`orvex`) instead of `public`

Managed platforms often share a database with other tools. On Supabase, for example, the `public`
schema is exposed through the auto-generated REST API by default. Keeping Core objects in their own
schema avoids accidental exposure and name collisions; on Supabase, simply do not add `orvex` to
the exposed schemas.
