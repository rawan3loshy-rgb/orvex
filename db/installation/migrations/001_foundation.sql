-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  001_foundation.sql
-- -----------------------------------------------------------------------------
--  Schema version : 001
--  Introduced in  : Core 1.x (001–012 consolidate the 1.x schema history)
--  Transaction    : yes — the runner wraps every file in BEGIN … COMMIT
--
--  This database belongs to ONE customer installation. It runs on the
--  customer's own PostgreSQL (self-hosted, Supabase, Neon, AWS RDS, Hetzner…)
--  and never contains data of any other customer. There is deliberately no
--  tenant_id anywhere in this schema: ORVEX is not multi-tenant SaaS.
--
--  Runner contract (full text in db/README.md):
--    * the version is the numeric file-name prefix; files run in order, once;
--    * search_path is set to the installation schema (DATABASE_SCHEMA,
--      default "orvex") before a file runs, so objects are created unqualified;
--    * the runner — never the file — records the row in schema_migrations,
--      inside the same transaction, together with the file's SHA-256 checksum;
--    * no PostgreSQL extensions are required (gen_random_uuid() and sha256()
--      are built in since PostgreSQL 13 / 11).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- schema_migrations — the migration ledger.
-- Created with IF NOT EXISTS because the runner bootstraps it before 001 runs.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  component     text        NOT NULL DEFAULT 'core'
                CHECK (component ~ '^(core|[a-z0-9][a-z0-9.-]{2,127})$'),
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
  'Forward-only migration ledger. One row per applied file. component = ''core'' for Core migrations or an extension id for extension-owned migrations (extensions keep their tables in their own schema).';
COMMENT ON COLUMN schema_migrations.checksum IS
  'SHA-256 (hex) of the migration file exactly as shipped in the signed release. The runner refuses to continue if an applied file''s checksum no longer matches.';
COMMENT ON COLUMN schema_migrations.core_version IS
  'Core release whose package contained and applied this migration, e.g. 2.5.0.';
COMMENT ON COLUMN schema_migrations.applied_by IS
  'Who ran it: installer, updater, or ''orvexctl migrate'' (manual/vendor-assisted).';

-- -----------------------------------------------------------------------------
-- Shared trigger functions.
-- Prefixed with orvex_ so they never collide with objects of other
-- applications when the PostgreSQL instance is shared (e.g. a Supabase project).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION orvex_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

COMMENT ON FUNCTION orvex_set_updated_at() IS
  'BEFORE UPDATE trigger: maintains updated_at.';

CREATE OR REPLACE FUNCTION orvex_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Retention jobs purge old rows explicitly:
  --   SET LOCAL orvex.retention_purge = 'on'; DELETE FROM … WHERE at < …;
  IF TG_OP = 'DELETE' AND current_setting('orvex.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation',
          HINT = 'Write a new row instead of changing history.';
END
$$;

COMMENT ON FUNCTION orvex_forbid_mutation() IS
  'BEFORE UPDATE OR DELETE trigger for append-only tables (audit log, order events). Protects history against application bugs and accidental edits; it is not a control against a database superuser, who owns the data anyway.';
