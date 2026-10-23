export { isReport, isRoutine } from "@/lib/validate";

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
