// A stand-in for Resend's email API so browser tests can follow the emailed links.
// GET /emails?to=<address> returns what was "sent" to that address, newest last.
import { createServer } from "node:http";

const port = Number(process.env.FAKE_RESEND_PORT) || 4011;
const sent: { to: string[]; subject: string; text: string }[] = [];

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  response.setHeader("content-type", "application/json");
  if (request.method === "GET" && url.pathname === "/health") { response.end("{}"); return; }
  if (request.method === "GET" && url.pathname === "/emails") { response.end(JSON.stringify(sent.filter(m => m.to.includes(url.searchParams.get("to") ?? "")))); return; }
  if (request.method !== "POST" || url.pathname !== "/emails") { response.statusCode = 404; response.end("{}"); return; }
  if (request.headers.authorization !== "Bearer test-resend-key") { response.statusCode = 401; response.end("{}"); return; }
  let raw = "";
  request.on("data", chunk => { raw += chunk; });
  request.on("end", () => {
    sent.push(JSON.parse(raw));
    response.end(JSON.stringify({ id: `email_${sent.length}` }));
  });
}).listen(port, "127.0.0.1", () => console.log(`fake resend on ${port}`));
