import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";

let pool: pg.Pool | null = null;
let roleChecked: Promise<void> | null = null;

export const databaseConfigured = () => !!process.env.DATABASE_URL;

export function getPool(): pg.Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_MAX) || 5, idleTimeoutMillis: 10_000 });
    // On Vercel Fluid compute, keeps the instance alive long enough to close idle connections
    // before suspension (Neon's guidance for node-postgres on Vercel). A no-op elsewhere.
    attachDatabasePool(pool);
  }
  return pool;
}

export async function closePool() { await pool?.end(); pool = null; roleChecked = null; }

// Row-level security is skipped for superusers and BYPASSRLS roles. Refuse to serve tenant
// data through such a role rather than silently relying on the query filters alone.
function assertLeastPrivilege(): Promise<void> {
  return roleChecked ??= getPool().query<{ unsafe: boolean }>("SELECT rolsuper OR rolbypassrls AS unsafe FROM pg_roles WHERE rolname = current_user")
    .then(({ rows }) => {
      if (rows[0]?.unsafe) throw new Error("DATABASE_URL connects as a superuser or BYPASSRLS role. Use the least-privilege app role described in the README.");
    })
    .catch(e => { roleChecked = null; throw e; });
}

// For tables that are not tenant data: users, businesses, memberships, sessions, login attempts.
export async function query<R extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<R>(text, params);
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally { client.release(); }
}

// Every read or write of tenant data runs here. Row-level security then limits the
// transaction to this business, whatever the SQL inside says.
export async function withTenant<T>(businessId: string, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  await assertLeastPrivilege();
  return transaction(async client => {
    await client.query("SELECT set_config('app.business_id', $1, true)", [businessId]);
    return fn(client);
  });
}
