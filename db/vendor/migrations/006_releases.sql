-- =============================================================================
--  ORVEX Systems · VENDOR PLATFORM database
--  006_releases.sql
-- -----------------------------------------------------------------------------
--  Core releases, notes and signed artifacts, served by releases.orvex.io
--  (manifests) and registry.orvex.io (container images) to every
--  installation, which verifies them locally before installing.
-- =============================================================================

CREATE TABLE releases (
  version             text        PRIMARY KEY CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'),
  channel             text        NOT NULL CHECK (channel IN ('stable', 'beta')),
  status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn')),
  title               text        NOT NULL,
  summary             text        NOT NULL DEFAULT '',
  released_at         timestamptz,
  migration_from      text        CHECK (migration_from ~ '^[0-9]{3}$'),
  migration_to        text        CHECK (migration_to ~ '^[0-9]{3}$'),
  migration_steps     text[]      NOT NULL DEFAULT '{}',
  min_upgrade_from    text        NOT NULL,
  compat_node         text        NOT NULL,
  compat_postgres     text        NOT NULL,
  compat_docker       text        NOT NULL,
  requires_backup     boolean     NOT NULL DEFAULT true,
  breaking            boolean     NOT NULL DEFAULT false,
  rollout_percent     smallint    NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  manifest            jsonb       CHECK (manifest IS NULL OR jsonb_typeof(manifest) = 'object'),
  manifest_signature  text        CHECK (manifest_signature ~ '^ed25519:'),
  signing_key_id      text        REFERENCES signing_keys(id),
  withdrawn_at        timestamptz,
  withdrawn_reason    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT releases_migration_pair     CHECK ((migration_from IS NULL) = (migration_to IS NULL)),
  CONSTRAINT releases_published_is_signed
    CHECK (status <> 'published' OR (manifest IS NOT NULL AND manifest_signature IS NOT NULL
                                     AND signing_key_id IS NOT NULL AND released_at IS NOT NULL)),
  CONSTRAINT releases_withdrawn_reason   CHECK (status <> 'withdrawn' OR withdrawn_reason IS NOT NULL)
);

CREATE INDEX releases_channel_idx ON releases (channel, released_at DESC) WHERE status = 'published';

COMMENT ON TABLE releases IS
  'Release (e.g. 2.5.0 · stable · migration 017 → 018 · min upgrade 2.3.0 · Node >= 22.11 LTS · PostgreSQL 14 – 17 · Docker >= 24).';
COMMENT ON COLUMN releases.rollout_percent IS
  'Staged rollout: share of installations (stable hash of installation id) to which the update is offered automatically. Anyone can still install it explicitly.';
COMMENT ON COLUMN releases.manifest IS
  'Exact signed release manifest (orvex-release/v1) served to installations; see docs/ARCHITECTURE.md § Update architecture.';
COMMENT ON COLUMN releases.withdrawn_at IS
  'A withdrawn release is no longer offered; installations already on it are told which version to move to.';

CREATE TRIGGER releases_set_updated_at BEFORE UPDATE ON releases
  FOR EACH ROW EXECUTE FUNCTION platform_set_updated_at();

CREATE TABLE release_notes (
  release_version  text     NOT NULL REFERENCES releases(version) ON DELETE CASCADE,
  position         smallint NOT NULL CHECK (position >= 1),
  type             text     NOT NULL CHECK (type IN ('feature', 'improvement', 'fix', 'security')),
  text             text     NOT NULL,
  PRIMARY KEY (release_version, position)
);

CREATE TABLE release_artifacts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  release_version  text        NOT NULL REFERENCES releases(version) ON DELETE CASCADE,
  kind             text        NOT NULL CHECK (kind IN ('container_image', 'update_bundle', 'migrations', 'sbom', 'checksums')),
  platform         text        NOT NULL DEFAULT 'any' CHECK (platform IN ('any', 'linux/amd64', 'linux/arm64')),
  uri              text        NOT NULL,
  image_digest     text        CHECK (image_digest ~ '^sha256:[0-9a-f]{64}$'),
  size_bytes       bigint      NOT NULL CHECK (size_bytes > 0),
  sha256           char(64)    NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  signature        text        NOT NULL CHECK (signature ~ '^ed25519:'),
  signing_key_id   text        NOT NULL REFERENCES signing_keys(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT release_artifacts_unique UNIQUE (release_version, kind, platform),
  CONSTRAINT release_artifacts_image_has_digest CHECK (kind <> 'container_image' OR image_digest IS NOT NULL)
);

COMMENT ON TABLE release_artifacts IS
  'Release.package: every artifact has a SHA-256 and a detached Ed25519 signature. Container images are additionally pinned by digest (registry.orvex.io/core:2.5.0@sha256:…).';
