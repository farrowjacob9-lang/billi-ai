-- Billions schema v1: accounts, business membership and tenant-isolated work.
-- Tenant tables carry business_id and are guarded by row-level security keyed on
-- the per-transaction setting app.business_id (set by withTenant in src/server/db.ts).
-- Connect the app as a role WITHOUT superuser or BYPASSRLS, or these policies are skipped.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

-- Only a SHA-256 of the session token is stored; the token itself lives in an httpOnly cookie.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expires_at ON sessions (expires_at);

CREATE TABLE login_attempts (
  email text NOT NULL,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_recent ON login_attempts (email, attempted_at);

-- A run keeps the calculated report only. The uploaded CSV is never stored.
CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  row_count integer NOT NULL,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX runs_business_recent ON runs (business_id, created_at DESC);

-- Routines are versioned by insert: a change is a new row, so past runs stay explainable.
CREATE TABLE routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  version integer NOT NULL DEFAULT 1,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routines_business_recent ON routines (business_id, created_at DESC);

CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  subject_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_business_recent ON audit_events (business_id, created_at DESC);

CREATE TABLE ai_usage (
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day date NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['runs', 'routines', 'audit_events', 'ai_usage'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
      WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)$p$, t);
  END LOOP;
END $$;
