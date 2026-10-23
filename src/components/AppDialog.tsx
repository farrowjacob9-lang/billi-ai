"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, KeyRound, LogOut, Settings2, Trash2, X, Zap } from "lucide-react";
import type { Modal, SettingsInfo } from "@/lib/types";

// Account actions resolve to an error message to show in the dialog, or null when they succeeded.
export type AccountActions = {
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  deleteAccount: (password: string) => Promise<string | null>;
};

type Props = {
  modal: Modal; settings: SettingsInfo; businessName: string; onClose: () => void; onOpen: (modal: Modal) => void; onSaveRoutine: (name: string) => void | Promise<void>;
  onManageHistory: () => void; onSignOut?: () => void; account?: AccountActions;
};

export function AppDialog({ modal, settings, businessName, onClose, onOpen, onSaveRoutine, onManageHistory, onSignOut, account }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [routineName, setRoutineName] = useState("Weekly business report");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => { if (modal) { if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); }, [modal]);
  useEffect(() => {
    if (modal === "routine") setRoutineName("Weekly business report");
    setCurrent(""); setNext(""); setConfirm(""); setUnderstood(false); setError(""); setPending(false);
  }, [modal]);

  function submit(event: FormEvent) {
    event.preventDefault(); const name = routineName.trim(); if (!name) return;
    void onSaveRoutine(name);
  }

  async function run(action: () => Promise<string | null>) {
    if (pending) return;
    setPending(true); setError("");
    const failure = await action();
    if (failure) { setError(failure); setPending(false); }
  }

  function changePassword(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) { setError("The two new passwords don’t match."); return; }
    void run(() => account!.changePassword(current, next));
  }

  function deleteAccount(event: FormEvent) {
    event.preventDefault();
    void run(() => account!.deleteAccount(current));
  }

  const errorCard = error && <div className="error-card" role="alert"><div><p>{error}</p></div></div>;

  return <dialog className="modal" ref={dialog} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="dialog-title"><div className="modal-content"><button className="modal-close icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
    {modal === "routine" ? <><span className="task-icon mint"><Zap size={24} /></span><h2 id="dialog-title">Make good work repeatable.</h2><p>Keep the report format and checks for next time. Your source file and transaction data aren’t included.</p><form onSubmit={submit}><label htmlFor="routine-name">Routine name</label><input id="routine-name" value={routineName} onChange={e => setRoutineName(e.target.value)} maxLength={80} required autoFocus /><div className="routine-rules"><span><Check size={14} /> Weekly CSV · date, description, category, amount</span><span><Check size={14} /> AUD · income, expenses and net movement</span><span><Check size={14} /> Input checks and reconciled totals</span><span><Check size={14} /> Manual run · {settings.routineStorage}</span></div><button className="primary-button" type="submit">Save routine <ArrowRight size={16} /></button></form></>
      : modal === "password" && account ? <><span className="task-icon mint"><KeyRound size={23} /></span><h2 id="dialog-title">Change your password.</h2><p>You’ll stay signed in here. Every other device is signed out.</p><form onSubmit={changePassword}>
        <label htmlFor="current-password">Current password</label><input id="current-password" type="password" value={current} onChange={e => setCurrent(e.target.value)} maxLength={200} required autoComplete="current-password" autoFocus />
        <label htmlFor="new-password">New password</label><input id="new-password" type="password" value={next} onChange={e => setNext(e.target.value)} minLength={10} maxLength={200} required autoComplete="new-password" />
        <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={10} maxLength={200} required autoComplete="new-password" />
        {errorCard}<button className="primary-button" type="submit" disabled={pending}>{pending ? "One moment…" : "Change password"} <ArrowRight size={16} /></button></form></>
      : modal === "delete" && account ? <><span className="task-icon mint"><Trash2 size={23} /></span><h2 id="dialog-title">Delete your account.</h2><p>This permanently deletes your sign-in, {businessName} and all of its reports, routines and records. It can’t be undone.</p><form onSubmit={deleteAccount}>
        <label htmlFor="delete-password">Password</label><input id="delete-password" type="password" value={current} onChange={e => setCurrent(e.target.value)} maxLength={200} required autoComplete="current-password" autoFocus />
        <label className="check-row"><input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} required /> I understand {businessName} and its reports will be deleted for good.</label>
        {errorCard}<button className="primary-button danger-button" type="submit" disabled={pending || !understood}>{pending ? "Deleting…" : "Delete account and data"} <ArrowRight size={16} /></button></form></>
      : <><span className="task-icon mint"><Settings2 size={23} /></span><h2 id="dialog-title">Settings</h2><p>{settings.intro}</p>{settings.rows.map(([label, value]) => <div className="settings-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}<p className="modal-footnote">{settings.footnote}</p><button className="secondary-button" onClick={onManageHistory}>Open activity <ArrowRight size={16} /></button>
        {account && <div className="settings-actions"><button className="secondary-button" onClick={() => onOpen("password")}><KeyRound size={15} /> Change password</button><button className="secondary-button" onClick={() => onOpen("delete")}><Trash2 size={15} /> Delete account</button></div>}
        {onSignOut && <button className="secondary-button sign-out" onClick={onSignOut}><LogOut size={15} /> Sign out</button>}
        <p className="settings-links"><a href="/privacy" target="_blank">Privacy Policy</a> · <a href="/terms" target="_blank">Terms of Service</a></p></>}
  </div></dialog>;
}
