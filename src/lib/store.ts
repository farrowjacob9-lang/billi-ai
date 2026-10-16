import { isReport, isRoutine, readSaved, ROUTINE_KEY, RUN_KEY, writeSaved } from "@/lib/browser";
import type { Report } from "@/lib/report";
import type { Routine } from "@/lib/types";

// What the server offers. Without DATABASE_URL the app stays a browser-only prototype.
export type Capabilities = { mode: "local" | "cloud"; ai: boolean; user: { email: string; businessName: string } | null };
export const LOCAL_CAPABILITIES: Capabilities = { mode: "local", ai: false, user: null };

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers }, credentials: "same-origin" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(error?.message || "Something went wrong. Please try again.", response.status, error?.code || "unknown");
  }
  return body as T;
}

export async function loadCapabilities(): Promise<Capabilities> {
  try { return await api<Capabilities>("/api/session"); } catch { return LOCAL_CAPABILITIES; }
}

export interface Store {
  // `saved` is false when the run could not be persisted (local storage unavailable).
  createRun(csv: string, fileName: string, local: Report, signal: AbortSignal): Promise<{ report: Report; saved: boolean }>;
  listRuns(): Promise<Report[]>;
  clearRuns(): Promise<boolean>;
  listRoutines(): Promise<Routine[]>;
  createRoutine(name: string): Promise<Routine | null>;
  deleteRoutine(id: string): Promise<boolean>;
}

// Browser-only: the report is calculated here; only the totals are sent when a model is connected.
export function localStore(caps: Capabilities): Store {
  return {
    async createRun(_csv, _fileName, local, signal) {
      let report = local;
      if (caps.ai) {
        try {
          const result = await api<{ narrative: string | null }>("/api/narrative", { method: "POST", body: JSON.stringify({ report: local }), signal });
          if (result.narrative) report = { ...local, narrative: result.narrative, narrativeSource: "ai" };
        } catch (e) { if (signal.aborted) throw e; }
      }
      signal.throwIfAborted();
      const runs = [report, ...readSaved(RUN_KEY, isReport)].slice(0, 30);
      return { report, saved: writeSaved(RUN_KEY, runs) };
    },
    async listRuns() { return readSaved(RUN_KEY, isReport); },
    async clearRuns() { return writeSaved(RUN_KEY, []); },
    async listRoutines() { return readSaved(ROUTINE_KEY, isRoutine); },
    async createRoutine(name) {
      const routine = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
      return writeSaved(ROUTINE_KEY, [routine, ...readSaved(ROUTINE_KEY, isRoutine)].slice(0, 30)) ? routine : null;
    },
    async deleteRoutine(id) { return writeSaved(ROUTINE_KEY, readSaved(ROUTINE_KEY, isRoutine).filter(r => r.id !== id)); },
  };
}

// Signed in: the server re-validates the CSV, recalculates, writes the narrative and stores the run for this business only.
export function cloudStore(): Store {
  return {
    async createRun(csv, fileName, _local, signal) {
      const { report } = await api<{ report: Report }>("/api/runs", { method: "POST", body: JSON.stringify({ csv, fileName }), signal });
      return { report, saved: true };
    },
    async listRuns() { return (await api<{ runs: Report[] }>("/api/runs")).runs.filter(isReport); },
    async clearRuns() { await api("/api/runs", { method: "DELETE" }); return true; },
    async listRoutines() { return (await api<{ routines: Routine[] }>("/api/routines")).routines.filter(isRoutine); },
    async createRoutine(name) { return (await api<{ routine: Routine }>("/api/routines", { method: "POST", body: JSON.stringify({ name }) })).routine; },
    async deleteRoutine(id) { await api(`/api/routines/${encodeURIComponent(id)}`, { method: "DELETE" }); return true; },
  };
}
