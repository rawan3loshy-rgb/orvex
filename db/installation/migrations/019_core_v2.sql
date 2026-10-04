-- ============================================================================
-- 019_core_v2.sql — ORVEX Core aligned domain model (2026-10 architecture alignment)
--
-- Expand-only migration. Introduces the unified Account model, service
-- revisions, supplier products + offers, tier pricing rules, the double-entry
-- ledger, payments, after-care and account-scoped idempotency. Legacy tables
-- (resellers, service_mappings, routing_rules, transactions) remain readable for
-- one release and are dropped by a later "contract" migration.
--
-- Money: BIGINT micro-units (1 USD = 1 000 000). Never NUMERIC floats in code.
-- Enum values are identical to the TypeScript unions in src/core/domain/*.
-- ============================================================================

-- ---------------------------------------------------------------- accounts
CREATE TABLE accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number             text NOT NULL UNIQUE,                       -- AC-10482
  name               text NOT NULL,
  kind               text NOT NULL CHECK (kind IN ('customer','guest')),
  tier               text NOT NULL CHECK (tier IN ('retail','reseller','business','api_only')),
  status             text NOT NULL CHECK (status IN ('active','frozen','pending','closed')),
  status_reason      text,
  pricing_tier_id    uuid NOT NULL,
  credit_limit       bigint NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  email              citext NOT NULL,
  contact_name       text NOT NULL DEFAULT '',
  country            char(2),
  service_access     jsonb NOT NULL DEFAULT '{"mode":"all"}',
  channels           jsonb NOT NULL,                             -- {storefront, portal, api, dhru}
  limits             jsonb NOT NULL,                             -- {ordersPerMinute, dailyOrders, maxConcurrent, maxOrderValue}
  low_balance_alert  bigint,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_active_at     timestamptz
);
CREATE UNIQUE INDEX accounts_customer_email ON accounts (email) WHERE kind = 'customer';

CREATE TABLE account_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts (id),
  name        text NOT NULL,
  email       citext NOT NULL,
  role        text NOT NULL CHECK (role IN ('owner','admin','orderer','finance','developer','viewer')),
  mfa         boolean NOT NULL DEFAULT false,
  status      text NOT NULL CHECK (status IN ('active','invited','disabled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, email)
);

-- ---------------------------------------------------------------- catalog
CREATE TABLE service_revisions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id     uuid NOT NULL REFERENCES services (id),
  number         int NOT NULL,
  fields         jsonb NOT NULL,          -- FieldDef[] (types from vertical packs, e.g. "gsm.imei")
  result_schema  jsonb NOT NULL,          -- ResultFieldDef[]
  note           text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  UNIQUE (service_id, number)
);
ALTER TABLE services ADD COLUMN current_revision_id uuid REFERENCES service_revisions (id);
ALTER TABLE services ADD COLUMN visibility jsonb NOT NULL DEFAULT '{"storefront":true,"portal":true,"api":true}';
ALTER TABLE services ADD COLUMN when_unavailable text NOT NULL DEFAULT 'show_unavailable' CHECK (when_unavailable IN ('show_unavailable','hide'));

CREATE TABLE supplier_products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid NOT NULL REFERENCES providers (id),
  external_id      text NOT NULL,
  name             text NOT NULL,
  group_name       text NOT NULL DEFAULT '',
  cost             bigint NOT NULL CHECK (cost >= 0),      -- single source of truth for supplier cost
  previous_cost    bigint,
  status           text NOT NULL CHECK (status IN ('available','removed')),
  remote_fields    text[] NOT NULL DEFAULT '{}',
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  cost_changed_at  timestamptz,
  UNIQUE (supplier_id, external_id)
);

CREATE TABLE offers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id           uuid NOT NULL REFERENCES services (id),
  supplier_product_id  uuid NOT NULL REFERENCES supplier_products (id),
  priority             int NOT NULL CHECK (priority >= 1),
  enabled              boolean NOT NULL DEFAULT true,
  disabled_reason      text,
  field_mapping        jsonb NOT NULL DEFAULT '{}',
  max_cost             bigint,
  config               jsonb NOT NULL DEFAULT '{}',
  UNIQUE (service_id, supplier_product_id),
  UNIQUE (service_id, priority) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE catalog_sync_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid NOT NULL REFERENCES providers (id),
  trigger          text NOT NULL CHECK (trigger IN ('scheduled','manual')),
  status           text NOT NULL CHECK (status IN ('review_required','applied','no_changes','failed')),
  counts           jsonb NOT NULL,
  started_at       timestamptz NOT NULL,
  finished_at      timestamptz
);
CREATE TABLE catalog_sync_changes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               uuid NOT NULL REFERENCES catalog_sync_runs (id),
  kind                 text NOT NULL CHECK (kind IN ('new','price','removed','fields','warning')),
  supplier_product_id  uuid REFERENCES supplier_products (id),
  before               jsonb,
  after                jsonb,
  impact               jsonb NOT NULL,
  decision             text NOT NULL CHECK (decision IN ('pending','applied','ignored')),
  decided_at           timestamptz,
  decided_by           text
);

-- ---------------------------------------------------------------- pricing
CREATE TABLE pricing_tiers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,                 -- Retail, Silver, Gold, Platinum
  is_default  boolean NOT NULL DEFAULT false,
  sort        int NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX pricing_tiers_one_default ON pricing_tiers (is_default) WHERE is_default;
ALTER TABLE accounts ADD CONSTRAINT accounts_pricing_tier_fk FOREIGN KEY (pricing_tier_id) REFERENCES pricing_tiers (id);

CREATE TABLE pricing_rules_v2 (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id          uuid NOT NULL REFERENCES pricing_tiers (id),
  scope_kind       text NOT NULL CHECK (scope_kind IN ('all','category','service')),
  scope_id         uuid,                               -- category or service id
  method           text NOT NULL CHECK (method IN ('fixed','cost_plus_percent','cost_plus_fixed')),
  value            bigint NOT NULL,                    -- micros, or basis points for percent
  rounding_increment bigint NOT NULL DEFAULT 10000,
  rounding_mode    text NOT NULL DEFAULT 'up' CHECK (rounding_mode IN ('up','nearest','down')),
  min_margin_bps   int,
  enabled          boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text,
  UNIQUE (tier_id, scope_kind, scope_id)
);

-- ---------------------------------------------------------------- orders (v2 columns)
ALTER TABLE orders ADD COLUMN ref text UNIQUE;                               -- ORD-7K3P9Q (random)
ALTER TABLE orders ADD COLUMN account_id uuid REFERENCES accounts (id);
ALTER TABLE orders ADD COLUMN service_revision_id uuid REFERENCES service_revisions (id);
ALTER TABLE orders ADD COLUMN price_snapshot jsonb;                          -- PriceQuote incl. steps
ALTER TABLE orders ADD COLUMN price_micros bigint;
ALTER TABLE orders ADD COLUMN supplier_cost_micros bigint;
ALTER TABLE orders ADD COLUMN status_v2 text CHECK (status_v2 IN ('awaiting_payment','queued','processing','needs_review','completed','rejected','cancelled'));
ALTER TABLE orders ADD COLUMN financial_status text CHECK (financial_status IN ('none','held','captured','released','partially_refunded','refunded'));
ALTER TABLE orders ADD COLUMN review jsonb;                                  -- reason, lookups, resolution
ALTER TABLE orders ADD COLUMN tracking_token text UNIQUE;                    -- 32 random chars (guest tracking)
ALTER TABLE orders ADD COLUMN refunded_micros bigint NOT NULL DEFAULT 0;
ALTER TABLE orders ADD CONSTRAINT orders_refund_cap CHECK (refunded_micros <= coalesce(price_micros, 0));

ALTER TABLE order_attempts ADD COLUMN offer_id uuid REFERENCES offers (id);
ALTER TABLE order_attempts ADD COLUMN cost_micros bigint;
ALTER TABLE order_attempts ADD COLUMN state text CHECK (state IN ('sending','accepted','succeeded','rejected','not_accepted','unknown','confirmed_not_received'));
ALTER TABLE order_attempts ADD COLUMN classification jsonb;                  -- kind, code, failoverSafe, mappingId

-- Idempotency is scoped to the ACCOUNT (not the API key or channel).
CREATE TABLE idempotency_keys_v2 (
  account_id    uuid NOT NULL REFERENCES accounts (id),
  key           text NOT NULL,
  request_hash  text NOT NULL,
  order_id      uuid REFERENCES orders (id),
  channel       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  PRIMARY KEY (account_id, key)
);

-- ---------------------------------------------------------------- ledger
CREATE TABLE ledger_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                text NOT NULL UNIQUE,
  at                 timestamptz NOT NULL DEFAULT now(),
  kind               text NOT NULL CHECK (kind IN ('top_up','order_hold','order_release','order_settlement','refund','chargeback','adjustment','supplier_top_up','gateway_payout','supplier_credit')),
  description        text NOT NULL,
  order_id           uuid REFERENCES orders (id),
  account_id         uuid REFERENCES accounts (id),
  supplier_id        uuid REFERENCES providers (id),
  payment_intent_id  uuid,
  refund_id          uuid,
  idempotency_key    text NOT NULL UNIQUE,
  actor              jsonb NOT NULL,
  reason             text
);
CREATE TABLE ledger_entries (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tx_id       uuid NOT NULL REFERENCES ledger_transactions (id),
  account     text NOT NULL,                 -- customer_available:<uuid>, supplier_prepaid:<uuid>, revenue, …
  direction   text NOT NULL CHECK (direction IN ('debit','credit')),
  amount      bigint NOT NULL CHECK (amount > 0)
);
CREATE INDEX ledger_entries_account ON ledger_entries (account);
-- Balance enforced at commit: Σ debits = Σ credits per transaction (constraint trigger, deferred).
-- Both tables are append-only (trigger rejects UPDATE/DELETE). Balances are views / rollups.

-- ---------------------------------------------------------------- payments & after-care
CREATE TABLE payment_intents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text NOT NULL UNIQUE,
  account_id       uuid NOT NULL REFERENCES accounts (id),
  order_id         uuid REFERENCES orders (id),
  purpose          text NOT NULL CHECK (purpose IN ('order','top_up')),
  amount           bigint NOT NULL CHECK (amount > 0),
  method           text NOT NULL CHECK (method IN ('card','paypal','bank_transfer','manual')),
  status           text NOT NULL CHECK (status IN ('requires_payment','pending','succeeded','failed','cancelled')),
  gateway_ref      text,
  failure_reason   text,
  refunded         bigint NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gateway_events (
  id                 text PRIMARY KEY,                 -- gateway event id → de-duplication
  gateway            text NOT NULL,
  type               text NOT NULL,
  payment_intent_id  uuid REFERENCES payment_intents (id),
  signature_valid    boolean NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  payload            jsonb NOT NULL
);
CREATE TABLE refunds (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                text NOT NULL UNIQUE,
  order_id           uuid REFERENCES orders (id),
  payment_intent_id  uuid REFERENCES payment_intents (id),
  account_id         uuid NOT NULL REFERENCES accounts (id),
  amount             bigint NOT NULL CHECK (amount > 0),
  destination        text NOT NULL CHECK (destination IN ('wallet','original_method')),
  reason             text NOT NULL,
  idempotency_key    text NOT NULL UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  actor              jsonb NOT NULL
);
CREATE TABLE chargebacks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id  uuid NOT NULL REFERENCES payment_intents (id) UNIQUE,
  amount             bigint NOT NULL,
  fee                bigint NOT NULL,
  status             text NOT NULL CHECK (status IN ('open','won','lost')),
  opened_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz
);
CREATE TABLE verification_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref             text NOT NULL UNIQUE,
  order_id        uuid NOT NULL REFERENCES orders (id),
  account_id      uuid NOT NULL REFERENCES accounts (id),
  reason          text NOT NULL CHECK (reason IN ('code_not_working','wrong_result','result_missing','other')),
  message         text NOT NULL,
  status          text NOT NULL CHECK (status IN ('open','awaiting_supplier','approved','rejected')),
  supplier_ticket text,
  resolution      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  channel     text NOT NULL CHECK (channel IN ('email','telegram','whatsapp')),
  audience    text NOT NULL CHECK (audience IN ('customer','operator')),
  template    text NOT NULL,
  recipient   text NOT NULL,
  subject     text NOT NULL,
  status      text NOT NULL CHECK (status IN ('sent','failed','suppressed')),
  order_id    uuid REFERENCES orders (id)
);

-- Outbound webhooks: Standard Webhooks message id, stable across retries.
ALTER TABLE webhook_deliveries ADD COLUMN message_id text;
CREATE UNIQUE INDEX webhook_deliveries_message ON webhook_deliveries (endpoint_id, message_id);
ALTER TABLE webhooks ADD COLUMN account_id uuid REFERENCES accounts (id);   -- NULL = operator endpoint
ALTER TABLE api_keys ADD COLUMN account_id uuid REFERENCES accounts (id);
ALTER TABLE api_keys ADD COLUMN dhru_compat boolean NOT NULL DEFAULT false;
