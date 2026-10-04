-- =============================================================================
--  ORVEX Systems · VENDOR PLATFORM database
--  005_licensing.sql
-- -----------------------------------------------------------------------------
--  Signing keys, licenses, licensed domains and modules, installation
--  activations, heartbeats and the validation log (license.orvex.io).
--
--  What the vendor learns about an installation is limited to what is needed
--  to license and support it: installation id, domain, environment, Core and
--  schema version, health summary, update channel, declared hosting labels
--  and license-relevant counters. Never business data, never hostnames or IPs
--  of databases, never credentials.
-- =============================================================================

CREATE TABLE signing_keys (
  id           text        PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{3,64}$'),
  label        text        NOT NULL,
  purpose      text        NOT NULL CHECK (purpose IN ('license', 'release')),
  algorithm    text        NOT NULL DEFAULT 'Ed25519' CHECK (algorithm = 'Ed25519'),
  public_key   text        NOT NULL,
  not_before   timestamptz NOT NULL,
  not_after    timestamptz NOT NULL,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signing_keys_validity CHECK (not_after > not_before)
);

COMMENT ON TABLE signing_keys IS
  'Public halves of the vendor signing keys (orvex-license-2026, orvex-release-2026 "ORVEX Release Key 2026"). Private keys live in an HSM/KMS and never in a database. Core embeds the public keys of the current and next key generation, which makes rotation possible without breaking verification.';

CREATE TABLE licenses (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number     text        NOT NULL UNIQUE CHECK (license_number ~ '^LIC-[0-9]{4}-[A-Z0-9]{2}$'),
  account_id         uuid        NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  subscription_id    uuid        REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id            text        NOT NULL REFERENCES plans(id),
  key_prefix         text        NOT NULL UNIQUE CHECK (key_prefix ~ '^LX-[0-9]{4}-[A-Z0-9]{4}$'),
  key_hash           bytea       NOT NULL UNIQUE CHECK (octet_length(key_hash) = 32),
  key_ciphertext     bytea       NOT NULL,
  key_nonce          bytea       NOT NULL CHECK (octet_length(key_nonce) = 12),
  key_key_id         text        NOT NULL,
  status             text        NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'suspended')),
  licensed_version   text        NOT NULL CHECK (licensed_version ~ '^[0-9]+\.(x|[0-9]+)$'),
  max_installations  integer     NOT NULL CHECK (max_installations >= 1),
  enforcement        text        NOT NULL DEFAULT 'restrict_intake' CHECK (enforcement IN ('restrict_intake', 'notify_only')),
  issued_at          timestamptz NOT NULL,
  activated_at       timestamptz,
  expires_at         timestamptz NOT NULL,
  updates_until      timestamptz NOT NULL,
  signing_key_id     text        NOT NULL REFERENCES signing_keys(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT licenses_term CHECK (expires_at > issued_at)
);

CREATE INDEX licenses_account_idx ON licenses (account_id);

COMMENT ON TABLE licenses IS
  'VendorLicense (e.g. LIC-4829-AX · Professional · 2.x · 12 Aug 2026 → 12 Aug 2027 · max 2 installations).';
COMMENT ON COLUMN licenses.key_hash IS
  'SHA-256 of the full license key (LX-2048-AX91-7KQ2-M3PD). Keys are high-entropy random strings, so a fast hash is appropriate for lookup at activation.';
COMMENT ON COLUMN licenses.key_ciphertext IS
  'Encrypted copy so the portal can show the key again to the account Owner/Technical members.';
COMMENT ON COLUMN licenses.enforcement IS
  'What Core does after the grace period: restrict_intake (pause new order intake; admin, data export, in-flight orders and backups keep working) or notify_only (contractual enforcement, e.g. Enterprise).';

CREATE TRIGGER licenses_set_updated_at BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION platform_set_updated_at();

CREATE TABLE license_domains (
  license_id   uuid        NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  domain       text        NOT NULL
               CHECK (domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  environment  text        NOT NULL CHECK (environment IN ('production', 'staging')),
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (license_id, domain)
);

CREATE UNIQUE INDEX license_domains_domain_key ON license_domains (domain);

COMMENT ON TABLE license_domains IS
  'VendorLicense.licensedDomains (portal.unlockdesk-demo.com, staging.unlockdesk-demo.com). A domain is bound to at most one license.';

CREATE TABLE license_modules (
  license_id  uuid    NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  module_id   text    NOT NULL REFERENCES modules(id),
  included    boolean NOT NULL,
  PRIMARY KEY (license_id, module_id)
);

-- -----------------------------------------------------------------------------
-- installations — license activations (InstallationRef).
-- -----------------------------------------------------------------------------
CREATE TABLE installations (
  id                   text        PRIMARY KEY CHECK (id ~ '^inst_[a-z0-9]{12}$'),
  license_id           uuid        NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
  name                 text        NOT NULL,
  domain               text        NOT NULL,
  environment          text        NOT NULL CHECK (environment IN ('production', 'staging')),
  deployment           text        NOT NULL DEFAULT 'self-managed' CHECK (deployment IN ('self-managed', 'vendor-assisted')),
  update_channel       text        NOT NULL DEFAULT 'stable' CHECK (update_channel IN ('stable', 'beta')),
  instance_public_key  text        NOT NULL,
  status               text        NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'degraded')),
  core_version         text,
  schema_version       text        CHECK (schema_version ~ '^[0-9]{3}$'),
  hosting_label        text,
  region_label         text,
  database_label       text,
  activated_at         timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at    timestamptz,
  last_validated_at    timestamptz,
  deactivated_at       timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT installations_domain_licensed FOREIGN KEY (license_id, domain) REFERENCES license_domains (license_id, domain)
);

CREATE UNIQUE INDEX installations_active_domain ON installations (domain) WHERE deactivated_at IS NULL;
CREATE INDEX installations_license_idx ON installations (license_id) WHERE deactivated_at IS NULL;
CREATE INDEX installations_version_idx ON installations (core_version) WHERE deactivated_at IS NULL;

COMMENT ON TABLE installations IS
  'One row per activated installation (inst_7f3k9q2m8x1v · portal.unlockdesk-demo.com · 2.4.1 / 017). Fleet view for release rollout and support. The vendor can see that an installation exists and which version it runs — it cannot reach into it.';
COMMENT ON COLUMN installations.instance_public_key IS
  'Ed25519 public key generated by the installation at activation; heartbeats and validations must be signed with the matching private key (installation binding). A copied installation on another server either fails domain checks or shows up as a second instance with the same id.';
COMMENT ON COLUMN installations.status IS
  'Derived from heartbeat age and reported health: offline after 3 missed daily heartbeats. Offline is informational only and never affects the customer.';
COMMENT ON COLUMN installations.database_label IS
  'Engine and version as declared/reported (e.g. "PostgreSQL 16.4 (self-hosted)", "Neon PostgreSQL 16 (serverless)") for compatibility support. Never hosts, URLs or credentials.';

CREATE TRIGGER installations_set_updated_at BEFORE UPDATE ON installations
  FOR EACH ROW EXECUTE FUNCTION platform_set_updated_at();

CREATE TABLE installation_heartbeats (
  installation_id  text        NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  received_at      timestamptz NOT NULL DEFAULT now(),
  core_version     text        NOT NULL,
  schema_version   text        NOT NULL CHECK (schema_version ~ '^[0-9]{3}$'),
  health           text        NOT NULL CHECK (health IN ('healthy', 'degraded', 'down', 'attention')),
  update_channel   text        NOT NULL CHECK (update_channel IN ('stable', 'beta')),
  license_status   text        CHECK (license_status IN ('active', 'grace', 'expired', 'invalid')),
  platform         jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(platform) = 'object'),
  counters         jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(counters) = 'object'),
  signature_ok     boolean     NOT NULL,
  PRIMARY KEY (installation_id, received_at)
);

COMMENT ON TABLE installation_heartbeats IS
  'Optional daily heartbeat (TELEMETRY_HEARTBEAT=minimal on the installation; can be turned off — licensing then relies on validation calls alone). Kept 90 days.';
COMMENT ON COLUMN installation_heartbeats.platform IS
  '{"node": "22.11.0", "postgres": "16.4", "runtime": "docker-compose"} — versions only.';
COMMENT ON COLUMN installation_heartbeats.counters IS
  'License-relevant counters only, e.g. {"adminUsers": 6}. No order volumes, revenue, reseller or end-customer data.';

CREATE TABLE license_validations (
  id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_id          uuid        NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  installation_id     text        REFERENCES installations(id) ON DELETE SET NULL,
  kind                text        NOT NULL CHECK (kind IN ('activate', 'validate', 'deactivate')),
  at                  timestamptz NOT NULL DEFAULT now(),
  result              text        NOT NULL
                      CHECK (result IN ('valid', 'invalid_key', 'expired', 'suspended', 'domain_mismatch',
                                        'installation_limit', 'signature_invalid', 'rate_limited')),
  client_version      text,
  ip                  inet,
  receipt_expires_at  timestamptz
);

CREATE INDEX license_validations_license_idx ON license_validations (license_id, at DESC);

COMMENT ON TABLE license_validations IS
  'Log of activation / validation / deactivation requests (abuse detection, support). Kept 90 days.';
