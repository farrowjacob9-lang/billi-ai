import { withTenant } from "./db.ts";
import type { Report } from "../lib/report.ts";
import type { Routine } from "../lib/types.ts";

// Tenant data access. Every function takes the business from the server-side session,
// filters on it explicitly, and runs under row-level security as a second guard.
const RECENT_LIMIT = 30;

async function audit(client: { query: (text: string, params: unknown[]) => Promise<unknown> }, businessId: string, userId: string, action: string, subjectId: string | null = null) {
  await client.query("INSERT INTO audit_events (business_id, user_id, action, subject_id) VALUES ($1, $2, $3, $4)", [businessId, userId, action, subjectId]);
}

export async function listRuns(businessId: string): Promise<Report[]> {
  return withTenant(businessId, async client => (await client.query<{ report: Report }>(
    "SELECT report FROM runs WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2", [businessId, RECENT_LIMIT])).rows.map(r => r.report));
}

export async function saveRun(businessId: string, userId: string, report: Report): Promise<Report> {
  return withTenant(businessId, async client => {
    const id = (await client.query<{ id: string }>("SELECT gen_random_uuid() AS id")).rows[0].id;
    const stored: Report = { ...report, id };
    await client.query(
      "INSERT INTO runs (id, business_id, created_by, file_name, start_date, end_date, row_count, report, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [id, businessId, userId, stored.fileName, stored.startDate, stored.endDate, stored.rowCount, JSON.stringify(stored), stored.createdAt]);
    await audit(client, businessId, userId, "run.created", id);
    return stored;
  });
}

export async function clearRuns(businessId: string, userId: string): Promise<number> {
  return withTenant(businessId, async client => {
    const { rowCount } = await client.query("DELETE FROM runs WHERE business_id = $1", [businessId]);
    await audit(client, businessId, userId, "runs.cleared");
    return rowCount ?? 0;
  });
}

export async function listRoutines(businessId: string): Promise<Routine[]> {
  return withTenant(businessId, async client => (await client.query<{ id: string; name: string; created_at: Date }>(
    "SELECT id, name, created_at FROM routines WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2", [businessId, RECENT_LIMIT]))
    .rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at.toISOString() })));
}

// The definition is what a future scheduled run will execute; today it is the one supported report.
export const WEEKLY_REPORT_DEFINITION = { kind: "weekly-csv-report", columns: ["date", "description", "category", "amount"], currency: "AUD", maxDays: 7 } as const;

export async function createRoutine(businessId: string, userId: string, name: string): Promise<Routine> {
  return withTenant(businessId, async client => {
    const row = (await client.query<{ id: string; created_at: Date }>(
      "INSERT INTO routines (business_id, created_by, name, definition) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
      [businessId, userId, name, JSON.stringify(WEEKLY_REPORT_DEFINITION)])).rows[0];
    await audit(client, businessId, userId, "routine.created", row.id);
    return { id: row.id, name, createdAt: row.created_at.toISOString() };
  });
}

export async function deleteRoutine(businessId: string, userId: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
  return withTenant(businessId, async client => {
    const { rowCount } = await client.query("DELETE FROM routines WHERE id = $1 AND business_id = $2", [id, businessId]);
    if (rowCount) await audit(client, businessId, userId, "routine.deleted", id);
    return !!rowCount;
  });
}

// Counts a model call against today's allowance (UTC). Returns false once the limit is reached.
export async function takeAiCall(businessId: string, limit: number): Promise<boolean> {
  return withTenant(businessId, async client => (await client.query(
    `INSERT INTO ai_usage (business_id, day, calls) VALUES ($1, (now() AT TIME ZONE 'utc')::date, 1)
     ON CONFLICT (business_id, day) DO UPDATE SET calls = ai_usage.calls + 1 WHERE ai_usage.calls < $2
     RETURNING calls`, [businessId, limit])).rowCount === 1);
}
