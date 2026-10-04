-- =============================================================================
--  ORVEX Systems · VENDOR PLATFORM database
--  007_support.sql
-- -----------------------------------------------------------------------------
--  Support tickets and messages, and the record of support access the
--  customer has granted. Granting access never gives the vendor credentials:
--  the customer creates a time-boxed vendor_support user inside their own
--  installation (or opens a supervised session); this table only records the
--  consent for accountability on both sides.
-- =============================================================================

CREATE SEQUENCE support_ticket_number_seq START WITH 1900;

CREATE TABLE support_tickets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text        NOT NULL UNIQUE DEFAULT ('TCK-' || nextval('support_ticket_number_seq'))
                               CHECK (number ~ '^TCK-[0-9]{4,8}$'),
  account_id       uuid        NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  installation_id  text        REFERENCES installations(id) ON DELETE SET NULL,
  subject          text        NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  status           text        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'awaiting_customer', 'in_progress', 'resolved', 'closed')),
  priority         text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category         text        NOT NULL DEFAULT 'General'
                   CHECK (category IN ('Installation', 'Billing', 'Update', 'Provider adapter', 'Licensing',
                                       'Custom development', 'General')),
  created_by       uuid        REFERENCES users(id) ON DELETE SET NULL,
  assignee         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  closed_at        timestamptz
);

ALTER SEQUENCE support_ticket_number_seq OWNED BY support_tickets.number;

CREATE INDEX support_tickets_account_idx ON support_tickets (account_id, updated_at DESC);
CREATE INDEX support_tickets_open_idx ON support_tickets (priority, updated_at) WHERE status NOT IN ('resolved', 'closed');

COMMENT ON TABLE support_tickets IS
  'SupportTicket (e.g. TCK-2041). Customers attach logs or screenshots deliberately; nothing is pulled from installations automatically.';

CREATE TRIGGER support_tickets_set_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION platform_set_updated_at();

CREATE TABLE support_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
  author_label    text        NOT NULL,
  role            text        NOT NULL CHECK (role IN ('customer', 'support')),
  body            text        NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  internal        boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_internal_is_staff CHECK (NOT internal OR role = 'support')
);

CREATE INDEX support_messages_ticket_idx ON support_messages (ticket_id, created_at);

COMMENT ON TABLE support_messages IS
  'SupportMessage. author_label e.g. "Jonas — ORVEX Support". internal = staff-only note, never shown in the portal.';

CREATE TABLE support_access_grants (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  installation_id     text        NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  ticket_id           uuid        REFERENCES support_tickets(id) ON DELETE SET NULL,
  granted_by_user_id  uuid        NOT NULL REFERENCES users(id),
  scope               text        NOT NULL CHECK (scope IN ('read_only_admin', 'update_assist', 'supervised_session')),
  reason              text        NOT NULL,
  granted_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  CONSTRAINT support_access_grants_time_boxed CHECK (expires_at > granted_at AND expires_at <= granted_at + interval '14 days')
);

CREATE INDEX support_access_grants_active_idx ON support_access_grants (installation_id, expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE support_access_grants IS
  'Consent record for vendor support access (e.g. vendor-assisted update window for TCK-2033). Access itself is enforced inside the installation by an expiring vendor_support user; the vendor stores no credentials.';
