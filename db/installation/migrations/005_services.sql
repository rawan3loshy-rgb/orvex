-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  005_services.sql
-- -----------------------------------------------------------------------------
--  Schema version : 005
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : The customer's own service catalog and the input fields
--                   each service accepts.
--  Categories     : the category set of the initial target market, GSM
--                   services (IMEI Services, Unlocking, Server Services, Codes,
--                   Other Services). Changing the set is a regular migration;
--                   nothing else in the schema is specific to GSM.
-- =============================================================================

CREATE SEQUENCE service_code_seq START WITH 1001;

CREATE TABLE services (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text          NOT NULL UNIQUE DEFAULT ('SVC-' || nextval('service_code_seq'))
                                  CHECK (code ~ '^SVC-[0-9]{4,9}$'),
  slug              text          NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,95}$'),
  name              text          NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  category          text          NOT NULL
                                  CHECK (category IN ('IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services')),
  delivery          text          NOT NULL DEFAULT 'instant' CHECK (delivery IN ('instant', 'async', 'manual')),
  status            text          NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft', 'deprecated')),
  description       text          NOT NULL DEFAULT '',
  price             numeric(12,4) NOT NULL CHECK (price >= 0),
  turnaround_min_s  integer       NOT NULL DEFAULT 1 CHECK (turnaround_min_s >= 0),
  turnaround_max_s  integer       NOT NULL DEFAULT 5,
  routing_strategy  text          NOT NULL DEFAULT 'priority'
                                  CHECK (routing_strategy IN ('priority', 'lowest_cost', 'fastest', 'health_weighted', 'round_robin')),
  visible_website   boolean       NOT NULL DEFAULT false,
  visible_api       boolean       NOT NULL DEFAULT false,
  tags              text[]        NOT NULL DEFAULT '{}',
  icon              text          NOT NULL DEFAULT 'box',
  archived_at       timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT services_turnaround_range CHECK (turnaround_max_s >= turnaround_min_s),
  CONSTRAINT services_draft_is_hidden  CHECK (status <> 'draft' OR (NOT visible_website AND NOT visible_api))
);

ALTER SEQUENCE service_code_seq OWNED BY services.code;

CREATE INDEX services_status_category_idx ON services (status, category) WHERE archived_at IS NULL;
CREATE INDEX services_tags_idx ON services USING gin (tags);

COMMENT ON TABLE services IS
  'Service catalog of this installation (what the customer sells, e.g. SVC-1001 IMEI Check — Full Report, SVC-1018 NCK Code — Alcatel / ZTE). Each service is fulfilled by one or more providers through service_mappings.';
COMMENT ON COLUMN services.code IS
  'Stable public identifier (SVC-1001). This is the service id used by the admin API, the Reseller API (service_id) and webhooks.';
COMMENT ON COLUMN services.price IS
  'Public list price in the installation base currency (settings.general.currency). Reseller prices derive from pricing groups (016).';
COMMENT ON COLUMN services.routing_strategy IS
  'Default strategy used to order the provider chain; routing rules may override it per order.';

CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- service_fields — ordered input schema of a service.
-- -----------------------------------------------------------------------------
CREATE TABLE service_fields (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   uuid        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key          text        NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  label        text        NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  type         text        NOT NULL
               CHECK (type IN ('string', 'enum', 'country', 'date', 'number', 'email', 'phone')
                      OR type ~ '^x-[a-z0-9][a-z0-9.-]{1,63}$'),
  required     boolean     NOT NULL DEFAULT true,
  sensitive    boolean     NOT NULL DEFAULT false,
  description  text,
  validation   jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(validation) = 'object'),
  position     smallint    NOT NULL CHECK (position >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_fields_key_unique      UNIQUE (service_id, key),
  CONSTRAINT service_fields_position_unique UNIQUE (service_id, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT service_fields_enum_has_options
    CHECK (type <> 'enum' OR jsonb_typeof(validation -> 'options') = 'array')
);

COMMENT ON TABLE service_fields IS
  'Input fields of a service (ServiceField). Validated on every order before routing.';
COMMENT ON COLUMN service_fields.type IS
  'Core field type, or an extension-provided type in the x- namespace (e.g. x-imei-validation.imei from the service-type.imei-validation extension: Luhn-checked 15-digit IMEI). Common GSM keys: imei, serial_number, model, network, country, phone_number, brand.';
COMMENT ON COLUMN service_fields.sensitive IS
  'Sensitive values (end-customer phone numbers, account e-mails, owner names…) are encrypted in orders.input_sensitive_* and masked everywhere else, including logs and webhooks.';
COMMENT ON COLUMN service_fields.validation IS
  '{"pattern","minLength","maxLength","options","example","message"} — all optional.';

CREATE TRIGGER service_fields_set_updated_at BEFORE UPDATE ON service_fields
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();
