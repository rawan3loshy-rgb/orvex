-- =============================================================================
--  ORVEX Systems · VENDOR PLATFORM database
--  003_catalog.sql
-- -----------------------------------------------------------------------------
--  Product catalog: licensable modules, plans and add-ons. This is vendor
--  reference data (public pricing), so it is seeded here.
-- =============================================================================

CREATE TABLE modules (
  id           text PRIMARY KEY CHECK (id ~ '^[a-z][a-z_]{1,47}$'),
  name         text NOT NULL,
  description  text NOT NULL DEFAULT ''
);

COMMENT ON TABLE modules IS
  'Licensable capabilities. Module ids appear in the signed license document and are enforced locally by Core.';

INSERT INTO modules (id, name) VALUES
  ('core',               'Core orchestration'),
  ('reseller_api',       'Reseller API'),
  ('routing_advanced',   'Advanced routing'),
  ('website',            'Website builder'),
  ('webhooks',           'Webhooks & monitoring'),
  ('custom_extensions',  'Custom extensions'),
  ('multi_installation', 'Multi-installation (HA)'),
  ('white_label',        'White-label admin');

CREATE TABLE plans (
  id                            text          PRIMARY KEY CHECK (id IN ('starter', 'professional', 'enterprise')),
  name                          text          NOT NULL,
  tagline                       text          NOT NULL,
  price_monthly                 numeric(12,2) CHECK (price_monthly >= 0),
  billing_note                  text          NOT NULL,
  installations_label           text          NOT NULL,
  max_production_installations  integer       CHECK (max_production_installations >= 1),
  max_staging_installations     integer       CHECK (max_staging_installations >= 0),
  max_admin_users               integer       CHECK (max_admin_users >= 1),
  features                      jsonb         NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(features) = 'array'),
  highlighted                   boolean       NOT NULL DEFAULT false,
  active                        boolean       NOT NULL DEFAULT true,
  sort_order                    smallint      NOT NULL DEFAULT 0
);

COMMENT ON TABLE plans IS
  'Plan. price_monthly NULL = quoted (Enterprise). Limit columns NULL = unlimited / contract-defined.';

CREATE TABLE plan_modules (
  plan_id    text NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module_id  text NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
  PRIMARY KEY (plan_id, module_id)
);

INSERT INTO plans (id, name, tagline, price_monthly, billing_note, installations_label,
                   max_production_installations, max_staging_installations, max_admin_users, features, highlighted, sort_order)
VALUES
  ('starter', 'Starter', 'For new service platforms getting their first supplier APIs online.',
   149, 'per month, billed quarterly', '1 production installation', 1, 0, 5,
   '["Up to 3 provider connections", "Up to 25 services", "Reseller API (5 resellers)", "Website builder", "Stable update channel", "Email support"]',
   false, 1),
  ('professional', 'Professional', 'For established operators running multiple suppliers, resellers and routing rules.',
   449, 'per month, billed quarterly', '1 production + 1 staging', 1, 1, 25,
   '["Unlimited providers & services", "Unlimited resellers", "Advanced routing engine", "Webhooks & delivery monitoring", "Custom extensions", "Stable + beta channels", "Business-hours support (8h SLA)"]',
   true, 2),
  ('enterprise', 'Enterprise', 'For platforms that need multiple regions, custom supplier adapters and guarantees.',
   NULL, 'annual agreement', 'Multiple installations & HA', NULL, NULL, NULL,
   '["Everything in Professional", "Multi-installation & high availability", "Custom provider adapters", "Vendor-assisted deployment", "White-label admin", "24/7 support · 1h critical SLA", "Source code escrow"]',
   false, 3);

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.plan_id, m.module_id
FROM (VALUES
  ('starter',      ARRAY['core', 'reseller_api', 'website']),
  ('professional', ARRAY['core', 'reseller_api', 'routing_advanced', 'website', 'webhooks', 'custom_extensions']),
  ('enterprise',   ARRAY['core', 'reseller_api', 'routing_advanced', 'website', 'webhooks', 'custom_extensions',
                         'multi_installation', 'white_label'])
) AS p(plan_id, modules)
CROSS JOIN LATERAL unnest(p.modules) AS m(module_id);

CREATE TABLE add_ons (
  id           text          PRIMARY KEY CHECK (id ~ '^addon_[a-z_]+$'),
  name         text          NOT NULL,
  description  text          NOT NULL DEFAULT '',
  price        numeric(12,2) NOT NULL CHECK (price >= 0),
  billing      text          NOT NULL DEFAULT 'per_month' CHECK (billing IN ('per_month', 'one_time')),
  active       boolean       NOT NULL DEFAULT true
);

INSERT INTO add_ons (id, name, description, price) VALUES
  ('addon_priority', 'Priority support', '4h response SLA and a named support engineer.', 99);
