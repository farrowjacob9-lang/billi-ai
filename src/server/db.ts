import pg from "pg";

let pool: pg.Pool | null = null;

export const databaseConfigured = () => !!process.env.DATABASE_URL;

export function getPool(): pg.Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_MAX) || 5, idleTimeoutMillis: 10_000 });
  }
  return pool;
}

export async function closePool() { await pool?.end(); pool = null; }

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
  return transaction(async client => {
    await client.query("SELECT set_config('app.business_id', $1, true)", [businessId]);
    return fn(client);
  });
}
