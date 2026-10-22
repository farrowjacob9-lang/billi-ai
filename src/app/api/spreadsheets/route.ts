import { databaseConfigured } from "@/server/db";
import { HttpError, ok, readJson, requireSession, route } from "@/server/http";
import { parseWorkbook } from "@/server/read-workbook";
import { MAX_SHEET_BYTES } from "@/lib/sheet";

export const runtime = "nodejs";

export const POST = route(async request => {
  if (databaseConfigured()) await requireSession();
  const body = await readJson(request, 3 * 1024 * 1024);
  if (typeof body.fileName !== "string" || !/\.xlsx$/i.test(body.fileName) || body.fileName.length > 200 || typeof body.data !== "string") throw new HttpError(400, "invalid_workbook", "Attach an .xlsx workbook.");
  const bytes = Buffer.from(body.data, "base64");
  if (bytes.toString("base64") !== body.data) throw new HttpError(400, "invalid_workbook", "The workbook upload is incomplete. Select the file again.");
  if (!bytes.length || bytes.length > MAX_SHEET_BYTES) throw new HttpError(413, "too_large", "Choose a spreadsheet under 2 MB.");
  try {
    // Parse transiently on Node, rather than relying on browser XML/ZIP implementations.
    const sheets = await parseWorkbook(Uint8Array.from(bytes).buffer, body.fileName);
    if (Buffer.byteLength(JSON.stringify(sheets)) > MAX_SHEET_BYTES) throw new Error("The extracted workbook exceeds 2 MB. Export only the sheet you need.");
    return ok({ sheets });
  } catch (e) { throw new HttpError(422, "invalid_workbook", e instanceof Error ? e.message : "The workbook couldn't be read. Try a fresh .xlsx export."); }
});
