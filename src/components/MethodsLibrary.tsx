"use client";
import {useEffect,useState} from 'react';
import {currentVersion,describePlan,sameInputShape,type LearnedMethod,type MethodRun} from '@/lib/methods';
import type {MethodStore} from '@/lib/method-store';
import type {Sheet} from '@/lib/sheet';
export function MethodsLibrary({methods,store,sheet,error,focus,onRefresh,onRun,onNotice}:{methods:LearnedMethod[];store:MethodStore;sheet:Sheet|null;error:string;focus:{id:string;token:number}|null;onRefresh:()=>Promise<unknown>;onRun:(question:string)=>void;onNotice:(text:string)=>void}) {
  const [selected,setSelected]=useState(''),[runs,setRuns]=useState<MethodRun[]>([]),[busy,setBusy]=useState(false),[failure,setFailure]=useState('');
  useEffect(()=>{if(focus){setSelected(focus.id);setFailure('');}},[focus]);
  const current=methods.find(m=>m.id===selected);
  useEffect(()=>{let live=true;setRuns([]);if(current)void store.detail(current).then(d=>{if(live)setRuns(d.runs);}).catch(e=>{if(live)setFailure(e.message);});return()=>{live=false;};},[current,store]);
  async function change(restore?:number) {
    if(!current||busy)return;
    if(restore===undefined && !confirm('Forget this approach and its version/run history? Existing saved answers remain unchanged.'))return;
    setBusy(true);setFailure('');
    try{await store.change(current,restore);await onRefresh();onNotice(restore===undefined?'Approach forgotten. Future requests will be interpreted afresh.':'Earlier rules restored as a new version. Previous answers are unchanged.');if(restore===undefined)setSelected('');}catch(e){setFailure((e as Error).message);await onRefresh().catch(()=>{});}finally{setBusy(false);}
  }
  return <section className="methods-library" aria-label="Established approaches"><h2>Your established approaches <small>{methods.length}</small></h2><p>Accepted ways of doing a task. Matching requests reuse their rules on current data; individual corrections stay separate until accepted.</p>
    {(error||failure) && <p role="alert">{failure||error}</p>}
    {!methods.length && <p>Nothing established yet. Get a useful result in chat, adjust it if needed, and choose “That’s right”. You don’t need to build a workflow.</p>}
    <div className="method-list">{methods.map(m=><button key={m.id} className="method-card" aria-pressed={selected===m.id} onClick={()=>{setFailure('');setSelected(selected===m.id?'':m.id);}}><strong>{m.question}</strong><span>Version {m.revision} · {store.storage(m.id)==='tab'?'This tab only':`Expires ${new Date(m.expiresAt).toLocaleDateString()}`}</span><small>{describePlan(currentVersion(m).plan)}</small></button>)}</div>
    {current && <article className="method-detail" aria-label="Approach details"><h3>{current.question}</h3><p>{describePlan(currentVersion(current).plan)}</p><p>Scope: this request wording (ignoring case, whitespace and trailing punctuation), with these headings: {current.columns.join(', ')}.</p><p>Stored in {store.storage(current.id)==='account'?'your business account':store.storage(current.id)==='browser'?'this browser':'this tab only'}. {store.storage(current.id)==='tab'?'Refreshing or closing this tab forgets it.':'Accepted changes or restores start a new 30-day lifetime. Running it does not extend expiry.'} Worksheet rows are not stored with the approach. Questions, corrections and filter values may contain information from your data.</p>
      {sheet && !sameInputShape(current.columns,sheet.columns) && <p role="alert">The selected sheet has different headings. No remembered rules will be applied. Use a matching sheet, or ask a new question and accept a separate approach for the new input.</p>}
      <button className="secondary-button" disabled={busy||!sheet||!sameInputShape(current.columns,sheet.columns)} onClick={()=>onRun(current.question)}>Run on current data</button><button className="text-button" disabled={busy} onClick={()=>void change()}>Forget approach</button>
      <details><summary>Version history · {current.versions.length} retained</summary><p>Latest 20 accepted versions. Restoring copies earlier rules into a new version.</p>{[...current.versions].reverse().map(v=><div className="method-version" key={v.version}><strong>Version {v.version}{v.restoredFrom?` · restored from ${v.restoredFrom}`:''}</strong><p>{describePlan(v.plan)}</p>{v.correction && <p>Correction: {v.correction}</p>}<small>Accepted {new Date(v.acceptedAt).toLocaleString()} · {v.evidence.sourceName} · input {v.evidence.fingerprint.slice(0,12)}</small>{v.version!==current.revision && <button className="secondary-button" disabled={busy} onClick={()=>void change(v.version)}>Restore version {v.version}</button>}</div>)}</details>
      <details><summary>Recent uses · {runs.length}</summary><p>Version and input fingerprints identify recorded runs. Raw inputs and historical answers are not retained here; save the workspace to retain its cells and conversation.</p>{runs.map(r=><p key={r.id}>Version {r.version} · {new Date(r.at).toLocaleString()} · {r.evidence.sourceName} · {r.evidence.matched}/{r.evidence.rowCount} rows · input {r.evidence.fingerprint.slice(0,12)}</p>)}</details>
    </article>}
    <button className="text-button" onClick={()=>void onRefresh().catch(()=>{})}>Refresh approaches</button>
  </section>;
}
