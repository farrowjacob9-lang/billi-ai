import { parseCsv } from "./report.ts";
import Decimal from "decimal.js";

export type Cell = string | number | boolean | null;
export type Sheet = { name: string; columns: string[]; rows: Cell[][]; headerRow?: number };
export type Plan = {
  operation: "sum" | "average" | "min" | "max" | "count" | "rows" | "distinct";
  column?: string;
  groupBy?: string;
  period?: "month" | "year";
  dateAnchor?: "today";
  filters?: { column: string; operator: "equals" | "not_equals" | "contains" | "gt" | "gte" | "lt" | "lte" | "before" | "after"; value: string | number }[];
  direction?: "asc" | "desc";
  limit?: number;
};
export const MAX_SHEET_BYTES = 2 * 1024 * 1024;

export function makeSheet(name: string, grid: Cell[][], headerRow = 1): Sheet {
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 100) throw new Error("Choose a header row between 1 and 100.");
  const trimmed = [...grid];
  while (trimmed.length && trimmed.at(-1)!.every(v => v === null || v === "")) trimmed.pop();
  const [head, ...data] = trimmed;
  if (!head || !data.length) throw new Error("The sheet needs column headings in its first row and at least one data row.");
  const width = Math.max(head.length, ...data.map(r => r.length));
  if (width > 60 || data.length > 10000 || width * data.length > 100000) throw new Error("Choose a sheet with up to 10,000 rows, 60 columns and 100,000 cells.");
  const columns = Array.from({ length: width }, (_, i) => String(head[i] ?? "").trim());
  if (columns.some(c => !c || c.length > 120) || new Set(columns.map(c => c.toLowerCase())).size !== width) throw new Error("Every column needs a unique heading of up to 120 characters. Remove merged or empty headings.");
  const rows = data.map(row => columns.map((_, i) => {
    const cell = row[i] ?? null;
    if (typeof cell === "number" && !Number.isFinite(cell)) throw new Error("The sheet contains an invalid number.");
    if (typeof cell === "string" && cell.length > 2000) throw new Error("A cell exceeds 2,000 characters. Shorten it before uploading.");
    return cell;
  }));
  const sheet = { name: name.slice(0, 200), columns, rows, ...(headerRow !== 1 ? {headerRow} : {}) };
  if (new TextEncoder().encode(JSON.stringify(sheet)).length > MAX_SHEET_BYTES) throw new Error("The extracted sheet is larger than 2 MB. Choose a smaller sheet.");
  return sheet;
}

export function csvSheet(text: string, name: string, headerRow = 1): Sheet {
  if (new TextEncoder().encode(text).length > MAX_SHEET_BYTES) throw new Error("Choose a file under 2 MB.");
  const grid = parseCsv(text, true).slice(headerRow - 1);
  if (grid.some(row => row.length !== grid[0]?.length)) throw new Error("CSV rows have different numbers of fields. Check commas and quoted cells.");
  return makeSheet(name, grid, headerRow);
}

export function validateSheet(value: unknown): Sheet {
  if (!value || typeof value !== "object") throw new Error("Attach a spreadsheet first.");
  const s = value as Sheet;
  if (typeof s.name !== "string" || !Array.isArray(s.columns) || !s.columns.every(c => typeof c === "string") || !Array.isArray(s.rows) || !s.rows.every(r => Array.isArray(r) && r.length === s.columns.length && r.every(c => c === null || ["string", "number", "boolean"].includes(typeof c)))) throw new Error("Invalid spreadsheet data. Upload the file again.");
  return makeSheet(s.name, [s.columns, ...s.rows], s.headerRow ?? 1);
}

// Blank and mixed-text cells are never silently treated as zero.
export function numeric(cell: Cell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== "string") return null;
  const s = cell.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

export function validatePlan(value: unknown, sheet: Sheet): Plan {
  if (!value || typeof value !== "object") throw new Error("Please ask for a total, average, minimum, maximum, count, grouped comparison or matching rows.");
  const p = value as Plan;
  if (!["sum", "average", "min", "max", "count", "rows", "distinct"].includes(p.operation)) throw new Error("I can calculate totals, averages, minimums, maximums and counts, or find matching rows. Please ask one of those questions.");
  if (!["count", "rows"].includes(p.operation) && !sheet.columns.includes(p.column ?? "")) throw new Error("Which numeric column should I use?");
  if (p.column !== undefined && !sheet.columns.includes(p.column) || p.groupBy !== undefined && !sheet.columns.includes(p.groupBy)) throw new Error("That column isn't in this sheet. Use one of the headings shown in the preview.");
  if (p.dateAnchor !== undefined && p.dateAnchor !== "today") throw new Error("Unsupported workflow date anchor.");
  if (p.period !== undefined && (!["month", "year"].includes(p.period) || !p.groupBy)) throw new Error("Choose a date column for monthly or yearly grouping.");
  if (p.operation === "rows" && p.groupBy) throw new Error("Ask for matching rows or a grouped calculation separately.");
  if (p.direction !== undefined && !["asc", "desc"].includes(p.direction) || p.limit !== undefined && (!Number.isInteger(p.limit) || p.limit < 1 || p.limit > 50)) throw new Error("Show between 1 and 50 results, sorted ascending or descending.");
  if (p.filters !== undefined && (!Array.isArray(p.filters) || p.filters.length > 8 || p.filters.some(f => !f || !sheet.columns.includes(f.column) || !["equals", "not_equals", "contains", "gt", "gte", "lt", "lte", "before", "after"].includes(f.operator) || !["string", "number"].includes(typeof f.value) || String(f.value).length > 2000))) throw new Error("I couldn't interpret the filters. Please name the column and value to match.");
  return p;
}

const display = (v: Cell) => v === null || v === "" ? "(blank)" : String(v);
const fmt = (n: Decimal) => {
  const [whole, fraction] = n.toDecimalPlaces(10).toFixed().split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
};

export type SheetResult = { text: string; sourceRows: number[]; matched: number; total: number; values: { label: string; value: number }[] };
export function isoDate(cell: Cell): string | null {
  if (typeof cell !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(cell)) return null;
  const date = new Date(cell + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === cell ? cell : null;
}
export function evaluatePlan(sheet: Sheet, raw: unknown): SheetResult {
  const plan = validatePlan(raw, sheet);
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Melbourne",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const filters = (plan.filters ?? []).map(f => ({...f,value:plan.dateAnchor === "today" && f.value === "$today" ? today : f.value}));
  const matching = sheet.rows.map((row, i) => ({ row, source: i + (sheet.headerRow ?? 1) + 1 })).filter(({ row }) => filters.every(f => {
    const cell = row[sheet.columns.indexOf(f.column)];
    if (f.operator === "equals") return display(cell).toLowerCase() === String(f.value).toLowerCase();
    if (f.operator === "not_equals") return display(cell).toLowerCase() !== String(f.value).toLowerCase();
    if (f.operator === "contains") return display(cell).toLowerCase().includes(String(f.value).toLowerCase());
    if (f.operator === "before" || f.operator === "after") {
      const a = isoDate(cell), b = isoDate(f.value);
      if (!b) throw new Error("Date comparisons need YYYY-MM-DD dates.");
      if (!a) throw new Error(`${f.column} contains blank or non-ISO dates. Confirm the date format before comparing.`);
      return f.operator === "before" ? a < b : a > b;
    }
    const a = numeric(cell), b = numeric(f.value);
    if (a === null || b === null) return false;
    return f.operator === "gt" ? a > b : f.operator === "gte" ? a >= b : f.operator === "lt" ? a < b : a <= b;
  }));
  const scope = `Source: ${sheet.name}. Matched ${matching.length} of ${sheet.rows.length} rows.${filters.length ? ` Filters (all must match): ${filters.map(f => `${f.column} ${f.operator} ${f.value}`).join("; ")}.` : " No filters."}`;
  const values: SheetResult["values"] = [];
  const done = (text: string): SheetResult => ({text, sourceRows: matching.map(e => e.source), matched: matching.length, total: sheet.rows.length, values});
  if (!matching.length) return done(`No rows match this question.\n\n${scope}`);
  const col = sheet.columns.indexOf(plan.column ?? "");
  const limit = plan.limit ?? 20;
  if (plan.operation === "rows") {
    if (col >= 0) matching.sort((a, b) => {
      const x = numeric(a.row[col]), y = numeric(b.row[col]);
      return (x !== null && y !== null ? x - y : display(a.row[col]).localeCompare(display(b.row[col]))) * (plan.direction === "asc" ? 1 : -1);
    });
    return done(`${matching.slice(0, limit).map(({ row, source }) => `Row ${source}: ${sheet.columns.map((c, i) => `${c}: ${display(row[i])}`).join(" · ")}`).join("\n")}\n\nShowing ${Math.min(limit, matching.length)} of ${matching.length} matching rows. ${scope}`);
  }
  const groups = new Map<string, typeof matching>();
  for (const entry of matching) {
    let key = plan.groupBy ? display(entry.row[sheet.columns.indexOf(plan.groupBy)]) : "All rows";
    if (plan.period) {
      if (!isoDate(key)) throw new Error(`${plan.groupBy} contains blank or non-ISO dates. Confirm the date format before grouping.`);
      key = key.slice(0, plan.period === "month" ? 7 : 4);
    }
    const group = groups.get(key) ?? []; group.push(entry); groups.set(key, group);
  }
  const results = [...groups].map(([label, entries]) => {
    const values = entries.map(e => numeric(e.row[col] ?? null)).filter((v): v is number => v !== null);
    if (!["count", "distinct"].includes(plan.operation) && values.length !== entries.length) throw new Error(`${plan.column} contains blank or non-numeric cells in the matching rows. Filter those rows explicitly or clean the column before calculating; I haven't treated them as zero.`);
    const exact = entries.map(e => String(e.row[col] ?? "0").replaceAll(",", ""));
    const total = ["count", "distinct"].includes(plan.operation) ? new Decimal(0) : exact.reduce((a, b) => a.plus(b), new Decimal(0));
    const value = plan.operation === "distinct" ? new Decimal(new Set(entries.map(e => JSON.stringify(e.row[col]))).size) : plan.operation === "count" ? new Decimal(entries.length) : plan.operation === "sum" ? total : plan.operation === "average" ? total.div(values.length) : plan.operation === "min" ? Decimal.min(...exact) : Decimal.max(...exact);
    if (!value.isFinite() || value.abs().greaterThan(Number.MAX_SAFE_INTEGER)) throw new Error("This calculation exceeds the supported numeric range.");
    return { label, value };
  }).sort((a, b) => a.value.comparedTo(b.value) * (plan.direction === "asc" ? 1 : -1));
  values.push(...results.slice(0, limit).map(r => ({label:r.label, value:r.value.toNumber()})));
  const title = `${plan.operation}${plan.column ? ` of ${plan.column}` : " of rows"}${plan.groupBy ? ` by ${plan.groupBy}` : ""}`;
  return done(`${title}:\n${results.slice(0, limit).map(r => `${r.label}: ${fmt(r.value)}`).join("\n")}\n\n${scope}${results.length > limit ? ` Showing ${limit} of ${results.length} groups.` : ""} Calculated in code; units follow the source column. Numeric results are rounded to at most 10 decimal places.`);
}

export function executePlan(sheet: Sheet, raw: unknown): string { return evaluatePlan(sheet, raw).text; }

// Limited, explicit helpers keep basic questions useful without a model connection.
export function simplePlan(question: string, sheet: Sheet): Plan | null {
  const q = question.toLowerCase().replace(/[?!.]+$/, "");
  if (/^(how many (rows|records)|count (the )?(rows|records))$/.test(q)) return { operation: "count" };
  const columns = sheet.columns.filter(c => q.includes(c.toLowerCase()));
  if (columns.length !== 1) return null;
  const column = columns[0];
  if (q === `total ${column.toLowerCase()}` || q === `sum of ${column.toLowerCase()}` || q === `what is the total ${column.toLowerCase()}`) return { operation: "sum", column };
  if (q === `average ${column.toLowerCase()}` || q === `what is the average ${column.toLowerCase()}`) return { operation: "average", column };
  return null;
}
