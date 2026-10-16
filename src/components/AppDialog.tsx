"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, LogOut, Settings2, X, Zap } from "lucide-react";
import type { Modal, SettingsInfo } from "@/lib/types";

type Props = {
  modal: Modal; settings: SettingsInfo; onClose: () => void; onSaveRoutine: (name: string) => void | Promise<void>;
  onManageHistory: () => void; onSignOut?: () => void;
};

export function AppDialog({ modal, settings, onClose, onSaveRoutine, onManageHistory, onSignOut }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [routineName, setRoutineName] = useState("Weekly business report");
  useEffect(() => { if (modal) dialog.current?.showModal(); else dialog.current?.close(); }, [modal]);
  useEffect(() => { if (modal === "routine") setRoutineName("Weekly business report"); }, [modal]);

  function submit(event: FormEvent) {
    event.preventDefault(); const name = routineName.trim(); if (!name) return;
    void onSaveRoutine(name);
  }

  return <dialog className="modal" ref={dialog} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="dialog-title"><div className="modal-content"><button className="modal-close icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
    {modal === "routine" ? <><span className="task-icon mint"><Zap size={24} /></span><h2 id="dialog-title">Make good work repeatable.</h2><p>Keep the report format and checks for next time. Your source file and transaction data aren’t included.</p><form onSubmit={submit}><label htmlFor="routine-name">Routine name</label><input id="routine-name" value={routineName} onChange={e => setRoutineName(e.target.value)} maxLength={80} required autoFocus /><div className="routine-rules"><span><Check size={14} /> Weekly CSV · date, description, category, amount</span><span><Check size={14} /> AUD · income, expenses and net movement</span><span><Check size={14} /> Input checks and reconciled totals</span><span><Check size={14} /> Manual run · {settings.routineStorage}</span></div><button className="primary-button" type="submit">Save routine <ArrowRight size={16} /></button></form></>
      : <><span className="task-icon mint"><Settings2 size={23} /></span><h2 id="dialog-title">A workspace taking shape.</h2><p>{settings.intro}</p>{settings.rows.map(([label, value]) => <div className="settings-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}<p className="modal-footnote">{settings.footnote}</p><button className="secondary-button" onClick={onManageHistory}>Manage history <ArrowRight size={16} /></button>{onSignOut && <button className="secondary-button sign-out" onClick={onSignOut}><LogOut size={15} /> Sign out</button>}</>}
  </div></dialog>;
}
