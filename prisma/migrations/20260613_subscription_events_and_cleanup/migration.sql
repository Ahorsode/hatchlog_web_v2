CREATE TABLE subscription_events (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farm_id      TEXT        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_farm_id ON subscription_events(farm_id);
CREATE INDEX idx_subscription_events_farm_created ON subscription_events(farm_id, created_at);
