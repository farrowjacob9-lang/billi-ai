-- Apply once in Neon SQL Editor as the database owner after migration 005.
-- Prefer the migration runner when owner credentials are configured.
BEGIN;
-- Accepted task methods have their own explicit 30-day lifetime, independent of source uploads.
-- Definitions contain questions, headings, rules and fingerprint evidence, never source cells.
CREATE TABLE learned_methods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 task_key text NOT NULL, input_key text NOT NULL,
 definition jsonb NOT NULL, revision integer NOT NULL CHECK(revision>0),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,id), UNIQUE(business_id,task_key,input_key)
);
CREATE INDEX learned_methods_recent ON learned_methods(business_id,updated_at DESC);
CREATE TABLE method_executions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
 method_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(business_id,method_id) REFERENCES learned_methods(business_id,id) ON DELETE CASCADE
);
CREATE INDEX method_executions_recent ON method_executions(business_id,method_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['learned_methods','method_executions'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (business_id = NULLIF(current_setting('app.business_id',true),'')::uuid) WITH CHECK (business_id = NULLIF(current_setting('app.business_id',true),'')::uuid)$p$,t);
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='billions_app') THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO billions_app',t); END IF;
 END LOOP;
END $$;

INSERT INTO schema_migrations(version) VALUES ('006_learned_methods.sql');
COMMIT;
