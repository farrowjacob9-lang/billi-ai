import { aiContext } from "@/server/metering";
import { requireAiAccess } from "@/server/access";
import { planSheetQuestion } from "@/server/ai";
import { HttpError, ok, readJson, route } from "@/server/http";
import { executePlan, validateSheet } from "@/lib/sheet";

export const POST = route(async request => {
  const body = await readJson(request, 2.5 * 1024 * 1024);
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 2000) throw new HttpError(400, "invalid_input", "Ask a question of up to 2,000 characters.");
  let sheet;
  try { sheet = validateSheet(body.sheet); }
  catch (e) { throw new HttpError(422, "invalid_sheet", (e as Error).message); }
  const session = await requireAiAccess();
  const history = Array.isArray(body.history) ? body.history.filter((q): q is string => typeof q === "string").slice(-6).map(q => q.slice(0, 2000)) : [];
  // Rows stay on our server. Only headings and user questions go to the model.
  const plan = await aiContext.run({ businessId: session?.businessId ?? "", operation: "spreadsheet-question" }, () => planSheetQuestion(question, sheet.columns, history, request.signal));
  if (!plan) return ok({ reply: "The AI assistant couldn't interpret that question right now. Try again, or ask a simple question such as ‘total Amount’ or ‘how many rows’." });
  try { return ok({ reply: executePlan(sheet, plan), plan }); }
  catch (e) { return ok({ reply: (e as Error).message }); }
});
