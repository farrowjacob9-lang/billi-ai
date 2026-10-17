// Integration tests against a real Postgres. Set TEST_DATABASE_URL to an owner/superuser
// connection; each run creates a throwaway database and a least-privilege app role, then drops it.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { migrate } from "../scripts/migrate.ts";
import { createReport, SAMPLE_CSV } from "../src/lib/report.ts";

const admin = process.env.TEST_DATABASE_URL;
const skip = admin ? false : "set TEST_DATABASE_URL to run database tests";
const dbName = `billions_test_${randomBytes(4).toString("hex")}`;
const role = "billions_app_test", rolePassword = randomBytes(12).toString("hex");
let appUrl = "";

type Modules = { auth: typeof import("../src/server/auth.ts"); repo: typeof import("../src/server/repo.ts"); db: typeof import("../src/server/db.ts"); limits: typeof import("../src/server/limits.ts") };
let m: Modules;

const withUrl = (url: string, database: string, user?: string, password?: string) => {
  const u = new URL(url); u.pathname = `/${database}`;
  if (user) { u.username = user; u.password = password ?? ""; }
  return u.toString();
};

before(async () => {
  if (!admin) return;
  const root = new pg.Client({ connectionString: admin });
  await root.connect();
  await root.query(`CREATE DATABASE ${dbName}`);
  await root.query(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$`);
  await root.query(`ALTER ROLE ${role} PASSWORD '${rolePassword}'`);
  await root.end();
  const ownerUrl = withUrl(admin, dbName);
  // Recreate Neon's Data API defaults: new tables granted to `authenticated` automatically.
  const neonLike = new pg.Client({ connectionString: ownerUrl });
  await neonLike.connect();
  await neonLike.query(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$`);
  await neonLike.query("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated");
  await neonLike.end();
  await migrate(ownerUrl, () => undefined);
  const owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(`GRANT USAGE ON SCHEMA public TO ${role}; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${role};`);
  await owner.end();
  appUrl = withUrl(admin, dbName, role, rolePassword);
  process.env.DATABASE_URL = appUrl;
  m = { auth: await import("../src/server/auth.ts"), repo: await import("../src/server/repo.ts"), db: await import("../src/server/db.ts"), limits: await import("../src/server/limits.ts") };
});

after(async () => {
  if (!admin) return;
  await m?.db.closePool();
  const root = new pg.Client({ connectionString: admin });
  await root.connect();
  await root.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await root.end();
});

const signUp = (email: string, businessName = "Business") => m.auth.signUp({ email, password: "correct horse battery", businessName });

test("sign-up creates a business, an owner membership and a working session", { skip }, async () => {
  const { token, session } = await signUp("Owner@Example.com ", "Harbour Studio");
  assert.equal(session.email, "owner@example.com");
  assert.deepEqual(await m.auth.sessionFromToken(token), session);
  const stored = (await m.db.query<{ token_hash: string }>("SELECT token_hash FROM sessions")).rows.map(r => r.token_hash);
  assert.ok(!stored.includes(token), "the raw token is never stored");
  await assert.rejects(signUp("owner@example.com"), { code: "email_taken" });
  await m.auth.endSession(token);
  assert.equal(await m.auth.sessionFromToken(token), null);
});

test("sign-in checks the password and throttles repeated failures", { skip }, async () => {
  await signUp("throttle@example.com");
  const { session } = await m.auth.logIn({ email: "THROTTLE@example.com", password: "correct horse battery" });
  assert.equal(session.email, "throttle@example.com");
  for (let i = 0; i < 5; i++) await assert.rejects(m.auth.logIn({ email: "throttle@example.com", password: "wrong password!" }), { code: "invalid_credentials" });
  await assert.rejects(m.auth.logIn({ email: "throttle@example.com", password: "correct horse battery" }), { code: "rate_limited" });
  await assert.rejects(m.auth.logIn({ email: "nobody@example.com", password: "whatever123" }), { code: "invalid_credentials" });
});

test("expired sessions are refused", { skip }, async () => {
  const { token } = await signUp("expired@example.com");
  await m.db.query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1", [m.auth.hashToken(token)]);
  assert.equal(await m.auth.sessionFromToken(token), null);
});

test("one business never sees, changes or deletes another business's work", { skip }, async () => {
  const a = (await signUp("a@example.com", "A")).session, b = (await signUp("b@example.com", "B")).session;
  const run = await m.repo.saveRun(a.businessId, a.userId, createReport(SAMPLE_CSV, "a-week.csv", "pending", new Date().toISOString()));
  const routine = await m.repo.createRoutine(a.businessId, a.userId, "A's Monday report");

  assert.deepEqual((await m.repo.listRuns(a.businessId)).map(r => r.id), [run.id]);
  assert.deepEqual(await m.repo.listRuns(b.businessId), []);
  assert.deepEqual(await m.repo.listRoutines(b.businessId), []);
  assert.equal(await m.repo.deleteRoutine(b.businessId, b.userId, routine.id), false);
  assert.equal(await m.repo.clearRuns(b.businessId, b.userId), 0);
  assert.equal((await m.repo.listRuns(a.businessId)).length, 1);
  assert.equal((await m.repo.listRoutines(a.businessId)).length, 1);
});

test("row-level security holds even when a query forgets the business filter", { skip }, async () => {
  const a = (await signUp("rls-a@example.com", "A")).session, b = (await signUp("rls-b@example.com", "B")).session;
  const run = await m.repo.saveRun(a.businessId, a.userId, createReport(SAMPLE_CSV, "secret.csv", "pending", new Date().toISOString()));
  const unscoped = await m.db.query("SELECT id FROM runs");
  assert.equal(unscoped.rowCount, 0, "no tenant set: nothing is visible");
  const asB = await m.db.withTenant(b.businessId, client => client.query("SELECT id FROM runs WHERE id = $1", [run.id]));
  assert.equal(asB.rowCount, 0, "B cannot read A's run by id");
  const update = await m.db.withTenant(b.businessId, client => client.query("UPDATE runs SET file_name = 'pwned' WHERE id = $1", [run.id]));
  assert.equal(update.rowCount, 0, "B cannot change A's run");
  await assert.rejects(m.db.withTenant(b.businessId, client => client.query("INSERT INTO runs (business_id, file_name, start_date, end_date, row_count, report) VALUES ($1, 'x', now(), now(), 1, '{}')", [a.businessId])), /row-level security/);
});

test("the AI allowance stops at the daily limit, per business", { skip }, async () => {
  const a = (await signUp("quota-a@example.com", "A")).session, b = (await signUp("quota-b@example.com", "B")).session;
  assert.deepEqual([await m.repo.takeAiCall(a.businessId, 2), await m.repo.takeAiCall(a.businessId, 2), await m.repo.takeAiCall(a.businessId, 2)], [true, true, false]);
  assert.equal(await m.repo.takeAiCall(b.businessId, 2), true);
});

test("stored runs keep the calculated report only, never the CSV", { skip }, async () => {
  const a = (await signUp("nocsv@example.com", "A")).session;
  await m.repo.saveRun(a.businessId, a.userId, createReport(SAMPLE_CSV, "week.csv", "pending", new Date().toISOString()));
  const raw = await m.db.withTenant(a.businessId, client => client.query<{ report: unknown }>("SELECT report FROM runs WHERE business_id = $1", [a.businessId]));
  assert.doesNotMatch(JSON.stringify(raw.rows), /Website discovery|Studio rent/);
});

test("parallel wrong guesses can't race past the sign-in throttle", { skip }, async () => {
  await signUp("race@example.com");
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => m.auth.logIn({ email: "race@example.com", password: "wrong password!" })));
  const codes = results.map(r => r.status === "rejected" ? (r.reason as { code: string }).code : "ok");
  assert.equal(codes.filter(c => c === "invalid_credentials").length, 5, "exactly five passwords were checked");
  assert.equal(codes.filter(c => c === "rate_limited").length, 7);
});

test("rate limits count atomically within a window", { skip }, async () => {
  const key = `test:${randomBytes(4).toString("hex")}`;
  const taken = await Promise.all(Array.from({ length: 10 }, () => m.limits.takeRateLimit(key, 3, 3600)));
  assert.equal(taken.filter(Boolean).length, 3);
});

test("the app refuses to serve tenant data through a role that bypasses row-level security", { skip }, async () => {
  await m.db.closePool();
  process.env.DATABASE_URL = withUrl(admin!, dbName);
  try { await assert.rejects(m.repo.listRuns("00000000-0000-0000-0000-000000000000"), /superuser or BYPASSRLS/); }
  finally { await m.db.closePool(); process.env.DATABASE_URL = appUrl; }
});

test("Neon's Data API role gets no access to Billions tables, now or in future migrations", { skip }, async () => {
  const owner = new pg.Client({ connectionString: withUrl(admin!, dbName) });
  await owner.connect();
  try {
    const open = await owner.query<{ table_name: string }>(
      "SELECT c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')");
    assert.deepEqual(open.rows, []);
    await owner.query("CREATE TABLE later_table (id int)");
    assert.equal((await owner.query("SELECT has_table_privilege('authenticated', 'later_table', 'SELECT') AS ok")).rows[0].ok, false);
  } finally { await owner.end(); }
});
