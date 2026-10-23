"use client";
import {useState} from 'react';
import {describePlan,type MethodRef} from '@/lib/methods';
import type {Message} from '@/lib/types';
import type {MethodStorage} from '@/lib/method-store';

type Props={message:Message;disabled:boolean;storage:MethodStorage;onAccept:(message:Message,scope:'once'|'matching')=>Promise<string|null>;onCorrect:(message:Message,text:string)=>Promise<string|null>;onInspect:(ref:MethodRef)=>void};
export function AnswerLearning({message,disabled,storage,onAccept,onCorrect,onInspect}:Props) {
  const [editing,setEditing]=useState(false),[correction,setCorrection]=useState(''),[scope,setScope]=useState<'once'|'matching'>(message.task?.scopeHint==='once'?'once':'matching'),[error,setError]=useState('');
  if(!message.task || !message.plan || !message.evidence)return null;
  const established=!!message.methodRef && !message.task.correction && !message.accepted;
  const place=storage==='account'?'your business account':storage==='browser'?'this browser':'this tab';
  return <section className="answer-learning" aria-label="Refine this result">
    {message.methodRef && <button className="method-reference" onClick={()=>onInspect(message.methodRef!)}>Established approach · version {message.methodRef.version}</button>}
    {message.task.correction && <p className="adjustment-note">Adjustment: {message.task.correction}</p>}
    {established && <p className="adjustment-note">Using accepted rules: {describePlan(message.plan)}</p>}
    {!message.accepted && !established ? <>
      <div className="learning-actions"><button className="secondary-button" disabled={disabled} onClick={async()=>{setError('');const failure=await onAccept(message,scope);if(failure)setError(failure);}}>That’s right</button><button className="text-button" disabled={disabled} onClick={()=>{setEditing(!editing);setError('');}}>Adjust result</button></div>
      <label className="learning-scope">Apply my acceptance to <select aria-label="Acceptance scope" value={scope} disabled={disabled} onChange={e=>setScope(e.target.value as typeof scope)}><option value="matching">Matching requests</option><option value="once">This result only</option></select></label>
      <p className="learning-disclosure">{scope==='once'?'Accepts this result without changing future requests.':`Matching requests use this approach in ${place}${storage==='tab'?' until this tab is closed or refreshed':' for 30 days'}. The request wording and all headings must match. No schedule or external actions.`}</p>
    </>:<div className="learning-actions"><span role="status">{established?'Applied your accepted approach.':message.accepted==='once'?'Accepted for this result only.':'Accepted for matching requests.'}</span><button className="text-button" disabled={disabled} onClick={()=>setEditing(!editing)}>Adjust result</button>{(message.accepted==='matching'||established) && message.methodRef && <button className="text-button" onClick={()=>onInspect(message.methodRef!)}>View or change approach</button>}</div>}
    {editing && <form className="correction-form" onSubmit={async e=>{e.preventDefault();if(!correction.trim()||disabled)return;setError('');const failure=await onCorrect(message,correction.trim());if(failure)setError(failure);else {setEditing(false);setCorrection('');}}}>
      <label>What should change?<input aria-label="What should change?" value={correction} onChange={e=>setCorrection(e.target.value)} maxLength={1000} placeholder="For example, only include posted transactions" disabled={disabled}/></label>
      <p>The original answer stays in the conversation. Changes affect a new result until you accept them.</p>
      <div><button className="secondary-button" type="submit" disabled={disabled||!correction.trim()}>Update result</button><button className="text-button" type="button" onClick={()=>setEditing(false)}>Cancel</button></div>
    </form>}
    <details className="accepted-rules"><summary>Approach behind this result</summary><p>{describePlan(message.plan)}</p><p>Matching request: {message.task.question}</p><p>Input fingerprint: {message.evidence.fingerprint.slice(0,12)} · {message.evidence.rowCount} source rows · {message.evidence.matched} matched. This identifies the input; it does not retain its cells.</p></details>
    {error && <p role="alert" className="learning-error">{error}</p>}
  </section>;
}
