-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  016_pricing.sql
-- -----------------------------------------------------------------------------
--  Schema version : 016
--  Introduced in  : Core 2.3.0 (migration 015 → 016,
--                   "Create table pricing_groups", "Create table pricing_rules")
--  Summary        : Reseller pricing groups with per-service contract price
--                   overrides; every reseller belongs to exactly one group.
-- =============================================================================

CREATE TABLE pricing_groups (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text         NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9_]{0,47}$'),
  name              text         NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  description       text         NOT NULL DEFAULT '',
  discount_percent  numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent > -100 AND discount_percent < 100),
  color             text,
  is_default        boolean      NOT NULL DEFAULT false,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pricing_groups_single_default ON pricing_groups ((true)) WHERE is_default;

COMMENT ON TABLE pricing_groups IS
  'PricingGroup. API id = ''grp_'' || key (e.g. grp_standard, grp_enterprise). Exactly one default group applies to new resellers and to website customers.';
COMMENT ON COLUMN pricing_groups.discount_percent IS
  'Discount off the public price in percent; negative = surcharge.';

CREATE TRIGGER pricing_groups_set_updated_at BEFORE UPDATE ON pricing_groups
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

CREATE TABLE pricing_rules (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_group_id  uuid          NOT NULL REFERENCES pricing_groups(id) ON DELETE CASCADE,
  service_id        uuid          NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price             numeric(12,4) NOT NULL CHECK (price >= 0),
  valid_until       timestamptz,
  note              text          NOT NULL DEFAULT '',
  created_by        uuid          REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pricing_rules_one_override_per_service UNIQUE (pricing_group_id, service_id)
);

COMMENT ON TABLE pricing_rules IS
  'Per-service fixed-price overrides of a pricing group (PricingGroup.overrides), e.g. contract pricing until 2027-03. The API rejects overrides below the primary provider cost.';
COMMENT ON COLUMN pricing_rules.valid_until IS
  'Optional contract end; after it the group discount applies again.';

CREATE TRIGGER pricing_rules_set_updated_at BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

INSERT INTO pricing_groups (key, name, description, discount_percent, color, is_default)
VALUES ('standard', 'Standard', 'Public list price. Default for new resellers and website customers.', 0, 'var(--c6)', true)
ON CONFLICT (key) DO NOTHING;

-- Every existing reseller joins the default group.
ALTER TABLE resellers ADD COLUMN pricing_group_id uuid;

UPDATE resellers
   SET pricing_group_id = (SELECT id FROM pricing_groups WHERE is_default)
 WHERE pricing_group_id IS NULL;

ALTER TABLE resellers
  ALTER COLUMN pricing_group_id SET NOT NULL,
  ADD CONSTRAINT resellers_pricing_group_fk FOREIGN KEY (pricing_group_id) REFERENCES pricing_groups(id) ON DELETE RESTRICT;

CREATE INDEX resellers_pricing_group_idx ON resellers (pricing_group_id);

-- Provenance of the frozen order price.
ALTER TABLE orders ADD COLUMN pricing_group_id uuid REFERENCES pricing_groups(id) ON DELETE SET NULL;

COMMENT ON COLUMN orders.pricing_group_id IS
  'Pricing group whose price was applied when the order was created (NULL = public price).';

-- -----------------------------------------------------------------------------
-- Effective price per group and service — same rule as the order engine:
-- override if present and valid, else round(public price × (1 − discount), 2).
-- -----------------------------------------------------------------------------
CREATE VIEW service_group_prices AS
SELECT g.id                                   AS pricing_group_id,
       s.id                                   AS service_id,
       s.price                                AS public_price,
       COALESCE(r.price, round(s.price * (1 - g.discount_percent / 100), 2)) AS group_price,
       (r.id IS NOT NULL)                     AS overridden
FROM pricing_groups g
CROSS JOIN services s
LEFT JOIN pricing_rules r
       ON r.pricing_group_id = g.id
      AND r.service_id = s.id
      AND (r.valid_until IS NULL OR r.valid_until > now())
WHERE s.archived_at IS NULL;

COMMENT ON VIEW service_group_prices IS
  'Effective selling price per pricing group and service (PriceRow.groupPrice / overridden).';
