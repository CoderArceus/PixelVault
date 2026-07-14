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
