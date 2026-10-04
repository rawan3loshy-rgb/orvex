-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  011_system_operations.sql
-- -----------------------------------------------------------------------------
--  Schema version : 011
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : Health checks and incidents, the cached signed license,
--                   backup catalog and update history.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- system_health_checks — component checks written by core-scheduler.
-- -----------------------------------------------------------------------------
CREATE TABLE system_health_checks (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  component   text        NOT NULL
              CHECK (component IN ('application', 'database', 'queue', 'api', 'webhooks', 'storage', 'license', 'updates')),
  status      text        NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'attention')),
  summary     text        NOT NULL,
  metric      text        NOT NULL DEFAULT '',
  latency_ms  integer     CHECK (latency_ms >= 0),
  details     jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  host        text
);

CREATE INDEX system_health_checks_component_idx ON system_health_checks (component, checked_at DESC);

COMMENT ON TABLE system_health_checks IS
  'Time series of component health (HealthComponent). The latest row per component is the current state shown on the Health page; 30 days are kept.';

CREATE TABLE incidents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  component      text        NOT NULL,
  status         text        NOT NULL DEFAULT 'investigating'
                 CHECK (status IN ('investigating', 'monitoring', 'resolved')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  auto_detected  boolean     NOT NULL DEFAULT true,
  notes          text        NOT NULL DEFAULT '',
  CONSTRAINT incidents_resolution_consistent CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);

CREATE INDEX incidents_open_idx ON incidents (started_at DESC) WHERE status <> 'resolved';

COMMENT ON TABLE incidents IS
  'Incidents opened automatically by the health monitor (provider outage, failing webhook endpoint, database failover…) or by an operator.';

-- -----------------------------------------------------------------------------
-- license_state — cached, signed license + validation bookkeeping. Singleton.
-- -----------------------------------------------------------------------------
CREATE TABLE license_state (
  singleton             boolean     PRIMARY KEY DEFAULT true CHECK (singleton),
  license_id            text        NOT NULL CHECK (license_id ~ '^LIC-[0-9]{4}-[A-Z0-9]{2}$'),
  license_key_hint      text        NOT NULL,
  installation_id       text        NOT NULL REFERENCES installation(installation_id),
  status                text        NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'invalid')),
  plan                  text        NOT NULL,
  customer              text        NOT NULL,
  domain                text        NOT NULL,
  licensed_version      text        NOT NULL,
  issued_at             timestamptz NOT NULL,
  activated_at          timestamptz NOT NULL,
  expires_at            timestamptz NOT NULL,
  updates_until         timestamptz NOT NULL,
  modules               jsonb       NOT NULL CHECK (jsonb_typeof(modules) = 'array'),
  limits                jsonb       NOT NULL CHECK (jsonb_typeof(limits) = 'array'),
  license_document      jsonb       NOT NULL CHECK (jsonb_typeof(license_document) = 'object'),
  signature             text        NOT NULL CHECK (signature ~ '^ed25519:'),
  signing_key_id        text        NOT NULL,
  validation_receipt    jsonb       CHECK (validation_receipt IS NULL OR jsonb_typeof(validation_receipt) = 'object'),
  validation_mode       text        NOT NULL DEFAULT 'online' CHECK (validation_mode IN ('online', 'cached')),
  last_validated_at     timestamptz,
  last_attempt_at       timestamptz,
  last_error            text,
  consecutive_failures  integer     NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  next_validation_at    timestamptz NOT NULL,
  cache_valid_until     timestamptz,
  grace_period_days     smallint    NOT NULL DEFAULT 14 CHECK (grace_period_days BETWEEN 1 AND 30),
  grace_started_at      timestamptz,
  license_server_url    text        NOT NULL DEFAULT 'https://license.orvex.io',
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_state_term CHECK (expires_at > issued_at),
  CONSTRAINT license_state_grace_consistent CHECK (status <> 'grace' OR grace_started_at IS NOT NULL)
);

COMMENT ON TABLE license_state IS
  'Local cache of the license (InstallationLicense). Source of truth is license_document + signature, verified with the ORVEX public key compiled into Core on every boot and every validation; the denormalised columns are re-derived from the verified document, so editing them changes nothing.';
COMMENT ON COLUMN license_state.license_key_hint IS
  'Masked key, e.g. LX-2048-AX91-••••-••••. The key itself is provided via LICENSE_KEY and never stored.';
COMMENT ON COLUMN license_state.validation_receipt IS
  'Last signed validation response from the license server (contains validatedAt and cacheValidUntil).';
COMMENT ON COLUMN license_state.cache_valid_until IS
  'last_validated_at + grace_period_days (14). Until then the installation is fully licensed even if the license server is unreachable (validation_mode = cached).';
COMMENT ON COLUMN license_state.grace_started_at IS
  'Set when the cache window lapses or the term expires; grace lasts grace_period_days with full functionality before status becomes expired (restricted mode — never data loss).';

CREATE TRIGGER license_state_set_updated_at BEFORE UPDATE ON license_state
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- backups — catalog of database backups.
-- -----------------------------------------------------------------------------
CREATE TABLE backups (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL UNIQUE CHECK (name ~ '^bkp_[a-z0-9_]{1,60}$'),
  kind            text        NOT NULL CHECK (kind IN ('pre-update', 'scheduled', 'manual')),
  status          text        NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'completed', 'failed', 'expired', 'deleted')),
  method          text        NOT NULL DEFAULT 'pg_dump' CHECK (method IN ('pg_dump', 'provider_snapshot')),
  core_version    text        NOT NULL,
  schema_version  text        NOT NULL CHECK (schema_version ~ '^[0-9]{3}$'),
  storage_uri     text,
  size_bytes      bigint      CHECK (size_bytes >= 0),
  sha256          char(64)    CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  encrypted       boolean     NOT NULL DEFAULT true,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  expires_at      timestamptz,
  created_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  error           text,
  CONSTRAINT backups_completed_has_artifact
    CHECK (status <> 'completed' OR (storage_uri IS NOT NULL AND sha256 IS NOT NULL AND completed_at IS NOT NULL))
);

CREATE INDEX backups_started_idx ON backups (started_at DESC);

COMMENT ON TABLE backups IS
  'Index of backups (e.g. bkp_nightly_1001, bkp_0905). The backup store is the source of truth: every backup is written with a manifest file next to it, so the catalog can be rebuilt after a restore (orvexctl backup list reads storage, not this table).';
COMMENT ON COLUMN backups.method IS
  'pg_dump (custom format, portable across PostgreSQL hosts) or provider_snapshot (e.g. a Neon branch or RDS snapshot taken through the provider API when configured).';
COMMENT ON COLUMN backups.schema_version IS
  'Schema version contained in the backup. A restore requires a Core image whose migrations start at or below this version.';

-- -----------------------------------------------------------------------------
-- update_history — every Core update attempt (UpdateCenterState.history).
-- -----------------------------------------------------------------------------
CREATE TABLE update_history (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_version        text        NOT NULL,
  to_version          text        NOT NULL,
  from_schema         text        NOT NULL CHECK (from_schema ~ '^[0-9]{3}$'),
  to_schema           text        CHECK (to_schema ~ '^[0-9]{3}$'),
  channel             text        NOT NULL CHECK (channel IN ('stable', 'beta')),
  mode                text        NOT NULL DEFAULT 'self-managed' CHECK (mode IN ('self-managed', 'vendor-assisted')),
  status              text        NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress', 'success', 'failed', 'rolled_back')),
  current_step        text        CHECK (current_step IN ('preparing', 'backup', 'download', 'verify', 'install',
                                                          'migrate', 'restart', 'health', 'complete', 'rollback')),
  steps               jsonb       NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(steps) = 'array'),
  backup_id           uuid        REFERENCES backups(id) ON DELETE SET NULL,
  package_sha256      char(64)    CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  signature_verified  boolean     NOT NULL DEFAULT false,
  initiated_by        uuid        REFERENCES users(id) ON DELETE SET NULL,
  initiated_by_label  text        NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  duration_sec        integer     CHECK (duration_sec >= 0),
  error               text,
  CONSTRAINT update_history_finished_consistent CHECK ((status = 'in_progress') = (finished_at IS NULL))
);

CREATE UNIQUE INDEX update_history_single_in_progress ON update_history ((true)) WHERE status = 'in_progress';
CREATE INDEX update_history_started_idx ON update_history (started_at DESC);

COMMENT ON TABLE update_history IS
  'Update attempts. The updater also keeps an on-disk journal (/var/lib/orvex/updates/journal.jsonl) and re-applies its entries after a rollback restore, because restoring the pre-update backup would otherwise erase the record of the failed attempt.';
COMMENT ON COLUMN update_history.steps IS
  '[{"id": "backup", "status": "done", "startedAt": "…", "finishedAt": "…", "detail": "bkp_pre_250 · 1.29 GB"}] — preparing, backup, download, verify, install, migrate, restart, health, complete (rollback when triggered).';
COMMENT ON COLUMN update_history.initiated_by_label IS
  'Display name, e.g. ''Alex Morgan'' or ''ORVEX (vendor-assisted)''.';
