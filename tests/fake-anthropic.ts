// A stand-in for the Messages API so browser tests exercise the real SDK path without a key or cost.
// It answers from the facts it was sent, and lies on purpose when a question says "invent".
import { createServer } from "node:http";

const port = Number(process.env.FAKE_ANTHROPIC_PORT) || 4010;
const received: string[] = [];

type Body = { system?: string; messages?: { role: string; content: string }[] };

function reply(body: Body): string {
  const last = String(body.messages?.at(-1)?.content ?? "");
  const facts = /<facts>(\{.*\})<\/facts>/s.exec(last)?.[1];
  const parsed = facts ? JSON.parse(facts) as { income: string; expenses: string; netMovement: string; transactions: number; expensesByCategory: { category: string; amount: string; shareOfExpenses: string }[] } : null;
  const money = (value: string) => `$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
  if (/<question>.*invent/is.test(last)) return "Your income grew 37% to $99,999.99 compared with last week.";
  if (!parsed) return "Upload a CSV with date, description, category and amount columns, covering up to 7 days.";
  const top = parsed.expensesByCategory[0];
  if (last.includes("<question>")) return `Your expenses were ${money(parsed.expenses)}, and ${top.category} was the largest at ${money(top.amount)} (${top.shareOfExpenses} of spending).`;
  return `A strong week: ${parsed.transactions} transactions brought in ${money(parsed.income)} against ${money(parsed.expenses)} of expenses, leaving ${money(parsed.netMovement)}. ${top.category} led spending at ${money(top.amount)}.`;
}

createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") { response.end("ok"); return; }
  if (request.method === "GET" && request.url === "/requests") { response.setHeader("content-type", "application/json"); response.end(JSON.stringify(received)); return; }
  let raw = "";
  request.on("data", chunk => { raw += chunk; });
  request.on("end", () => {
    received.push(raw);
    const body = JSON.parse(raw || "{}") as Body;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      id: `msg_fake_${received.length}`, type: "message", role: "assistant", model: "fake",
      content: [{ type: "text", text: reply(body) }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
  });
}).listen(port, "127.0.0.1", () => console.log(`fake anthropic on ${port}`));
