import { aiAllowedFor } from "@/server/access";
import { aiConfigured, writeNarrative } from "@/server/ai";
import { takeAiAllowance } from "@/server/limits";
import { HttpError, ok, readJson, requireSession, route } from "@/server/http";
import { clearRuns, listRuns, saveRun } from "@/server/repo";
import { createReport } from "@/lib/report";

const MAX_BODY = 2.5 * 1024 * 1024; // a 2 MB CSV plus JSON escaping

export const GET = route(async () => {
  const session = await requireSession();
  return ok({ runs: await listRuns(session.businessId) });
});

// The server never trusts the browser's numbers: it re-validates and recalculates the CSV,
// keeps only the calculated report, and discards the file.
export const POST = route(async request => {
  const session = await requireSession();
  const body = await readJson(request, MAX_BODY);
  if (typeof body.csv !== "string") throw new HttpError(400, "invalid_input", "Attach a CSV file.");
  const fileName = typeof body.fileName === "string" ? body.fileName.replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 200) : "";
  if (!fileName) throw new HttpError(400, "invalid_input", "The file needs a name.");
  let report;
  try { report = createReport(body.csv, fileName, "pending", new Date().toISOString()); }
  catch (e) { throw new HttpError(422, "invalid_csv", e instanceof Error ? e.message : "We couldn’t read that file."); }
  // A cancelled upload must not spend an AI call or be saved.
  const cancelled = () => { if (request.signal.aborted) throw new HttpError(499, "cancelled", "The report was cancelled."); };
  cancelled();
  if (aiConfigured() && aiAllowedFor(session) && await takeAiAllowance(session.businessId) === "ok") {
    const narrative = await writeNarrative(report, request.signal);
    if (narrative) report = { ...report, narrative, narrativeSource: "ai" as const };
  }
  cancelled();
  return ok({ report: await saveRun(session.businessId, session.userId, report) }, 201);
});

export const DELETE = route(async () => {
  const session = await requireSession();
  return ok({ deleted: await clearRuns(session.businessId, session.userId) });
});
