"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, FileSpreadsheet, MessageSquare, Paperclip, Play, ShieldCheck, Sparkles, Upload, X, Zap } from "lucide-react";
import { SheetExplorer } from "@/components/SheetExplorer";
import { ReportCard } from "@/components/ReportCard";
import type { Report } from "@/lib/report";
import type { Message, UiError } from "@/lib/types";
import type { Sheet } from "@/lib/sheet";

const ERROR_TITLES: Record<UiError["kind"], string> = {
  file: "Let’s check that file.",
  session: "Your session has ended.",
  server: "We couldn’t finish that.",
};

const STAGES = [
  ["Checking your CSV", "Checking columns, dates and amounts."],
  ["Reconciling the numbers", "Calculating every transaction in integer cents."],
  ["Preparing your report", "Creating the summary and reviewable output."],
];

type Props = {
  sheet: Sheet | null; sheets: Sheet[]; sheetIndex: number; onSelectSheet: (index: number) => void;
  onPrepareSheetReport: () => void;
  report: Report | null; messages: Message[]; busy: boolean; replying: boolean; stage: number; error: UiError | null; privacyNote: string; modeLabel: string;
  onPickFile: () => void; onUpload: (file: File) => void; onRunSample: () => void; onCancel: () => void; onDismissError: () => void;
  onSend: (text: string) => void; onDownloadReport: () => void; onDownloadSample: () => void; onSaveRoutine: () => void; onViewRoutines: () => void;
};

export function WorkspaceView(props: Props) {
  const { report, messages, busy, replying, stage, error, privacyNote, modeLabel } = props;
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const messageEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { if (messages.length) { const body = messageEnd.current?.closest(".conversation-body"); if (body) body.scrollTop = body.scrollHeight; } }, [messages]);

  function send(event: FormEvent) {
    event.preventDefault(); const text = draft.trim(); if (!text || busy || replying) return;
    setDraft(""); props.onSend(text);
  }

  return <>
    <div className="page-heading"><div><h1>Work with your data</h1><p>Upload a spreadsheet. Ask a question. Check the source.</p></div></div>
    {/* The conversation has the whole page until there is a report; then it shares it. */}
    <div className={`workspace-grid ${report || props.sheet ? "split" : "solo"}`}>
      <section className="conversation-column" aria-label="Conversation workspace">
        <div className="section-heading"><h2>Conversation</h2><span><span className="status-dot" /> Ready when you are</span></div>
        <div className={`conversation-card ${dragging ? "dragging" : ""}`} onDragEnter={e => { e.preventDefault(); dragDepth.current++; setDragging(true); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { e.preventDefault(); if (--dragDepth.current <= 0) setDragging(false); }} onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); const file = e.dataTransfer.files[0]; if (file) props.onUpload(file); }}>
          {dragging && <div className="drop-overlay"><Upload size={32} /><strong>Drop your Excel or CSV here</strong><span>Excel is checked on our server without being saved. Up to 2 MB; headings in the first row.</span></div>}
          <div className="conversation-body">
            {messages.length === 0 ? <><div className="assistant-avatar"><Sparkles size={22} strokeWidth={1.6} /></div><h3>What would you like to understand?</h3><p>Upload Excel or CSV to get started. Answers show the calculations and rows they use.</p><div className="starter-actions"><button disabled={busy} onClick={props.onPickFile}><FileSpreadsheet size={16} /> Upload a spreadsheet <ArrowUpRight size={14} /></button><button disabled={busy} onClick={props.onRunSample}><Play size={16} /> Try a sample report <ArrowUpRight size={14} /></button><button onClick={() => setDraft("What format should my spreadsheet use?")}><MessageSquare size={16} /> Help me get started <ArrowUpRight size={14} /></button></div></> : <div className="message-list" aria-live="polite">{messages.map(message => <div className={`message ${message.role}`} key={message.id}>{message.role === "assistant" && <span className="message-avatar"><Sparkles size={15} /></span>}<div>{message.text}</div></div>)}{replying && <div className="message assistant"><span className="message-avatar"><Sparkles size={15} /></span><div className="typing" aria-label="Naxium is replying"><i /><i /><i /></div></div>}<div ref={messageEnd} /></div>}
            {busy && <div className="progress-card" role="status"><span className="spinner" /><div><strong>{STAGES[stage][0]}</strong><small>{STAGES[stage][1]}</small></div><button className="icon-button" aria-label="Cancel report" onClick={props.onCancel}><X size={16} /></button></div>}
            {error && <div className="error-card" role="alert"><div><strong>{ERROR_TITLES[error.kind]}</strong><p>{error.message}</p></div><button className="icon-button" aria-label="Dismiss error" onClick={props.onDismissError}><X size={16} /></button></div>}
          </div>
          <form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">Message Naxium</label><textarea id="message" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask a question, or bring something to work on…" rows={2} maxLength={2000} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><div className="composer-tools"><div><button type="button" className="icon-button" aria-label="Attach spreadsheet" disabled={busy} onClick={props.onPickFile}><Paperclip size={18} /></button><span className="composer-mode"><span /> {modeLabel}</span></div><button type="submit" className="send-button" aria-label="Send message" disabled={!draft.trim() || busy || replying}><ArrowUp size={18} /></button></div></form>
        </div>
        <div className="local-note"><ShieldCheck size={13} /> {privacyNote}</div>

        <button className="template-link" onClick={props.onDownloadSample}><ArrowDownToLine size={14} /> Download the sample CSV <span>See the supported format</span></button>
      </section>

      {props.sheet && <section className="report-column" aria-label="Spreadsheet preview">
        <div className="section-heading"><h2>Your spreadsheet</h2><span>{props.sheet.rows.length.toLocaleString()} rows · {props.sheet.columns.length} columns</span></div>
        <div className="sheet-card">
          <label htmlFor="sheet-select">Active sheet</label>
          <select id="sheet-select" value={props.sheetIndex} onChange={e => props.onSelectSheet(Number(e.target.value))}>{props.sheets.map((s, i) => <option value={i} key={i}>{s.name}</option>)}</select>
          <SheetExplorer key={`${props.sheetIndex}:${props.sheet.name}`} sheet={props.sheet} disabled={busy || replying} onQuestion={question => { setDraft(question); document.getElementById("message")?.focus({ preventScroll: true }); }} />
          <p>Save workspace keeps your parsed data and conversation for 30 days. Unsaved work is removed when you refresh or start a new conversation.</p>
          <button className="secondary-button" disabled={busy} onClick={props.onPrepareSheetReport}>Prepare weekly report</button>
          <p>Weekly reporting needs date, description, category and amount columns, AUD amounts, and at most seven consecutive days.</p>
        </div>
      </section>}
      {report && <section className="report-column" aria-label="Report">
        <div className="section-heading"><h2>Your latest output</h2><span className="output-mode">Ready to review</span></div>
        <ReportCard report={report} isPreview={false} onDownload={props.onDownloadReport} onSave={props.onSaveRoutine} onRun={props.onRunSample} busy={busy} />
        <div className="routine-nudge"><span className="nudge-icon"><Zap size={19} /></span><div><strong>Good work is worth repeating.</strong><p>Once it works for you, make it a routine.</p></div><button className="icon-button" aria-label="View routines" onClick={props.onViewRoutines}><ArrowRight size={18} /></button></div>
      </section>}
    </div>

  </>;
}
