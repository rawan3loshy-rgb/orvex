-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  009_api_keys.sql
-- -----------------------------------------------------------------------------
--  Schema version : 009
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : API keys for the Reseller API v1 and internal integrations.
--
--  Hashing history: Core <= 2.4 stored salted SHA-256 digests ("sha256:" prefix).
--  Core 2.5.0 hashes new keys with Argon2id and transparently re-hashes a legacy
--  key on its next successful use (the plaintext is only available at that
--  moment), so no data migration is needed and no key has to be re-issued.
-- =============================================================================

CREATE TABLE api_keys (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  prefix                 text        NOT NULL UNIQUE CHECK (prefix ~ '^orx_(live|test)_[A-Za-z0-9]{4}$'),
  last4                  char(4)     NOT NULL CHECK (last4 ~ '^[A-Za-z0-9]{4}$'),
  secret_hash            text        NOT NULL CHECK (secret_hash LIKE '$argon2id$%' OR secret_hash LIKE 'sha256:%'),
  reseller_id            uuid        REFERENCES resellers(id) ON DELETE CASCADE,
  environment            text        NOT NULL CHECK (environment IN ('live', 'test')),
  scopes                 text[]      NOT NULL
                         CHECK (cardinality(scopes) > 0
                                AND scopes <@ ARRAY['services:read', 'orders:read', 'orders:write', 'balance:read', 'webhooks:manage']::text[]),
  rate_limit_per_minute  integer     NOT NULL DEFAULT 300 CHECK (rate_limit_per_minute BETWEEN 1 AND 100000),
  ip_allowlist           cidr[]      NOT NULL DEFAULT '{}',
  status                 text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_by             uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  last_used_at           timestamptz,
  last_used_ip           inet,
  expires_at             timestamptz,
  revoked_at             timestamptz,
  revoked_by             uuid        REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT api_keys_prefix_matches_environment CHECK (prefix ~ ('^orx_' || environment || '_')),
  CONSTRAINT api_keys_revocation_consistent      CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX api_keys_reseller_active_idx ON api_keys (reseller_id) WHERE status = 'active';
CREATE INDEX api_keys_expiry_idx ON api_keys (expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

COMMENT ON TABLE api_keys IS
  'API credentials. The full secret (orx_live_<40 base62 chars>) is shown exactly once at creation and never stored.';
COMMENT ON COLUMN api_keys.prefix IS
  'Public lookup prefix = ''orx_<env>_'' + first 4 characters of the secret body (e.g. orx_live_4f2a). Unique; regenerated on collision at creation.';
COMMENT ON COLUMN api_keys.secret_hash IS
  'Argon2id PHC string of the full secret (legacy ''sha256:'' digests are upgraded on next use). Verification: look up by prefix, verify with Argon2id (constant time), then cache the positive result in memory for 60 s keyed by SHA-256 of the presented key, so the hot path does not pay the Argon2 cost per request. Revocation clears the cache across processes via NOTIFY.';
COMMENT ON COLUMN api_keys.reseller_id IS
  'NULL = internal key owned by the installation (reporting, importers).';
COMMENT ON COLUMN api_keys.ip_allowlist IS
  'Empty = any address (unless settings.api.requireIpAllowlist). Single addresses are stored as /32 or /128.';
COMMENT ON COLUMN api_keys.status IS
  'expired is set by the scheduler once expires_at passes.';
