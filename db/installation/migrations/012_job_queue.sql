-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  012_job_queue.sql
-- -----------------------------------------------------------------------------
--  Schema version : 012
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : Durable job queue on PostgreSQL (FOR UPDATE SKIP LOCKED)
--                   and the scheduler's task table. No Redis, no broker: the
--                   installation's only stateful dependency is PostgreSQL.
-- =============================================================================

CREATE TABLE jobs (
  id                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  queue             text        NOT NULL DEFAULT 'default' CHECK (queue ~ '^[a-z][a-z0-9_-]{0,31}$'),
  kind              text        NOT NULL CHECK (kind ~ '^[a-z_]+(\.[a-z_]+)+$'),
  payload           jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload) = 'object'),
  status            text        NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead')),
  priority          smallint    NOT NULL DEFAULT 0,
  run_at            timestamptz NOT NULL DEFAULT now(),
  attempts          integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts      integer     NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  dedupe_key        text,
  locked_by         text,
  locked_at         timestamptz,
  lease_expires_at  timestamptz,
  last_error        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  CONSTRAINT jobs_running_has_lease
    CHECK (status <> 'running' OR (locked_by IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CONSTRAINT jobs_finished_consistent
    CHECK ((status IN ('succeeded', 'failed', 'dead')) = (finished_at IS NOT NULL))
);

-- Dequeue path: workers run
--   WITH next AS (
--     SELECT id FROM jobs
--     WHERE status = 'queued' AND queue = $1 AND run_at <= now()
--     ORDER BY priority DESC, run_at
--     FOR UPDATE SKIP LOCKED
--     LIMIT $2
--   )
--   UPDATE jobs j
--      SET status = 'running', attempts = j.attempts + 1, locked_by = $3,
--          locked_at = now(), lease_expires_at = now() + interval '5 minutes'
--     FROM next WHERE j.id = next.id
--   RETURNING j.*;
-- Concurrent workers never block each other and never receive the same job.
CREATE INDEX jobs_dequeue_idx       ON jobs (queue, priority DESC, run_at) WHERE status = 'queued';
CREATE INDEX jobs_lease_expiry_idx  ON jobs (lease_expires_at) WHERE status = 'running';
CREATE INDEX jobs_finished_idx      ON jobs (finished_at) WHERE finished_at IS NOT NULL;
CREATE UNIQUE INDEX jobs_dedupe_key ON jobs (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running');

COMMENT ON TABLE jobs IS
  'Background work: order.process, order.poll_status, webhook.deliver, provider.health_check, provider.sync_catalog, backup.run, license.validate, maintenance.partitions, maintenance.retention, stats.rollup. Retries use exponential backoff by moving run_at; exhausted jobs become dead and surface on the Health page.';
COMMENT ON COLUMN jobs.lease_expires_at IS
  'Crash safety: a running job whose lease expired (worker died) is re-queued by the scheduler. Handlers are idempotent.';
COMMENT ON COLUMN jobs.dedupe_key IS
  'Prevents duplicate pending work, e.g. ''order.poll_status:<order id>''.';

-- Wake idle workers immediately. Workers also poll (QUEUE_POLL_INTERVAL_MS),
-- because LISTEN is unavailable behind transaction-pooling proxies (PgBouncer
-- in transaction mode, Supabase/Neon pooled endpoints).
CREATE OR REPLACE FUNCTION orvex_notify_job() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('orvex_jobs', NEW.queue);
  RETURN NULL;
END
$$;

CREATE TRIGGER jobs_notify AFTER INSERT ON jobs
  FOR EACH ROW WHEN (NEW.status = 'queued') EXECUTE FUNCTION orvex_notify_job();

-- -----------------------------------------------------------------------------
-- scheduled_tasks — cron-like schedule executed by core-scheduler.
-- -----------------------------------------------------------------------------
CREATE TABLE scheduled_tasks (
  name         text        PRIMARY KEY CHECK (name ~ '^[a-z_]+(\.[a-z_]+)*$'),
  schedule     text        NOT NULL,
  job_kind     text        NOT NULL CHECK (job_kind ~ '^[a-z_]+(\.[a-z_]+)+$'),
  payload      jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload) = 'object'),
  enabled      boolean     NOT NULL DEFAULT true,
  last_run_at  timestamptz,
  next_run_at  timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE scheduled_tasks IS
  'Each tick the scheduler claims due rows with FOR UPDATE SKIP LOCKED, enqueues a job and computes next_run_at — in one transaction. Safe with several scheduler replicas and with connection poolers (no advisory locks, no LISTEN).';
COMMENT ON COLUMN scheduled_tasks.schedule IS
  'Five-field cron expression evaluated in UTC.';

CREATE TRIGGER scheduled_tasks_set_updated_at BEFORE UPDATE ON scheduled_tasks
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

INSERT INTO scheduled_tasks (name, schedule, job_kind) VALUES
  ('provider.health_check',  '* * * * *',    'provider.health_check'),
  ('stats.rollup',           '*/5 * * * *',  'stats.rollup'),
  ('license.validate',       '*/15 * * * *', 'license.validate'),
  ('updates.check',          '0 */6 * * *',  'updates.check'),
  ('backup.nightly',         '0 3 * * *',    'backup.run'),
  ('maintenance.partitions', '10 0 * * *',   'maintenance.partitions'),
  ('maintenance.retention',  '30 2 * * *',   'maintenance.retention'),
  ('ledger.reconcile',       '45 3 * * *',   'ledger.reconcile');
