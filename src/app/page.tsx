"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, Check, CheckCheck, ChevronDown, ChevronRight, CircleCheck, Clock3, FileSpreadsheet, FileText, FolderOpen, History, LayoutGrid, Link2, Menu, MessageSquare, MoreHorizontal, Paperclip, Play, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Upload, X, Zap } from "lucide-react";
import { createReport, money, narrative, reportMarkdown, SAMPLE_CSV, shortDate, type Report } from "@/lib/report";

type View = "workspace" | "routines" | "history";
type Routine = { id: string; name: string; createdAt: string };
type Message = { id: number; role: "user" | "assistant"; text: string };
const RUN_KEY = "billions.runs.v1", ROUTINE_KEY = "billions.routines.v1";
const preview = createReport(SAMPLE_CSV, "sample-week.csv", "sample", "2026-10-12T08:00:00Z");

function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readSaved<T>(key: string, validate: (item: unknown) => item is T): T[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value.filter(validate).slice(0, 30) : []; } catch { return []; }
}
const isReport = (v: unknown): v is Report => {
  if (!v || typeof v !== "object") return false;
  const r = v as Report;
  return typeof r.id === "string" && typeof r.fileName === "string" && typeof r.createdAt === "string" && Number.isFinite(Date.parse(r.createdAt)) && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate) && Number.isFinite(Date.parse(r.startDate)) && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate) && Number.isFinite(Date.parse(r.endDate)) && [r.income, r.expenses, r.net, r.rowCount].every(Number.isSafeInteger) && Array.isArray(r.days) && r.days.length <= 7 && r.days.every(d => d && typeof d.date === "string" && Number.isFinite(Date.parse(d.date)) && Number.isSafeInteger(d.income) && Number.isSafeInteger(d.expenses)) && Array.isArray(r.categories) && r.categories.every(c => c && typeof c.name === "string" && Number.isSafeInteger(c.cents));
};
const isRoutine = (v: unknown): v is Routine => !!v && typeof v === "object" && typeof (v as Routine).id === "string" && typeof (v as Routine).name === "string" && typeof (v as Routine).createdAt === "string";

export default function Home() {
  const [view, setView] = useState<View>("workspace");
  const [report, setReport] = useState<Report | null>(null);
  const [runs, setRuns] = useState<Report[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"routine" | "settings" | null>(null);
  const [routineName, setRoutineName] = useState("Weekly business report");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const operation = useRef(0);
  const dragDepth = useRef(0);
  const messageEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { setRuns(readSaved(RUN_KEY, isReport)); setRoutines(readSaved(ROUTINE_KEY, isRoutine)); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (messages.length) messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages]);
  useEffect(() => { if (modal) dialog.current?.showModal(); else dialog.current?.close(); }, [modal]);
  useEffect(() => () => { operation.current++; }, []);

  function persist<T>(key: string, value: T[]) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { setToast("Browser storage is unavailable. You can still download this report, but history won’t survive a refresh."); }
  }
  function notify(text: string) { setToast(text); }
  function navigate(next: View) { setView(next); setQuery(""); setMobileNav(false); }
  function newConversation() { operation.current++; setBusy(false); setReport(null); setMessages([]); setError(""); setDraft(""); navigate("workspace"); }

  async function runCsv(csv: string, fileName: string) {
    const current = ++operation.current;
    navigate("workspace"); setBusy(true); setStage(0); setError(""); setReport(null);
    setMessages(previous => [...previous, { id: Date.now(), role: "user", text: `Prepare a weekly report from ${fileName}.` }]);
    try {
      await new Promise(resolve => setTimeout(resolve, 180));
      if (operation.current !== current) return;
      const result = createReport(csv, fileName, crypto.randomUUID());
      setStage(1);
      await new Promise(resolve => setTimeout(resolve, 180));
      if (operation.current !== current) return;
      setStage(2);
      await new Promise(resolve => setTimeout(resolve, 180));
      if (operation.current !== current) return;
      setReport(result);
      setRuns(previous => { const next = [result, ...previous].slice(0, 30); persist(RUN_KEY, next); return next; });
      setMessages(previous => [...previous, { id: Date.now(), role: "assistant", text: `Your report is ready. I checked all ${result.rowCount} transactions and reconciled the totals. Review the report and its checks on the right. Your original file is unchanged.` }]);
    } catch (e) {
      if (operation.current === current) setError(e instanceof Error ? e.message : "We couldn’t read that file. Try a fresh CSV export.");
    } finally { if (operation.current === current) setBusy(false); }
  }

  async function upload(file: File) {
    if (busy) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choose a .csv file. Excel files aren’t supported in this first version; export the sheet as CSV first."); navigate("workspace"); return; }
    if (file.size > 2 * 1024 * 1024) { setError("This file is larger than 2 MB. Upload a smaller weekly export."); navigate("workspace"); return; }
    try { const text = await file.text(); await runCsv(text, file.name); } catch { setError("The file could not be opened. Please select it again."); }
  }

  function send(event: FormEvent) {
    event.preventDefault(); const text = draft.trim(); if (!text || busy) return;
    setDraft(""); setMessages(previous => [...previous, { id: Date.now(), role: "user", text }]);
    const lower = text.toLowerCase();
    let reply: string;
    if (report && /expense|spend|cost/.test(lower)) reply = report.categories.length ? `Your expenses total ${money(report.expenses, true)}. ${report.categories.map(c => `${c.name}: ${money(c.cents, true)}`).join("; ")}. These figures include every expense in your uploaded file.` : "There are no negative amounts in this file, so no expenses were recorded.";
    else if (report && /income|revenue|net|summary|summari|report/.test(lower)) reply = narrative(report);
    else if (/format|column|template|csv|upload|spreadsheet/.test(lower)) reply = "Upload a CSV with date, description, category and amount columns. Use YYYY-MM-DD dates, positive amounts for income and negative amounts for expenses, all in AUD. Choose up to seven consecutive days and a file under 2 MB. You can download the sample below.";
    else reply = "This prototype can prepare a weekly transaction report and explain its income and expense totals. Upload a CSV or try the sample to begin. Open-ended AI chat isn’t connected yet.";
    setMessages(previous => [...previous, { id: Date.now() + 1, role: "assistant", text: reply }]);
  }

  function saveRoutine(event: FormEvent) {
    event.preventDefault(); const name = routineName.trim(); if (!name) return;
    const next = [{ id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }, ...routines].slice(0, 30);
    setRoutines(next); persist(ROUTINE_KEY, next); setModal(null); notify("Routine saved in this browser. Run it again with a new weekly CSV.");
  }

  const actual = report || preview;
  const title = view === "routines" ? "Your routines" : view === "history" ? "Run history" : "Your workspace";
  const filteredRuns = runs.filter(r => `${r.fileName} ${shortDate(r.startDate)} ${shortDate(r.endDate)}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="app-shell">
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`} aria-label="Main navigation">
      <a className="brand" href="/" aria-label="Billions home"><span className="brand-mark">b<span>.</span></span>billions<span className="brand-dot">®</span></a>
      <button className="workspace-picker" onClick={() => setModal("settings")}><span className="workspace-avatar">B<span /></span><span>My workspace<small>Personal workspace</small></span><ChevronDown size={15} /></button>
      <button className="new-chat" onClick={newConversation}><Plus size={18} /> New conversation <span>↗</span></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <NavItem active={view === "workspace"} onClick={() => navigate("workspace")} icon={<LayoutGrid size={18} />} label="Overview" />
        <NavItem active={view === "routines"} onClick={() => navigate("routines")} icon={<Zap size={18} />} label="Routines" count={routines.length || undefined} />
        <NavItem active={view === "history"} onClick={() => navigate("history")} icon={<History size={18} />} label="Run history" count={runs.length || undefined} />
      </nav>
      <div className="nav-label recent-label">RECENT WORK <button aria-label="Start a new conversation" onClick={newConversation}><Plus size={15} /></button></div>
      <div className="recent-list">{runs.length ? runs.slice(0, 4).map(run => <button key={run.id} onClick={() => { setReport(run); navigate("workspace"); }}><MessageSquare size={15} /><span>{run.fileName}</span></button>) : <div className="recent-empty">A little quiet here.<br />Your reports will appear as you work.</div>}</div>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><div className="note-symbol"><Sparkles size={17} /></div><strong>A little less busywork.</strong><p>Make room for the work<br />only you can do.</p><span>That’s the idea behind Billions.</span></div>
        <button className="profile" onClick={() => setModal("settings")}><span className="profile-avatar">Y</span><span>Your workspace<small>Local prototype</small></span><Settings2 size={17} /></button>
      </div>
    </aside>

    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{view === "workspace" ? "Overview" : title}</strong></div><div className="topbar-right"><span className="prototype-badge"><span /> Interactive prototype</span><button className="icon-button" aria-label="Workspace settings" onClick={() => setModal("settings")}><Settings2 size={18} /></button></div></header>
      <div className="page-content">
        {view === "workspace" ? <>
          <div className="page-heading"><div><div className="eyebrow"><span /> A LITTLE MORE CLARITY. A LOT MORE POSSIBILITY.</div><h1>Make room for your best work<span>.</span></h1><p>A thought partner for the everyday. A helping hand for the repetitive.</p></div><span className="heading-art" aria-hidden="true"><Sparkles size={37} strokeWidth={1.2} /><span>✳</span></span></div>
          <div className="workspace-grid">
            <section className="conversation-column" aria-label="Conversation workspace">
              <div className="section-heading"><h2>What’s on your mind?</h2><span><span className="status-dot" /> Ready when you are</span></div>
              <div className={`conversation-card ${dragging ? "dragging" : ""}`} onDragEnter={e => { e.preventDefault(); dragDepth.current++; setDragging(true); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { e.preventDefault(); if (--dragDepth.current <= 0) setDragging(false); }} onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); const file = e.dataTransfer.files[0]; if (file) void upload(file); }}>
                {dragging && <div className="drop-overlay"><Upload size={32} /><strong>Drop your weekly CSV here</strong><span>Your file stays in this browser.</span></div>}
                <div className="conversation-body">
                  {messages.length === 0 ? <><div className="assistant-avatar"><Sparkles size={22} strokeWidth={1.6} /></div><h3>Big ideas. Small tasks.<br />Let’s make a start.</h3><p>Bring a spreadsheet and leave with a clearer picture.<br className="desktop-break" /> I’ll take care of the numbers. You keep the decisions.</p><div className="starter-actions"><button disabled={busy} onClick={() => fileInput.current?.click()}><FileSpreadsheet size={16} /> Prepare my weekly report <ArrowUpRight size={14} /></button><button onClick={() => { setDraft("What format should my spreadsheet use?"); }}><MessageSquare size={16} /> Help me get started <ArrowUpRight size={14} /></button></div></> : <div className="message-list" aria-live="polite">{messages.map(message => <div className={`message ${message.role}`} key={message.id}>{message.role === "assistant" && <span className="message-avatar"><Sparkles size={15} /></span>}<div>{message.text}</div></div>)}<div ref={messageEnd} /></div>}
                  {busy && <div className="progress-card" role="status"><span className="spinner" /><div><strong>{["Checking your CSV", "Reconciling the numbers", "Preparing your report"][stage]}</strong><small>{["Checking columns, dates and amounts.", "Calculating every transaction in integer cents.", "Creating the summary and reviewable output."][stage]}</small></div><button className="icon-button" aria-label="Cancel report" onClick={() => { operation.current++; setBusy(false); notify("Report cancelled. Your file is unchanged."); }}><X size={16} /></button></div>}
                  {error && <div className="error-card" role="alert"><div><strong>Let’s check that file.</strong><p>{error}</p></div><button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
                </div>
                <form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">Message Billions</label><textarea id="message" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask a question, or bring something to work on…" rows={2} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><div className="composer-tools"><div><button type="button" className="icon-button" aria-label="Attach CSV" disabled={busy} onClick={() => fileInput.current?.click()}><Paperclip size={18} /></button><span className="composer-mode"><span /> Report assistant</span></div><button type="submit" className="send-button" aria-label="Send message" disabled={!draft.trim() || busy}><ArrowUp size={18} /></button></div></form>
              </div>
              <div className="local-note"><ShieldCheck size={13} /> Files are processed locally. No AI provider is connected yet.</div>

              <div className="section-heading starter-heading"><h2>A good place to start</h2><span>Small steps. Useful outcomes.</span></div>
              <div className="task-grid"><button className="task-card" disabled={busy} onClick={() => fileInput.current?.click()}><span className="task-icon mint"><FileSpreadsheet size={20} /></span><ArrowUpRight className="task-arrow" size={17} /><h3>Find the story<br />in your spreadsheet.</h3><p>A weekly report, with the<br />numbers checked.</p><span className="task-tag">WEEKLY REPORT</span></button><button className="task-card sample-task" disabled={busy} onClick={() => void runCsv(SAMPLE_CSV, "sample-week.csv")}><span className="task-icon peach"><Play size={19} /></span><ArrowUpRight className="task-arrow" size={17} /><h3>A little curious?<br />Take a look around.</h3><p>Try a sample report.<br />No files needed.</p><span className="task-tag">EXPLORE WITH SAMPLE DATA</span></button></div>
              <button className="template-link" onClick={() => download("billions-sample.csv", SAMPLE_CSV, "text/csv")}><ArrowDownToLine size={14} /> Download the sample CSV <span>See the supported format</span></button>
            </section>

            <section className="report-column" aria-label="Report preview">
              <div className="section-heading"><h2>{report ? "Your latest output" : "From data to a clearer picture"}</h2><span className="output-mode">{report ? "Ready to review" : "A little preview"}</span></div>
              <ReportCard report={actual} isPreview={!report} onDownload={() => download(`billions-report-${actual.startDate}.md`, reportMarkdown(actual), "text/markdown")} onSave={() => { setRoutineName("Weekly business report"); setModal("routine"); }} onRun={() => void runCsv(SAMPLE_CSV, "sample-week.csv")} busy={busy} />
              <div className="routine-nudge"><span className="nudge-icon"><Zap size={19} /></span><div><strong>Good work is worth repeating.</strong><p>Once it works for you, make it a routine.</p></div><button className="icon-button" aria-label="View routines" onClick={() => navigate("routines")}><ArrowRight size={18} /></button></div>
            </section>
          </div>
          <footer className="page-footer"><span className="footer-mark">b.</span><span>A little help. A little headspace. A better way to work.</span><span>BUILT FOR YOUR EVERYDAY</span></footer>
        </> : <>
          <div className="page-heading"><div><div className="eyebrow"><span /> {view === "history" ? "A CLEAR RECORD OF THE WORK." : "LESS REPETITION. MORE POSSIBILITY."}</div><h1>{title}<span>.</span></h1><p>{view === "history" ? "Your completed reports, ready to pick up again." : "Keep the useful steps. Bring fresh data next time."}</p></div>{view === "history" ? <button className="secondary-button" disabled={!runs.length} onClick={() => { setRuns([]); persist(RUN_KEY, []); notify("Run history cleared from this browser."); }}><RotateCcw size={15} /> Clear history</button> : <button className="primary-button" onClick={() => setModal("routine")}><Plus size={16} /> New routine</button>}</div>
          {view === "history" ? <section className="list-panel"><div className="list-toolbar"><h2>Completed reports <span>{runs.length}</span></h2><label className="search-box"><Search size={16} /><input aria-label="Search run history" placeholder="Find a report…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>{filteredRuns.length ? <div className="run-list">{filteredRuns.map(run => <button className="run-row" key={run.id} onClick={() => { setReport(run); setMessages([]); navigate("workspace"); }}><span className="task-icon mint"><FileText size={21} /></span><span className="run-info"><strong>{run.fileName}</strong><small>{shortDate(run.startDate)} – {shortDate(run.endDate)} · {run.rowCount} transactions</small></span><span className="run-amount">{money(run.net)}<small>Net movement</small></span><span className="verified"><CircleCheck size={13} /> Checked</span><ChevronRight size={17} /></button>)}</div> : <EmptyState icon={<History size={28} />} title={query ? "No matching reports" : "Your work has a place here."} description={query ? "Try another filename or reporting date." : "Run your first weekly report and find it here whenever you need it."} action={query ? undefined : <button className="primary-button" onClick={() => void runCsv(SAMPLE_CSV, "sample-week.csv")}><Play size={15} /> Try a sample report</button>} />}</section> : <section className="routines-panel"><div className="info-banner"><ShieldCheck size={18} /><p>Routines save the report format and validation rules in this browser. Each run needs a new CSV. Scheduling and shared routines are part of a future release.</p></div>{routines.length ? <div className="routine-grid">{routines.map(routine => <article className="saved-routine" key={routine.id}><div><span className="task-icon mint"><Zap size={21} /></span><button className="icon-button" aria-label={`Delete ${routine.name}`} onClick={() => { const next = routines.filter(r => r.id !== routine.id); setRoutines(next); persist(ROUTINE_KEY, next); notify("Routine removed."); }}><X size={16} /></button></div><span className="task-tag">MANUAL · CSV REPORT</span><h3>{routine.name}</h3><p>Validate your weekly transactions, calculate the totals and prepare a reviewable report.</p><div className="routine-meta"><CheckCheck size={14} /> 4 required columns <span>·</span> AUD</div><button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} /> Run with a new CSV <ArrowRight size={15} /></button></article>)}</div> : <EmptyState icon={<Zap size={28} />} title="Make the next time easier." description="Save your weekly report setup as a routine. The format stays consistent; you bring the new data." action={<button className="primary-button" onClick={() => setModal("routine")}><Plus size={15} /> Create your first routine</button>} />}</section>}
          <p className="storage-note"><FolderOpen size={14} /> History and routine settings are stored only in this browser. Uploaded source files are not saved.</p>
        </>}
      </div>
    </main>

    <input className="sr-only" type="file" accept=".csv,text/csv" aria-label="Upload weekly CSV" ref={fileInput} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    <dialog className="modal" ref={dialog} onCancel={() => setModal(null)} onClick={e => { if (e.target === e.currentTarget) setModal(null); }} aria-labelledby="dialog-title"><div className="modal-content"><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20} /></button>{modal === "routine" ? <><span className="task-icon mint"><Zap size={24} /></span><h2 id="dialog-title">Make good work repeatable.</h2><p>Keep the report format and checks for next time. Your source file and transaction data aren’t included.</p><form onSubmit={saveRoutine}><label htmlFor="routine-name">Routine name</label><input id="routine-name" value={routineName} onChange={e => setRoutineName(e.target.value)} maxLength={80} required autoFocus /><div className="routine-rules"><span><Check size={14} /> Weekly CSV · date, description, category, amount</span><span><Check size={14} /> AUD · income, expenses and net movement</span><span><Check size={14} /> Input checks and reconciled totals</span><span><Check size={14} /> Manual run · saved in this browser</span></div><button className="primary-button" type="submit">Save routine <ArrowRight size={16} /></button></form></> : <><span className="task-icon mint"><Settings2 size={23} /></span><h2 id="dialog-title">A workspace taking shape.</h2><p>You’re exploring the first Billions prototype. CSV reporting works locally; the chat uses a limited set of report helpers.</p><div className="settings-row"><span>Data processing</span><strong>In your browser</strong></div><div className="settings-row"><span>Report narrative</span><strong>Deterministic template</strong></div><div className="settings-row"><span>Currency</span><strong>AUD</strong></div><div className="settings-row"><span>Accounts & cloud storage</span><strong>Not connected</strong></div><p className="modal-footnote">Use sample or non-sensitive data on shared devices. Report summaries in history persist in browser storage until cleared.</p><button className="secondary-button" onClick={() => { setModal(null); navigate("history"); }}>Manage local history <ArrowRight size={16} /></button></>}</div></dialog>
    {toast && <div className="toast" role="status"><CircleCheck size={18} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast("")}><X size={16} /></button></div>}
  </div>;
}

function NavItem({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count?: number }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>{icon}<span>{label}</span>{count ? <small>{count}</small> : null}{active && <span className="active-dot" />}</button>;
}

function ReportCard({ report, isPreview, onDownload, onSave, onRun, busy }: { report: Report; isPreview: boolean; onDownload: () => void; onSave: () => void; onRun: () => void; busy: boolean }) {
  const max = Math.max(...report.days.map(d => Math.max(d.income, d.expenses)), 1);
  const [checksOpen, setChecksOpen] = useState(false);
  return <article className="report-card"><div className="report-cover"><div className="report-cover-top"><span><FileText size={15} /> BUSINESS SNAPSHOT</span><span className="report-cover-mark">b.</span></div><h2>One week.<br />A clearer picture.</h2><div className="report-period">{shortDate(report.startDate)} – {shortDate(report.endDate)}, {report.endDate.slice(0, 4)}<span>{isPreview ? "SAMPLE DATA" : "CSV REPORT"}</span></div><div className="cover-art" aria-hidden="true"><i /><i /><i /><i /></div></div>
    <div className="report-body"><div className="report-title-row"><h3>Weekly business report</h3><span className={isPreview ? "sample-badge" : "verified"}>{isPreview ? "Example" : <><CircleCheck size={12} /> Checked</>}</span></div><div className="report-file"><FileSpreadsheet size={13} /><span>{report.fileName}</span><span>·</span>{report.rowCount} transactions</div>
      <div className="metrics"><div><span>Income <ArrowUpRight size={12} /></span><strong>{money(report.income)}</strong><small>Recorded income</small></div><div><span>Expenses <ArrowDown size={12} /></span><strong>{money(report.expenses)}</strong><small>Recorded outgoings</small></div><div className="net-metric"><span>Net movement</span><strong>{money(report.net)}</strong><small>Income less expenses</small></div></div>
      <div className="chart-title"><strong>The week at a glance</strong><span><i className="income-key" /> Income <i className="expense-key" /> Expenses</span></div><div className="chart" role="img" aria-label={`Daily income and expenses in AUD for ${shortDate(report.startDate)} to ${shortDate(report.endDate)}. Expand daily figures below for exact values.`}><div className="chart-grid"><span /><span /><span /></div>{report.days.map(day => <div className="chart-day" key={day.date}><div className="bar-pair"><span className="bar income-bar" style={{ height: `${Math.max(day.income / max * 100, day.income ? 3 : 0)}%` }} /><span className="bar expense-bar" style={{ height: `${Math.max(day.expenses / max * 100, day.expenses ? 3 : 0)}%` }} /></div><span className="day-label">{new Date(day.date).toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" })}</span></div>)}</div>
      <details className="daily-figures"><summary>View daily figures <ChevronDown size={12} /></summary><table><caption className="sr-only">Daily transaction totals in AUD</caption><thead><tr><th scope="col">Date</th><th scope="col">Income</th><th scope="col">Expenses</th></tr></thead><tbody>{report.days.map(day => <tr key={day.date}><th scope="row">{shortDate(day.date)}</th><td>{money(day.income, true)}</td><td>{money(day.expenses, true)}</td></tr>)}</tbody></table></details>
      <div className="report-insight"><span><Sparkles size={15} /> THE TAKEAWAY <small>Template summary</small></span><p>{narrative(report)}</p></div>
      <button className="checks-toggle" onClick={() => setChecksOpen(!checksOpen)} aria-expanded={checksOpen}><span><ShieldCheck size={16} /><strong>{report.rowCount} records checked. Totals reconciled.</strong></span><ChevronDown className={checksOpen ? "rotated" : ""} size={15} /></button>{checksOpen && <div className="checks-details"><p><Check size={13} /> Required columns and every record present</p><p><Check size={13} /> Valid dates within a seven-day period</p><p><Check size={13} /> Amounts calculated using integer cents</p><p><Check size={13} /> Category and daily totals reconcile</p><p><Check size={13} /> Original file unchanged</p><small>Positive amounts = income; negative amounts = expenses. This is a transaction summary, not an accounting profit figure or bank balance.</small></div>}
      <div className="report-actions">{isPreview ? <button className="primary-button" onClick={onRun} disabled={busy}><Play size={14} /> Try this report <ArrowRight size={15} /></button> : <><button className="primary-button" onClick={onDownload}><ArrowDownToLine size={15} /> Download report</button><button className="save-routine-button" onClick={onSave}><Zap size={14} /> Save routine</button></>}</div>
    </div>
  </article>;
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{description}</p>{action}</div>;
}
