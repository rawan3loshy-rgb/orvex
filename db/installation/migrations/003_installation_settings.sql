-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  003_installation_settings.sql
-- -----------------------------------------------------------------------------
--  Schema version : 003
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : Installation identity (singleton) and settings sections.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- installation — who this installation is. Exactly one row, written by the
-- installer (`orvexctl init`) on first boot, never by a migration.
-- -----------------------------------------------------------------------------
CREATE TABLE installation (
  singleton            boolean     PRIMARY KEY DEFAULT true CHECK (singleton),
  installation_id      text        NOT NULL UNIQUE CHECK (installation_id ~ '^inst_[a-z0-9]{12}$'),
  name                 text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  org_name             text        NOT NULL,
  domain               text        NOT NULL
                       CHECK (domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  environment          text        NOT NULL CHECK (environment IN ('production', 'staging')),
  core_version         text        NOT NULL,
  instance_public_key  text,
  installed_at         timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE installation IS
  'Identity of this installation (e.g. inst_7f3k9q2m8x1v · UnlockDesk Production · portal.unlockdesk-demo.com). Singleton.';
COMMENT ON COLUMN installation.core_version IS
  'Running Core version, written by the updater after a successful update. The schema version is max(version) in schema_migrations.';
COMMENT ON COLUMN installation.instance_public_key IS
  'Ed25519 public key generated at activation. The private key lives on the data volume (/var/lib/orvex/instance.key) and signs every license-server request — this is the installation binding.';

CREATE TRIGGER installation_set_updated_at BEFORE UPDATE ON installation
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- settings — one JSON document per section (mirrors InstallationSettings).
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
  section     text        PRIMARY KEY
              CHECK (section IN ('general', 'security', 'api', 'email', 'webhooks', 'localization', 'branding')),
  value       jsonb       NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  updated_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE settings IS
  'Runtime configuration edited from Settings in the admin UI. Validated by the application against a JSON schema per section. Infrastructure secrets (database, SMTP credentials, encryption keys) are NEVER stored here — they come from the environment.';
COMMENT ON COLUMN settings.value IS
  'Section document. email.smtpHostMasked is derived from SMTP_URL at read time and never persisted.';

CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- Neutral defaults; the installer fills organisation-specific values.
INSERT INTO settings (section, value) VALUES
  ('general',      '{"orgName": "", "supportEmail": "", "timezone": "UTC", "currency": "USD", "orderPrefix": "#"}'),
  ('security',     '{"enforceMfa": true, "sessionTimeoutMin": 60, "ipAllowlistAdmin": [], "passwordMinLength": 12, "auditRetentionDays": 365}'),
  ('api',          '{"baseUrl": "", "defaultRateLimit": 300, "requireIpAllowlist": false, "idempotencyWindowHours": 24, "sandboxEnabled": true}'),
  ('email',        '{"provider": "SMTP", "fromName": "", "fromAddress": "", "verified": false}'),
  ('webhooks',     '{"signingAlgorithm": "HMAC-SHA256", "maxAttempts": 8, "backoff": "Exponential (30s → 6h)", "timeoutMs": 10000}'),
  ('localization', '{"language": "English (US)", "dateFormat": "DD MMM YYYY", "numberFormat": "1,234.56"}'),
  ('branding',     '{"logoText": "", "primaryColor": "#2b2d30", "adminTitle": ""}');
