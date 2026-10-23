import { workflows } from "./client";
import { dueJobs, runJob, failJob } from "../routine-jobs";
import { validId, workspaceStorageReady } from "../workspaces";
export const runRoutine = workflows.createFunction(
  {
    id: "run-workspace-routine",
    retries: 2,
    timeouts: { finish: "5m" },
    triggers: { event: "naxium/routine.run" },
    onFailure: async ({ event }) => {
      const data = event.data.event.data;
      if (validId(data.businessId) && validId(data.id))
        await failJob(data.businessId, data.id);
    },
  },
  async ({ event, step }) => {
    const { businessId, id } = event.data;
    if (!validId(businessId) || !validId(id))
      throw new Error("Invalid routine event");
    return step.run("calculate-saved-query", () => runJob(businessId, id));
  },
);
export const scheduledRoutines = workflows.createFunction(
  {
    id: "scheduled-workspace-routines",
    retries: 2,
    triggers: { cron: "*/15 * * * *" },
  },
  async ({ step }) => {
    if (
      process.env.NODE_ENV !== "production" ||
      !(await workspaceStorageReady())
    )
      return { skipped: true };
    const jobs = await step.run(
      "queue-due-routines-and-expire-workspaces",
      dueJobs,
    );
    if (jobs.length)
      await step.sendEvent(
        "dispatch-routines",
        jobs.map((j) => ({ id: j.id, name: "naxium/routine.run", data: j })),
      );
    return { queued: jobs.length };
  },
);
