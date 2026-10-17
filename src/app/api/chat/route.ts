import { requireAiAccess } from "@/server/access";
import { answerQuestion, type ChatTurn } from "@/server/ai";
import { HttpError, ok, readJson, route } from "@/server/http";
import { isConsistentReport, isReport } from "@/lib/validate";

const isTurn = (v: unknown): v is ChatTurn => !!v && typeof v === "object" && ((v as ChatTurn).role === "user" || (v as ChatTurn).role === "assistant") && typeof (v as ChatTurn).text === "string" && (v as ChatTurn).text.length > 0;

export const POST = route(async request => {
  const body = await readJson(request, 64 * 1024);
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 2000) throw new HttpError(400, "invalid_input", "Ask a question of up to 2,000 characters.");
  const report = isReport(body.report) && isConsistentReport(body.report) ? body.report : null;
  // Long turns are shortened rather than dropped, so the model keeps the thread of the conversation.
  const history = Array.isArray(body.history) ? body.history.filter(isTurn).slice(-8).map(t => ({ role: t.role, text: t.text.slice(0, 2000) })) : [];
  await requireAiAccess();
  return ok({ reply: await answerQuestion(question, report, history, request.signal) });
});
