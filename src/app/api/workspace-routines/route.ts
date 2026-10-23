import {takeRateLimit} from "@/server/limits";
import { ok, readJson, requireSession, route, HttpError } from "@/server/http";
import { withTenant } from "@/server/db";
import {
  requireWorkspaceStorage,
  getWorkspace,
  validId,
} from "@/server/workspaces";
import { validateWorkflow, runWorkflow } from "@/lib/workflow";
import { validateSheet } from "@/lib/sheet";
import { validatePlan } from "@/lib/sheet";
import { createJob, failJob } from "@/server/routine-jobs";
import { workflows, workflowsConfigured } from "@/server/workflows/client";
export const GET = route(async () => {
  const s = await requireSession();
  await requireWorkspaceStorage();
  return withTenant(s.businessId, async (c) =>
    ok({
      routines: (
        await c.query(
          "SELECT id,name,cadence,workspace_id,sheet_index,question,plan FROM workspace_routines WHERE business_id=$1 ORDER BY created_at DESC LIMIT 30",
          [s.businessId],
        )
      ).rows,
      jobs: (
        await c.query(
          "SELECT j.id,j.routine_id,j.status,j.result,j.error,j.created_at,r.workspace_id,r.name FROM workspace_jobs j JOIN workspace_routines r ON r.business_id=j.business_id AND r.id=j.routine_id WHERE j.business_id=$1 ORDER BY j.created_at DESC LIMIT 20",
          [s.businessId],
        )
      ).rows,
    }),
  );
});
export const POST = route(async (req) => {
  const s = await requireSession();
  await requireWorkspaceStorage();
  const b = await readJson(req, 2.5 * 1024 * 1024);
  if (["create","run","apply"].includes(String(b.action)) && !await takeRateLimit(`workspace-routine:${s.businessId}`,60,3600)) throw new HttpError(429,"rate_limited","Too many routine changes. Try again later.");
  if (b.action === "create") {
    if (
      !validId(b.workspaceId) ||
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 120 ||
      typeof b.question !== "string" ||
      b.question.length > 2000 ||
      !Number.isInteger(b.sheetIndex) ||
      !["manual", "daily", "weekly"].includes(String(b.cadence))
    )
      throw new HttpError(
        400,
        "invalid_input",
        "Choose a workspace, question and frequency.",
      );
    if (b.cadence !== "manual" && !workflowsConfigured())
      throw new HttpError(
        503,
        "worker_setup",
        "Scheduled routines are not connected yet. Save an on-demand routine for now.",
      );
    const routineName = b.name.trim();
    const w = await getWorkspace(s.businessId, b.workspaceId);
    const sheet = w?.snapshot.sheets[Number(b.sheetIndex)];
    if (!sheet)
      throw new HttpError(
        404,
        "not_found",
        "Save this spreadsheet workspace first.",
      );
    let plan;
    try {
      plan = b.plan && typeof b.plan === "object" && "version" in b.plan ? validateWorkflow(b.plan, sheet) : validatePlan(b.plan, sheet);
    } catch (e) {
      throw new HttpError(422, "invalid_plan", (e as Error).message);
    }
    return withTenant(s.businessId, async (c) => {
      await c.query("SELECT id FROM businesses WHERE id=$1 FOR UPDATE", [
        s.businessId,
      ]);
      if (
        (
          await c.query(
            "SELECT count(*)::int AS n FROM workspace_routines WHERE business_id=$1",
            [s.businessId],
          )
        ).rows[0].n >= 30
      )
        throw new HttpError(
          409,
          "routine_limit",
          "Delete a routine before adding another (maximum 30).",
        );
      return ok(
        {
          routine: (
            await c.query(
              "INSERT INTO workspace_routines(business_id,workspace_id,name,sheet_index,question,plan,cadence,next_at) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $7='daily' THEN now()+interval '1 day' WHEN $7='weekly' THEN now()+interval '7 days' ELSE NULL END) RETURNING id",
              [
                s.businessId,
                b.workspaceId,
                routineName,
                b.sheetIndex,
                b.question,
                JSON.stringify(plan),
                b.cadence,
              ],
            )
          ).rows[0],
        },
        201,
      );
    });
  }
  if (!validId(b.id))
    throw new HttpError(400, "invalid_input", "Choose a routine or job.");
  if (b.action === "apply") {
    return withTenant(s.businessId, async c => {
      const stored = (await c.query("SELECT plan,name FROM workspace_routines WHERE business_id=$1 AND id=$2", [s.businessId,b.id])).rows[0];
      if (!stored) throw new HttpError(404,"not_found","Workflow not found.");
      try {
        const sheet = validateSheet(b.sheet);
        const results = runWorkflow(stored.plan,sheet);
        await c.query("INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,'workflow.applied',$3)",[s.businessId,s.userId,b.id]);
        return ok({results, name:stored.name});
      } catch(e) { if (e instanceof HttpError) throw e; throw new HttpError(422,"workflow_input",e instanceof Error ? e.message : "Review the workflow input."); }
    });
  }
  if (b.action === "delete")
    return withTenant(s.businessId, async (c) =>
      ok({
        deleted: !!(
          await c.query(
            "DELETE FROM workspace_routines WHERE business_id=$1 AND id=$2",
            [s.businessId, b.id],
          )
        ).rowCount,
      }),
    );
  if (b.action === "cancel")
    return withTenant(s.businessId, async (c) =>
      ok({
        cancelled: !!(
          await c.query(
            "UPDATE workspace_jobs SET status='cancelled',finished_at=now() WHERE business_id=$1 AND id=$2 AND status IN ('queued','running','needs_input')",
            [s.businessId, b.id],
          )
        ).rowCount,
      }),
    );
  if (b.action === "run") {
    const id = await createJob(s.businessId, b.id);
    if (!id) throw new HttpError(404, "not_found", "Routine not found.");
    if (workflowsConfigured()) {
      try {
        await workflows.send({
          id,
          name: "naxium/routine.run",
          data: { businessId: s.businessId, id },
        });
      } catch {
        await failJob(s.businessId, id);
        throw new HttpError(
          503,
          "worker_unavailable",
          "The worker is unavailable. Try running again.",
        );
      }
    } else {
      const { runJob } = await import("@/server/routine-jobs");
      await runJob(s.businessId, id);
    }
    return ok({ id });
  }
  throw new HttpError(
    400,
    "invalid_input",
    "Choose create, run, cancel or delete.",
  );
});
