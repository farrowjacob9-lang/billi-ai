// Applies db/migrations/*.sql in order, once each. Usage: DATABASE_URL=... npm run db:migrate
// Run it with an owner role; run the app with a role that has no BYPASSRLS (see README).
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

export async function migrate(connectionString: string, log: (line: string) => void = console.log) {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const done = new Set((await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map(r => r.version));
    for (const file of (await readdir(dir)).filter(f => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(path.join(dir, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        log(`applied ${file}`);
      } catch (e) { await client.query("ROLLBACK"); throw e; }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!url) { console.error("Set DATABASE_MIGRATION_URL or DATABASE_URL."); process.exit(1); }
  migrate(url).then(() => console.log("database is up to date")).catch(e => { console.error(e); process.exit(1); });
}
