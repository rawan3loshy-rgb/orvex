-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  004_providers.sql
-- -----------------------------------------------------------------------------
--  Schema version : 004
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : External supplier APIs ("providers"), their encrypted
--                   connection credentials, call logs and daily health rollups.
--  Note           : providers.adapter_id is added in 015 (Core 2.2.0).
-- =============================================================================

CREATE TABLE providers (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text          NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  name                   text          NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  short_name             text          NOT NULL CHECK (length(short_name) BETWEEN 1 AND 40),
  description            text          NOT NULL DEFAULT '',
  protocol               text          NOT NULL DEFAULT 'REST / JSON'
                                       CHECK (protocol IN ('REST / JSON', 'GraphQL', 'SOAP / XML', 'gRPC')),
  base_url               text          NOT NULL CHECK (base_url ~ '^https?://'),
  region                 text          NOT NULL DEFAULT '',
  status                 text          NOT NULL DEFAULT 'operational'
                                       CHECK (status IN ('operational', 'degraded', 'outage', 'disabled')),
  connection_state       text          NOT NULL DEFAULT 'disconnected'
                                       CHECK (connection_state IN ('connected', 'error', 'disconnected')),
  balance                numeric(12,4) NOT NULL DEFAULT 0,
  low_balance_threshold  numeric(12,4) NOT NULL DEFAULT 0 CHECK (low_balance_threshold >= 0),
  rate_limit_requests    integer       NOT NULL DEFAULT 20 CHECK (rate_limit_requests > 0),
  rate_limit_per         text          NOT NULL DEFAULT 'second' CHECK (rate_limit_per IN ('second', 'minute')),
  timeout_ms             integer       NOT NULL DEFAULT 30000 CHECK (timeout_ms BETWEEN 1000 AND 300000),
  retry_max_attempts     smallint      NOT NULL DEFAULT 3 CHECK (retry_max_attempts BETWEEN 1 AND 10),
  retry_backoff          text          NOT NULL DEFAULT 'exponential'
                                       CHECK (retry_backoff IN ('exponential', 'linear', 'fixed')),
  retry_base_delay_ms    integer       NOT NULL DEFAULT 400 CHECK (retry_base_delay_ms BETWEEN 0 AND 60000),
  webhook_signing        boolean       NOT NULL DEFAULT true,
  color                  text,
  connected_at           timestamptz,
  last_sync_at           timestamptz,
  last_check_at          timestamptz,
  archived_at            timestamptz,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX providers_status_idx ON providers (status) WHERE archived_at IS NULL;

COMMENT ON TABLE providers IS
  'Supplier APIs this installation routes orders to. API id = ''prv_'' || replace(slug, ''-'', '''') (e.g. slug global-unlock → prv_globalunlock). Providers referenced by orders are archived, never deleted.';
COMMENT ON COLUMN providers.status IS
  'Maintained by the health monitor (core-scheduler) from health checks and attempt outcomes; ''disabled'' is set by an operator. Core never routes to disabled or outage providers.';
COMMENT ON COLUMN providers.balance IS
  'Prepaid balance held at the provider, refreshed through the adapter''s balance call. Low-balance alerts fire below low_balance_threshold.';
COMMENT ON COLUMN providers.webhook_signing IS
  'Whether inbound callbacks from this provider must carry a valid signature. Callbacks arrive at {APP_URL}/hooks/providers/{slug}; the URL is derived, not stored.';

CREATE TRIGGER providers_set_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- provider_connections — credentials, encrypted at rest. Never plaintext.
-- -----------------------------------------------------------------------------
CREATE TABLE provider_connections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id             uuid        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  environment             text        NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
  base_url_override       text        CHECK (base_url_override ~ '^https?://'),
  options                 jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(options) = 'object'),
  credentials_ciphertext  bytea       NOT NULL CHECK (octet_length(credentials_ciphertext) > 16),
  credentials_nonce       bytea       NOT NULL CHECK (octet_length(credentials_nonce) = 12),
  credentials_key_id      text        NOT NULL CHECK (credentials_key_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  credential_hints        jsonb       NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(credential_hints) = 'array'),
  last_rotated_at         timestamptz NOT NULL DEFAULT now(),
  last_tested_at          timestamptz,
  last_test_ok            boolean,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_connections_one_per_env UNIQUE (provider_id, environment)
);

COMMENT ON TABLE provider_connections IS
  'Connection to a provider per environment (live / test sandbox). Secrets are stored only as an AES-256-GCM encrypted JSON bundle {credentialKey: secret}.';
COMMENT ON COLUMN provider_connections.credentials_ciphertext IS
  'AES-256-GCM ciphertext of the credential bundle with the 16-byte auth tag appended. Associated data = ''provider_connections:'' || id, so a ciphertext cannot be moved to another row.';
COMMENT ON COLUMN provider_connections.credentials_nonce IS
  '96-bit random nonce, unique per encryption.';
COMMENT ON COLUMN provider_connections.credentials_key_id IS
  'Id of the data-encryption key in the installation key ring (derived from ENCRYPTION_KEY via HKDF). Enables key rotation: rows are re-encrypted in the background, old ids stay readable until done.';
COMMENT ON COLUMN provider_connections.credential_hints IS
  'Non-secret metadata shown in the UI: [{"key","label","masked","lastRotatedAt"}]. masked reveals at most the last 4 characters. Secrets are write-only through the API.';
COMMENT ON COLUMN provider_connections.options IS
  'Non-secret adapter options (e.g. {"batchSize": 50, "region": "us-west"}).';

CREATE TRIGGER provider_connections_set_updated_at BEFORE UPDATE ON provider_connections
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- provider_logs — adapter operations (submit, status poll, catalog sync,
-- health check, inbound webhook, balance). Pruned by the retention job.
-- -----------------------------------------------------------------------------
CREATE TABLE provider_logs (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id  uuid        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  at           timestamptz NOT NULL DEFAULT now(),
  level        text        NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  operation    text        NOT NULL
               CHECK (operation IN ('submit_order', 'get_status', 'list_services', 'health_check', 'webhook_in', 'balance')),
  http_status  smallint    CHECK (http_status BETWEEN 100 AND 599),
  latency_ms   integer     CHECK (latency_ms >= 0),
  message      text        NOT NULL DEFAULT '',
  order_id     uuid,
  request_id   text
);

CREATE INDEX provider_logs_provider_at_idx ON provider_logs (provider_id, at DESC);
CREATE INDEX provider_logs_errors_idx ON provider_logs (at DESC) WHERE level = 'error';

COMMENT ON TABLE provider_logs IS
  'Operational log of adapter calls. Payloads and secrets are never logged. order_id intentionally has no foreign key: log rows are written on the hot path and may outlive the order retention window.';

-- -----------------------------------------------------------------------------
-- provider_daily_stats — rollup written by the scheduler (90-day uptime bars).
-- -----------------------------------------------------------------------------
CREATE TABLE provider_daily_stats (
  provider_id     uuid         NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day             date         NOT NULL,
  uptime_percent  numeric(5,2) NOT NULL CHECK (uptime_percent BETWEEN 0 AND 100),
  status          text         NOT NULL CHECK (status IN ('operational', 'degraded', 'outage', 'disabled')),
  attempts        integer      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  successes       integer      NOT NULL DEFAULT 0 CHECK (successes >= 0),
  latency_p50_ms  integer      CHECK (latency_p50_ms >= 0),
  latency_p95_ms  integer      CHECK (latency_p95_ms >= 0),
  PRIMARY KEY (provider_id, day),
  CONSTRAINT provider_daily_stats_successes_le_attempts CHECK (successes <= attempts)
);

COMMENT ON TABLE provider_daily_stats IS
  'Daily provider health rollup (UTC days). Source of Provider.uptimeHistory, uptime30d and latency percentiles.';
