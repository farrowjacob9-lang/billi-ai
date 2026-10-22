import { withTenant, query, databaseConfigured } from "./db.ts";
import { HttpError } from "./http";
import { validateSnapshot, type Snapshot } from "../lib/workspace.ts";
export async function workspaceStorageReady() {
  if (!databaseConfigured()) return false;
  try {
    const r = await query<{ ready: boolean }>(
      "SELECT to_regclass('public.workspaces') IS NOT NULL AND to_regclass('public.ai_calls') IS NOT NULL AS ready",
    );
    return r.rows[0].ready;
  } catch {
    return false;
  }
}
export async function requireWorkspaceStorage() {
  if (!(await workspaceStorageReady()))
    throw new HttpError(
      503,
      "storage_setup",
      "Saved work is not enabled on this deployment yet. Your spreadsheet is still available in this tab.",
    );
}
export const validId = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function listWorkspaces(businessId: string) {
  return withTenant(businessId, async (c) => {
    await c.query(
      "DELETE FROM workspaces WHERE business_id=$1 AND expires_at<=now()",
      [businessId],
    );
    return (
      await c.query(
        "SELECT id,name,updated_at,expires_at FROM workspaces WHERE business_id=$1 AND expires_at>now() ORDER BY updated_at DESC LIMIT 30",
        [businessId],
      )
    ).rows;
  });
}
export async function getWorkspace(
  businessId: string,
  id: string,
): Promise<{ id: string; name: string; snapshot: Snapshot } | null> {
  if (!validId(id)) return null;
  return withTenant(
    businessId,
    async (c) =>
      (
        await c.query(
          "SELECT id,name,snapshot FROM workspaces WHERE business_id=$1 AND id=$2 AND expires_at>now()",
          [businessId, id],
        )
      ).rows[0] ?? null,
  );
}
export async function saveWorkspace(
  businessId: string,
  userId: string,
  name: string,
  input: unknown,
  id?: string,
) {
  const snapshot = validateSnapshot(input);
  return withTenant(businessId, async (c) => {
    await c.query("SELECT id FROM businesses WHERE id=$1 FOR UPDATE", [
      businessId,
    ]);
    let saved;
    if (id) {
      if (!validId(id))
        throw new HttpError(400, "invalid_input", "Invalid workspace.");
      saved = (
        await c.query(
          "UPDATE workspaces SET name=$3,snapshot=$4,updated_at=now(),expires_at=now()+interval '30 days' WHERE business_id=$1 AND id=$2 AND expires_at>now() RETURNING id,name,updated_at,expires_at",
          [businessId, id, name, JSON.stringify(snapshot)],
        )
      ).rows[0];
      if (!saved) throw new HttpError(404, "not_found", "Workspace not found.");
    } else {
      const count = await c.query(
        "SELECT count(*)::int AS n FROM workspaces WHERE business_id=$1 AND expires_at>now()",
        [businessId],
      );
      if (count.rows[0].n >= 30)
        throw new HttpError(
          409,
          "workspace_limit",
          "Delete a saved workspace before saving another (maximum 30).",
        );
      saved = (
        await c.query(
          "INSERT INTO workspaces(business_id,created_by,name,snapshot) VALUES($1,$2,$3,$4) RETURNING id,name,updated_at,expires_at",
          [businessId, userId, name, JSON.stringify(snapshot)],
        )
      ).rows[0];
    }
    await c.query(
      "INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,$3,$4)",
      [businessId, userId, "workspace.saved", saved.id],
    );
    return saved;
  });
}
export async function deleteWorkspace(
  businessId: string,
  userId: string,
  id: string,
) {
  if (!validId(id)) return false;
  return withTenant(businessId, async (c) => {
    const r = await c.query(
      "DELETE FROM workspaces WHERE business_id=$1 AND id=$2",
      [businessId, id],
    );
    if (r.rowCount)
      await c.query(
        "INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,$3,$4)",
        [businessId, userId, "workspace.deleted", id],
      );
    return !!r.rowCount;
  });
}
