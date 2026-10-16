export type Entry = { date: string; description: string; category: string; cents: number };
export type Report = {
  id: string;
  fileName: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  income: number;
  expenses: number;
  net: number;
  rowCount: number;
  days: { date: string; income: number; expenses: number }[];
  categories: { name: string; cents: number }[];
};

export const SAMPLE_CSV = `date,description,category,amount
2026-10-05,Website discovery,Projects,4800.00
2026-10-05,Software subscriptions,Software,-1250.00
2026-10-06,Monthly support,Retainers,3600.00
2026-10-06,Studio rent,Operations,-2400.00
2026-10-07,Brand identity,Projects,5200.00
2026-10-07,Advertising,Marketing,-680.00
2026-10-08,Strategy workshop,Services,2800.00
2026-10-08,Contractor support,People,-960.00
2026-10-09,Development milestone,Projects,4200.00
2026-10-09,Design contractor,People,-1800.00
2026-10-11,Quarterly support,Retainers,3750.00
2026-10-11,Equipment,Operations,-1200.00`;

// Parse quoted CSV fields without splitting commas or newlines inside quotes.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const finishField = () => { row.push(field); field = ""; closed = false; };
  const finishRow = () => { finishField(); if (row.some(value => value.trim() !== "")) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ",") finishField();
    else if (char === "\n" || char === "\r") { if (char === "\r" && text[i + 1] === "\n") i++; finishRow(); }
    else if (char === '"' && field === "" && !closed) quoted = true;
    else if (closed || char === '"') throw new Error("The CSV contains an unexpected quote. Export it again as a standard CSV file.");
    else field += char;
  }
  if (quoted) throw new Error("A quoted field is missing its closing quote. Check the CSV and try again.");
  if (field !== "" || row.length || closed) finishRow();
  return rows;
}

export function createReport(csv: string, fileName: string, id = "preview", now = new Date().toISOString()): Report {
  if (new TextEncoder().encode(csv).length > 2 * 1024 * 1024) throw new Error("This file is larger than 2 MB. Upload a smaller weekly export.");
  const [header, ...rows] = parseCsv(csv);
  if (!header) throw new Error("This file is empty. Add the column headings and at least one transaction.");
  const columns = header.map(x => x.trim().toLowerCase());
  if (new Set(columns).size !== columns.length) throw new Error("The CSV has duplicate column headings. Give each column a unique name.");
  const required = ["date", "description", "category", "amount"];
  const missing = required.filter(x => !columns.includes(x));
  if (missing.length) throw new Error(`Missing ${missing.join(", ")} ${missing.length === 1 ? "column" : "columns"}. Use the sample CSV as a template.`);
  if (!rows.length) throw new Error("No transactions found. Add at least one transaction beneath the headings.");
  if (rows.length > 10000) throw new Error("This export has more than 10,000 transactions. Choose a smaller weekly export.");
  const entries: Entry[] = rows.map((row, index) => {
    const line = index + 2;
    if (row.length !== columns.length) throw new Error(`Record ${line} has ${row.length} fields; expected ${columns.length}. Check commas and quoted values.`);
    const value = (key: string) => row[columns.indexOf(key)].trim();
    const date = value("date"), amount = value("amount");
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error(`Record ${line}: use a real date in YYYY-MM-DD format.`);
    if (!/^-?\d+(\.\d{1,2})?$/.test(amount)) throw new Error(`Record ${line}: amount must be a number with at most two decimal places, without $ signs or thousands separators.`);
    const [whole, fraction = ""] = amount.replace(/^-/, "").split(".");
    const cents = (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) * (amount.startsWith("-") ? -1 : 1);
    if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100000000000) throw new Error(`Record ${line}: amount exceeds the supported range of AUD 1 billion.`);
    if (!value("description") || !value("category")) throw new Error(`Record ${line}: description and category cannot be empty.`);
    return { date, description: value("description"), category: value("category"), cents };
  });
  const dates = entries.map(x => x.date).sort();
  const startDate = dates[0], endDate = dates[dates.length - 1];
  if (Date.parse(endDate) - Date.parse(startDate) > 6 * 86400000) throw new Error("This file covers more than seven calendar days. Choose a single weekly reporting period.");
  const income = entries.reduce((sum, x) => sum + Math.max(x.cents, 0), 0);
  const expenses = entries.reduce((sum, x) => sum + Math.max(-x.cents, 0), 0);
  if (!Number.isSafeInteger(income) || !Number.isSafeInteger(expenses) || !Number.isSafeInteger(income - expenses)) throw new Error("The combined amounts exceed the supported calculation range. Split the export into smaller files.");
  const days: Report["days"] = [];
  for (let time = Date.parse(startDate); time <= Date.parse(endDate); time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10), matching = entries.filter(x => x.date === date);
    days.push({ date, income: matching.reduce((s, x) => s + Math.max(x.cents, 0), 0), expenses: matching.reduce((s, x) => s + Math.max(-x.cents, 0), 0) });
  }
  const categoryTotals = new Map<string, number>();
  for (const entry of entries.filter(x => x.cents < 0)) categoryTotals.set(entry.category, (categoryTotals.get(entry.category) || 0) - entry.cents);
  return { id, fileName, createdAt: now, startDate, endDate, income, expenses, net: income - expenses, rowCount: entries.length, days, categories: [...categoryTotals].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents) };
}

export const money = (cents: number, decimals = false) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: decimals ? 2 : (cents % 100 ? 2 : 0) }).format(cents / 100);
export const shortDate = (date: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
export function narrative(report: Report): string {
  const top = report.categories[0];
  return `${report.rowCount} transactions recorded ${money(report.income, true)} in income and ${money(report.expenses, true)} in expenses, leaving a net ${report.net < 0 ? "outflow" : "inflow"} of ${money(Math.abs(report.net), true)}.${top ? ` ${top.name} was the largest expense category at ${money(top.cents, true)}.` : " No expenses were recorded."}`;
}
export function reportMarkdown(report: Report): string {
  return `# Weekly business report\n\n${shortDate(report.startDate)} – ${shortDate(report.endDate)}\n\nCurrency: AUD\nSource: ${report.fileName}\nTransactions: ${report.rowCount}\n\n## Overview\n\n${narrative(report)}\n\n## Metrics\n\n- Income: ${money(report.income, true)}\n- Expenses: ${money(report.expenses, true)}\n- Net movement: ${money(report.net, true)}\n\n## Expenses by category\n\n${report.categories.map(x => `- ${x.name}: ${money(x.cents, true)}`).join("\n") || "No expenses recorded."}\n\n## Validation\n\nRequired fields, dates, amount precision, reporting period and totals checked. Calculations use integer cents. Every source record is included. Original file unchanged.\n\nThis prototype uses a deterministic narrative template, not an AI model. Positive amounts are treated as income and negative amounts as expenses. This is a transaction summary, not a profit-and-loss statement, tax calculation or bank balance.\n`;
}
