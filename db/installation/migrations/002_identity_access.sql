-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  002_identity_access.sql
-- -----------------------------------------------------------------------------
--  Schema version : 002
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : Installation-local administrators, roles, permissions,
--                   sessions and one-time tokens.
--
--  These users are local to the installation (Alex Morgan signs in at
--  portal.unlockdesk-demo.com/admin). They are unrelated to accounts on the vendor
--  platform (account.orvex.io); the two never share identities or sessions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- permissions — catalog of every permission Core checks.
-- -----------------------------------------------------------------------------
CREATE TABLE permissions (
  key          text PRIMARY KEY CHECK (key ~ '^[a-z_]+:[a-z_]+$'),
  resource     text GENERATED ALWAYS AS (split_part(key, ':', 1)) STORED,
  action       text GENERATED ALWAYS AS (split_part(key, ':', 2)) STORED,
  description  text NOT NULL
);

COMMENT ON TABLE permissions IS
  'Catalog of permission keys (resource:action). Reference data owned by Core; extensions register additional keys under their own resource name.';

INSERT INTO permissions (key, description) VALUES
  ('orders:read',          'View orders, attempts and order timelines'),
  ('orders:write',         'Create test orders, retry and cancel orders'),
  ('orders:refund',        'Refund completed orders'),
  ('services:read',        'View the service catalog'),
  ('services:write',       'Create and edit services, fields and prices'),
  ('providers:read',       'View providers, health and provider logs'),
  ('providers:write',      'Connect and configure providers, test and sync'),
  ('providers:credentials','Rotate provider credentials (write-only secrets)'),
  ('routing:read',         'View mappings and routing rules'),
  ('routing:write',        'Edit mappings, priorities and routing rules'),
  ('resellers:read',       'View resellers and usage'),
  ('resellers:write',      'Create, edit, suspend and activate resellers'),
  ('resellers:balance',    'Top up or adjust reseller balances'),
  ('pricing:read',         'View pricing groups and margins'),
  ('pricing:write',        'Edit pricing groups and contract price overrides'),
  ('transactions:read',    'View the ledger'),
  ('transactions:write',   'Record manual ledger entries'),
  ('reports:read',         'View revenue, margin and volume reports'),
  ('developer:read',       'View API keys (masked), webhooks and API logs'),
  ('developer:write',      'Create and revoke API keys, manage webhooks, replay deliveries'),
  ('website:read',         'View website pages, sections, navigation and theme'),
  ('website:write',        'Edit website content'),
  ('website:publish',      'Publish the website'),
  ('settings:read',        'View installation settings'),
  ('settings:write',       'Change installation settings'),
  ('users:read',           'View administrators and roles'),
  ('users:write',          'Invite, disable and change roles of administrators'),
  ('system:read',          'View health, audit log, backups and update history'),
  ('system:update',        'Run Core updates and restores'),
  ('system:backup',        'Create and download backups'),
  ('extensions:read',      'View installed extensions'),
  ('extensions:write',     'Install, enable, disable and configure extensions'),
  ('license:read',         'View license status'),
  ('license:manage',       'Re-validate, replace or deactivate the license');

-- -----------------------------------------------------------------------------
-- roles
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_]{1,47}$'),
  name         text        NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  description  text        NOT NULL DEFAULT '',
  is_system    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE roles IS
  'RBAC roles. System roles (Owner, Administrator) ship with Core and cannot be deleted; all other roles are defined by the customer. API id = ''role_'' || key.';

CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- role_permissions — grants may be exact keys or wildcards.
-- -----------------------------------------------------------------------------
CREATE TABLE role_permissions (
  role_id     uuid        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission  text        NOT NULL CHECK (permission ~ '^(\*|[a-z_]+:(\*|[a-z_]+))$'),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission)
);

COMMENT ON TABLE role_permissions IS
  'Grants. ''*'' = everything, ''orders:*'' = every action on a resource, ''orders:read'' = one permission. The application rejects grants that match no catalog entry.';

INSERT INTO roles (key, name, description, is_system) VALUES
  ('owner', 'Owner',         'Full access including license, billing contacts and user management.', true),
  ('admin', 'Administrator', 'Manage everything except ownership transfer and license.',              true);

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM roles r
CROSS JOIN LATERAL unnest(
  CASE r.key
    WHEN 'owner' THEN ARRAY['*']
    WHEN 'admin' THEN ARRAY['orders:*', 'services:*', 'providers:*', 'routing:*', 'resellers:*',
                            'pricing:*', 'developer:*', 'website:*', 'settings:*', 'users:*']
  END
) AS p(permission)
WHERE r.key IN ('owner', 'admin');

-- -----------------------------------------------------------------------------
-- users — installation administrators.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  text        NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name                   text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  role_id                uuid        NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status                 text        NOT NULL DEFAULT 'invited'
                                     CHECK (status IN ('active', 'invited', 'disabled')),
  kind                   text        NOT NULL DEFAULT 'member'
                                     CHECK (kind IN ('member', 'vendor_support')),
  password_hash          text        CHECK (password_hash IS NULL OR password_hash LIKE '$argon2id$%'),
  mfa_enabled            boolean     NOT NULL DEFAULT false,
  mfa_secret_ciphertext  bytea,
  mfa_secret_nonce       bytea       CHECK (mfa_secret_nonce IS NULL OR octet_length(mfa_secret_nonce) = 12),
  mfa_secret_key_id      text,
  color                  text,
  failed_login_count     smallint    NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until           timestamptz,
  last_login_at          timestamptz,
  last_active_at         timestamptz,
  expires_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_mfa_secret_complete
    CHECK (num_nulls(mfa_secret_ciphertext, mfa_secret_nonce, mfa_secret_key_id) IN (0, 3)),
  CONSTRAINT users_mfa_requires_secret
    CHECK (NOT mfa_enabled OR mfa_secret_ciphertext IS NOT NULL),
  CONSTRAINT users_vendor_support_is_time_boxed
    CHECK (kind <> 'vendor_support' OR expires_at IS NOT NULL)
);

CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
CREATE INDEX users_role_idx ON users (role_id);

COMMENT ON TABLE users IS
  'Administrators of this installation. Never deleted (disable instead) so that audit history stays attributable.';
COMMENT ON COLUMN users.password_hash IS
  'Argon2id PHC string ($argon2id$v=19$m=19456,t=2,p=1$…). Plain-text passwords are never stored or logged.';
COMMENT ON COLUMN users.mfa_secret_ciphertext IS
  'TOTP secret, AES-256-GCM encrypted with the installation key ring (ENCRYPTION_KEY). 16-byte auth tag appended.';
COMMENT ON COLUMN users.kind IS
  'vendor_support = temporary account the customer creates to give ORVEX support consented, time-boxed access. Must have expires_at; disabled automatically when it passes.';
COMMENT ON COLUMN users.color IS
  'Avatar colour token used by the admin UI (e.g. var(--c1)).';

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- user_sessions — server-side admin sessions (httpOnly cookie holds the token).
-- -----------------------------------------------------------------------------
CREATE TABLE user_sessions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash           bytea       NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  ip                   inet,
  user_agent           text,
  mfa_verified_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz NOT NULL DEFAULT now(),
  idle_expires_at      timestamptz NOT NULL,
  absolute_expires_at  timestamptz NOT NULL,
  revoked_at           timestamptz,
  revoked_reason       text,
  CONSTRAINT user_sessions_expiry_order CHECK (idle_expires_at <= absolute_expires_at)
);

CREATE INDEX user_sessions_user_active_idx ON user_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX user_sessions_expiry_idx ON user_sessions (absolute_expires_at);

COMMENT ON TABLE user_sessions IS
  'Admin sessions. The cookie carries a random 256-bit token; only its SHA-256 is stored, so a database leak does not leak live sessions. Idle timeout comes from settings.security.sessionTimeoutMin.';

-- -----------------------------------------------------------------------------
-- user_tokens — invitations, password resets, MFA recovery codes.
-- -----------------------------------------------------------------------------
CREATE TABLE user_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     text        NOT NULL CHECK (purpose IN ('invite', 'password_reset', 'email_change', 'mfa_recovery')),
  token_hash  bytea       NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_tokens_user_idx ON user_tokens (user_id, purpose) WHERE used_at IS NULL;

COMMENT ON TABLE user_tokens IS
  'Single-use tokens; only SHA-256 hashes are stored.';
