import { withTenant, query } from "./db.ts";
import { executePlan, validatePlan, type Plan } from "../lib/sheet.ts";
import type { Snapshot } from "../lib/workspace.ts";
export async function createJob(
  businessId: string,
  routineId: string,
  scheduledFor: string | null = null,
) {
  return withTenant(
    businessId,
    async (c) =>
      (
        await c.query(
          "INSERT INTO workspace_jobs(business_id,routine_id,scheduled_for) SELECT $1,id,$3::timestamptz FROM workspace_routines WHERE business_id=$1 AND id=$2 ON CONFLICT(routine_id,scheduled_for) DO NOTHING RETURNING id",
          [businessId, routineId, scheduledFor],
        )
      ).rows[0]?.id as string | undefined,
  );
}
export async function failJob(businessId: string, id: string) {
  await withTenant(businessId, async (c) => {
    await c.query(
      "UPDATE workspace_jobs SET status='failed',error='The background worker could not finish. Try running the routine again.',finished_at=now() WHERE business_id=$1 AND id=$2 AND status IN ('queued','running')",
      [businessId, id],
    );
  });
}
export async function runJob(businessId: string, id: string) {
  const job = await withTenant(businessId, async (c) => {
    const claimed = await c.query(
      "UPDATE workspace_jobs SET status='running',started_at=coalesce(started_at,now()) WHERE business_id=$1 AND id=$2 AND status IN ('queued','running') RETURNING routine_id",
      [businessId, id],
    );
    if (!claimed.rows[0]) return null;
    return (
      await c.query(
        "SELECT r.plan,r.sheet_index,r.question,w.snapshot,w.expires_at FROM workspace_routines r JOIN workspaces w ON w.business_id=r.business_id AND w.id=r.workspace_id WHERE r.business_id=$1 AND r.id=$2",
        [businessId, claimed.rows[0].routine_id],
      )
    ).rows[0];
  });
  if (!job) return { status: "not_running" };
  let result: string | null = null,
    error: string | null = null,
    status = "complete";
  try {
    if (Date.parse(job.expires_at) <= Date.now())
      throw new Error(
        "The saved workspace expired. Save a new workspace to continue.",
      );
    const sheet = (job.snapshot as Snapshot).sheets[job.sheet_index];
    if (!sheet)
      throw new Error(
        "This routine needs a worksheet that is no longer present.",
      );
    result = executePlan(sheet, validatePlan(job.plan, sheet) as Plan);
  } catch (e) {
    status = "needs_input";
    error =
      e instanceof Error
        ? e.message
        : "Clarify the question in the saved workspace.";
  }
  await withTenant(businessId, async (c) => {
    await c.query(
      "UPDATE workspace_jobs SET status=$3,result=$4,error=$5,finished_at=now() WHERE business_id=$1 AND id=$2 AND status='running'",
      [businessId, id, status, result, error],
    );
  });
  return { status };
}
export async function dueJobs() {
  const jobs: { businessId: string; id: string }[] = [];
  let cursor = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const businesses = (
      await query<{ id: string }>(
        "SELECT id FROM businesses WHERE id>$1 ORDER BY id LIMIT 100",
        [cursor],
      )
    ).rows;
    if (!businesses.length) break;
    for (const b of businesses) {
      if (jobs.length >= 200) return jobs;
      await withTenant(b.id, async (c) => {
        await c.query(
          "DELETE FROM workspaces WHERE business_id=$1 AND expires_at<=now()",
          [b.id],
        );
        await c.query("UPDATE workspace_jobs SET status='failed',error='The worker stopped responding. Run the routine again.',finished_at=now() WHERE business_id=$1 AND status='running' AND started_at<now()-interval '10 minutes'",[b.id]);
        const due = await c.query(
          "SELECT id,next_at,cadence FROM workspace_routines WHERE business_id=$1 AND cadence<>'manual' AND next_at<=now() FOR UPDATE SKIP LOCKED",
          [b.id],
        );
        for (const r of due.rows) {
          const job = (
            await c.query(
              "INSERT INTO workspace_jobs(business_id,routine_id,scheduled_for) VALUES($1,$2,$3) ON CONFLICT(routine_id,scheduled_for) DO NOTHING RETURNING id",
              [b.id, r.id, r.next_at],
            )
          ).rows[0];
          await c.query(
            "UPDATE workspace_routines SET next_at=now()+CASE WHEN cadence='daily' THEN interval '1 day' ELSE interval '7 days' END WHERE business_id=$1 AND id=$2",
            [b.id, r.id],
          );
        }
        const pending = (
          await c.query(
            "SELECT id FROM workspace_jobs WHERE business_id=$1 AND status='queued' ORDER BY created_at LIMIT $2",
            [b.id, 200-jobs.length],
          )
        ).rows;
        for (const j of pending) jobs.push({ businessId: b.id, id: j.id });
      });
    }
    if (jobs.length >= 200) return jobs;
    cursor = businesses.at(-1)!.id;
  }
  return jobs;
}
