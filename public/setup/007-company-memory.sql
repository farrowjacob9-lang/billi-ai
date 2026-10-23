BEGIN;
-- Explicitly retained business records; independent of temporary spreadsheet workspaces.
CREATE TABLE company_memory (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 source_workspace_id uuid,
 source_message_id double precision,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_memory_recent ON company_memory(business_id,updated_at DESC);
ALTER TABLE company_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memory FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON company_memory USING (business_id = NULLIF(current_setting('app.business_id',true),'')::uuid) WITH CHECK (business_id = NULLIF(current_setting('app.business_id',true),'')::uuid);
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='billions_app') THEN GRANT SELECT,INSERT,UPDATE,DELETE ON company_memory TO billions_app; END IF;
END $$;

INSERT INTO schema_migrations(version) VALUES ('007_company_memory.sql');
COMMIT;
