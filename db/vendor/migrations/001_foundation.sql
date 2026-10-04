-- =============================================================================
--  ORVEX Systems · VENDOR PLATFORM database
--  001_foundation.sql
-- -----------------------------------------------------------------------------
--  This is the vendor's own commercial database behind orvex.io,
--  account.orvex.io, license.orvex.io and releases.orvex.io.
--  It holds accounts, subscriptions, invoices, licenses, releases and support
--  tickets — and NOTHING from a customer's installation: no providers, no
--  services, no orders, no resellers, no end-customer data, no API keys,
--  no credentials. The only installation facts stored here are the license
--  activation record and heartbeat metadata (version, schema version, health).
--
--  Separate migration track from the installation database (db/installation).
--  Same runner contract: forward-only, transactional, checksum-verified.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  component     text        NOT NULL DEFAULT 'platform' CHECK (component ~ '^[a-z0-9][a-z0-9.-]{2,127}$'),
  version       text        NOT NULL CHECK (version ~ '^[0-9]{3}$'),
  name          text        NOT NULL,
  checksum      char(64)    NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  core_version  text        NOT NULL,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  duration_ms   integer     NOT NULL CHECK (duration_ms >= 0),
  applied_by    text        NOT NULL,
  PRIMARY KEY (component, version)
);

COMMENT ON TABLE schema_migrations IS
  'Migration ledger of the vendor platform (component = platform). core_version holds the platform build that applied the file.';

CREATE OR REPLACE FUNCTION platform_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION platform_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('platform.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

-- -----------------------------------------------------------------------------
-- audit_logs — staff and customer actions on the vendor platform
-- (license reissue, domain change, invoice void, support access request…).
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor_type    text        NOT NULL CHECK (actor_type IN ('customer', 'staff', 'system')),
  actor_id      text        NOT NULL,
  actor_label   text        NOT NULL,
  account_id    uuid,
  action        text        NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type   text        NOT NULL,
  entity_id     text        NOT NULL,
  summary       text        NOT NULL,
  ip            inet,
  changes       jsonb       CHECK (changes IS NULL OR jsonb_typeof(changes) = 'array')
);

CREATE INDEX audit_logs_account_idx ON audit_logs (account_id, at DESC);
CREATE INDEX audit_logs_at_idx ON audit_logs (at DESC);

CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION platform_forbid_mutation();
