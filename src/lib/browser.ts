import type { Report } from "@/lib/report";
import type { Routine } from "@/lib/types";

export const RUN_KEY = "billions.runs.v1", ROUTINE_KEY = "billions.routines.v1";

export function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readSaved<T>(key: string, validate: (item: unknown) => item is T): T[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value.filter(validate).slice(0, 30) : []; } catch { return []; }
}

// Returns false when storage is unavailable (private mode, quota), so the caller can say so.
export function writeSaved<T>(key: string, value: T[]): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

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
