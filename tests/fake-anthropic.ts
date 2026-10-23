// A stand-in for the Messages API so browser tests exercise the real SDK path without a key or cost.
// It answers from the facts it was sent, and lies on purpose when a question says "invent".
import { createServer } from "node:http";

const port = Number(process.env.FAKE_ANTHROPIC_PORT) || 4010;
const received: string[] = [];

type Body = { system?: string; messages?: { role: string; content: string }[] };

function reply(body: Body): string {
  const last = String(body.messages?.at(-1)?.content ?? "");
  if(body.system?.includes("Create a REVIEW DRAFT"))return "Draft for John’s Electrical\nScope reused from reference: install lighting.\nPrice [Review]. New address [To confirm]. Total [Total to confirm].";
  if(body.system?.includes("helpful business assistant"))return "Melbourne weather: test forecast, 18 degrees. Check the cited forecast before planning outdoor work.";
  if (body.system?.includes("Translate a spreadsheet question")) {
    const request = JSON.parse(last);
    if(/weather|explain a business plan/i.test(request.question))return JSON.stringify({general:true});
    if(request.revision) {
      if(/only posted/i.test(request.revision.correction))return JSON.stringify({clarification:"Posted appears in more than one column. Which column should determine inclusion?"});
      if(/invent/i.test(request.revision.correction))return JSON.stringify({operation:"sum",column:"Imaginary"});
      return JSON.stringify({clarification:"Which column and value should change?"});
    }
    if (/how much did we spend/i.test(request.question)) return JSON.stringify({clarification:"Which amount column and sign convention should I use, and should pending transactions be included?"});
    if (/monthly/i.test(request.question)) return JSON.stringify({operation:"sum",column:"Amount",groupBy:"Date",period:"month"});
    if (/invent/i.test(request.question)) return JSON.stringify({ operation: "sum", column: "Imaginary" });
    if (/largest/i.test(request.question)) return JSON.stringify({ operation: "rows", column: "Amount", direction: "asc", limit: 1 });
    return JSON.stringify({ operation: "sum", column: "Amount", groupBy: "Category" });
  }
  const hasReport = /<facts>\{/.test(last);
  if (/<question>.*invent/is.test(last)) return "Your income grew 37% to $99,999.99 compared with last week.";
  if (!hasReport) return "Upload a CSV with date, description, category and amount columns, covering up to {maxDays} days.";
  const top = /"name":"([^"]+)"/.exec(last)?.[1] ?? "";
  if (last.includes("<question>")) return `Your expenses were {expenses}, and ${top} was the largest at {category:${top}} ({share:${top}} of spending).`;
  return `A strong week: {transactions} transactions brought in {income} against {expenses} of expenses, a net inflow of {net}. ${top} led spending at {category:${top}}.`;
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
      content: [{ type: "text", text: reply(body), ...(body.system?.includes("helpful business assistant")?{citations:[{type:"web_search_result_location",url:"https://www.bom.gov.au/places/vic/melbourne/forecast/",title:"Melbourne forecast",encrypted_index:"test",cited_text:"test forecast"}]}:{}) }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
  });
}).listen(port, "127.0.0.1", () => console.log(`fake anthropic on ${port}`));
