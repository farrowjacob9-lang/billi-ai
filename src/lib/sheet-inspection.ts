import { numeric, type Sheet } from "./sheet.ts";

export function inspectSheet(sheet: Sheet) {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  const columns = sheet.columns.map(name => ({ name, blanks: 0, numeric: 0, populated: 0 }));
  sheet.rows.forEach((row, index) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicates.push(index);
    seen.add(key);
    row.forEach((cell, i) => {
      if (cell === null || typeof cell === "string" && cell.trim() === "") columns[i].blanks++;
      else {
        columns[i].populated++;
        if (numeric(cell) !== null) columns[i].numeric++;
      }
    });
  });
  return { columns, duplicates };
}

export function suggestedQuestions(sheet: Sheet): string[] {
  const profile = inspectSheet(sheet);
  const amount = profile.columns.find(c => /^(amount|total|cost|value)$/i.test(c.name) && c.numeric === sheet.rows.length)
    ?? profile.columns.find(c => c.numeric === sheet.rows.length);
  const category = sheet.columns.find(c => /^(category|department|type)$/i.test(c));
  return ["How many rows?", ...(amount ? [`Total ${amount.name}`, `Average ${amount.name}`, ...(category ? [`Sum ${amount.name} by ${category}`] : [])] : [])];
}

// Search changes the preview only; calculation plans always use the original sheet.
export function matchingRowIndexes(sheet: Sheet, query: string, mode: "all" | "duplicates" | "blanks", duplicateIndexes: number[]): number[] {
  const needle = query.trim().toLocaleLowerCase();
  const duplicates = new Set(duplicateIndexes);
  return sheet.rows.flatMap((row, index) => {
    if (mode === "duplicates" && !duplicates.has(index)) return [];
    if (mode === "blanks" && !row.some(c => c === null || typeof c === "string" && c.trim() === "")) return [];
    return !needle || row.some(c => String(c ?? "").toLocaleLowerCase().includes(needle)) ? [index] : [];
  });
}
