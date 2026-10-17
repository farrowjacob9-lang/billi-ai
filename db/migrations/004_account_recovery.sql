-- Email verification and password reset. Each emailed link carries a random token; only its
-- SHA-256 is stored, bound to the user and the address it was sent to. A token is consumed by
-- deleting its row, so it works once.
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

CREATE TABLE email_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX email_tokens_user ON email_tokens (user_id, purpose);
CREATE INDEX email_tokens_expires_at ON email_tokens (expires_at);

-- The README's app role, when it exists, so a deploy can't run without access to the new table.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'billions_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON email_tokens TO billions_app;
  END IF;
END $$;
