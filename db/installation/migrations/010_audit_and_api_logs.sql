-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  010_audit_and_api_logs.sql
-- -----------------------------------------------------------------------------
--  Schema version : 010
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : Append-only audit log; API request log partitioned by
--                   month; generic monthly-partition maintenance functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- audit_logs — who changed what, when (Activity page).
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at                timestamptz NOT NULL DEFAULT now(),
  actor_type        text        NOT NULL CHECK (actor_type IN ('user', 'system', 'api')),
  actor_user_id     uuid,
  actor_api_key_id  uuid,
  actor_label       text        NOT NULL,
  action            text        NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  summary           text        NOT NULL,
  entity_type       text        NOT NULL
                    CHECK (entity_type IN ('service', 'provider', 'mapping', 'routing_rule', 'reseller', 'api_key',
                                           'webhook', 'pricing_group', 'order', 'user', 'website', 'system', 'license')),
  entity_id         text        NOT NULL,
  entity_label      text        NOT NULL DEFAULT '',
  severity          text        NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
  ip                inet,
  user_agent        text,
  request_id        text,
  changes           jsonb       CHECK (changes IS NULL OR jsonb_typeof(changes) = 'array')
);

CREATE INDEX audit_logs_at_idx       ON audit_logs (at DESC);
CREATE INDEX audit_logs_entity_idx   ON audit_logs (entity_type, entity_id, at DESC);
CREATE INDEX audit_logs_actor_idx    ON audit_logs (actor_user_id, at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX audit_logs_severe_idx   ON audit_logs (at DESC) WHERE severity IN ('warning', 'critical');

CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION orvex_forbid_mutation();

COMMENT ON TABLE audit_logs IS
  'Append-only audit trail (AuditEntry). Written in the same transaction as the change it describes. Retention: settings.security.auditRetentionDays (purged by the retention job). Can be streamed to an external SIEM for tamper evidence.';
COMMENT ON COLUMN audit_logs.actor_user_id IS
  'No foreign key on purpose: audit rows must never be rewritten (an ON DELETE SET NULL would be an UPDATE) and must outlive the referenced user.';
COMMENT ON COLUMN audit_logs.action IS
  'Dotted verb, e.g. service.price_changed, provider.credentials_rotated, license.validated, system.updated.';
COMMENT ON COLUMN audit_logs.changes IS
  '[{"field","from","to"}] with secrets always redacted.';

-- -----------------------------------------------------------------------------
-- api_request_logs — every Reseller API request, partitioned by month.
-- -----------------------------------------------------------------------------
CREATE TABLE api_request_logs (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  at               timestamptz NOT NULL DEFAULT now(),
  request_id       text        NOT NULL,
  method           text        NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  path             text        NOT NULL,
  endpoint         text        NOT NULL,
  status           smallint    NOT NULL CHECK (status BETWEEN 100 AND 599),
  latency_ms       integer     NOT NULL CHECK (latency_ms >= 0),
  reseller_id      uuid,
  api_key_id       uuid,
  api_key_prefix   text,
  client_label     text        NOT NULL DEFAULT 'Internal',
  ip               inet,
  user_agent       text,
  request_headers  jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(request_headers) = 'object'),
  request_body     text        CHECK (octet_length(request_body) <= 65536),
  response_body    text        CHECK (octet_length(response_body) <= 65536),
  timeline         jsonb       NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(timeline) = 'array'),
  PRIMARY KEY (id, at)
) PARTITION BY RANGE (at);

CREATE INDEX api_request_logs_at_idx         ON api_request_logs (at DESC);
CREATE INDEX api_request_logs_reseller_idx   ON api_request_logs (reseller_id, at DESC);
CREATE INDEX api_request_logs_key_idx        ON api_request_logs (api_key_id, at DESC);
CREATE INDEX api_request_logs_request_id_idx ON api_request_logs (request_id);
CREATE INDEX api_request_logs_errors_idx     ON api_request_logs (at DESC) WHERE status >= 400;

COMMENT ON TABLE api_request_logs IS
  'Reseller API request log (ApiLogEntry), RANGE-partitioned by month on at. Old months are dropped as whole partitions (instant, no vacuum debt). No foreign keys: logs are hot-path writes and outlive keys/resellers.';
COMMENT ON COLUMN api_request_logs.endpoint IS
  'Route template, e.g. ''POST /api/v1/orders''.';
COMMENT ON COLUMN api_request_logs.request_headers IS
  'Redacted headers: Authorization is reduced to the key prefix, cookies are dropped.';
COMMENT ON COLUMN api_request_logs.request_body IS
  'Body truncated to 64 KiB with sensitive service fields masked.';

-- Safety net for rows outside every monthly partition (should stay empty).
CREATE TABLE api_request_logs_default PARTITION OF api_request_logs DEFAULT;

-- -----------------------------------------------------------------------------
-- Partition maintenance. Core tables partitioned by month use the column "at".
-- Called by the scheduler (job maintenance.partitions) daily.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION orvex_ensure_monthly_partitions(
  parent        regclass,
  months_back   integer DEFAULT 0,
  months_ahead  integer DEFAULT 3
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  parent_schema  text;
  parent_name    text;
  default_part   text;
  month_start    date;
  part_name      text;
  lower_bound    timestamptz;
  upper_bound    timestamptz;
  created        integer := 0;
BEGIN
  SELECT n.nspname, c.relname INTO parent_schema, parent_name
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = parent;

  SELECT format('%I.%I', n.nspname, c.relname) INTO default_part
  FROM pg_inherits i
  JOIN pg_class c ON c.oid = i.inhrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE i.inhparent = parent AND pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT';

  FOR i IN -months_back .. months_ahead LOOP
    month_start := (date_trunc('month', now() AT TIME ZONE 'UTC') + make_interval(months => i))::date;
    part_name   := format('%s_y%sm%s', parent_name, to_char(month_start, 'YYYY'), to_char(month_start, 'MM'));
    lower_bound := month_start::timestamp AT TIME ZONE 'UTC';
    upper_bound := (month_start + interval '1 month')::timestamp AT TIME ZONE 'UTC';

    IF to_regclass(format('%I.%I', parent_schema, part_name)) IS NULL THEN
      -- Build the partition detached, move any stray rows out of the default
      -- partition, then attach — so a late run never fails on default rows.
      EXECUTE format('CREATE TABLE %I.%I (LIKE %I.%I INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
                     parent_schema, part_name, parent_schema, parent_name);
      IF default_part IS NOT NULL THEN
        EXECUTE format('WITH moved AS (DELETE FROM %s WHERE at >= %L AND at < %L RETURNING *) '
                       'INSERT INTO %I.%I SELECT * FROM moved',
                       default_part, lower_bound, upper_bound, parent_schema, part_name);
      END IF;
      EXECUTE format('ALTER TABLE %I.%I ATTACH PARTITION %I.%I FOR VALUES FROM (%L) TO (%L)',
                     parent_schema, parent_name, parent_schema, part_name, lower_bound, upper_bound);
      created := created + 1;
    END IF;
  END LOOP;

  RETURN created;
END
$$;

COMMENT ON FUNCTION orvex_ensure_monthly_partitions(regclass, integer, integer) IS
  'Creates missing monthly partitions <parent>_yYYYYmMM (UTC months) from months_back to months_ahead. Idempotent.';

CREATE OR REPLACE FUNCTION orvex_drop_monthly_partitions_before(
  parent  regclass,
  cutoff  timestamptz
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  r        record;
  y        text;
  m        text;
  dropped  integer := 0;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS part_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE i.inhparent = parent
  LOOP
    y := substring(r.part_name FROM '_y([0-9]{4})m[0-9]{2}$');
    m := substring(r.part_name FROM '_y[0-9]{4}m([0-9]{2})$');
    CONTINUE WHEN y IS NULL OR m IS NULL;
    IF ((make_date(y::integer, m::integer, 1) + interval '1 month')::timestamp AT TIME ZONE 'UTC') <= cutoff THEN
      EXECUTE format('DROP TABLE %I.%I', r.schema_name, r.part_name);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  RETURN dropped;
END
$$;

COMMENT ON FUNCTION orvex_drop_monthly_partitions_before(regclass, timestamptz) IS
  'Drops monthly partitions whose whole month ends on or before cutoff (retention). Never touches the default partition.';

SELECT orvex_ensure_monthly_partitions('api_request_logs', 1, 3);
