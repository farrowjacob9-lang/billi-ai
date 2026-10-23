"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, MailCheck, Menu, Settings2 } from "lucide-react";
import { AppDialog, type AccountActions } from "@/components/AppDialog";
import { HistoryView, RoutinesView } from "@/components/ListViews";
import { Sidebar } from "@/components/Sidebar";
import { Toast } from "@/components/ui";
import { WorkspaceTools } from "@/components/WorkspaceTools";
import { WorkspaceView } from "@/components/WorkspaceView";
import { compactForModel } from "@/lib/ai/verify";
import { download } from "@/lib/browser";
import { modeCopy } from "@/lib/copy";
import { localReply } from "@/lib/local-reply";
import { createReport, reportMarkdown, SAMPLE_CSV, type Report } from "@/lib/report";
import { AuthScreen } from "@/components/AuthScreen";
import { api, ApiError, cloudStore, localStore, SIGNED_OUT_EVENT, type Capabilities } from "@/lib/store";
import type { Message, Modal, Routine, UiError, View } from "@/lib/types";
import { readSpreadsheet } from "@/lib/read-workbook";
import { executePlan, simplePlan, type Sheet } from "@/lib/sheet";

const pause = () => new Promise(resolve => setTimeout(resolve, 180));

// A rejected file is the user's to fix; anything else is the session or our side.
function uiError(e: unknown): UiError {
  if (e instanceof ApiError) {
    if (e.status === 401) return { kind: "session", message: e.message };
    if ([400, 413, 422].includes(e.status)) return { kind: "file", message: e.message };
    return { kind: "server", message: e.message };
  }
  if (e instanceof TypeError) return { kind: "server", message: "We couldn’t reach Naxium. Check your connection and try again." };
  return { kind: "file", message: e instanceof Error ? e.message : "We couldn’t read that file. Try a fresh CSV export." };
}

// The server decides the mode (browser-only or accounts) and who is signed in before the first render.
export function App({ caps }: { caps: Capabilities }) {
  const [salesDraft,setSalesDraft] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [view, setView] = useState<View>("workspace");
  const [report, setReport] = useState<Report | null>(null);
  const [workspaceSession,setWorkspaceSession]=useState(0);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheet = sheets[sheetIndex] ?? null;
  const activeSheetRef = useRef(sheet);
  activeSheetRef.current = sheet;
  const [runs, setRuns] = useState<Report[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const sheetMessages = useRef<Record<string, Message[]>>({});
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
  function openRun(run: Report, clearMessages: boolean) { if (unsaved && !window.confirm("Discard unsaved spreadsheet changes and open this report?")) return; sheetMessages.current = {}; setWorkspaceSession(n=>n+1); cancelRun(); conversation.current++; setSheets([]); setReplying(false); setReport(run); setError(null); if (clearMessages) setMessages([]); navigate("workspace"); }
  function newConversation() { if (unsaved && !window.confirm("Discard unsaved changes and start a new conversation?")) return; sheetMessages.current = {}; setWorkspaceSession(n=>n+1); conversation.current++; setReplying(false); cancelRun(); setReport(null); setSheets([]); setMessages([]); setError(null); navigate("workspace"); }

  async function runCsv(csv: string, fileName: string) {
    if (sheet && unsaved && !window.confirm("Save your spreadsheet first if you want to keep it. Continue to the weekly report?")) return;
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
      setReport(result); setSheets([]);
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
    if (unsaved && !window.confirm("Replace the current spreadsheet? Save it first if you want to keep your changes.")) return;
    cancelRun(); conversation.current++; setReplying(false); setBusy(true); setStage(0); setError(null); navigate("workspace");
    const current = operation.current;
    try {
      const loaded = await readSpreadsheet(file, headerRow);
      if (current !== operation.current) return;
      sheetMessages.current = {}; setWorkspaceSession(n=>n+1); setSheets(loaded); setSheetIndex(0); setReport(null); setMessages([]);
      say("user", `Work with ${file.name}.`, "run");
      say("assistant", `Ready: ${loaded[0].rows.length} rows and ${loaded[0].columns.length} columns in ${loaded[0].name}. Ask for a total, an average, a count, a breakdown by category or matching transactions. Use the exact column headings in your questions. Use Save workspace to keep the parsed cells and conversation for 30 days. Otherwise they stay in this tab until you refresh or start a new conversation.`, "run");
    } catch (e) { if (current === operation.current) setError(uiError(e)); }
    finally { if (current === operation.current) setBusy(false); }
  }

  async function send(text: string) {
    say("user", text);
    if (sheet) {
      const workflowIntent = /(?:create|build|make|set up).*?(?:daily.*sales.*review|sales.*workflow)/i.test(text);
      const continuing = /follow.?up date/i.test(text) && messages.some(m => m.role === "user" && /daily sales review/i.test(m.text));
      if (workflowIntent || continuing) {
        setSalesDraft(true);
        say("assistant","I've proposed a daily follow-up review: overdue open deals, follow-ups due today, and missing follow-up dates. Review the proposal above and choose Save sales review. You can change the scope there.");
        requestAnimationFrame(() => document.getElementById("sales-review-draft")?.scrollIntoView({block:"start"}));
        return;
      }
      const asked = conversation.current;
      setReplying(true);
      let answer: string;
      let usedPlan: import("@/lib/sheet").Plan | undefined;
      try {
        const plan = simplePlan(text, sheet);
        if (plan) { answer = executePlan(sheet, plan); usedPlan = plan; }
        else if (caps.ai) {
          const history = messages.filter(m => m.role === "user" && m.kind !== "run").slice(-6).map(m => m.text);
          const result = await api<{ reply: string; plan?: import("@/lib/sheet").Plan }>("/api/sheet-question", { method: "POST", body: JSON.stringify({ sheet, question: text, history }) }); answer = result.reply; usedPlan = result.plan;
        } else answer = `Open-ended questions need an AI connection on this deployment. You can still ask “how many rows”, “total ${sheet.columns[0]}” or “average ${sheet.columns[0]}” (use a numeric column for totals and averages).`;
      } catch (e) { answer = e instanceof Error ? e.message : "The question couldn't be answered. Try again."; }
      if (conversation.current !== asked) return;
      setReplying(false); setMessages(previous => [...previous, {id:Date.now()+Math.random(),role:"assistant",text:answer,...(usedPlan ? {plan:usedPlan}:{})}]); return;
    }
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

  async function resendVerification() {
    try {
      const { verified } = await api<{ sent: boolean; verified: boolean }>("/api/auth/verify/resend", { method: "POST" });
      if (verified) { window.location.reload(); return; }
      setToast(`We’ve sent a new link to ${caps.user?.email}. It works once and expires in 24 hours.`);
    } catch (e) { setToast(e instanceof ApiError ? e.message : "The link couldn’t be sent. Please try again."); }
  }

  const failure = (e: unknown) => e instanceof ApiError ? e.message : "We couldn’t reach Naxium. Check your connection and try again.";
  const account: AccountActions | undefined = caps.user ? {
    async changePassword(currentPassword, newPassword) {
      try {
        await api("/api/account/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
        setModal(null); setToast("Password changed. Every other device has been signed out.");
        return null;
      } catch (e) { return failure(e); }
    },
    async deleteAccount(password) {
      try {
        await api("/api/account/delete", { method: "POST", body: JSON.stringify({ password }) });
        window.location.replace("/");
        return null;
      } catch (e) { return failure(e); }
    },
  } : undefined;

  async function signOut() {
    if (unsaved && !window.confirm("Sign out and discard unsaved changes?")) return;
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* the session cookie is cleared server-side either way */ }
    window.location.reload();
  }

  const runSample = () => { void runCsv(SAMPLE_CSV, "sample-week.csv"); };
  if (signedOut) return <AuthScreen canEmail={caps.email} notice={sessionEnded ? "Your session has ended. Sign in again to pick up where you left off." : undefined} />;
  const unverified = caps.email && caps.user && !caps.user.emailVerified;
  const title = view === "routines" ? "Your routines" : view === "history" ? "Run history" : "Overview";

  return <div className="app-shell">
    <Sidebar view={view} open={mobileNav} runs={runs} routineCount={routines.length} workspaceName={copy.workspaceName} workspaceDetail={copy.workspaceDetail} accountLabel={copy.accountLabel} accountDetail={copy.accountDetail}
      onNavigate={navigate} onNewConversation={newConversation} onOpenRun={run => openRun(run, false)} onSettings={() => setModal("settings")} onClose={() => setMobileNav(false)} />

    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><button className="breadcrumb-link" onClick={() => navigate("workspace")}>Workspace</button><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-right"><span className="prototype-badge"><span /> {copy.badge}</span><button className="icon-button" aria-label="Workspace settings" onClick={() => setModal("settings")}><Settings2 size={18} /></button></div></header>
      <div className="page-content">
        {!signedOut && <WorkspaceTools salesDraft={salesDraft} onCloseSalesDraft={() => setSalesDraft(false)} onResults={(results, source) => { if (activeSheetRef.current !== source) { setToast("The active sheet changed while the workflow ran. Run it again on the selected sheet."); return; } conversation.current++; setReplying(false); setMessages(old => [...old,...results]); navigate("workspace"); }} onDirty={setUnsaved} sessionKey={workspaceSession} caps={caps} snapshot={sheet ? {sheets,sheetIndex,messages,sheetMessages:sheetMessages.current} : null} onRestore={saved => { sheetMessages.current = saved.sheetMessages ?? {}; cancelRun(); conversation.current++; setReport(null); setSheets(saved.sheets); setSheetIndex(saved.sheetIndex); setMessages(saved.messages); setError(null); setReplying(false); navigate("workspace"); }} onReview={(id,decision)=>setMessages(previous=>previous.map(m=>m.id===id?{...m,decision}:m))} onNotice={setToast} />}

        {unverified && <div className="verify-banner" role="status"><MailCheck size={18} /><p>Confirm your email to turn on the AI assistant. We sent a link to <strong>{caps.user!.email}</strong>. Reports work in the meantime.</p><button className="secondary-button" onClick={() => void resendVerification()}>Send a new link</button></div>}
        {view === "workspace" ? <WorkspaceView headerRow={headerRow} onHeaderRow={setHeaderRow} onPrepareSheetReport={() => { if (!sheet) return; const csv = [sheet.columns, ...sheet.rows].map(row => row.map(c => '"' + String(c ?? "").replaceAll('"', '""') + '"').join(",")).join("\n"); void runCsv(csv, sheet.name); }} sheet={sheet} sheets={sheets} sheetIndex={sheetIndex} onSelectSheet={index => { conversation.current++; setReplying(false); sheetMessages.current[sheetIndex] = messages; setSheetIndex(index); setMessages(sheetMessages.current[index] ?? []); setError(null); }} report={report} messages={messages} busy={busy} replying={replying} stage={stage} error={error} privacyNote={sheet ? "Excel workbooks are parsed on our server without being saved. CSV files are parsed in this tab. AI questions are calculated on our server; Claude receives column headings and your questions only. Only Save workspace retains the parsed data and conversation." : copy.privacyNote} modeLabel={copy.modeLabel}
          onPickFile={() => fileInput.current?.click()} onUpload={file => void upload(file)} onRunSample={runSample} onCancel={() => { cancelRun(); setToast("Report cancelled. Your file is unchanged."); }} onDismissError={() => setError(null)}
          onSend={text => void send(text)} onDownloadReport={() => { if (report) download(`billions-report-${report.startDate}.md`, reportMarkdown(report), "text/markdown"); }}
          onDownloadSample={() => download("billions-sample.csv", SAMPLE_CSV, "text/csv")} onSaveRoutine={() => setModal("routine")} onViewRoutines={() => navigate("routines")} />
          : view === "history" ? <HistoryView runs={runs} storageNote={copy.storageNote} onOpen={run => openRun(run, true)} onDelete={run => void deleteRun(run)} onClear={() => void clearHistory()} onRunSample={runSample} />
          : <RoutinesView routines={routines} storageNote={copy.storageNote} banner={copy.routinesBanner} onCreate={() => setModal("routine")} onDelete={routine => void deleteRoutine(routine)} onRun={() => fileInput.current?.click()} />}
      </div>
    </main>

    <input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Upload spreadsheet" ref={fileInput} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    <AppDialog modal={modal} settings={copy.settings} businessName={copy.workspaceName} onClose={() => setModal(null)} onOpen={setModal} onSaveRoutine={saveRoutine} onManageHistory={() => { setModal(null); navigate("history"); }} onSignOut={caps.user ? () => void signOut() : undefined} account={account} />
    {toast && <Toast text={toast} onDismiss={() => setToast("")} />}
  </div>;
}
