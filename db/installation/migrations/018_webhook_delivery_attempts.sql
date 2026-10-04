-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  018_webhook_delivery_attempts.sql
-- -----------------------------------------------------------------------------
--  Schema version : 018   ← applied by Core 2.4.0 (016 → 019 in one update; 2.5.0 adds 020–022)
--  Introduced in  : Core 2.4.0 (migration 017 → 018, historical pre-v2 schema)
--  Release steps  : 1. Create table webhook_delivery_attempts
--                   2. Add column routing_rules.weight
--                   3. Backfill webhook delivery statistics
--                   4. Create index orders (created_at DESC, status)
--  Transaction    : yes. Runs during the update's maintenance window (order
--                   intake paused, workers stopped), so the plain CREATE INDEX
--                   below may briefly lock orders. Typical duration: ~1 s per
--                   million orders on current hardware.
--  Compatibility  : additive only (expand phase). Applied together with 017 and
--                   019 by the 2.4.0 update.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. webhook_delivery_attempts — one row per HTTP attempt of a delivery
--    (delivery timeline, retries and one-click replay in the admin UI).
-- -----------------------------------------------------------------------------
CREATE TABLE webhook_delivery_attempts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id       uuid        NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
  attempt_no        smallint    NOT NULL CHECK (attempt_no >= 1),
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  outcome           text        NOT NULL
                    CHECK (outcome IN ('success', 'http_error', 'timeout', 'connection_error', 'tls_error', 'in_flight')),
  response_code     smallint    CHECK (response_code BETWEEN 100 AND 599),
  response_headers  jsonb       CHECK (response_headers IS NULL OR jsonb_typeof(response_headers) = 'object'),
  response_body     text        CHECK (octet_length(response_body) <= 4096),
  latency_ms        integer     NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  signature_header  text,
  error             text,
  CONSTRAINT webhook_delivery_attempts_sequence_unique UNIQUE (delivery_id, attempt_no),
  CONSTRAINT webhook_delivery_attempts_open_consistent CHECK ((outcome = 'in_flight') = (finished_at IS NULL))
);

CREATE INDEX webhook_delivery_attempts_started_idx ON webhook_delivery_attempts (started_at DESC);

COMMENT ON TABLE webhook_delivery_attempts IS
  'Per-attempt record of a webhook delivery. webhook_deliveries keeps the current state; this table keeps the history.';
COMMENT ON COLUMN webhook_delivery_attempts.signature_header IS
  'Value of the ORVEX-Signature header that was sent (timestamp + MAC). Never the secret.';

-- -----------------------------------------------------------------------------
-- 2. routing_rules.weight — HISTORICAL. Belonged to the pre-v2 routing_rules
--    table. Core v2 (019_core_v2) routes by offer priority with guarded
--    failover only; this column is unused and dropped in the contract phase.
-- -----------------------------------------------------------------------------
ALTER TABLE routing_rules
  ADD COLUMN weight smallint NOT NULL DEFAULT 100 CHECK (weight BETWEEN 0 AND 1000);

COMMENT ON COLUMN routing_rules.weight IS
  'Historical (pre-v2). Unused since 019_core_v2 — V1 routing is priority order + guarded failover.';

-- -----------------------------------------------------------------------------
-- 3. Backfill webhook delivery statistics.
--    a) Represent the latest known attempt of every existing delivery.
-- -----------------------------------------------------------------------------
INSERT INTO webhook_delivery_attempts
  (delivery_id, attempt_no, started_at, finished_at, outcome, response_code, response_body, latency_ms)
SELECT d.id,
       d.attempt,
       COALESCE(d.last_attempt_at, d.created_at),
       COALESCE(d.last_attempt_at, d.created_at) + d.latency_ms * interval '1 millisecond',
       CASE
         WHEN d.status = 'delivered'     THEN 'success'
         WHEN d.response_code IS NULL    THEN 'timeout'
         ELSE 'http_error'
       END,
       d.response_code,
       d.response_body,
       d.latency_ms
FROM webhook_deliveries d
WHERE d.attempt >= 1;

--    b) Endpoint-level statistics used by failure detection and the UI.
ALTER TABLE webhooks
  ADD COLUMN last_delivery_at     timestamptz,
  ADD COLUMN consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0);

COMMENT ON COLUMN webhooks.last_delivery_at IS
  'Time of the most recent delivery attempt to this endpoint.';
COMMENT ON COLUMN webhooks.consecutive_failures IS
  'Failed or retrying deliveries since the last successful one; drives status = failing.';

UPDATE webhooks w
   SET last_delivery_at = s.last_at
  FROM (SELECT endpoint_id, max(COALESCE(last_attempt_at, created_at)) AS last_at
          FROM webhook_deliveries
         GROUP BY endpoint_id) s
 WHERE s.endpoint_id = w.id;

UPDATE webhooks w
   SET consecutive_failures = s.failures
  FROM (SELECT d.endpoint_id, count(*) AS failures
          FROM webhook_deliveries d
          LEFT JOIN (SELECT endpoint_id, max(created_at) AS last_ok
                       FROM webhook_deliveries
                      WHERE status = 'delivered'
                      GROUP BY endpoint_id) ok ON ok.endpoint_id = d.endpoint_id
         WHERE d.status IN ('failed', 'retrying')
           AND d.created_at > COALESCE(ok.last_ok, '-infinity'::timestamptz)
         GROUP BY d.endpoint_id) s
 WHERE s.endpoint_id = w.id;

-- -----------------------------------------------------------------------------
-- 4. Order analytics index (dashboard volume, reports, orders list default
--    sort). Supersedes the single-column index from 013.
-- -----------------------------------------------------------------------------
CREATE INDEX orders_created_at_status_idx ON orders (created_at DESC, status);
DROP INDEX IF EXISTS orders_created_at_idx;
