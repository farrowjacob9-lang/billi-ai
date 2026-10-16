import { requireAiAccess } from "@/server/access";
import { writeNarrative } from "@/server/ai";
import { HttpError, ok, readJson, route } from "@/server/http";
import { isConsistentReport, isReport } from "@/lib/validate";

// Browser-only mode: the browser calculated the report and sends the totals, never the CSV.
export const POST = route(async request => {
  const body = await readJson(request, 256 * 1024);
  if (!isReport(body.report) || !isConsistentReport(body.report)) throw new HttpError(400, "invalid_report", "That report doesn’t add up, so it wasn’t sent to the model.");
  await requireAiAccess();
  return ok({ narrative: await writeNarrative(body.report, request.signal) });
});
