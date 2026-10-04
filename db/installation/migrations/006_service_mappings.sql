-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  006_service_mappings.sql
-- -----------------------------------------------------------------------------
--  Schema version : 006
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : Mapping of internal services to provider services, and the
--                   cached remote catalog fetched through adapters.
-- =============================================================================

CREATE TABLE service_mappings (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      uuid          NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  provider_id     uuid          NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  external_id     text          NOT NULL CHECK (length(external_id) BETWEEN 1 AND 200),
  external_name   text          NOT NULL DEFAULT '',
  cost            numeric(12,4) NOT NULL CHECK (cost >= 0),
  priority        smallint      NOT NULL CHECK (priority >= 1),
  enabled         boolean       NOT NULL DEFAULT true,
  timeout_ms      integer       NOT NULL DEFAULT 30000 CHECK (timeout_ms BETWEEN 1000 AND 300000),
  weight          smallint      NOT NULL DEFAULT 10 CHECK (weight BETWEEN 0 AND 100),
  field_map       jsonb         NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(field_map) = 'object'),
  last_synced_at  timestamptz,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT service_mappings_pair_unique     UNIQUE (service_id, provider_id),
  CONSTRAINT service_mappings_priority_unique UNIQUE (service_id, priority) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX service_mappings_provider_idx ON service_mappings (provider_id);

COMMENT ON TABLE service_mappings IS
  'Which provider services fulfil an internal service, at what cost and in which order. A service with several enabled mappings has automatic fallback.';
COMMENT ON COLUMN service_mappings.priority IS
  '1 = primary. Unique per service; the constraint is deferred so a reorder (PUT /services/:id/mappings/order) can swap priorities in one transaction.';
COMMENT ON COLUMN service_mappings.weight IS
  'Traffic share in percent used by weighted strategies.';
COMMENT ON COLUMN service_mappings.field_map IS
  'Internal field key → provider field name, e.g. {"imei": "IMEI", "network": "NETWORK"} for a DHRU-compatible XML gateway.';

CREATE TRIGGER service_mappings_set_updated_at BEFORE UPDATE ON service_mappings
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- provider_remote_services — result of ProviderAdapter.listRemoteServices().
-- -----------------------------------------------------------------------------
CREATE TABLE provider_remote_services (
  provider_id  uuid          NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  external_id  text          NOT NULL,
  name         text          NOT NULL,
  cost         numeric(12,4) CHECK (cost >= 0),
  currency     char(3)       CHECK (currency ~ '^[A-Z]{3}$'),
  fields       text[]        NOT NULL DEFAULT '{}',
  raw          jsonb,
  synced_at    timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, external_id)
);

COMMENT ON TABLE provider_remote_services IS
  'Provider catalog cache refreshed by POST /providers/:id/sync. Used by the mapping UI to pick external services and by cost-drift alerts.';
