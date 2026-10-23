"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUp, ArrowUpRight, FileSpreadsheet, Paperclip, Play, Settings2, Sparkles, Upload, X } from "lucide-react";
import type {MemoryReference} from "@/lib/company-memory";
import { AnswerLearning } from "@/components/AnswerLearning";
import type {MethodRef} from "@/lib/methods";
import type {MethodStorage} from "@/lib/method-store";
import { evaluatePlan } from "@/lib/sheet";
import { SheetAnswer } from "@/components/SheetAnswer";
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
  onMemory:()=>void;onRemember:(message:Message)=>void;onReference:(reference:MemoryReference)=>void; memoryContext?:string;onClearMemory:()=>void;

  advancedWorkflow:boolean;onAdvancedWorkflow:(open:boolean)=>void;
  methodsLibrary:React.ReactNode; methodBusy:boolean; methodStorage:MethodStorage;
  onAcceptAnswer:(message:Message,scope:"once"|"matching")=>Promise<string|null>;
  onCorrectAnswer:(message:Message,text:string)=>Promise<string|null>; onInspectMethod:(ref:MethodRef)=>void;
  blockedTask:string;onFreshTask:()=>void;
  draft:string; onDraft:(draft:string)=>void; threadPosition:React.MutableRefObject<{top:number;follow:boolean}|null>;
  workName?:string;
  panel: "data"|"workflow"|"results"|"manage"|null; onPanel:(panel:"data"|"workflow"|"results"|"manage"|null)=>void;
  onToolsMount:(node:HTMLDivElement|null)=>void; onWorkflowMount:(node:HTMLDivElement|null)=>void; saveStatus:string;
  headerRow: number; onHeaderRow: (row: number) => void;
  sheet: Sheet | null; sheets: Sheet[]; sheetIndex: number; onSelectSheet: (index: number) => void;
  onPrepareSheetReport: () => void;
  report: Report | null; messages: Message[]; busy: boolean; replying: boolean; stage: number; error: UiError | null; privacyNote: string; modeLabel: string;
  onPickFile: () => void; onUpload: (file: File) => void; onRunSample: () => void; onCancel: () => void; onDismissError: () => void;
  onSend: (text: string) => void; onDownloadReport: () => void; onDownloadSample: () => void; onSaveRoutine: () => void; onViewRoutines: () => void;
};

export function WorkspaceView(props: Props) {
  const { report, messages, busy, replying, stage, error } = props;
  const [wide,setWide] = useState(false);
  const [sourceRows,setSourceRows] = useState<number[]|null>(null);
  const {draft,onDraft:setDraft}=props;
  const [dragging,setDragging] = useState(false);
  const [atLatest,setAtLatest] = useState(props.threadPosition.current?.follow ?? true);
  const follow = useRef(props.threadPosition.current?.follow ?? true);
  const body = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  useEffect(()=>{if(body.current && props.threadPosition.current)body.current.scrollTop=props.threadPosition.current.top;},[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>setSourceRows(null),[props.sheet]);
  useEffect(()=>{if(error) props.onPanel(null);},[error,props.onPanel]);
  useEffect(()=> {if(follow.current && body.current) body.current.scrollTop=body.current.scrollHeight;},[messages,replying,error]);
  const closePanel=()=> {const closingFocus=document.activeElement;props.onPanel(null);requestAnimationFrame(()=>{if(document.activeElement===document.body || document.activeElement===closingFocus)document.getElementById("message")?.focus({preventScroll:true});});};
  const inspect=(rows:number[])=> {setSourceRows(rows);props.onPanel("data");};
  function send(event:FormEvent) {event.preventDefault();const text=draft.trim();if(!text || busy || replying)return;setDraft("");follow.current=true;setAtLatest(true);props.onSend(text);}
  function answer(message:Message) {
    if(!message.plan || !props.sheet)return <LinkedText text={message.text}/>;
    let current=false;try{current=evaluatePlan(props.sheet,message.plan).text===message.text;}catch{/* Historical answer remains text. */}
    return <><SheetAnswer sheet={props.sheet} plan={message.plan} text={message.text} onSources={inspect}/>{current && <AnswerLearning key={message.id} message={message} disabled={busy||replying||props.methodBusy} storage={props.methodStorage} onAccept={props.onAcceptAnswer} onCorrect={props.onCorrectAnswer} onInspect={props.onInspectMethod}/>}</>;
  }
  const results=messages.filter(m=>m.plan && m.role==="assistant");
  return <div className={`chat-workspace ${wide ? "workbench-wide" : ""} ${props.panel ? "with-workbench" : ""}`}>
    <h1 className="sr-only">Naxium conversation</h1>
    <div className="chat-toolbar">
      <div className="thread-title"><strong>{props.workName || (props.sheet ? props.sheet.name.split(" / ").at(-1) : report ? report.fileName : "New conversation")}</strong><small role="status">{props.saveStatus}</small></div>
      <div className="workbench-tabs" role="tablist" aria-label="Workbench" onKeyDown={e=>{
        if (!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
        const tabs=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
        const index=tabs.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;
        e.preventDefault();const next=e.key==="Home"?0:e.key==="End"?tabs.length-1:(index+(e.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
        tabs[next].focus();tabs[next].click();
      }}>
        {(["data","workflow","results"] as const).map(tab=><button key={tab} role="tab" aria-selected={props.panel===tab} aria-controls={`pane-${tab}`} disabled={tab==="data" && !props.sheet} onClick={()=>props.onPanel(props.panel===tab?null:tab)}>{tab==="data"?"Data":tab==="workflow"?"Workflow":"Results"}</button>)}
        <button aria-label="Company memory" onClick={props.onMemory}>Memory</button>
        <button aria-label="Workspace tools" title="Save, export and settings" onClick={()=>props.onPanel(props.panel==="manage"?null:"manage")}><Settings2 size={17}/></button>
      </div>
    </div>
    <div className="chat-workspace-body">
      <section className="conversation-column" aria-label="Conversation workspace">
        <div className={`conversation-card ${dragging?"dragging":""}`} onDragEnter={e=>{e.preventDefault();dragDepth.current++;setDragging(true);}} onDragOver={e=>e.preventDefault()} onDragLeave={e=>{e.preventDefault();if(--dragDepth.current<=0)setDragging(false);}} onDrop={e=>{e.preventDefault();dragDepth.current=0;setDragging(false);const file=e.dataTransfer.files[0];if(file)props.onUpload(file);}}>
          {dragging && <div className="drop-overlay"><Upload size={28}/><strong>Drop your file here</strong><span>Excel, CSV or PDF · up to 2 MB</span></div>}
          <div className={`conversation-body ${messages.length?"has-messages":"empty-thread"}`} ref={body} onScroll={e=>{const el=e.currentTarget;const latest=el.scrollHeight-el.scrollTop-el.clientHeight<80;follow.current=latest;setAtLatest(latest);props.threadPosition.current={top:el.scrollTop,follow:latest};}}>
            {!messages.length ? <div className="chat-welcome"><Sparkles size={28}/><h2>What would you like to work on?</h2><p>Bring a spreadsheet or PDF quote. Ask a question. Build a way of working.</p><div className="starter-actions"><button disabled={busy} onClick={props.onPickFile}><FileSpreadsheet size={17}/> Upload a file</button><button disabled={busy} onClick={props.onRunSample}><Play size={17}/> Try a sample report</button><button onClick={()=>{setDraft("Help me work with this spreadsheet.");document.getElementById("message")?.focus();}}>Help with a task <ArrowUpRight size={15}/></button></div></div>
              : <div className="message-list" aria-live="polite">{messages.map(message=><div className={`message ${message.role}`} key={message.id}>{message.role==="assistant" && <span className="message-avatar"><Sparkles size={15}/></span>}<div>{answer(message)}{message.memoryReferences && <section className="memory-citations" aria-label="Sources behind this answer">{message.memoryReferences.map((r,i)=><button className="memory-citation" key={i} onClick={()=>props.onReference(r)}><strong>{r.title}</strong><small>{r.kind==="memory"?"Company memory":"Saved work"}{r.row?` · row ${r.row}`:""} · {new Date(r.updatedAt).toLocaleDateString()}</small><span>{r.excerpt}</span></button>)}</section>}{message.role==="assistant"&&message.kind!=="run"&&<button className="remember-answer text-button" onClick={()=>props.onRemember(message)}>Keep in company memory</button>}</div></div>)}{replying && <div className="message assistant"><span className="message-avatar"><Sparkles size={15}/></span><div className="typing" aria-label="Naxium is replying"><i/><i/><i/></div></div>}</div>}
            {props.blockedTask && <div className="method-repair" role="status"><p>Your established approach has not run on this input.</p><button className="secondary-button" onClick={()=>props.onPanel("workflow")}>Inspect approaches</button><button className="text-button" onClick={props.onFreshTask} disabled={busy||replying}>Run as a new task</button></div>}
            {busy && <div className="progress-card" role="status"><span className="spinner"/><div><strong>{STAGES[stage][0]}</strong><small>{STAGES[stage][1]}</small></div><button className="icon-button" aria-label="Cancel report" onClick={props.onCancel}><X size={16}/></button></div>}
            {error && <div className="error-card" role="alert"><div><strong>{ERROR_TITLES[error.kind]}</strong><p>{error.message}</p></div><button className="icon-button" aria-label="Dismiss error" onClick={props.onDismissError}><X size={16}/></button></div>}
          </div>
          {!atLatest && <button className="jump-latest secondary-button" onClick={()=>{if(body.current)body.current.scrollTop=body.current.scrollHeight;follow.current=true;setAtLatest(true);}}>Jump to latest ↓</button>}
          <div className="composer-wrap">
            {props.memoryContext && <div className="memory-context" role="status">Reference: <strong>{props.memoryContext}</strong><button className="text-button" onClick={props.onClearMemory}>Remove reference</button></div>}
            {props.sheet && <button className="attached-file" onClick={()=>props.onPanel("data")}><FileSpreadsheet size={14}/><span>{props.sheet.name}</span><small>{props.sheet.rows.length} rows</small></button>}
            <form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">Message Naxium</label><textarea id="message" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Tell Naxium what you want to get done…" rows={2} maxLength={2000} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><div className="composer-tools"><div><button type="button" className="icon-button" aria-label="Attach spreadsheet or PDF" disabled={busy} onClick={props.onPickFile}><Paperclip size={18}/></button><span className="composer-mode">{replying?"Working on your question…":"Naxium"}</span></div><button type="submit" className="send-button" aria-label="Send message" disabled={!draft.trim()||busy||replying}><ArrowUp size={18}/></button></div></form>
            <details className="privacy-disclosure"><summary>How your data is handled</summary><p>{props.privacyNote}</p></details>
          </div>
        </div>
      </section>
      <aside className="workbench" aria-label="Workbench panel" hidden={!props.panel}>
        <header className="workbench-heading"><strong>{props.panel==="manage"?"Workspace tools":props.panel==="workflow"?"Workflow":props.panel==="results"?"Results":"Your data"}</strong><button className="panel-width-control" onClick={()=>setWide(!wide)}>{wide ? "Narrow panel" : "Widen panel"}</button><button className="icon-button" aria-label="Back to conversation" onClick={closePanel}><X size={18}/></button></header>
        <div className="workbench-pane" id="pane-data" hidden={props.panel!=="data"}>
          {props.sheet && <section className="report-column" aria-label="Spreadsheet preview"><div className="section-heading"><h2>Your spreadsheet</h2><span>{props.sheet.rows.length} rows · {props.sheet.columns.length} columns</span></div><div className="sheet-card"><label htmlFor="sheet-select">Active sheet</label><select id="sheet-select" value={props.sheetIndex} onChange={e=>props.onSelectSheet(Number(e.target.value))}>{props.sheets.map((s,i)=><option value={i} key={i}>{s.name}</option>)}</select><SheetExplorer key={`${props.sheetIndex}:${props.sheet.name}`} sheet={props.sheet} sourceRows={sourceRows} onClearSources={()=>setSourceRows(null)} disabled={busy||replying} onQuestion={question=>{setDraft(question);document.getElementById("message")?.focus({preventScroll:true});}}/><details className="sheet-checks"><summary>Weekly report</summary><button className="secondary-button" disabled={busy} onClick={props.onPrepareSheetReport}>Prepare weekly report</button><p>Needs date, description, category and amount columns, AUD values and at most seven consecutive days.</p></details></div></section>}
        </div>
        <div className="workbench-pane" id="pane-workflow" hidden={props.panel!=="workflow"}>{props.methodsLibrary}<details open={props.advancedWorkflow} onToggle={e=>props.onAdvancedWorkflow(e.currentTarget.open)}><summary>Advanced calculation workflows</summary><div ref={props.onWorkflowMount}/></details></div>
        <div className="workbench-pane" id="pane-results" hidden={props.panel!=="results"}>
          {report && <section aria-label="Report"><ReportCard report={report} isPreview={false} onDownload={props.onDownloadReport} onSave={props.onSaveRoutine} onRun={props.onRunSample} busy={busy}/></section>}
          {props.sheet && results.map(m=><article className="result-item" key={m.id}><SheetAnswer sheet={props.sheet!} plan={m.plan!} text={m.text} onSources={inspect}/></article>)}
          {!report && !results.length && <p className="workbench-empty">Your calculated answers and reports will appear here. Ask a question to get started.</p>}
        </div>
        <div className="workbench-pane" id="pane-manage" hidden={props.panel!=="manage"}>
          <div ref={props.onToolsMount}/>
          <details className="sheet-checks"><summary>Import settings</summary><label>Column headings are on row <input aria-label="Header row" type="number" min={1} max={100} value={props.headerRow} onChange={e=>props.onHeaderRow(Number(e.target.value))}/></label><p>Choose before uploading. Rows above the headings are skipped.</p><button className="secondary-button" disabled={busy} onClick={props.onPickFile}>Choose file with these settings</button></details>
          <button className="template-link" onClick={props.onDownloadSample}><ArrowDownToLine size={14}/> Download the sample CSV</button>
        </div>
      </aside>
    </div>
  </div>;
}


function LinkedText({text}:{text:string}){
 return <>{text.split(/(https?:\/\/[^\s<>]+)/g).map((part,i)=>/^https?:\/\//.test(part)?<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-source-link">{part}</a>:part)}</>;
}
