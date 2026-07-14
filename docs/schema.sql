-- PixelVault Database Schema
-- Exported from active migrations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  coin_balance  INTEGER NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: posts
CREATE TYPE post_status AS ENUM ('active', 'deleted');

CREATE TABLE posts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES users(id),
  price                 INTEGER NOT NULL CHECK (price > 0),
  storage_key_original  TEXT NOT NULL,
  storage_key_preview   TEXT NOT NULL,
  status                post_status NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_posts_owner_id ON posts(owner_id);
CREATE INDEX idx_posts_status ON posts(status);

-- Table: unlocks
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

-- Table: transactions
CREATE TABLE transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id),
  unlock_id     UUID NOT NULL REFERENCES unlocks(id),
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);

-- Table: unlock_attempts_log
CREATE TYPE unlock_attempt_status AS ENUM (
  'success',
  'insufficient_balance',
  'already_unlocked',
  'not_found'
);

CREATE TABLE unlock_attempts_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  
  -- Loose reference rather than a strict FK (REFERENCES posts(id)).
  -- If a post is fully hard-deleted in a background cleanup job, we don't want
  -- an old attempt log referencing that post to block the cleanup, nor do we
  -- want to cascade delete the audit log. The audit log must survive.
  post_id     UUID NOT NULL,
  
  status      unlock_attempt_status NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unlock_attempts_user_id ON unlock_attempts_log(user_id);
CREATE INDEX idx_unlock_attempts_post_id ON unlock_attempts_log(post_id);
