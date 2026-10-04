-- =============================================================================
--  ORVEX Systems · VENDOR PLATFORM database
--  002_accounts.sql
-- -----------------------------------------------------------------------------
--  Customer organisations, portal users and memberships (VendorAccount).
--  Portal users are NOT installation users: Alex Morgan's login on
--  account.orvex.io and his login on portal.unlockdesk-demo.com/admin are two
--  independent identities in two independent databases.
-- =============================================================================

CREATE TABLE accounts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             text        NOT NULL UNIQUE CHECK (public_id ~ '^acc_[a-z0-9]{4,24}$'),
  company               text        NOT NULL CHECK (length(company) BETWEEN 1 AND 200),
  country_code          char(2)     NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  vat_id                text,
  billing_email         text        NOT NULL CHECK (billing_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  billing_address       jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(billing_address) = 'object'),
  status                text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  billing_customer_ref  text        UNIQUE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE accounts IS
  'Customer organisation (e.g. acc_29f1 · UnlockDesk Demo Ltd.). Commercial data only.';
COMMENT ON COLUMN accounts.billing_customer_ref IS
  'Customer reference at the payment provider (e.g. Stripe cus_…). No payment credentials are stored on the platform.';

CREATE TRIGGER accounts_set_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION platform_set_updated_at();

CREATE TABLE users (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  text        NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name             text        NOT NULL,
  last_name              text        NOT NULL,
  password_hash          text        CHECK (password_hash IS NULL OR password_hash LIKE '$argon2id$%'),
  mfa_enabled            boolean     NOT NULL DEFAULT false,
  mfa_secret_ciphertext  bytea,
  mfa_secret_nonce       bytea,
  mfa_secret_key_id      text,
  status                 text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  last_login_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_mfa_secret_complete
    CHECK (num_nulls(mfa_secret_ciphertext, mfa_secret_nonce, mfa_secret_key_id) IN (0, 3))
);

CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

COMMENT ON TABLE users IS
  'People who sign in to account.orvex.io. One person can belong to several customer accounts.';

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION platform_set_updated_at();

CREATE TABLE account_members (
  account_id      uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('Owner', 'Billing', 'Technical')),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  joined_at       timestamptz,
  last_active_at  timestamptz,
  PRIMARY KEY (account_id, user_id)
);

CREATE UNIQUE INDEX account_members_single_owner ON account_members (account_id) WHERE role = 'Owner';
CREATE INDEX account_members_user_idx ON account_members (user_id);

COMMENT ON TABLE account_members IS
  'VendorAccount.team. Owner: everything incl. license and payment; Billing: subscription and invoices; Technical: license key, installations, releases, support.';

CREATE TABLE user_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      bytea       NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  device          text,
  location        text,
  ip              inet,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz
);

CREATE INDEX user_sessions_user_idx ON user_sessions (user_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE user_sessions IS
  'Portal sessions (VendorAccount.security.sessions). location is coarse (city, country) derived from the IP at sign-in.';
