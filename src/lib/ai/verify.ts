import type { Report } from "../report.ts";

// The model never sees transactions, descriptions or the file name: only these totals.
export function reportFacts(report: Report) {
  return {
    currency: "AUD",
    period: { start: report.startDate, end: report.endDate, days: report.days.length },
    transactions: report.rowCount,
    income: dollars(report.income),
    expenses: dollars(report.expenses),
    netMovement: dollars(report.net),
    expensesByCategory: report.categories.map(c => ({ category: c.name, amount: dollars(c.cents), shareOfExpenses: share(c.cents, report.expenses) })),
    daily: report.days.map(d => ({ date: d.date, income: dollars(d.income), expenses: dollars(d.expenses) })),
  };
}

const dollars = (cents: number) => (cents / 100).toFixed(2);
const share = (part: number, whole: number) => whole ? `${(part / whole * 100).toFixed(1)}%` : null;

// Figures the CSV contract itself mentions, so format questions can be answered without a report.
const CONTRACT_NUMBERS = [2, 4, 7, 10000];
const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const CURRENCY = new RegExp(String.raw`(?:A\$|AU\$|\$|AUD\s?)\s?(-?)(${NUMBER})(\s?(?:k|m|bn|million|thousand|billion)\b)?|(${NUMBER})\s?(?:AUD|dollars)\b`, "gi");
const PERCENT = new RegExp(String.raw`(${NUMBER})\s?(?:%|per\s?cent\b)`, "gi");
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const BARE = new RegExp(String.raw`(?<![\w.])(${NUMBER})(?:st|nd|rd|th)?(?![\w])`, "gi");

const toNumber = (value: string) => Number(value.replace(/,/g, ""));

function allowed(report: Report | null) {
  const cents = new Set<number>(), percents: number[] = [], integers = new Set<number>(CONTRACT_NUMBERS), dates = new Set<string>();
  if (report) {
    for (const value of [report.income, report.expenses, report.net, ...report.categories.map(c => c.cents), ...report.days.flatMap(d => [d.income, d.expenses, d.income - d.expenses])]) cents.add(Math.abs(value));
    const ratios = [...report.categories.flatMap(c => [[c.cents, report.expenses], [c.cents, report.income]]), [report.expenses, report.income], [report.net, report.income]];
    for (const [part, whole] of ratios) if (whole) percents.push(Math.abs(part / whole * 100));
    for (const value of [report.rowCount, report.days.length, report.categories.length]) integers.add(value);
    for (const day of report.days) { dates.add(day.date); integers.add(Number(day.date.slice(8, 10))); integers.add(Number(day.date.slice(0, 4))); }
  }
  return { cents, percents, integers, dates };
}

// A percentage passes when it equals a real share at the precision the model chose to write.
function matchesPercent(text: string, percents: number[]) {
  const decimals = text.includes(".") ? text.split(".")[1].length : 0;
  const value = toNumber(text);
  return decimals <= 2 && percents.some(p => Math.abs(Number(p.toFixed(decimals)) - value) < 1e-9);
}

export type Verification = { ok: boolean; unverified: string[] };

// Every figure in model-written text must equal a calculated total. Anything else, including
// rounded ("$16k") or derived figures we did not compute, fails and the text is not shown.
export function verifyFigures(text: string, report: Report | null): Verification {
  const { cents, percents, integers, dates } = allowed(report);
  const unverified: string[] = [];
  let rest = text.replace(/−/g, "-");
  rest = rest.replace(ISO_DATE, match => { if (!dates.has(match)) unverified.push(match); return " "; });
  rest = rest.replace(CURRENCY, (match, _sign: string, amount: string | undefined, suffix: string | undefined, trailing: string | undefined) => {
    const value = amount ?? trailing ?? "";
    const decimals = value.includes(".") ? value.split(".")[1].length : 0;
    if (suffix || decimals > 2 || !cents.has(Math.round(toNumber(value) * 100))) unverified.push(match.trim());
    return " ";
  });
  rest = rest.replace(PERCENT, (match, value: string) => { if (!matchesPercent(value, percents)) unverified.push(match.trim()); return " "; });
  for (const match of rest.matchAll(BARE)) if (!integers.has(toNumber(match[1]))) unverified.push(match[0]);
  return { ok: unverified.length === 0, unverified };
}
