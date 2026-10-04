-- =============================================================================
--  ORVEX Systems · VENDOR PLATFORM database
--  004_subscriptions_and_billing.sql
-- -----------------------------------------------------------------------------
--  Subscriptions, invoices and payments for the ORVEX license itself.
--  Card data never touches this database: payment methods and payments are
--  references to the payment provider (PCI scope stays with the provider).
--  Not to be confused with an installation's own ledger (resellers' balances),
--  which lives only in the customer's database.
-- =============================================================================

CREATE TABLE payment_methods (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider            text        NOT NULL CHECK (provider IN ('stripe', 'bank_transfer')),
  provider_reference  text        NOT NULL,
  kind                text        NOT NULL CHECK (kind IN ('card', 'sepa_debit', 'bank_transfer')),
  brand               text,
  last4               char(4)     CHECK (last4 ~ '^[0-9]{4}$'),
  exp_month           smallint    CHECK (exp_month BETWEEN 1 AND 12),
  exp_year            smallint    CHECK (exp_year BETWEEN 2000 AND 2100),
  is_default          boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  detached_at         timestamptz,
  CONSTRAINT payment_methods_provider_ref_unique UNIQUE (provider, provider_reference)
);

CREATE UNIQUE INDEX payment_methods_single_default ON payment_methods (account_id) WHERE is_default AND detached_at IS NULL;

COMMENT ON TABLE payment_methods IS
  'Display data and provider token reference only (e.g. Visa •••• 4242, exp 08/2028 → pm_… at Stripe). No PAN, no CVC, ever.';

CREATE TABLE subscriptions (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             text          NOT NULL UNIQUE CHECK (public_id ~ '^sub_[A-Za-z0-9]{4,24}$'),
  account_id            uuid          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  plan_id               text          NOT NULL REFERENCES plans(id),
  status                text          NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  billing_cycle         text          NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  amount                numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency              char(3)       NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  started_at            timestamptz   NOT NULL,
  current_period_start  timestamptz   NOT NULL,
  current_period_end    timestamptz   NOT NULL,
  next_renewal_at       timestamptz,
  auto_renew            boolean       NOT NULL DEFAULT true,
  cancel_at             timestamptz,
  cancelled_at          timestamptz,
  payment_method_id     uuid          REFERENCES payment_methods(id) ON DELETE SET NULL,
  provider_reference    text          UNIQUE,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_period_order CHECK (current_period_end > current_period_start)
);

CREATE UNIQUE INDEX subscriptions_one_live_per_account ON subscriptions (account_id)
  WHERE status IN ('active', 'past_due', 'trialing');

COMMENT ON TABLE subscriptions IS
  'Subscription (e.g. sub_8Kq2 · Professional · quarterly · 1,644 USD incl. add-ons). Drives license term and update entitlement; usage figures shown in the portal come from license activations and heartbeat counters, never from customer business data.';
COMMENT ON COLUMN subscriptions.amount IS
  'Amount per billing period including add-ons.';

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION platform_set_updated_at();

CREATE TABLE subscription_add_ons (
  subscription_id  uuid          NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  add_on_id        text          NOT NULL REFERENCES add_ons(id),
  unit_price       numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity         integer       NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  added_at         timestamptz   NOT NULL DEFAULT now(),
  removed_at       timestamptz,
  PRIMARY KEY (subscription_id, add_on_id)
);

COMMENT ON TABLE subscription_add_ons IS
  'Subscription.addOns with the monthly price frozen at the time it was added.';

CREATE TABLE invoices (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  number              text          NOT NULL UNIQUE CHECK (number ~ '^INV-[0-9]{4}-[0-9]{4}$'),
  account_id          uuid          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  subscription_id     uuid          REFERENCES subscriptions(id) ON DELETE SET NULL,
  status              text          NOT NULL CHECK (status IN ('paid', 'open', 'void', 'uncollectible')),
  currency            char(3)       NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal            numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  tax                 numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total               numeric(12,2) NOT NULL,
  issued_at           timestamptz   NOT NULL,
  due_at              timestamptz   NOT NULL,
  paid_at             timestamptz,
  period_start        timestamptz   NOT NULL,
  period_end          timestamptz   NOT NULL,
  pdf_uri             text,
  provider_reference  text          UNIQUE,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT invoices_total_is_sum   CHECK (total = subtotal + tax),
  CONSTRAINT invoices_paid_has_date  CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
  CONSTRAINT invoices_due_after_issue CHECK (due_at >= issued_at)
);

CREATE INDEX invoices_account_idx ON invoices (account_id, issued_at DESC);
CREATE INDEX invoices_open_idx ON invoices (due_at) WHERE status = 'open';

COMMENT ON TABLE invoices IS
  'Invoice (e.g. INV-2026-0418). Issued invoices are immutable apart from status/paid_at; corrections are credit notes (roadmap).';

CREATE TABLE invoice_lines (
  invoice_id   uuid          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position     smallint      NOT NULL CHECK (position >= 1),
  description  text          NOT NULL,
  quantity     numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit_price   numeric(12,2) NOT NULL,
  amount       numeric(12,2) NOT NULL,
  PRIMARY KEY (invoice_id, position),
  CONSTRAINT invoice_lines_amount CHECK (amount = round(quantity * unit_price, 2))
);

COMMENT ON TABLE invoice_lines IS
  'InvoiceLine, e.g. "ORVEX Core — Professional (quarterly)" 3 × 449 = 1,347.';

CREATE TABLE payments (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  invoice_id          uuid          NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  payment_method_id   uuid          REFERENCES payment_methods(id) ON DELETE SET NULL,
  at                  timestamptz   NOT NULL DEFAULT now(),
  amount              numeric(12,2) NOT NULL CHECK (amount > 0),
  currency            char(3)       NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  method_label        text          NOT NULL,
  status              text          NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded')),
  failure_reason      text,
  description         text          NOT NULL DEFAULT '',
  provider            text          NOT NULL CHECK (provider IN ('stripe', 'bank_transfer')),
  provider_reference  text          NOT NULL,
  CONSTRAINT payments_provider_ref_unique UNIQUE (provider, provider_reference)
);

CREATE INDEX payments_account_idx ON payments (account_id, at DESC);
CREATE INDEX payments_invoice_idx ON payments (invoice_id);

COMMENT ON TABLE payments IS
  'Payment attempts against invoices (Payment). method_label is display text (Visa •••• 4242, SEPA transfer); provider_reference is the provider''s charge / transfer id. Written from verified payment-provider webhooks.';
