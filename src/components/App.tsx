"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Menu, Settings2 } from "lucide-react";
import { AppDialog } from "@/components/AppDialog";
import { HistoryView, RoutinesView } from "@/components/ListViews";
import { Sidebar } from "@/components/Sidebar";
import { Toast } from "@/components/ui";
import { WorkspaceView } from "@/components/WorkspaceView";
import { compactForModel } from "@/lib/ai/verify";
import { download } from "@/lib/browser";
import { modeCopy } from "@/lib/copy";
import { localReply } from "@/lib/local-reply";
import { createReport, reportMarkdown, SAMPLE_CSV, type Report } from "@/lib/report";
import { AuthScreen } from "@/components/AuthScreen";
import { api, ApiError, cloudStore, localStore, SIGNED_OUT_EVENT, type Capabilities } from "@/lib/store";
import type { Message, Modal, Routine, UiError, View } from "@/lib/types";

const preview = createReport(SAMPLE_CSV, "sample-week.csv", "sample", "2026-10-12T08:00:00Z");
const pause = () => new Promise(resolve => setTimeout(resolve, 180));
const MAX_BYTES = 2 * 1024 * 1024;

// A rejected file is the user's to fix; anything else is the session or our side.
function uiError(e: unknown): UiError {
  if (e instanceof ApiError) {
    if (e.status === 401) return { kind: "session", message: e.message };
    if ([400, 413, 422].includes(e.status)) return { kind: "file", message: e.message };
    return { kind: "server", message: e.message };
  }
  if (e instanceof TypeError) return { kind: "server", message: "We couldn’t reach Billions. Check your connection and try again." };
  return { kind: "file", message: e instanceof Error ? e.message : "We couldn’t read that file. Try a fresh CSV export." };
}

// The server decides the mode (browser-only or accounts) and who is signed in before the first render.
export function App({ caps }: { caps: Capabilities }) {
  const [view, setView] = useState<View>("workspace");
  const [report, setReport] = useState<Report | null>(null);
  const [runs, setRuns] = useState<Report[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [replying, setReplying] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<UiError | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  // Bumped whenever the conversation changes, so a late chat reply can't land in the wrong one.
  const conversation = useRef(0);

  const signedOut = caps.mode === "cloud" && (!caps.user || sessionEnded);
  const store = useMemo(() => caps.mode === "cloud" ? cloudStore() : localStore(caps), [caps]);
  const copy = modeCopy(caps);

  useEffect(() => {
    if (signedOut) return;
    let live = true;
    Promise.all([store.listRuns(), store.listRoutines()])
      .then(([r, t]) => { if (live) { setRuns(r); setRoutines(t); } })
      .catch(() => { if (live) setToast("We couldn’t load your saved work. Refresh to try again."); });
    return () => { live = false; };
  }, [store, signedOut]);
  // Any API call that finds the session expired or revoked returns the user to the sign-in screen.
  useEffect(() => {
    if (!caps.user) return;
    const ended = () => { operation.current++; abort.current?.abort(); setModal(null); setSessionEnded(true); };
    window.addEventListener(SIGNED_OUT_EVENT, ended);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, ended);
  }, [caps.user]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => () => { operation.current++; abort.current?.abort(); }, []);

  const say = (role: Message["role"], text: string, kind?: Message["kind"]) => setMessages(previous => [...previous, { id: Date.now() + Math.random(), role, text, kind }]);
  function navigate(next: View) { setView(next); setMobileNav(false); }
  function cancelRun() { operation.current++; abort.current?.abort(); setBusy(false); }
  function openRun(run: Report, clearMessages: boolean) { cancelRun(); conversation.current++; setReplying(false); setReport(run); setError(null); if (clearMessages) setMessages([]); navigate("workspace"); }
  function newConversation() { conversation.current++; setReplying(false); cancelRun(); setReport(null); setMessages([]); setError(null); navigate("workspace"); }

  async function runCsv(csv: string, fileName: string) {
    cancelRun(); conversation.current++; setReplying(false);
    const current = ++operation.current, controller = new AbortController();
    abort.current = controller;
    const stale = () => operation.current !== current;
    navigate("workspace"); setBusy(true); setStage(0); setError(null); setReport(null);
    say("user", `Prepare a weekly report from ${fileName}.`, "run");
    try {
      await pause(); if (stale()) return;
      const local = createReport(csv, fileName, crypto.randomUUID());
      setStage(1); await pause(); if (stale()) return;
      setStage(2);
      const [{ report: result, saved }] = await Promise.all([store.createRun(csv, fileName, local, controller.signal), pause()]);
      if (stale()) return;
      setReport(result);
      setRuns(previous => [result, ...previous.filter(r => r.id !== result.id)].slice(0, 30));
      if (!saved) setToast("Browser storage is unavailable. You can still download this report, but history won’t survive a refresh.");
      say("assistant", `Your report is ready. I checked all ${result.rowCount} transactions and reconciled the totals. Review the report and its checks on the right. Your original file is unchanged.`, "run");
    } catch (e) {
      if (stale() || controller.signal.aborted) return;
      setError(uiError(e));
    } finally { if (!stale()) setBusy(false); }
  }

  async function upload(file: File) {
    if (busy) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError({ kind: "file", message: "Choose a .csv file. Excel files aren’t supported in this first version; export the sheet as CSV first." }); navigate("workspace"); return; }
    if (file.size > MAX_BYTES) { setError({ kind: "file", message: "This file is larger than 2 MB. Upload a smaller weekly export." }); navigate("workspace"); return; }
    let text: string;
    try { text = await file.text(); } catch { setError({ kind: "file", message: "The file could not be opened. Please select it again." }); return; }
    await runCsv(text, file.name);
  }

  async function send(text: string) {
    say("user", text);
    if (!caps.ai) { say("assistant", localReply(text, report)); return; }
    const asked = conversation.current, about = report;
    setReplying(true);
    let answer: string;
    try {
      const history = messages.filter(m => m.kind !== "run").slice(-8).map(({ role, text }) => ({ role, text }));
      const { reply } = await api<{ reply: string | null }>("/api/chat", { method: "POST", body: JSON.stringify({ question: text, report: about && compactForModel(about), history }) });
      answer = reply || localReply(text, about, true);
    } catch (e) { answer = e instanceof ApiError && e.status === 429 ? e.message : localReply(text, about, true); }
    if (conversation.current !== asked) return;
    setReplying(false);
    say("assistant", answer);
  }

  async function saveRoutine(name: string) {
    try {
      const routine = await store.createRoutine(name);
      if (!routine) { setToast("Browser storage is unavailable, so the routine couldn’t be saved."); return; }
      setRoutines(previous => [routine, ...previous].slice(0, 30)); setModal(null); setToast(copy.routineSaved);
    } catch (e) { setToast(e instanceof ApiError ? e.message : "The routine couldn’t be saved. Please try again."); }
  }

  async function deleteRoutine(routine: Routine) {
    try { if (await store.deleteRoutine(routine.id)) { setRoutines(previous => previous.filter(r => r.id !== routine.id)); setToast("Routine removed."); } }
    catch { setToast("The routine couldn’t be removed. Please try again."); }
  }

  async function deleteRun(run: Report) {
    const remove = () => setRuns(previous => previous.filter(r => r.id !== run.id));
    try { if (await store.deleteRun(run.id)) { remove(); setToast("Report deleted."); } }
    catch (e) {
      if (e instanceof ApiError && e.status === 404) { remove(); setToast("That report was already deleted."); }
      else setToast("The report couldn’t be deleted. Please try again.");
    }
  }

  async function clearHistory() {
    try { if (await store.clearRuns()) { setRuns([]); setToast(copy.historyCleared); } }
    catch { setToast("History couldn’t be cleared. Please try again."); }
  }

  async function signOut() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* the session cookie is cleared server-side either way */ }
    window.location.reload();
  }

  const runSample = () => void runCsv(SAMPLE_CSV, "sample-week.csv");
  if (signedOut) return <AuthScreen notice={sessionEnded ? "Your session has ended. Sign in again to pick up where you left off." : undefined} />;
  const title = view === "routines" ? "Your routines" : view === "history" ? "Run history" : "Overview";

  return <div className="app-shell">
    <Sidebar view={view} open={mobileNav} runs={runs} routineCount={routines.length} workspaceName={copy.workspaceName} workspaceDetail={copy.workspaceDetail} accountLabel={copy.accountLabel} accountDetail={copy.accountDetail}
      onNavigate={navigate} onNewConversation={newConversation} onOpenRun={run => openRun(run, false)} onSettings={() => setModal("settings")} onClose={() => setMobileNav(false)} />

    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><button className="breadcrumb-link" onClick={() => navigate("workspace")}>Workspace</button><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-right"><span className="prototype-badge"><span /> {copy.badge}</span><button className="icon-button" aria-label="Workspace settings" onClick={() => setModal("settings")}><Settings2 size={18} /></button></div></header>
      <div className="page-content">
        {view === "workspace" ? <WorkspaceView report={report} preview={preview} messages={messages} busy={busy} replying={replying} stage={stage} error={error} privacyNote={copy.privacyNote} modeLabel={copy.modeLabel}
          onPickFile={() => fileInput.current?.click()} onUpload={file => void upload(file)} onRunSample={runSample} onCancel={() => { cancelRun(); setToast("Report cancelled. Your file is unchanged."); }} onDismissError={() => setError(null)}
          onSend={text => void send(text)} onDownloadReport={() => { const r = report || preview; download(`billions-report-${r.startDate}.md`, reportMarkdown(r), "text/markdown"); }}
          onDownloadSample={() => download("billions-sample.csv", SAMPLE_CSV, "text/csv")} onSaveRoutine={() => setModal("routine")} onViewRoutines={() => navigate("routines")} />
          : view === "history" ? <HistoryView runs={runs} storageNote={copy.storageNote} onOpen={run => openRun(run, true)} onDelete={run => void deleteRun(run)} onClear={() => void clearHistory()} onRunSample={runSample} />
          : <RoutinesView routines={routines} storageNote={copy.storageNote} banner={copy.routinesBanner} onCreate={() => setModal("routine")} onDelete={routine => void deleteRoutine(routine)} onRun={() => fileInput.current?.click()} />}
      </div>
    </main>

    <input className="sr-only" type="file" accept=".csv,text/csv" aria-label="Upload weekly CSV" ref={fileInput} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    <AppDialog modal={modal} settings={copy.settings} onClose={() => setModal(null)} onSaveRoutine={saveRoutine} onManageHistory={() => { setModal(null); navigate("history"); }} onSignOut={caps.user ? () => void signOut() : undefined} />
    {toast && <Toast text={toast} onDismiss={() => setToast("")} />}
  </div>;
}
