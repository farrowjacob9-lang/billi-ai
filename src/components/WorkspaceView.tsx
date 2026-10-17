"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, FileSpreadsheet, MessageSquare, Paperclip, Play, ShieldCheck, Sparkles, Upload, X, Zap } from "lucide-react";
import { ReportCard } from "@/components/ReportCard";
import type { Report } from "@/lib/report";
import type { Message, UiError } from "@/lib/types";

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
  report: Report | null; preview: Report; messages: Message[]; busy: boolean; replying: boolean; stage: number; error: UiError | null; privacyNote: string; modeLabel: string;
  onPickFile: () => void; onUpload: (file: File) => void; onRunSample: () => void; onCancel: () => void; onDismissError: () => void;
  onSend: (text: string) => void; onDownloadReport: () => void; onDownloadSample: () => void; onSaveRoutine: () => void; onViewRoutines: () => void;
};

export function WorkspaceView(props: Props) {
  const { report, preview, messages, busy, replying, stage, error, privacyNote, modeLabel } = props;
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const messageEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { if (messages.length) messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages]);

  function send(event: FormEvent) {
    event.preventDefault(); const text = draft.trim(); if (!text || busy || replying) return;
    setDraft(""); props.onSend(text);
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span /> A LITTLE MORE CLARITY. A LOT MORE POSSIBILITY.</div><h1>Make room for your best work<span>.</span></h1><p>A thought partner for the everyday. A helping hand for the repetitive.</p></div><span className="heading-art" aria-hidden="true"><Sparkles size={37} strokeWidth={1.2} /><span>✳</span></span></div>
    <div className="workspace-grid">
      <section className="conversation-column" aria-label="Conversation workspace">
        <div className="section-heading"><h2>What’s on your mind?</h2><span><span className="status-dot" /> Ready when you are</span></div>
        <div className={`conversation-card ${dragging ? "dragging" : ""}`} onDragEnter={e => { e.preventDefault(); dragDepth.current++; setDragging(true); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { e.preventDefault(); if (--dragDepth.current <= 0) setDragging(false); }} onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); const file = e.dataTransfer.files[0]; if (file) props.onUpload(file); }}>
          {dragging && <div className="drop-overlay"><Upload size={32} /><strong>Drop your weekly CSV here</strong><span>Your file is checked before anything is saved.</span></div>}
          <div className="conversation-body">
            {messages.length === 0 ? <><div className="assistant-avatar"><Sparkles size={22} strokeWidth={1.6} /></div><h3>Big ideas. Small tasks.<br />Let’s make a start.</h3><p>Bring a spreadsheet and leave with a clearer picture.<br className="desktop-break" /> I’ll take care of the numbers. You keep the decisions.</p><div className="starter-actions"><button disabled={busy} onClick={props.onPickFile}><FileSpreadsheet size={16} /> Prepare my weekly report <ArrowUpRight size={14} /></button><button onClick={() => setDraft("What format should my spreadsheet use?")}><MessageSquare size={16} /> Help me get started <ArrowUpRight size={14} /></button></div></> : <div className="message-list" aria-live="polite">{messages.map(message => <div className={`message ${message.role}`} key={message.id}>{message.role === "assistant" && <span className="message-avatar"><Sparkles size={15} /></span>}<div>{message.text}</div></div>)}{replying && <div className="message assistant"><span className="message-avatar"><Sparkles size={15} /></span><div className="typing" aria-label="Billions is replying"><i /><i /><i /></div></div>}<div ref={messageEnd} /></div>}
            {busy && <div className="progress-card" role="status"><span className="spinner" /><div><strong>{STAGES[stage][0]}</strong><small>{STAGES[stage][1]}</small></div><button className="icon-button" aria-label="Cancel report" onClick={props.onCancel}><X size={16} /></button></div>}
            {error && <div className="error-card" role="alert"><div><strong>{ERROR_TITLES[error.kind]}</strong><p>{error.message}</p></div><button className="icon-button" aria-label="Dismiss error" onClick={props.onDismissError}><X size={16} /></button></div>}
          </div>
          <form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">Message Billions</label><textarea id="message" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask a question, or bring something to work on…" rows={2} maxLength={2000} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><div className="composer-tools"><div><button type="button" className="icon-button" aria-label="Attach CSV" disabled={busy} onClick={props.onPickFile}><Paperclip size={18} /></button><span className="composer-mode"><span /> {modeLabel}</span></div><button type="submit" className="send-button" aria-label="Send message" disabled={!draft.trim() || busy || replying}><ArrowUp size={18} /></button></div></form>
        </div>
        <div className="local-note"><ShieldCheck size={13} /> {privacyNote}</div>

        <div className="section-heading starter-heading"><h2>A good place to start</h2><span>Small steps. Useful outcomes.</span></div>
        <div className="task-grid"><button className="task-card" disabled={busy} onClick={props.onPickFile}><span className="task-icon mint"><FileSpreadsheet size={20} /></span><ArrowUpRight className="task-arrow" size={17} /><h3>Find the story<br />in your spreadsheet.</h3><p>A weekly report, with the<br />numbers checked.</p><span className="task-tag">WEEKLY REPORT</span></button><button className="task-card sample-task" disabled={busy} onClick={props.onRunSample}><span className="task-icon peach"><Play size={19} /></span><ArrowUpRight className="task-arrow" size={17} /><h3>A little curious?<br />Take a look around.</h3><p>Try a sample report.<br />No files needed.</p><span className="task-tag">EXPLORE WITH SAMPLE DATA</span></button></div>
        <button className="template-link" onClick={props.onDownloadSample}><ArrowDownToLine size={14} /> Download the sample CSV <span>See the supported format</span></button>
      </section>

      <section className="report-column" aria-label="Report preview">
        <div className="section-heading"><h2>{report ? "Your latest output" : "From data to a clearer picture"}</h2><span className="output-mode">{report ? "Ready to review" : "A little preview"}</span></div>
        <ReportCard report={report || preview} isPreview={!report} onDownload={props.onDownloadReport} onSave={props.onSaveRoutine} onRun={props.onRunSample} busy={busy} />
        <div className="routine-nudge"><span className="nudge-icon"><Zap size={19} /></span><div><strong>Good work is worth repeating.</strong><p>Once it works for you, make it a routine.</p></div><button className="icon-button" aria-label="View routines" onClick={props.onViewRoutines}><ArrowRight size={18} /></button></div>
      </section>
    </div>
    <footer className="page-footer"><span className="footer-mark">b.</span><span>A little help. A little headspace. A better way to work.</span><span>BUILT FOR YOUR EVERYDAY</span></footer>
  </>;
}
