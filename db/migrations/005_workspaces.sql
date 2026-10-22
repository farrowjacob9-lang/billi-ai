-- Explicitly saved parsed cells/conversations. Original upload binaries are not retained.
CREATE TABLE workspaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 snapshot jsonb NOT NULL, expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,id)
);
CREATE INDEX workspaces_recent ON workspaces(business_id,updated_at DESC);
CREATE TABLE workspace_routines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 sheet_index integer NOT NULL, question text NOT NULL, plan jsonb NOT NULL,
 cadence text NOT NULL CHECK(cadence IN ('manual','daily','weekly')), next_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(business_id,workspace_id) REFERENCES workspaces(business_id,id) ON DELETE CASCADE,
 UNIQUE(business_id,id)
);
CREATE TABLE workspace_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 routine_id uuid NOT NULL, scheduled_for timestamptz, status text NOT NULL DEFAULT 'queued'
 CHECK(status IN ('queued','running','needs_input','complete','failed','cancelled')),
 result text, error text, started_at timestamptz, finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(business_id,routine_id) REFERENCES workspace_routines(business_id,id) ON DELETE CASCADE,
 UNIQUE(routine_id,scheduled_for)
);
CREATE INDEX workspace_jobs_recent ON workspace_jobs(business_id,created_at DESC);
CREATE TABLE ai_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 model text NOT NULL, operation text NOT NULL, input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0, cache_write_tokens integer NOT NULL DEFAULT 0,
 cache_read_tokens integer NOT NULL DEFAULT 0, duration_ms integer NOT NULL, success boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_recent ON ai_calls(business_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['workspaces','workspace_routines','workspace_jobs','ai_calls'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (business_id = NULLIF(current_setting('app.business_id',true),'')::uuid) WITH CHECK (business_id = NULLIF(current_setting('app.business_id',true),'')::uuid)$p$,t);
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='billions_app') THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO billions_app',t); END IF;
 END LOOP;
END $$;
