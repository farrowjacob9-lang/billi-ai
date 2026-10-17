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
  assert.equal(await m.repo.deleteRun(b.businessId, b.userId, run.id), false);
  assert.equal(await m.repo.deleteRun(a.businessId, a.userId, "not-a-uuid"), false);
  assert.equal(await m.repo.clearRuns(b.businessId, b.userId), 0);
  assert.equal((await m.repo.listRuns(a.businessId)).length, 1);
  assert.equal((await m.repo.listRoutines(a.businessId)).length, 1);
});

test("a business can delete one report and keep the rest", { skip }, async () => {
  const a = (await signUp("delete-one@example.com", "A")).session;
  const keep = await m.repo.saveRun(a.businessId, a.userId, createReport(SAMPLE_CSV, "keep.csv", "pending", new Date().toISOString()));
  const drop = await m.repo.saveRun(a.businessId, a.userId, createReport(SAMPLE_CSV, "drop.csv", "pending", new Date().toISOString()));
  assert.equal(await m.repo.deleteRun(a.businessId, a.userId, drop.id), true);
  assert.equal(await m.repo.deleteRun(a.businessId, a.userId, drop.id), false, "a second delete finds nothing");
  assert.deepEqual((await m.repo.listRuns(a.businessId)).map(r => r.id), [keep.id]);
  const audit = await m.db.withTenant(a.businessId, client => client.query("SELECT 1 FROM audit_events WHERE action = 'run.deleted' AND subject_id = $1", [drop.id]));
  assert.equal(audit.rowCount, 1);
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

const asOwner = async <T,>(fn: (client: pg.Client) => Promise<T>) => {
  const owner = new pg.Client({ connectionString: withUrl(admin!, dbName) });
  await owner.connect();
  try { return await fn(owner); } finally { await owner.end(); }
};
const expireTokens = (userId: string) => asOwner(c => c.query("UPDATE email_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1", [userId]));

test("email verification links work once, expire, and only the latest one counts", { skip }, async () => {
  const { session, verification, token } = await signUp("verify@example.com");
  assert.equal(session.emailVerified, false);
  assert.equal(verification.email, "verify@example.com");
  const stored = (await m.db.query<{ token_hash: string }>("SELECT token_hash FROM email_tokens WHERE user_id = $1", [session.userId])).rows;
  assert.deepEqual(stored.map(r => r.token_hash), [m.auth.hashToken(verification.token)], "only the hash is stored");

  const newer = await m.auth.startEmailVerification(session.userId);
  await assert.rejects(m.auth.verifyEmail(verification.token), { code: "invalid_token" }, "a newer link replaces the old one");
  assert.deepEqual(await m.auth.verifyEmail(newer!.token), { email: "verify@example.com" });
  await assert.rejects(m.auth.verifyEmail(newer!.token), { code: "invalid_token" }, "single use");
  assert.equal((await m.auth.sessionFromToken(token))?.emailVerified, true);
  assert.equal(await m.auth.startEmailVerification(session.userId), null, "nothing to send once verified");

  const late = (await signUp("verify-late@example.com")).session;
  const link = await m.auth.startEmailVerification(late.userId);
  await expireTokens(late.userId);
  await assert.rejects(m.auth.verifyEmail(link!.token), { code: "invalid_token" });
  for (const junk of [undefined, "", 42, "x".repeat(101)]) await assert.rejects(m.auth.verifyEmail(junk), { code: "invalid_token" });
});

test("a password reset link signs in once, ends other sessions and lifts a lockout", { skip }, async () => {
  const { token: oldSession, session } = await signUp("reset@example.com");
  assert.equal(await m.auth.requestPasswordReset("nobody-here@example.com"), null);
  for (let i = 0; i < 5; i++) await assert.rejects(m.auth.logIn({ email: "reset@example.com", password: "wrong password!" }), { code: "invalid_credentials" });
  await assert.rejects(m.auth.logIn({ email: "reset@example.com", password: "correct horse battery" }), { code: "rate_limited" });

  const link = await m.auth.requestPasswordReset(" RESET@example.com ");
  assert.equal(link?.email, "reset@example.com");
  await assert.rejects(m.auth.resetPassword({ token: link!.token, password: "short" }), { code: "invalid_input" });
  const result = await m.auth.resetPassword({ token: link!.token, password: "a brand new passphrase" });
  assert.equal(result.session.userId, session.userId);
  assert.equal(result.session.emailVerified, true, "the emailed link proves the address");
  assert.equal(await m.auth.sessionFromToken(oldSession), null, "other sessions end");
  assert.ok(await m.auth.sessionFromToken(result.token));
  await assert.rejects(m.auth.resetPassword({ token: link!.token, password: "another new passphrase" }), { code: "invalid_token" }, "single use");

  await assert.rejects(m.auth.logIn({ email: "reset@example.com", password: "correct horse battery" }), { code: "invalid_credentials" });
  assert.ok(await m.auth.logIn({ email: "reset@example.com", password: "a brand new passphrase" }));
  const audit = await m.db.withTenant(session.businessId, c => c.query("SELECT 1 FROM audit_events WHERE action = 'password.reset'"));
  assert.equal(audit.rowCount, 1);
});

test("reset links expire, survive newer requests until one is used, and can't be redeemed twice in parallel", { skip }, async () => {
  const { session } = await signUp("reset-race@example.com");
  const first = await m.auth.requestPasswordReset("reset-race@example.com");
  const second = await m.auth.requestPasswordReset("reset-race@example.com");
  // A stranger asking for another link must not cancel the one the owner is about to use.
  const results = await Promise.allSettled([1, 2, 3].map(() => m.auth.resetPassword({ token: second!.token, password: "a brand new passphrase" })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  await assert.rejects(m.auth.resetPassword({ token: first!.token, password: "a brand new passphrase" }), { code: "invalid_token" }, "using one link clears the others");
  const third = await m.auth.requestPasswordReset("reset-race@example.com");
  await expireTokens(session.userId);
  await assert.rejects(m.auth.resetPassword({ token: third!.token, password: "a brand new passphrase" }), { code: "invalid_token" });
});

test("changing the password needs the current one and signs out other devices only", { skip }, async () => {
  const { token: here, session } = await signUp("change@example.com");
  const { token: elsewhere } = await m.auth.logIn({ email: "change@example.com", password: "correct horse battery" });
  await assert.rejects(m.auth.changePassword(session, here, { currentPassword: "not my password", newPassword: "a brand new passphrase" }), { code: "wrong_password" });
  await assert.rejects(m.auth.changePassword(session, here, { currentPassword: "correct horse battery", newPassword: "short" }), { code: "invalid_input" });
  await m.auth.changePassword(session, here, { currentPassword: "correct horse battery", newPassword: "a brand new passphrase" });
  assert.ok(await m.auth.sessionFromToken(here), "this device stays signed in");
  assert.equal(await m.auth.sessionFromToken(elsewhere), null, "other devices are signed out");
  assert.ok(await m.auth.logIn({ email: "change@example.com", password: "a brand new passphrase" }));
});

test("deleting an account removes the user, their business and its data, and nothing else", { skip }, async () => {
  const { token, session } = await signUp("leaving@example.com", "Leaving Co");
  const stay = (await signUp("staying@example.com", "Staying Co")).session;
  await m.repo.saveRun(session.businessId, session.userId, createReport(SAMPLE_CSV, "mine.csv", "pending", new Date().toISOString()));
  await m.repo.createRoutine(session.businessId, session.userId, "Mine");
  await m.repo.takeAiCall(session.businessId, 10);
  const kept = await m.repo.saveRun(stay.businessId, stay.userId, createReport(SAMPLE_CSV, "theirs.csv", "pending", new Date().toISOString()));

  await assert.rejects(m.auth.deleteAccount(session, token, "not my password"), { code: "wrong_password" });
  await m.auth.deleteAccount(session, token, "correct horse battery");

  assert.equal(await m.auth.sessionFromToken(token), null);
  const left = await asOwner(async c => {
    const count = async (sql: string) => (await c.query<{ n: number }>(sql, [session.businessId])).rows[0].n;
    return {
      business: await count("SELECT count(*)::int AS n FROM businesses WHERE id = $1"),
      runs: await count("SELECT count(*)::int AS n FROM runs WHERE business_id = $1"),
      routines: await count("SELECT count(*)::int AS n FROM routines WHERE business_id = $1"),
      audit: await count("SELECT count(*)::int AS n FROM audit_events WHERE business_id = $1"),
      usage: await count("SELECT count(*)::int AS n FROM ai_usage WHERE business_id = $1"),
      user: (await c.query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE email = 'leaving@example.com'")).rows[0].n,
    };
  });
  assert.deepEqual(left, { business: 0, runs: 0, routines: 0, audit: 0, usage: 0, user: 0 });
  assert.deepEqual((await m.repo.listRuns(stay.businessId)).map(r => r.id), [kept.id]);
  assert.ok(await signUp("leaving@example.com", "Back Again"), "the address can be used again");
});

test("a password change can't go through on a session that ended after its checks", { skip }, async () => {
  const { token, session } = await signUp("stale@example.com");
  await m.auth.endSession(token);
  await assert.rejects(m.auth.changePassword(session, token, { currentPassword: "correct horse battery", newPassword: "a brand new passphrase" }), { code: "signed_out" });
  await assert.rejects(m.auth.deleteAccount(session, token, "correct horse battery"), { code: "signed_out" });
  assert.ok(await m.auth.logIn({ email: "stale@example.com", password: "correct horse battery" }), "nothing changed");
});

test("addresses with display names or brackets are refused", { skip }, async () => {
  for (const email of ["x<me@example.com>", "a,b@example.com", "\"q\"@example.com", "me@exa mple.com"]) await assert.rejects(signUp(email), { code: "invalid_input" }, email);
  assert.equal(await m.auth.requestPasswordReset("x<reset@example.com>"), null);
});
