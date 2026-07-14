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
