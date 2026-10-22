import { makeSheet, type Cell, type Sheet } from "../lib/sheet.ts";
import { WorkbookReadError, workbookFailureKind } from "../lib/workbook-error.ts";
import { randomUUID } from "node:crypto";

export async function parseWorkbook(buffer: ArrayBuffer, fileName: string): Promise<Sheet[]> {
  // Bound declared uncompressed ZIP sizes before the workbook parser allocates cells.
  const view = new DataView(buffer);
  let end = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("This isn't a readable Excel workbook. Save it again as .xlsx.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true), expanded = 0;
  if (count > 1000 || count === 65535) throw new Error("This workbook is too complex. Export the sheet you need as CSV.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error("The workbook archive is damaged.");
    expanded += view.getUint32(offset + 24, true);
    if (expanded > 20 * 1024 * 1024) throw new Error("The expanded workbook exceeds 20 MB. Export the sheet you need as CSV.");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  let workbook: import("exceljs").Workbook;
  try {
    const { default: ExcelJS } = await import("exceljs");
    workbook = new ExcelJS.Workbook();
    // ExcelJS's declaration calls its input an ArrayBuffer, but its Node entry
    // point supports/recommends Buffer. Avoid browser-style byte dispatch here.
    const bytes = Buffer.from(buffer);
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (error) {
    const reference = randomUUID().slice(0, 8);
    const kind = workbookFailureKind(error);
    // Do not log the file name, XML, cells, raw parser message or uploaded bytes.
    console.error("[workbook] read failed", { reference, kind, node: process.version, bytes: buffer.byteLength });
    throw new WorkbookReadError(kind, reference);
  }
  if (workbook.worksheets.length > 20) throw new Error("Choose a workbook with at most 20 sheets.");
  const sheets: Sheet[] = [];
  for (const ws of workbook.worksheets) {
    if (ws.state !== "visible" || !ws.rowCount) continue;
    if (ws.rowCount > 10001 || ws.columnCount > 60 || ws.rowCount * ws.columnCount > 100060) throw new Error(`Sheet “${ws.name}” is too large. Export only the rows and columns you need.`);
    const grid: Cell[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row: Cell[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const value = ws.getCell(r, c).value;
        if (value && typeof value === "object") {
          if (value instanceof Date) row.push(value.toISOString().slice(0, 10));
          else if ("formula" in value || "sharedFormula" in value) throw new Error(`Sheet “${ws.name}” contains formulas. Export it as values or CSV so answers don't rely on stale cached results.`);
          else if ("error" in value) throw new Error(`Sheet “${ws.name}” contains an Excel cell error. Fix it before uploading.`);
          else if ("richText" in value) row.push(value.richText.map(t => t.text).join(""));
          else if ("text" in value) row.push(String(value.text));
          else row.push(null);
        } else row.push(value ?? null);
      }
      grid.push(row);
    }
    sheets.push(makeSheet(`${fileName} / ${ws.name}`, grid));
  }
  if (!sheets.length) throw new Error("The workbook has no visible sheets with data.");
  return sheets;
}
