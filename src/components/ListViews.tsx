"use client";

import { useState } from "react";
import { ArrowRight, CheckCheck, ChevronRight, CircleCheck, FileText, FolderOpen, History, Play, Plus, RotateCcw, Search, ShieldCheck, Trash2, Upload, X, Zap } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { money, shortDate, type Report } from "@/lib/report";
import type { Routine } from "@/lib/types";

function ListHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span /> {eyebrow}</div><h1>{title}<span>.</span></h1><p>{description}</p></div>{action}</div>;
}

export function HistoryView({ runs, storageNote, onOpen, onDelete, onClear, onRunSample }: { runs: Report[]; storageNote: string; onOpen: (run: Report) => void; onDelete: (run: Report) => void; onClear: () => void; onRunSample: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = runs.filter(r => `${r.fileName} ${shortDate(r.startDate)} ${shortDate(r.endDate)}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <ListHeading eyebrow="A CLEAR RECORD OF THE WORK." title="Run history" description="Your completed reports, ready to pick up again." action={<button className="secondary-button" disabled={!runs.length} onClick={onClear}><RotateCcw size={15} /> Clear history</button>} />
    <section className="list-panel"><div className="list-toolbar"><h2>Completed reports <span>{runs.length}</span></h2><label className="search-box"><Search size={16} /><input aria-label="Search run history" placeholder="Find a report…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      {filtered.length ? <div className="run-list">{filtered.map(run => <div className="run-item" key={run.id}><button className="run-row" onClick={() => onOpen(run)}><span className="task-icon mint"><FileText size={21} /></span><span className="run-info"><strong>{run.fileName}</strong><small>{shortDate(run.startDate)} – {shortDate(run.endDate)} · {run.rowCount} transactions</small></span><span className="run-amount">{money(run.net)}<small>Net movement</small></span><span className="verified"><CircleCheck size={13} /> Checked</span><ChevronRight size={17} /></button><button className="icon-button run-delete" aria-label={`Delete report ${run.fileName}, ${shortDate(run.startDate)} – ${shortDate(run.endDate)}`} onClick={() => onDelete(run)}><Trash2 size={15} /></button></div>)}</div>
        : <EmptyState icon={<History size={28} />} title={query ? "No matching reports" : "Your work has a place here."} description={query ? "Try another filename or reporting date." : "Run your first weekly report and find it here whenever you need it."} action={query ? undefined : <button className="primary-button" onClick={onRunSample}><Play size={15} /> Try a sample report</button>} />}
    </section>
    <p className="storage-note"><FolderOpen size={14} /> {storageNote}</p>
  </>;
}

export function RoutinesView({ routines, storageNote, banner, onCreate, onDelete, onRun }: { routines: Routine[]; storageNote: string; banner: string; onCreate: () => void; onDelete: (routine: Routine) => void; onRun: () => void }) {
  return <>
    <ListHeading eyebrow="LESS REPETITION. MORE POSSIBILITY." title="Your routines" description="Keep the useful steps. Bring fresh data next time." action={<button className="primary-button" onClick={onCreate}><Plus size={16} /> New routine</button>} />
    <section className="routines-panel"><div className="info-banner"><ShieldCheck size={18} /><p>{banner}</p></div>
      {routines.length ? <div className="routine-grid">{routines.map(routine => <article className="saved-routine" key={routine.id}><div><span className="task-icon mint"><Zap size={21} /></span><button className="icon-button" aria-label={`Delete ${routine.name}`} onClick={() => onDelete(routine)}><X size={16} /></button></div><span className="task-tag">MANUAL · CSV REPORT</span><h3>{routine.name}</h3><p>Validate your weekly transactions, calculate the totals and prepare a reviewable report.</p><div className="routine-meta"><CheckCheck size={14} /> 4 required columns <span>·</span> AUD</div><button className="secondary-button" onClick={onRun}><Upload size={15} /> Run with a new CSV <ArrowRight size={15} /></button></article>)}</div>
        : <EmptyState icon={<Zap size={28} />} title="Make the next time easier." description="Save your weekly report setup as a routine. The format stays consistent; you bring the new data." action={<button className="primary-button" onClick={onCreate}><Plus size={15} /> Create your first routine</button>} />}
    </section>
    <p className="storage-note"><FolderOpen size={14} /> {storageNote}</p>
  </>;
}
