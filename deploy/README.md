# ORVEX Core: deployment package

This directory is the **reference deployment package for one customer installation** of
ORVEX Core. Every customer gets the same package; what makes an installation unique is its
`.env`, its database and its configuration and extensions, never a fork of Core.

> **Status.** This package defines the V1 target layout and operating procedures. The Core image
> (`registry.orvex.io/core`) and the `orvexctl` CLI are product components on the roadmap
> (`docs/ROADMAP.md`); the clickable prototype in this repository runs with mock data and does not
> need any of this. Where a step uses `orvexctl`, the underlying Docker Compose commands are shown
> too.

```
deploy/
├── docker-compose.yml     core-api · core-worker · core-scheduler · caddy · (postgres) · (migrate)
├── Caddyfile              reverse proxy with automatic TLS
├── nginx.conf.example     alternative reverse proxy
└── .env.example           all configuration (copy to .env)
```

## Contents

1. [Requirements](#1-requirements)
2. [Install: self-managed](#2-install-self-managed)
3. [Install: vendor-assisted](#3-install-vendor-assisted)
4. [Database options](#4-database-options)
5. [Configuration reference](#5-configuration-reference)
6. [Backup and restore](#6-backup-and-restore)
7. [Updating ORVEX Core](#7-updating-orvex-core)
8. [Rollback](#8-rollback)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Requirements

| | Minimum | Recommended (production) |
|---|---|---|
| OS | Linux x86_64 or arm64 (Debian 12, Ubuntu 22.04/24.04, RHEL 9…) | Debian 12 |
| CPU / RAM | 2 vCPU / 4 GB | 4–8 vCPU / 16–32 GB |
| Disk | 40 GB SSD | 100 GB+ SSD (plus backup storage) |
| Docker | Engine ≥ 24, Compose ≥ 2.20 | latest stable |
| PostgreSQL | 14 – 17 (bundled or managed) | 16, managed or dedicated host |
| Network | DNS record for your domain; inbound 80/443; outbound HTTPS to your supplier APIs, `license.orvex.io`, `releases.orvex.io`, `registry.orvex.io` | |

Node.js 22 LTS is inside the Core image; you do not install Node on the host.

No inbound connection from ORVEX Systems is ever required. All vendor communication (license
validation, release download, optional heartbeat) is outbound from your installation.

## 2. Install: self-managed

```bash
# 1. Get the package (from account.orvex.io → Installation → Download deployment package)
sudo mkdir -p /opt/orvex && cd /opt/orvex
#    …unpack docker-compose.yml, Caddyfile, .env.example here

# 2. Configure
cp .env.example .env && chmod 600 .env
openssl rand -base64 32     # → ENCRYPTION_KEY=base64:…   (store a copy in your secret manager!)
openssl rand -hex 32        # → SESSION_SECRET=…
$EDITOR .env                # APP_URL, APP_DOMAIN, ACME_EMAIL, DATABASE_URL, LICENSE_KEY, …

# 3. Authenticate to the release registry (pull tokens are scoped to your license)
docker login registry.orvex.io -u LIC-XXXX-XX -p "$LICENSE_KEY"

# 4. Initialise: creates the schema, runs migrations 001 → latest, writes the installation
#    identity, activates the license (binds it to APP_DOMAIN) and creates the first Owner.
orvexctl init
#    equivalent:
#    docker compose pull
#    docker compose up -d postgres                       # only with the bundled-db profile
#    docker compose --profile tools run --rm migrate orvex migrate --initial
#    docker compose run --rm core-api orvex init --owner-email you@example.com

# 5. Start
docker compose up -d
docker compose ps                                       # all services "healthy"
curl -fsS https://portal.example.com/healthz            # {"status":"ok","version":"2.5.0",…}
```

Then open `https://<your-domain>/admin`, sign in as the Owner, enrol MFA, and continue with
the **go-live checklist** (*System → Installation*): connect suppliers, sync their catalogs, configure
services and offers, pricing tiers, the storefront, payment methods and email, then run a sandbox test
order. (In the demo: ten GSM suppliers, 56 services and 66 accounts. Core itself is industry-agnostic;
GSM comes from the GSM vertical pack.)

**Firewall.** Expose only 80/443. PostgreSQL (bundled) is reachable only on the internal Docker
network. If you use a managed database, allow-list your server's egress IP at the provider.

## 3. Install: vendor-assisted

For customers who prefer that ORVEX Systems performs the installation (Enterprise, or as a paid
service). The guiding rule: **the customer stays the owner and operator; the vendor gets temporary,
consented, auditable access and keeps nothing.**

1. **Prepare (customer).** Provision the server and, if desired, the managed database; create the
   DNS record; open a ticket (*Installation* category) on `account.orvex.io` with the target
   window.
2. **Grant access (customer).** Choose one:
   * a supervised screen-share session where your engineer runs the commands, or
   * a temporary Linux user with SSH key authentication and `sudo` limited to `docker` and
     `orvexctl`, expiring after the window (e.g. `useradd --expiredate`), recorded as a
     support access grant in the portal.
3. **Secrets stay with the customer.** You enter `LICENSE_KEY`, database credentials and generate
   `ENCRYPTION_KEY` / `SESSION_SECRET` yourself (or paste them during the session). The vendor
   engineer never stores them; tickets and chat must never contain secrets.
4. **Install (vendor engineer).** Same commands as §2, with `orvexctl init --deployment vendor-assisted`
   so the activation is recorded as vendor-assisted.
5. **Verify together.** Health page green, license *active*, a test order (e.g. an IMEI check)
   through a sandbox provider, backup job scheduled, first backup completed.
6. **Close access (customer).** Remove the temporary user / end the session; revoke the grant in the
   portal. All actions performed are listed in the installation's audit log and the ticket.

Vendor-assisted **updates** follow the same pattern (see §7), typically in a scheduled window.

## 4. Database options

ORVEX Core needs one PostgreSQL 14–17 database. Connectivity is configured **only** through
environment variables; there is no provider-specific code path.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Main connection string (may point at a pooler) |
| `DATABASE_DIRECT_URL` | Optional non-pooled connection for migrations, advisory locks and `LISTEN` |
| `DATABASE_SCHEMA` | Schema holding Core tables (default `orvex`) |
| `DATABASE_POOL_MAX` | Pool size per Core process |
| `DATABASE_SSL_MODE` | `disable` · `require` · `verify-full` (overrides `sslmode` in the URL) |
| `DATABASE_SSL_CA_FILE` | CA bundle for `verify-full` with a private CA |

| Option | Example `DATABASE_URL` | Notes |
|---|---|---|
| **Bundled** (`COMPOSE_PROFILES=bundled-db`) | `postgres://orvex:…@postgres:5432/orvex` | PostgreSQL 16 container on the internal network; `DATABASE_SSL_MODE=disable` is acceptable there. You own backups of the `postgres-data` volume (Core backups cover it). |
| **Self-hosted** (own VM / dedicated server) | `postgres://orvex:…@10.0.0.5:5432/orvex` | Use TLS (`verify-full`) unless on a private network you control. |
| **Supabase** | `postgres://postgres.<project-ref>:…@aws-0-<region>.pooler.supabase.com:6543/postgres` | `:6543` is the transaction pooler; set `DATABASE_DIRECT_URL` to the session/direct connection (`…:5432`). Keep schema `orvex` **out** of the API-exposed schemas. `DATABASE_SSL_MODE=require`. |
| **Neon** | `postgres://<role>:…@ep-<id>-pooler.<region>.aws.neon.tech/orvex` | `-pooler` host = PgBouncer (transaction mode); set `DATABASE_DIRECT_URL` to the non-pooler host. `require`. Autosuspend adds a cold-start delay on the first query; disable it for production. |
| **AWS RDS / Aurora PostgreSQL** | `postgres://orvex:…@<name>.<id>.<region>.rds.amazonaws.com:5432/orvex` | `verify-full` with the RDS CA bundle in `DATABASE_SSL_CA_FILE`. Snapshots can be used as `provider_snapshot` backups. |
| **Hetzner** (managed or self-run on Hetzner Cloud / dedicated) | `postgres://orvex:…@10.0.1.2:5432/orvex` | Use the private network; `require` or `verify-full`. |
| Any other PostgreSQL-compatible service | `postgres://…` | Must provide real PostgreSQL 14–17 semantics: `FOR UPDATE SKIP LOCKED`, declarative partitioning, PL/pgSQL. Wire-compatible databases with different semantics (e.g. CockroachDB) are not supported in V1. |

Database privileges: the Core role needs `CONNECT`, `CREATE` on the database (to create schema
`orvex` once; or let your DBA create it and grant ownership) and full rights inside that schema.
It needs no superuser and no extensions.

Connection budget: each of `core-api`, `core-worker`, `core-scheduler` opens up to
`DATABASE_POOL_MAX` connections; keep `3 × DATABASE_POOL_MAX + 10` below the server's limit (or use
a pooler).

## 5. Configuration reference

All configuration is environment-based; see the commented `.env.example`. Highlights:

| Group | Variables |
|---|---|
| Release | `CORE_VERSION`, `UPDATE_CHANNEL` (`stable`/`beta`), `RELEASE_SERVER_URL` |
| Application | `APP_URL`, `APP_DOMAIN`, `ACME_EMAIL`, `INSTALLATION_ENV`, `LOG_LEVEL`, `TRUST_PROXY` |
| Database | `DATABASE_URL`, `DATABASE_DIRECT_URL`, `DATABASE_SCHEMA`, `DATABASE_POOL_MAX`, `DATABASE_SSL_MODE`, `DATABASE_SSL_CA_FILE` |
| License | `LICENSE_KEY`, `LICENSE_SERVER_URL`, `TELEMETRY_HEARTBEAT` (`minimal`/`off`) |
| Security | `ENCRYPTION_KEY`, `ENCRYPTION_KEY_ID`, `ENCRYPTION_KEYS_PREVIOUS`, `SESSION_SECRET` |
| Storage | `STORAGE_DRIVER` (`local`/`s3`), `STORAGE_LOCAL_PATH`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` |
| Email | `SMTP_URL`, `MAIL_FROM` |
| Queue | `QUEUE_WORKERS`, `QUEUE_POLL_INTERVAL_MS` |
| Backups | `BACKUP_SCHEDULE`, `BACKUP_RETENTION_DAYS`, `BACKUP_TARGET`, `BACKUP_ENCRYPTION_RECIPIENT` |

Business configuration (services, routing, pricing, website, API defaults, security policies) is
**not** in `.env`; it lives in the database and is edited in the admin UI.

**`ENCRYPTION_KEY` is critical.** It protects provider credentials, webhook secrets, MFA secrets
and sensitive order inputs. Keep an offline copy separate from database backups. A database backup
without the key restores everything except those encrypted values. Rotation: set the new key and
id, move the old one to `ENCRYPTION_KEYS_PREVIOUS`, restart; a background job re-encrypts all rows,
after which the previous key can be removed.

## 6. Backup and restore

**What to back up**

| Item | How |
|---|---|
| PostgreSQL database | Core backups (nightly + before every update), or your provider's snapshots/PITR (recommended in addition) |
| `.env` (incl. `ENCRYPTION_KEY`) | Your secret manager / password vault, offline copy |
| `core-data` volume | Instance key (`instance.key`), local storage (if `STORAGE_DRIVER=local`), update journal |
| Object storage bucket | Provider-side versioning/replication (if `STORAGE_DRIVER=s3`) |

**Core backups.** `core-scheduler` runs `backup.run` on `BACKUP_SCHEDULE` (default 03:00 UTC):
`pg_dump --format=custom` of the `orvex` schema, encrypted to `BACKUP_ENCRYPTION_RECIPIENT` when
set, SHA-256 recorded, a manifest written next to the dump, retained `BACKUP_RETENTION_DAYS`.

```bash
orvexctl backup create --kind manual          # on demand
orvexctl backup list                          # reads the backup store (works even on an empty DB)
orvexctl backup verify bkp_manual_0927        # checksum + test restore into a scratch schema
```

**Restore** (disaster recovery or moving to another database provider):

```bash
orvexctl maintenance on                        # API returns 503 + Retry-After, workers stop
orvexctl backup restore bkp_nightly_1001       # into the database in DATABASE_URL
#   equivalent: pg_restore --clean --if-exists --no-owner -d "$DATABASE_DIRECT_URL" bkp_nightly_1001.dump
orvexctl migrate                               # if the backup's schema is older than the image
orvexctl maintenance off
```

Moving providers (e.g. bundled → RDS, or Neon → self-hosted) is a backup on the old database, a
restore into the new one, and a `DATABASE_URL` change. Core has no provider-specific state.

## 7. Updating ORVEX Core

Every release is the same, signed artifact for every customer. Updates run **inside your
infrastructure**, by your updater, against your database; the vendor never modifies a customer
database.

**From the admin UI**: *System → Updates → Update to 2.5.0*. The request is picked up by the
host-side update agent (`orvexctl agent`, installed by `orvexctl init` as a systemd service;
the long-running containers never get access to the Docker socket).

**From the shell** (identical flow):

```bash
orvexctl update --check                 # shows 2.4.1 → 2.5.0, schema 019 → 022, preflight results
orvexctl update 2.5.0
```

The flow (each step is recorded in *update_history* and shown live in the UI):

| # | Step | What happens | On failure |
|---|---|---|---|
| 1 | **Preflight** | Update entitlement (`updatesUntil` — an ended entitlement blocks the update but never operations), upgrade path (min 2.3.0), disk space, PostgreSQL / Docker compatibility, migrations declared expand-only, extension `coreRange` vs target (incompatible extensions will be disabled), recent backup; signed manifest downloaded and verified with the keys of the *currently installed* Core, image pulled by digest | Stop, nothing changed |
| 2 | **Backup** | Fresh `pre-update` backup, checksum verified | Stop, nothing changed |
| 3 | **Migration** | `orvex migrate` from the new image while the current version keeps serving: pending migrations (here `020`–`022`), each in its own transaction, checksum-verified, **additive only** (expand) | Failed file rolled back automatically; current version keeps running |
| 4 | **Worker drain** | Workers finish or release in-flight jobs; intake briefly returns `503` + `Retry-After` | Resume workers on the current version |
| 5 | **Container swap** | `CORE_VERSION` updated in `.env` (previous value kept); `docker compose up -d` replaces core-api, core-worker, core-scheduler | Automatic app-only rollback (§8) |
| 6 | **Health check** | `/healthz` reports the new version and schema `022`; DB, queue, storage, license and driver checks; smoke order through the sandbox driver | Automatic app-only rollback (§8) |
| 7 | **Complete** | Intake resumes, extensions re-checked, history written, optional heartbeat reports the new version | n/a |

Because migrations only add schema, the previous version tolerates the new schema: the intake pause is
limited to the drain + swap (typically under a minute), and app-only rollback is always safe.

Equivalent manual commands (what `orvexctl` executes):

```bash
orvexctl release verify 2.5.0                               # uses the installed Core's trusted keys
docker pull registry.orvex.io/core:2.5.0@sha256:<digest-from-manifest>
orvexctl backup create --kind pre-update
docker compose --profile tools run --rm migrate              # expand-only, current version keeps serving
orvexctl workers drain
sed -i 's/^CORE_VERSION=.*/CORE_VERSION=2.5.0/' .env
docker compose up -d core-api core-worker core-scheduler
orvexctl health --wait --expect-version 2.5.0 --expect-schema 022
```

**Vendor-assisted updates**: the customer grants a time-boxed access window (§3) or shares a
session; the vendor engineer runs exactly the same command. The installation records
`mode = vendor-assisted` in its update history.

## 8. Rollback

Migrations are **forward-only**; rollback never runs "down" scripts. Two strategies, chosen
automatically from the release manifest:

1. **Application-only rollback** (no data loss). When the release declares its schema change
   backward compatible with the previous minor (2.5.0's migrations 020–022 are purely additive:
   `"backwardCompatibleWith": "2.4"`), the updater restores `CORE_VERSION=2.4.1` and restarts. The
   database stays at 022, which 2.4.1 tolerates. Orders processed meanwhile are kept.
2. **Restore rollback**. When the schema change is not backward compatible, or the migration step
   itself failed in a non-transactional file, the updater restores the `pre-update` backup, sets the
   previous `CORE_VERSION`, restarts and verifies health. Data written after the backup is lost, which
   is why the restore path is reserved for non-additive releases (announced in the manifest).

Afterwards the updater re-applies its on-disk journal to `update_history` (a restore would otherwise
erase the record of the failed attempt), marks the attempt `rolled_back` and leaves maintenance
mode. The UI and the vendor-side ticket show what failed.

Manual rollback (e.g. a problem found hours later):

```bash
orvexctl rollback --to 2.4.1                 # application-only if compatible, else asks to restore
orvexctl rollback --to 2.4.1 --restore bkp_pre_250
```

## 9. Troubleshooting

| Symptom | Check / fix |
|---|---|
| `docker compose up` fails with *Set CORE_VERSION / APP_DOMAIN in .env* | `.env` missing or incomplete; run from the directory containing `docker-compose.yml`. |
| Caddy cannot obtain a certificate | DNS must point at the server; ports 80 and 443 reachable from the internet; `ACME_EMAIL` set. Check `docker compose logs caddy`. For internal hosts use `tls internal` or your own certificate. |
| `core-api` unhealthy, logs show *pending migrations* | The image is newer than the schema: `docker compose --profile tools run --rm migrate`. |
| *schema is newer than this Core version* | A rollback to an incompatible version; follow §8 restore rollback. |
| `connection refused` / timeouts to the database | Network path and allow-list at the provider; `DATABASE_SSL_MODE` (`require` for most managed services); for Neon, autosuspend cold start. |
| *prepared statement already exists* or `LISTEN` errors | `DATABASE_URL` points at a transaction-mode pooler; set `DATABASE_DIRECT_URL`. Core disables prepared statements automatically when it detects a pooler. |
| *too many connections* | Lower `DATABASE_POOL_MAX` or use a pooler; see the connection budget in §4. |
| License shows *cached* | License server unreachable from the server (egress firewall, proxy). Fully functional for 14 days after the last successful validation; then a 14-day grace period; see `docs/ARCHITECTURE.md § License architecture`. |
| License *invalid: domain mismatch* | `APP_DOMAIN` differs from the licensed domain. Add/change the domain in the portal (*License → Domains*), then *Re-validate*. |
| Webhook endpoint shows *failing* | Receiver (e.g. a reseller's callback URL) returns non-2xx or times out (10 s). Inspect the delivery timeline, fix the receiver, then *Replay*. |
| Provider *degraded / outage* | Provider-side issue or credentials (e.g. a DHRU-compatible XML gateway timing out); *Providers → Test connection*. Routing rules (e.g. *Skip degraded providers*) fail over automatically. |
| Collect a support bundle | `orvexctl support bundle`: versions, health, redacted config and recent logs. **You** review and attach it to a ticket; nothing is uploaded automatically. |
