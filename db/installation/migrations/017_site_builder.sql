-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  017_site_builder.sql
-- -----------------------------------------------------------------------------
--  Schema version : 017   ← applied by Core 2.4.0 (016 → 019 in one update; 2.4.x runs 019)
--  Introduced in  : Core 2.4.0 (migration 016 → 017, "Create table site_sections",
--                   "Create table site_pages", "Migrate legacy CMS blocks")
--  Summary        : Section-based website builder for the customer's public
--                   site: theme tokens, sections (HTML/CSS, optional sandboxed
--                   JS), pages, navigation and immutable publications.
--
--  Security model (see docs/ARCHITECTURE.md § Security):
--    * section HTML is sanitised server-side with an allow-list on save AND on
--      publish (no <script>, no inline event handlers, no javascript: URLs);
--    * section CSS is scoped to the section wrapper;
--    * section JS never runs in the site document — only inside a sandboxed
--      iframe (sandbox="allow-scripts", opaque origin, own CSP), and only when
--      js_enabled is true.
-- =============================================================================

CREATE TABLE site_theme (
  singleton           boolean     PRIMARY KEY DEFAULT true CHECK (singleton),
  site_name           text        NOT NULL DEFAULT 'My Platform',
  logo_text           text        NOT NULL DEFAULT 'My Platform',
  primary_color       text        NOT NULL DEFAULT '#2b2d30' CHECK (primary_color    ~ '^#[0-9a-fA-F]{6}$'),
  accent_color        text        NOT NULL DEFAULT '#ff5a36' CHECK (accent_color     ~ '^#[0-9a-fA-F]{6}$'),
  background_color    text        NOT NULL DEFAULT '#ffffff' CHECK (background_color ~ '^#[0-9a-fA-F]{6}$'),
  surface_color       text        NOT NULL DEFAULT '#f5f4f1' CHECK (surface_color    ~ '^#[0-9a-fA-F]{6}$'),
  text_color          text        NOT NULL DEFAULT '#17181a' CHECK (text_color       ~ '^#[0-9a-fA-F]{6}$'),
  muted_color         text        NOT NULL DEFAULT '#6b6862' CHECK (muted_color      ~ '^#[0-9a-fA-F]{6}$'),
  radius_px           smallint    NOT NULL DEFAULT 10 CHECK (radius_px BETWEEN 0 AND 32),
  font_heading        text        NOT NULL DEFAULT 'Instrument Sans Variable',
  font_body           text        NOT NULL DEFAULT 'Inter Variable',
  mode                text        NOT NULL DEFAULT 'light' CHECK (mode IN ('light', 'dark')),
  theme_extension_id  text        REFERENCES extensions(id) ON DELETE SET NULL,
  custom_head         text        NOT NULL DEFAULT '' CHECK (octet_length(custom_head) <= 16384),
  published_at        timestamptz,
  updated_by          uuid        REFERENCES users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE site_theme IS
  'Singleton: theme tokens (exposed to sections as var(--site-*)) and site-wide settings (SiteTheme, SiteConfig.customHead, publishedAt). The site domain is the installation domain.';
COMMENT ON COLUMN site_theme.custom_head IS
  'Extra <head> markup; only <meta> and <link rel="preconnect|icon|stylesheet"> survive sanitisation.';

CREATE TRIGGER site_theme_set_updated_at BEFORE UPDATE ON site_theme
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

INSERT INTO site_theme DEFAULT VALUES ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- site_sections
-- -----------------------------------------------------------------------------
CREATE TABLE site_sections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  type                    text        NOT NULL
                          CHECK (type IN ('hero', 'features', 'services', 'stats', 'testimonials', 'faq', 'cta', 'footer', 'custom')),
  html                    text        NOT NULL DEFAULT '' CHECK (octet_length(html) <= 262144),
  css                     text        NOT NULL DEFAULT '' CHECK (octet_length(css) <= 131072),
  js                      text        NOT NULL DEFAULT '' CHECK (octet_length(js) <= 131072),
  js_enabled              boolean     NOT NULL DEFAULT false,
  enabled                 boolean     NOT NULL DEFAULT true,
  component_extension_id  text        REFERENCES extensions(id) ON DELETE SET NULL,
  updated_by              uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_sections_js_requires_code CHECK (NOT js_enabled OR length(js) > 0)
);

COMMENT ON TABLE site_sections IS
  'SiteSection. Dynamic blocks are declared in HTML with data attributes (e.g. <div data-block="service-catalog">) and rendered from the installation''s own catalog; template variables such as {{site.name}} and {{stats.orders}} are resolved at render time.';
COMMENT ON COLUMN site_sections.js_enabled IS
  'Opt-in. JS only ever executes inside a sandboxed iframe with an opaque origin: no access to cookies, the admin session or the parent page.';
COMMENT ON COLUMN site_sections.component_extension_id IS
  'Set when the section is provided by a website-component extension (e.g. web.pricing-table).';

CREATE TRIGGER site_sections_set_updated_at BEFORE UPDATE ON site_sections
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- site_pages and their ordered sections
-- -----------------------------------------------------------------------------
CREATE TABLE site_pages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  slug             text        NOT NULL UNIQUE
                   CHECK (slug ~ '^/([a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*)?$'
                          AND slug !~ '^/(admin|api|hooks|assets|healthz|readyz)(/|$)'),
  status           text        NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  is_home          boolean     NOT NULL DEFAULT false,
  seo_title        text        NOT NULL DEFAULT '' CHECK (length(seo_title) <= 120),
  seo_description  text        NOT NULL DEFAULT '' CHECK (length(seo_description) <= 320),
  updated_by       uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_pages_home_is_root CHECK (NOT is_home OR slug = '/')
);

CREATE UNIQUE INDEX site_pages_single_home ON site_pages ((true)) WHERE is_home;

COMMENT ON TABLE site_pages IS
  'SitePage. Slugs reserved for the platform (/admin, /api, /hooks, /assets, /healthz, /readyz) are rejected so the public site can never shadow system routes.';

CREATE TRIGGER site_pages_set_updated_at BEFORE UPDATE ON site_pages
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

CREATE TABLE site_page_sections (
  page_id     uuid     NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  section_id  uuid     NOT NULL REFERENCES site_sections(id) ON DELETE CASCADE,
  position    smallint NOT NULL CHECK (position >= 0),
  PRIMARY KEY (page_id, section_id),
  CONSTRAINT site_page_sections_position_unique UNIQUE (page_id, position) DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE site_page_sections IS
  'Ordered section list of a page (SitePage.sectionIds). Deleting a section removes it from every page.';

-- -----------------------------------------------------------------------------
-- site_navigation — header and footer menus
-- -----------------------------------------------------------------------------
CREATE TABLE site_navigation (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu        text        NOT NULL CHECK (menu IN ('header', 'footer')),
  label       text        NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  href        text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('page', 'external', 'anchor')),
  page_id     uuid        REFERENCES site_pages(id) ON DELETE SET NULL,
  highlight   boolean     NOT NULL DEFAULT false,
  position    smallint    NOT NULL CHECK (position >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_navigation_position_unique UNIQUE (menu, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT site_navigation_href_matches_kind CHECK (
       (kind = 'page'     AND href ~ '^/')
    OR (kind = 'anchor'   AND href ~ '^#')
    OR (kind = 'external' AND href ~ '^https://')
  )
);

COMMENT ON TABLE site_navigation IS
  'SiteNavItem for SiteConfig.nav (menu = header) and footerNav (menu = footer). The href check rules out javascript: and data: URLs.';

CREATE TRIGGER site_navigation_set_updated_at BEFORE UPDATE ON site_navigation
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- site_publications — immutable snapshots served to visitors.
-- -----------------------------------------------------------------------------
CREATE TABLE site_publications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  published_at     timestamptz NOT NULL DEFAULT now(),
  published_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  snapshot         jsonb       NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  snapshot_sha256  char(64)    NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  note             text        NOT NULL DEFAULT ''
);

CREATE INDEX site_publications_published_idx ON site_publications (published_at DESC);

COMMENT ON TABLE site_publications IS
  'POST /site/publish sanitises the draft and stores the complete site (pages, sections, nav, theme) as one snapshot. Visitors are served the latest snapshot, so editing never affects the live site and a bad publish is undone by re-publishing an older snapshot.';

-- -----------------------------------------------------------------------------
-- Migrate legacy CMS blocks. 1.x installations carried a cms_blocks table
-- (title, body_html, created_at). Fresh installations skip this block.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('cms_blocks') IS NOT NULL THEN
    INSERT INTO site_sections (name, type, html, css, enabled, created_at, updated_at)
    SELECT left(COALESCE(b.title, 'Legacy block'), 120), 'custom', COALESCE(b.body_html, ''), '', true,
           COALESCE(b.created_at, now()), now()
    FROM cms_blocks b;
    DROP TABLE cms_blocks;
  END IF;
END
$$;
