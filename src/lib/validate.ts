import type { Report } from "./report.ts";
import type { Routine } from "./types.ts";

const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));

export const isReport = (v: unknown): v is Report => {
  if (!v || typeof v !== "object") return false;
  const r = v as Report;
  return typeof r.id === "string" && typeof r.fileName === "string" && typeof r.createdAt === "string" && Number.isFinite(Date.parse(r.createdAt))
    && isDate(r.startDate) && isDate(r.endDate) && [r.income, r.expenses, r.net, r.rowCount].every(Number.isSafeInteger)
    && Array.isArray(r.days) && r.days.length <= 7 && r.days.every(d => d && isDate(d.date) && Number.isSafeInteger(d.income) && Number.isSafeInteger(d.expenses))
    && Array.isArray(r.categories) && r.categories.every(c => c && typeof c.name === "string" && Number.isSafeInteger(c.cents))
    && (r.narrative === undefined || (typeof r.narrative === "string" && r.narrative.length <= 2000))
    && (r.narrativeSource === undefined || r.narrativeSource === "ai" || r.narrativeSource === "template");
};

export const isRoutine = (v: unknown): v is Routine => !!v && typeof v === "object" && typeof (v as Routine).id === "string" && typeof (v as Routine).name === "string" && typeof (v as Routine).createdAt === "string";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// Rejects a report whose totals don't add up, so a hand-edited payload can't steer the model.
export const isConsistentReport = (r: Report) => r.days.length >= 1 && r.rowCount >= 1 && r.rowCount <= 10000 && r.categories.length <= 10000
  && r.income >= 0 && r.expenses >= 0 && r.days.every(d => d.income >= 0 && d.expenses >= 0)
  && r.net === r.income - r.expenses && sum(r.days.map(d => d.income)) === r.income && sum(r.days.map(d => d.expenses)) === r.expenses
  && sum(r.categories.map(c => c.cents)) === r.expenses && r.categories.every(c => c.cents > 0 && c.name.length <= 200)
  && r.days[0].date === r.startDate && r.days[r.days.length - 1].date === r.endDate;
