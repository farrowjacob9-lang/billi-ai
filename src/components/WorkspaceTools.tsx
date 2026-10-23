"use client";
import type {WorkReference} from "@/lib/work-navigation";
import { createPortal } from "react-dom";
import { WorkflowBuilder } from "@/components/WorkflowBuilder";
import { useEffect, useRef, useState } from "react";
import { api, type Capabilities } from "@/lib/store";
import {
  validateSnapshot,
  type Snapshot,
  type Decision,
} from "@/lib/workspace";
import type { Sheet } from "@/lib/sheet";
import type { Message } from "@/lib/types";

type Saved = {
  id: string;
  name: string;
  expires_at: string;
  updated_at?: string;
  snapshot?: Snapshot;
  revision?: string;
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
  onDirty,
  onResults,
  workflowRequest, salesDraft, onCloseSalesDraft, toolsMount, workflowMount, onStatus, onSavedList, onActive, requestedWork, onOpenSource, onContinueChat, onPickInput,
}: {
  workflowRequest:{name:string;token:number}|null;
  caps: Capabilities;
  snapshot: Snapshot | null;
  sessionKey: number;
  onRestore: (s: Snapshot, work:WorkReference) => void;
  onSavedList:(work:WorkReference[])=>void; onActive:(work:WorkReference|null)=>void; requestedWork:{id:string;token:number;messages?:Message[]}|null;
  onOpenSource:(id:string)=>void; onContinueChat:()=>void; onPickInput:()=>void;
  onReview: (id: number, d: Decision) => void;
  onNotice: (s: string) => void;
  onDirty: (dirty: boolean) => void;
  toolsMount: HTMLDivElement|null; workflowMount: HTMLDivElement|null; onStatus:(text:string)=>void;
  salesDraft: boolean; onCloseSalesDraft: () => void;
  onResults: (messages: Message[], source: Sheet) => void;
}) {
  const [flowContainer,setFlowContainer] = useState<HTMLDivElement|null>(null);
  const [toolsContainer,setToolsContainer] = useState<HTMLDivElement|null>(null);
  useEffect(()=> {setFlowContainer(document.createElement("div"));setToolsContainer(document.createElement("div"));},[]);
  useEffect(()=> {if(workflowMount && flowContainer) {workflowMount.appendChild(flowContainer);return ()=>flowContainer.remove();}},[workflowMount,flowContainer]);
  useEffect(()=> {if(toolsMount && toolsContainer) {toolsMount.appendChild(toolsContainer);return ()=>toolsContainer.remove();}},[toolsMount,toolsContainer]);

  const sessionVersion = useRef(sessionKey);
  sessionVersion.current = sessionKey;
  const [saved, setSaved] = useState<Saved[]>([]),
    [active, setActive] = useState(""),
    [name, setName] = useState(""),
    [working, setWorking] = useState(false),
    [theme, setTheme] = useState("light");
  useEffect(()=>onSavedList(saved.map(({id,name,updated_at,expires_at})=>({id,name,updated_at,expires_at}))),[saved,onSavedList]);
  useEffect(()=> {if(requestedWork) void perform(()=>open(requestedWork.id));},[requestedWork]); // eslint-disable-line react-hooks/exhaustive-deps
  const [savedName,setSavedName] = useState("");
  const [baseline, setBaseline] = useState("");
  const [revision, setRevision] = useState<string | undefined>();
  const [autosave, setAutosave] = useState(false);
  const fingerprint = snapshot ? JSON.stringify(snapshot) : "";
  const dirty = !!snapshot && (fingerprint !== baseline || !!active && name.trim() !== savedName);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  useEffect(()=> { onStatus(working ? "Saving…" : dirty ? "Unsaved changes" : active ? "Saved" : ""); }, [working,dirty,active,onStatus]);
  const toolsRef = useRef<HTMLDetailsElement>(null);
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
  const [readiness, setReadiness] = useState<Record<string, boolean> | null>(null);
  const cloud = caps.mode === "cloud";
  useEffect(() => {
    setActive("");
    setName("");
    setBaseline(""); setRevision(undefined); setAutosave(false);
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
  async function save(copy = false, silent = false) {
    if (!snapshot) return;
    const savingSession = sessionVersion.current;
    const valid = validateSnapshot(snapshot);
    const title = name.trim() || snapshot.sheets[snapshot.sheetIndex].name;
    const data = cloud
      ? (
          await api<{ workspace: Saved }>("/api/workspaces", {
            method: "POST",
            body: JSON.stringify({
              id: copy ? undefined : active || undefined,
              revision,
              name: title,
              snapshot: valid,
            }),
          })
        ).workspace
      : {
          id: !copy && active || crypto.randomUUID(),
          revision: crypto.randomUUID(),
          name: title,
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          snapshot: valid,
        };
    if (!cloud) {
      if ((!active || copy) && saved.length >= 10)
        throw new Error(
          "Delete a saved workspace first (maximum 10 in this browser).",
        );
      await localDB("readwrite", (s) => s.put(data));
    }
    if (savingSession !== sessionVersion.current) { await load(); return; }
    onActive({id:data.id,name:title});
    setActive(data.id);
    setName(title);
    setBaseline(fingerprint); setRevision(data.revision); setSavedName(title);
    await load();
    if (!silent) onNotice(
      "Workspace saved for 30 days. Save again to include new questions and extend retention.",
    );
  }
  useEffect(() => {
    if (!autosave || !active || !dirty || working) return;
    const timer = setTimeout(() => void perform(async () => { try { await save(false, true); } catch(e) { setAutosave(false); throw e; } }), 2000);
    return () => clearTimeout(timer);
  }, [autosave, active, dirty, working, fingerprint, name]); // eslint-disable-line react-hooks/exhaustive-deps
  const openVersion=useRef(0);
  async function open(id: string) {
    const openingVersion=++openVersion.current;
    if (dirty && !window.confirm("You have unsaved changes. Open another workspace and discard them?")) {onActive(active?{id:active,name}:null);return;}
    const openingSession = sessionVersion.current;
    const data = cloud
      ? (await api<{ workspace: Saved }>("/api/workspaces/" + id)).workspace
      : await localDB<Saved>("readonly", (s) => s.get(id));
    if (openingSession !== sessionVersion.current || openingVersion !== openVersion.current) return;
    if (!data?.snapshot) throw new Error("Workspace no longer available.");
    const restored = validateSnapshot(data.snapshot);
    setBaseline(JSON.stringify(restored)); setRevision(data.revision); setSavedName(data.name); setAutosave(false);
    onRestore(restored,{id:data.id,name:data.name});
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
      onActive(null);
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
    {flowContainer && createPortal(<WorkflowBuilder workflowRequest={workflowRequest} onLibraryChange={()=>void load().catch(()=>{})} onOpenSource={onOpenSource} onContinueChat={onContinueChat} onPickInput={onPickInput} salesDraft={salesDraft} onCloseSalesDraft={onCloseSalesDraft} snapshot={snapshot} workspaceId={active} cloud={cloud} onResults={onResults} onNotice={onNotice} />,flowContainer)}
    {toolsContainer && createPortal(<details ref={toolsRef} className="workspace-tools">
      <summary>Saved work, exports & routines</summary>
      <p role="status">{working ? "Working…" : dirty ? "Unsaved changes" : active ? "All changes saved" : "No workspace open"}{active && name ? ` · ${name}` : ""}</p>
      <div className="tools-row">
        <strong>Your workspace</strong>
        <a href="/plans">Plan and limits</a>
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
          onClick={() => void perform(() => save())}
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
      {active && <div className="tools-row"><label><input type="checkbox" checked={autosave} onChange={e => setAutosave(e.target.checked)} /> Autosave changes to this saved workspace (extends 30-day retention)</label><button className="secondary-button" disabled={working || !snapshot} onClick={() => void perform(() => save(true))}>Save a version copy</button></div>}
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
      {cloud && <details onToggle={e => { if (e.currentTarget.open) void api<Record<string, boolean>>("/api/readiness").then(setReadiness).catch(e => onNotice(e.message)); }}><summary>Service connections</summary>{readiness && Object.entries(readiness).map(([key, ready]) => <p key={key}>{({storage:"Saved work",ai:"AI provider",accountEmail:"Account emails",scheduledWorkflows:"Scheduled workflows",billing:"Paid subscriptions"} as Record<string,string>)[key] ?? key}: {ready ? "Configured" : "Not connected"}</p>)}<p>Configuration status does not prove delivery or availability. Scheduled workflows run against saved data, not live bank feeds.</p></details>}
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
    </details>,toolsContainer)}
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
