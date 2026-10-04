-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  015_extensions.sql
-- -----------------------------------------------------------------------------
--  Schema version : 015
--  Introduced in  : Core 2.2.0 (migration 014 → 015,
--                   "Create table extensions", "Add providers.adapter_id")
--  Summary        : Extension registry (CORE + CONFIGURATION + EXTENSIONS =
--                   CUSTOMER INSTALLATION), extension trust store, and the
--                   link from every provider to the adapter that talks to it.
--
--  Extensions that need their own tables get a dedicated PostgreSQL schema
--  (e.g. ext_unlockdesk_dsn_adapter) and their own migration track, recorded in
--  schema_migrations with component = <extension id>. Extensions never alter
--  Core tables.
-- =============================================================================

CREATE TABLE extensions (
  id                 text        PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9.-]{2,127}$'),
  name               text        NOT NULL,
  kind               text        NOT NULL
                     CHECK (kind IN ('provider-adapter', 'service-type', 'theme', 'website-component', 'business-rule', 'module')),
  version            text        NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'),
  core_range         text        NOT NULL,
  author             text        NOT NULL,
  source             text        NOT NULL CHECK (source IN ('core', 'official', 'custom')),
  description        text        NOT NULL DEFAULT '',
  manifest           jsonb       NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  status             text        NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled', 'incompatible')),
  config             jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(config) = 'object'),
  package_sha256     char(64)    CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  package_signature  text        CHECK (package_signature ~ '^ed25519:'),
  signed_by          text,
  installed_by       uuid        REFERENCES users(id) ON DELETE SET NULL,
  installed_at       timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extensions_signed_unless_core
    CHECK (source = 'core' OR (package_sha256 IS NOT NULL AND package_signature IS NOT NULL AND signed_by IS NOT NULL)),
  CONSTRAINT extensions_manifest_matches_row
    CHECK (manifest ->> 'id' = id AND manifest ->> 'version' = version AND manifest ->> 'kind' = kind)
);

CREATE INDEX extensions_kind_idx ON extensions (kind, status);

COMMENT ON TABLE extensions IS
  'Installed extensions (InstalledExtension). Core-bundled extensions (source = core) ship inside the Core image and are refreshed at boot; official and custom extensions are signed packages installed from the admin UI or orvexctl.';
COMMENT ON COLUMN extensions.core_range IS
  'semver range of Core the extension supports (e.g. ^2.4.0, ~2.4.0). Checked at install, at boot and in update pre-flight; an extension that does not satisfy the target version is disabled during the update (status incompatible) instead of blocking it.';
COMMENT ON COLUMN extensions.manifest IS
  'Full ExtensionManifest including requested permissions (network:outbound, secrets:read, queue:write, storage:write, catalog:read, routing:extend, transactions:read, email:send). Permissions are granted at install after operator review.';
COMMENT ON COLUMN extensions.config IS
  'Non-secret configuration. Extension secrets use the same encrypted bundle mechanism as provider credentials.';

CREATE TRIGGER extensions_set_updated_at BEFORE UPDATE ON extensions
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- extension_trusted_keys — signers whose extension packages this installation
-- accepts besides ORVEX's built-in release keys (e.g. a customer's own
-- developer key for in-house extensions).
-- -----------------------------------------------------------------------------
CREATE TABLE extension_trusted_keys (
  key_id      text        PRIMARY KEY CHECK (key_id ~ '^[A-Za-z0-9_.-]{3,64}$'),
  label       text        NOT NULL,
  algorithm   text        NOT NULL DEFAULT 'Ed25519' CHECK (algorithm = 'Ed25519'),
  public_key  text        NOT NULL,
  added_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

COMMENT ON TABLE extension_trusted_keys IS
  'Customer-managed trust anchors for custom extensions. ORVEX release/extension keys are compiled into Core and not stored here.';

-- -----------------------------------------------------------------------------
-- Built-in adapters shipped with Core 2.2.0 (versions refreshed at boot).
-- -----------------------------------------------------------------------------
INSERT INTO extensions (id, name, kind, version, core_range, author, source, description, manifest, status)
VALUES
  ('adapter.rest-json', 'REST / JSON Adapter', 'provider-adapter', '3.0.0', '^2.2.0', 'ORVEX', 'core',
   'Generic adapter for JSON over HTTPS providers with OAuth2, API key or HMAC auth.',
   '{"id": "adapter.rest-json", "name": "REST / JSON Adapter", "kind": "provider-adapter", "version": "3.0.0",
     "coreRange": "^2.2.0", "author": "ORVEX", "source": "core",
     "description": "Generic adapter for JSON over HTTPS providers with OAuth2, API key or HMAC auth.",
     "permissions": ["network:outbound", "secrets:read"]}',
   'enabled'),
  ('adapter.soap-xml', 'SOAP / XML Adapter', 'provider-adapter', '2.0.0', '^2.2.0', 'ORVEX', 'core',
   'WSDL-driven adapter for legacy XML gateways.',
   '{"id": "adapter.soap-xml", "name": "SOAP / XML Adapter", "kind": "provider-adapter", "version": "2.0.0",
     "coreRange": "^2.2.0", "author": "ORVEX", "source": "core",
     "description": "WSDL-driven adapter for legacy XML gateways.",
     "permissions": ["network:outbound", "secrets:read"]}',
   'enabled')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- providers.adapter_id — Core never talks to a provider directly.
-- Providers created before 2.2.0 could only use the built-in REST client.
-- -----------------------------------------------------------------------------
ALTER TABLE providers ADD COLUMN adapter_id text;

UPDATE providers SET adapter_id = 'adapter.rest-json' WHERE adapter_id IS NULL;

ALTER TABLE providers
  ALTER COLUMN adapter_id SET NOT NULL,
  ADD CONSTRAINT providers_adapter_fk FOREIGN KEY (adapter_id) REFERENCES extensions(id) ON DELETE RESTRICT;

CREATE INDEX providers_adapter_idx ON providers (adapter_id);

COMMENT ON COLUMN providers.adapter_id IS
  'Extension id of the provider-adapter used for this provider (e.g. adapter.rest-json, ext.unlockdesk.dsn-adapter). An adapter in use cannot be uninstalled.';
