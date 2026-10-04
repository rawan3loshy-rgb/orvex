-- =============================================================================
--  ORVEX Core · INSTALLATION database
--  007_routing_rules.sql
-- -----------------------------------------------------------------------------
--  Schema version : 007
--  Introduced in  : Core 1.x (consolidated)
--  Summary        : Ordered routing rules evaluated by the routing engine on
--                   every order, plus hourly hit counters.
--  Note           : routing_rules.weight is added in 018 (Core 2.5.0).
-- =============================================================================

CREATE TABLE routing_rules (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description         text        NOT NULL DEFAULT '',
  enabled             boolean     NOT NULL DEFAULT true,
  position            integer     NOT NULL CHECK (position >= 1),
  scope_service_ids   uuid[],
  scope_categories    text[],
  conditions          jsonb       NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(conditions) = 'array'),
  action_type         text        NOT NULL
                      CHECK (action_type IN ('prefer_provider', 'exclude_provider', 'set_strategy', 'hold_for_review', 'set_timeout')),
  action_provider_id  uuid        REFERENCES providers(id) ON DELETE RESTRICT,
  action_strategy     text        CHECK (action_strategy IN ('priority', 'lowest_cost', 'fastest', 'health_weighted', 'round_robin')),
  action_value        integer,
  created_by          uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT routing_rules_position_unique UNIQUE (position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT routing_rules_categories_valid
    CHECK (scope_categories IS NULL
           OR scope_categories <@ ARRAY['IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services']::text[]),
  CONSTRAINT routing_rules_action_arguments CHECK (
    CASE action_type
      WHEN 'prefer_provider' THEN action_provider_id IS NOT NULL
      WHEN 'set_strategy'    THEN action_strategy IS NOT NULL
      WHEN 'set_timeout'     THEN action_value BETWEEN 1000 AND 300000
      ELSE true
    END
  )
);

COMMENT ON TABLE routing_rules IS
  'Routing rules (RoutingRule), evaluated in position order after the service strategy has ordered the provider chain.';
COMMENT ON COLUMN routing_rules.scope_service_ids IS
  'NULL = all services. Services are archived rather than deleted, so ids stay resolvable; unknown ids are ignored by the engine.';
COMMENT ON COLUMN routing_rules.conditions IS
  'AND-ed conditions: [{"field": "order.country", "operator": "in", "value": ["DE","FR"]}]. Fields: provider.health, provider.latency_p95, provider.balance, order.country, order.amount, reseller.group, service.category, time.hour (in settings.general.timezone). Operators: lt, gt, eq, neq, in.';
COMMENT ON COLUMN routing_rules.action_value IS
  'Numeric argument, e.g. the timeout in ms for set_timeout.';

CREATE TRIGGER routing_rules_set_updated_at BEFORE UPDATE ON routing_rules
  FOR EACH ROW EXECUTE FUNCTION orvex_set_updated_at();

-- -----------------------------------------------------------------------------
-- routing_rule_hits — hourly counters (RoutingRule.hits24h).
-- -----------------------------------------------------------------------------
CREATE TABLE routing_rule_hits (
  rule_id  uuid        NOT NULL REFERENCES routing_rules(id) ON DELETE CASCADE,
  hour     timestamptz NOT NULL,
  hits     integer     NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (rule_id, hour)
);

COMMENT ON TABLE routing_rule_hits IS
  'Upserted by the routing engine (INSERT … ON CONFLICT DO UPDATE SET hits = hits + 1) with hour = date_trunc(''hour'', now()) in UTC. Rows older than 30 days are pruned.';
