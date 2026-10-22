"use client";
import { useEffect, useRef, useState } from "react";
import { api, type Capabilities } from "@/lib/store";
import {
  validateSnapshot,
  type Snapshot,
  type Decision,
} from "@/lib/workspace";
import type { Message } from "@/lib/types";

type Saved = {
  id: string;
  name: string;
  expires_at: string;
  snapshot?: Snapshot;
};
type Routine = {
  id: string;
  name: string;
  cadence: string;
  workspace_id: string;
  sheet_index: number;
  question: string;
};
type Job = {
  id: string;
  status: string;
  result: string | null;
  error: string | null;
  routine_id: string;
};
async function localDB<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("naxium-saved-work", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("workspaces", { keyPath: "id" });
    req.onerror = () => reject(new Error("Browser storage is unavailable."));
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("workspaces", mode);
      const r = fn(tx.objectStore("workspaces"));
      let result: T;
      r.onsuccess = () => {
        result = r.result;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(new Error("Saved work could not be updated."));
      };
    };
  });
}
export function WorkspaceTools({
  caps,
  snapshot,
  sessionKey,
  onRestore,
  onReview,
  onNotice,
}: {
  caps: Capabilities;
  snapshot: Snapshot | null;
  sessionKey: number;
  onRestore: (s: Snapshot) => void;
  onReview: (id: number, d: Decision) => void;
  onNotice: (s: string) => void;
}) {
  const toolsRef = useRef<HTMLDetailsElement>(null);
  const [saved, setSaved] = useState<Saved[]>([]),
    [active, setActive] = useState(""),
    [name, setName] = useState(""),
    [working, setWorking] = useState(false),
    [theme, setTheme] = useState("light");
  const [usage, setUsage] = useState<{
    used: number;
    limit: number;
    metering: boolean;
    calls: {
      model: string;
      operation: string;
      calls: number;
      input_tokens: string;
      output_tokens: string;
      failures: number;
    }[];
  } | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [cadence, setCadence] = useState("manual");
  const cloud = caps.mode === "cloud";
  useEffect(() => {
    setActive("");
    setName("");
  }, [sessionKey]);
  async function load() {
    if (cloud) {
      try {
        setSaved(
          (await api<{ workspaces: Saved[] }>("/api/workspaces")).workspaces,
        );
      } catch {
        /* Optional until storage is enabled. */
      }
    } else {
      const all = await localDB<Saved[]>("readonly", (s) => s.getAll());
      setSaved(all.filter((w) => Date.parse(w.expires_at) > Date.now()));
      for (const w of all.filter((w) => Date.parse(w.expires_at) <= Date.now()))
        await localDB("readwrite", (s) => s.delete(w.id));
    }
  }
  async function refreshRoutines() {
    if (!cloud) return;
    try {
      const r = await api<{ routines: Routine[]; jobs: Job[] }>(
        "/api/workspace-routines",
      );
      setRoutines(r.routines);
      setJobs(r.jobs);
    } catch {
      /* Setup not complete. */
    }
  }
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "light");
    void load().catch(() => {});
    void refreshRoutines();
  }, [cloud]); // eslint-disable-line react-hooks/exhaustive-deps
  async function perform(fn: () => Promise<void>) {
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setWorking(false);
    }
  }
  async function save() {
    if (!snapshot) return;
    const valid = validateSnapshot(snapshot);
    const title = name.trim() || snapshot.sheets[snapshot.sheetIndex].name;
    const data = cloud
      ? (
          await api<{ workspace: Saved }>("/api/workspaces", {
            method: "POST",
            body: JSON.stringify({
              id: active || undefined,
              name: title,
              snapshot: valid,
            }),
          })
        ).workspace
      : {
          id: active || crypto.randomUUID(),
          name: title,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          snapshot: valid,
        };
    if (!cloud) {
      if (!active && saved.length >= 10)
        throw new Error(
          "Delete a saved workspace first (maximum 10 in this browser).",
        );
      await localDB("readwrite", (s) => s.put(data));
    }
    setActive(data.id);
    setName(title);
    await load();
    onNotice(
      "Workspace saved for 30 days. Save again to include new questions and extend retention.",
    );
  }
  async function open(id: string) {
    const data = cloud
      ? (await api<{ workspace: Saved }>("/api/workspaces/" + id)).workspace
      : await localDB<Saved>("readonly", (s) => s.get(id));
    if (!data?.snapshot) throw new Error("Workspace no longer available.");
    onRestore(validateSnapshot(data.snapshot));
    setActive(id);
    setName(data.name);
    if (toolsRef.current) toolsRef.current.open = false;
    onNotice(`Opened ${data.name}. Your spreadsheet and conversation are ready.`);
    requestAnimationFrame(() => {
      document.querySelector(".page-heading")?.scrollIntoView({ block: "start" });
    });
  }
  async function remove(id: string) {
    if (cloud) await api("/api/workspaces/" + id, { method: "DELETE" });
    else await localDB("readwrite", (s) => s.delete(id));
    if (active === id) {
      setActive("");
      setName("");
    }
    await load();
    await refreshRoutines();
    onNotice(
      "Saved workspace and its routines deleted. The current tab stays open.",
    );
  }
  async function exportFile(format: "xlsx" | "pdf") {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshot, format }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message ?? "Export failed.");
    }
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `naxium-${format === "xlsx" ? "workspace.xlsx" : "report.pdf"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("nx-theme", next);
    } catch {
      /* Preference remains active for this tab. */
    }
  }
  const latest = snapshot?.messages.at(-1);
  const lastPlan =
    latest?.role === "assistant" && latest.plan ? latest : undefined;
  async function routineAction(body: unknown) {
    await api("/api/workspace-routines", {
      method: "POST",
      body: JSON.stringify(body),
    });
    await refreshRoutines();
  }
  return (
    <>
    {saved.length > 0 && <nav aria-label="Saved workspaces" className="saved-work-shortcuts">
      <strong>Saved work</strong>
      {saved.map(w => <button key={w.id} className="secondary-button" disabled={working} aria-current={active === w.id ? "page" : undefined} onClick={() => void perform(() => open(w.id))}>{w.name}</button>)}
      {working && <span role="status">Loading…</span>}
    </nav>}
    <details ref={toolsRef} className="workspace-tools">
      <summary>Saved work, exports & routines</summary>
      <div className="tools-row">
        <strong>Your workspace</strong>
        <button className="secondary-button" onClick={toggleTheme}>
          {theme === "light" ? "Dark theme" : "Light theme"}
        </button>
      </div>
      <div className="tools-row">
        <select
          aria-label="Saved workspaces"
          disabled={working}
          value={active}
          onChange={(e) => {
            if (e.target.value) void perform(() => open(e.target.value));
            else {
              setActive("");
              setName("");
            }
          }}
        >
          <option value="">Save as a new workspace</option>
          {saved.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Workspace name"
          placeholder="Workspace name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="primary-button"
          disabled={!snapshot || working}
          onClick={() => void perform(save)}
        >
          Save workspace
        </button>
        {active && (
          <button
            className="secondary-button"
            disabled={working}
            onClick={() => void perform(() => remove(active))}
          >
            Delete saved workspace
          </button>
        )}
      </div>
      <p>
        Saving keeps the parsed cells and conversation for 30 days{" "}
        {cloud ? "in your business" : "in this browser"}. Uploads are temporary
        until saved. New questions and review decisions need another save.
      </p>
      {snapshot && (
        <div className="tools-row">
          <button
            className="secondary-button"
            disabled={working}
            onClick={() => void perform(() => exportFile("xlsx"))}
          >
            Export Excel
          </button>
          <button
            className="secondary-button"
            disabled={working}
            onClick={() => void perform(() => exportFile("pdf"))}
          >
            Export PDF
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setActive("");
              setName("");
              onNotice("The next save will create a separate workspace.");
            }}
          >
            Save a separate copy
          </button>
        </div>
      )}
      <details>
        <summary>Review answers</summary>
        {snapshot?.messages
          .filter((m) => m.role === "assistant" && m.kind !== "run")
          .map((m) => (
            <AnswerReview
              key={m.id}
              message={m}
              onReview={(d) => onReview(m.id, d)}
            />
          ))}
        {!snapshot?.messages.some(
          (m) => m.role === "assistant" && m.kind !== "run",
        ) && (
          <p>
            Answers will appear here. Approvals and notes are kept beside the
            original answer.
          </p>
        )}
      </details>
      {cloud && (
        <details
          onToggle={(e) => {
            if (e.currentTarget.open)
              void api<typeof usage>("/api/usage")
                .then(setUsage)
                .catch((e) => onNotice(e.message));
          }}
        >
          <summary>AI allowance and activity</summary>
          {usage && (
            <>
              <p>
                {usage.used} of {usage.limit} daily calls used. Allowance resets
                at midnight UTC.
              </p>
              {usage.calls.map((c, i) => (
                <p key={i}>
                  {c.operation} · {c.model}: {c.calls} calls, {c.input_tokens}{" "}
                  input / {c.output_tokens} output tokens, {c.failures} failed.
                </p>
              ))}
              {!usage.metering && (
                <p>
                  Detailed activity will appear after saved-work setup is
                  complete.
                </p>
              )}
              <p>
                Token activity is recorded usage, not a provider invoice. No
                cost estimate is shown without verified model pricing.
              </p>
            </>
          )}
        </details>
      )}
      <details
        onToggle={(e) => {
          if (e.currentTarget.open) void refreshRoutines();
        }}
      >
        <summary>Repeat a calculation</summary>
        <p>
          Routines use the saved spreadsheet snapshot. Update and save the
          workspace when you have new data. No emails or external actions are
          sent.
        </p>
        {cloud ? (
          <>
            <div className="tools-row">
              <select
                aria-label="Routine frequency"
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
              >
                <option value="manual">On demand</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <button
                className="secondary-button"
                disabled={!active || !lastPlan?.plan || working}
                onClick={() =>
                  void perform(() =>
                    routineAction({
                      action: "create",
                      workspaceId: active,
                      sheetIndex: snapshot!.sheetIndex,
                      name: name || "Saved calculation",
                      question:
                        snapshot!.messages
                          .filter((m) => m.role === "user")
                          .at(-1)?.text ?? "Saved calculation",
                      plan: lastPlan!.plan,
                      cadence,
                    }),
                  )
                }
              >
                Save latest calculation as routine
              </button>
            </div>
            <p>
              Save your workspace and ask a calculable question first. Scheduled
              routines require the background worker to be connected.
            </p>
            {routines.map((r) => (
              <div className="saved-routine" key={r.id}>
                <strong>{r.name}</strong>
                <span>{r.cadence}</span>
                <button
                  className="secondary-button"
                  disabled={working}
                  onClick={() =>
                    void perform(() =>
                      routineAction({ action: "run", id: r.id }),
                    )
                  }
                >
                  Run now
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    void perform(() =>
                      routineAction({ action: "delete", id: r.id }),
                    )
                  }
                >
                  Delete routine
                </button>
              </div>
            ))}
            <button
              className="secondary-button"
              onClick={() => void refreshRoutines()}
            >
              Refresh jobs
            </button>
            {jobs.map((j) => (
              <div className="job-result" key={j.id}>
                <strong>{j.status.replace("_", " ")}</strong>
                {j.error && <p>{j.error}</p>}
                {j.result && <pre>{j.result}</pre>}
                {["queued", "running", "needs_input"].includes(j.status) && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void perform(() =>
                        routineAction({ action: "cancel", id: j.id }),
                      )
                    }
                  >
                    Cancel job
                  </button>
                )}
                {j.status === "needs_input" && (
                  <p>
                    Open the saved workspace, clarify the question and save a
                    corrected routine. This run has not been marked complete.
                  </p>
                )}
              </div>
            ))}
          </>
        ) : (
          <p>Sign in to a business workspace to save durable routines.</p>
        )}
      </details>
    </details>
    </>
  );
}
function AnswerReview({
  message,
  onReview,
}: {
  message: Message;
  onReview: (d: Decision) => void;
}) {
  const [note, setNote] = useState(message.decision?.note ?? "");
  return (
    <div className="answer-review">
      <pre>{message.text}</pre>
      <label>
        Review note
        <textarea
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Record a correction or explain your decision"
        />
      </label>
      <div className="tools-row">
        {(["approved", "changed", "excluded"] as const).map((action) => (
          <button
            key={action}
            className="secondary-button"
            disabled={action === "changed" && !note.trim()}
            onClick={() => onReview({ action, note })}
          >
            {action === "approved"
              ? "Approve"
              : action === "changed"
                ? "Record correction"
                : "Exclude"}
          </button>
        ))}
        <span>{message.decision?.action ?? "Not reviewed"}</span>
      </div>
    </div>
  );
}
