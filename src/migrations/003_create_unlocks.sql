CREATE TABLE unlocks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  post_id     UUID NOT NULL REFERENCES posts(id),
  price_paid  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Load-bearing constraint: prevents duplicate purchases at the DB level
  UNIQUE (user_id, post_id)
);

CREATE INDEX idx_unlocks_user_id ON unlocks(user_id);
CREATE INDEX idx_unlocks_post_id ON unlocks(post_id);
