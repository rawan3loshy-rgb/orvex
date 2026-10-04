-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  014_webhooks.sql
-- -----------------------------------------------------------------------------
--  Schema version : 014
--  Introduced in  : Core 2.1.0 (migration 013 → 014, "Create table webhook_deliveries")
--  Summary        : Outbound webhook endpoints (HMAC-SHA256 signed) and their
--                   deliveries with exponential retry.
-- =============================================================================

CREATE TABLE webhooks (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url                text        NOT NULL CHECK (url ~ '^https://[^\s]+$' AND length(url) <= 2048),
  description        text        NOT NULL DEFAULT '',
  events             text[]      NOT NULL
                     CHECK (cardinality(events) > 0
                            AND events <@ ARRAY['order.created', 'order.processing', 'order.completed', 'order.failed',
                                                'order.refunded', 'balance.low', 'service.updated']::text[]),
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'failing')),
  reseller_id        uuid        REFERENCES resellers(id) ON DELETE CASCADE,
  secret_ciphertext  bytea       NOT NULL CHECK (octet_length(secret_ciphertext) > 16),
  secret_nonce       bytea       NOT NULL CHECK (octet_length(secret_nonce) = 12),
  secret_key_id      text        NOT NULL,
  secret_hint        text        NOT NULL,
  created_by         uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webhooks_reseller_idx ON webhooks (reseller_id) WHERE reseller_id IS NOT NULL;

COMMENT ON TABLE webhooks IS
  'Webhook endpoints (WebhookEndpoint). reseller_id NULL = installation-internal endpoint (ops event bus, alerting); otherwise the endpoint receives only that reseller''s events.';
COMMENT ON COLUMN webhooks.secret_ciphertext IS
  'Signing secret (whsec_…), AES-256-GCM encrypted: it must be recoverable to compute HMAC signatures, so it is encrypted rather than hashed. Shown once at creation.';
COMMENT ON COLUMN webhooks.secret_hint IS
  'Masked form for the UI, e.g. whsec_••••••••••••a91e.';
COMMENT ON COLUMN webhooks.status IS
  'failing is set automatically after repeated failed deliveries; disabled by an operator.';

CREATE TRIGGER webhooks_set_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

CREATE TABLE webhook_deliveries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id      uuid        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id         text        NOT NULL CHECK (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  event            text        NOT NULL
                   CHECK (event IN ('order.created', 'order.processing', 'order.completed', 'order.failed',
                                    'order.refunded', 'balance.low', 'service.updated')),
  order_id         uuid        REFERENCES orders(id) ON DELETE SET NULL,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('delivered', 'failed', 'retrying', 'pending')),
  payload          jsonb       NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  attempt          smallint    NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts     smallint    NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20),
  response_code    smallint    CHECK (response_code BETWEEN 100 AND 599),
  response_body    text        CHECK (octet_length(response_body) <= 4096),
  latency_ms       integer     NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  next_retry_at    timestamptz,
  replay_of        uuid        REFERENCES webhook_deliveries(id) ON DELETE SET NULL,
  is_test          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_attempt_at  timestamptz,
  delivered_at     timestamptz,
  CONSTRAINT webhook_deliveries_attempt_bound    CHECK (attempt <= max_attempts),
  CONSTRAINT webhook_deliveries_retry_scheduled  CHECK ((status = 'retrying') = (next_retry_at IS NOT NULL)),
  CONSTRAINT webhook_deliveries_delivered_at     CHECK ((status = 'delivered') = (delivered_at IS NOT NULL))
);

CREATE INDEX webhook_deliveries_endpoint_idx ON webhook_deliveries (endpoint_id, created_at DESC);
CREATE INDEX webhook_deliveries_order_idx    ON webhook_deliveries (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX webhook_deliveries_retry_idx    ON webhook_deliveries (next_retry_at) WHERE status = 'retrying';
CREATE INDEX webhook_deliveries_status_idx   ON webhook_deliveries (status, created_at DESC);

COMMENT ON TABLE webhook_deliveries IS
  'One row per (endpoint, event) (WebhookDelivery). Dispatched by webhook.deliver jobs; retries back off exponentially from 30 s to 6 h, up to settings.webhooks.maxAttempts (8). A replay creates a new row pointing at the original.';
COMMENT ON COLUMN webhook_deliveries.event_id IS
  'Stable event id (evt_…) sent in the payload and the ORVEX-Event-Id header; receivers use it to de-duplicate.';
COMMENT ON COLUMN webhook_deliveries.payload IS
  '{"id","type","created_at","data":{…}}. Sensitive service fields are never included.';
