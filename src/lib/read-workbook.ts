import { csvSheet, MAX_SHEET_BYTES, type Sheet } from "./sheet";
import { api } from "./store";

export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if (file.size > MAX_SHEET_BYTES) throw new Error("Choose a spreadsheet under 2 MB.");
  if (/\.csv$/i.test(file.name)) return [csvSheet(await file.text(), file.name)];
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Choose an .xlsx or .csv file. Save older .xls workbooks as .xlsx first.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const { sheets } = await api<{ sheets: Sheet[] }>("/api/spreadsheets", {
    method: "POST", body: JSON.stringify({ fileName: file.name, data: btoa(binary) }),
  });
  return sheets;
}
