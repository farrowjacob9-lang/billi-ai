import type { Report } from "../report.ts";

// The model never writes a figure. It writes placeholders such as {income} and code fills in
// the exact calculated value, so a number in the final text can only come from the calculation.
// Any digit, number word or comparison in the model's own words rejects the reply.

const MAX_CATEGORIES = 15, OTHER = "All other categories";
const CONTRACT = { maxDays: "7", maxMegabytes: "2", maxTransactions: "10,000", columns: "4" };

const aud = (cents: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(cents / 100);
const day = (date: string) => new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const percent = (part: number, whole: number) => whole ? `${(part / whole * 100).toFixed(1)}%` : "0.0%";

// Largest categories by name; the rest are folded into one line so a crafted file can't flood the prompt.
function categories(report: Report) {
  const top = report.categories.slice(0, MAX_CATEGORIES);
  const rest = report.categories.slice(MAX_CATEGORIES).reduce((sum, c) => sum + c.cents, 0);
  return rest ? [...top, { name: OTHER, cents: rest }] : top;
}

// What the browser sends to the model routes: totals only, at most sixteen category lines, no narrative.
export const compactForModel = (report: Report): Report =>
  ({ ...report, fileName: report.fileName.slice(0, 200), categories: categories(report), narrative: undefined, narrativeSource: undefined });

export function placeholderValues(report: Report | null): Map<string, string> {
  const values = new Map<string, string>(Object.entries(CONTRACT).map(([k, v]) => [k.toLowerCase(), v]));
  if (!report) return values;
  const entries: [string, string][] = [
    ["income", aud(report.income)], ["expenses", aud(report.expenses)], ["net", aud(Math.abs(report.net))],
    ["transactions", String(report.rowCount)], ["days", String(report.days.length)], ["categories", String(report.categories.length)],
    ["start", day(report.startDate)], ["end", day(report.endDate)], ["expensesshareofincome", percent(report.expenses, report.income)],
  ];
  for (const c of categories(report)) entries.push([`category:${c.name}`, aud(c.cents)], [`share:${c.name}`, percent(c.cents, report.expenses)]);
  for (const d of report.days) entries.push([`income:${d.date}`, aud(d.income)], [`expenses:${d.date}`, aud(d.expenses)], [`date:${d.date}`, day(d.date)]);
  for (const [key, value] of entries) values.set(key.toLowerCase(), value);
  return values;
}

// What the model is told. Values are shown so it can reason, but it must cite them by placeholder.
export function reportFacts(report: Report) {
  const direction = report.net > 0 ? "inflow (income exceeded expenses)" : report.net < 0 ? "outflow (expenses exceeded income)" : "none (income equalled expenses)";
  return {
    currency: "AUD",
    figures: {
      "{income}": aud(report.income), "{expenses}": aud(report.expenses), "{net}": `${aud(Math.abs(report.net))}, net ${direction}`,
      "{transactions}": report.rowCount, "{days}": report.days.length, "{categories}": report.categories.length,
      "{start}": report.startDate, "{end}": report.endDate, "{expensesShareOfIncome}": percent(report.expenses, report.income),
    },
    expenseCategoriesLargestFirst: categories(report).map(c => ({ name: c.name, amount: `{category:${c.name}}`, value: aud(c.cents), share: `{share:${c.name}}`, shareValue: percent(c.cents, report.expenses) })),
    daily: report.days.map(d => ({ date: `{date:${d.date}}`, income: `{income:${d.date}}`, incomeValue: aud(d.income), expenses: `{expenses:${d.date}}`, expensesValue: aud(d.expenses) })),
  };
}

// JSON.stringify leaves < and > alone; escape them so a category name can't close the <facts> block.
export const factsBlock = (report: Report | null) => `<facts>${report ? JSON.stringify(reportFacts(report)).replace(/</g, "\\u003c").replace(/>/g, "\\u003e") : "No report has been prepared yet."}</facts>`;

const NUMBER_WORDS = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|dozens?|half|halves|double[ds]?|twice|triple[ds]?|quarter|third|fourth|fifth|percent|per cent|majority|most of|single|once)\b/i;
const COMPARISONS = /\b(last|previous|prior|next) (week|month|quarter|year|period)\b|\b(compared|versus|vs\.?|year[- ]on[- ]year|growth|grew|increase[sd]?|decrease[sd]?|rose|fell|dropped|up on|down on|forecast|projected?|expect(ed)?|average|typical)\b/i;
const OUTFLOW_WORDS = /\b(loss|deficit|outflow|overspen[dt]|negative|shortfall|in the red)\b/i;
const INFLOW_WORDS = /\b(profit|surplus|inflow|positive|in the black)\b/i;

export type Verification = { ok: true; text: string } | { ok: false; reasons: string[] };

export function fillPlaceholders(raw: string, report: Report | null): Verification {
  const values = placeholderValues(report), reasons: string[] = [];
  const prose = raw.replace(/\{([^{}]{1,240})\}/g, (match, key: string) => { if (!values.has(key.trim().toLowerCase())) reasons.push(`unknown ${match}`); return " "; });
  if (/[{}]/.test(prose)) reasons.push("stray brace");
  if (/\d/.test(prose)) reasons.push("digit written directly");
  if (/[%$€£¥]/.test(prose)) reasons.push("symbol written directly");
  const word = NUMBER_WORDS.exec(prose); if (word) reasons.push(`number word "${word[0]}"`);
  const comparison = COMPARISONS.exec(prose); if (comparison) reasons.push(`comparison "${comparison[0]}"`);
  if (report && report.net >= 0 && OUTFLOW_WORDS.test(prose)) reasons.push("describes an outflow");
  if (report && report.net <= 0 && INFLOW_WORDS.test(prose)) reasons.push("describes an inflow");
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, text: raw.replace(/\{([^{}]{1,240})\}/g, (_m, key: string) => values.get(key.trim().toLowerCase())!) };
}
