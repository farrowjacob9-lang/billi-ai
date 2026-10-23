"use client";
import {useEffect,useRef,useState} from 'react';
import {importQuotePdf} from '@/lib/read-pdf';
import {download} from '@/lib/browser';
import type {MemoryStore} from '@/lib/memory-store';
import type {MemoryRecord,MemoryReference,MemoryInput} from '@/lib/company-memory';
type Props={initialFile?:File;store:MemoryStore;seed?:MemoryInput;focus?:string;onClose:()=>void;onUse:(record:MemoryRecord)=>void;onOpenWork:(id:string)=>void};
export function MemoryLibrary({initialFile,store,seed,focus,onClose,onUse,onOpenWork}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [records,setRecords]=useState<MemoryRecord[]>([]),[ready,setReady]=useState<boolean|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [origin,setOrigin]=useState<MemoryInput|undefined>(seed);
 const [selected,setSelected]=useState<MemoryRecord|null>(null),[title,setTitle]=useState(seed?.title??''),[body,setBody]=useState(seed?.body??''),[query,setQuery]=useState(''),[hits,setHits]=useState<MemoryReference[]|null>(null);
 async function refresh(){const result=await store.list();setRecords(result.records);setReady(result.ready);return result;}
 useEffect(()=>{dialog.current?.showModal();const node=dialog.current;const previous=document.activeElement;void refresh().then(async()=>{if(initialFile){await action(()=>loadPdf(initialFile));}else if(focus){const r=await store.get(focus);setSelected(r);setTitle(r.title);setBody(r.body);}}).catch(e=>setError(e.message));return()=>{node?.close();if(previous instanceof HTMLElement)previous.focus();};},[]); // eslint-disable-line react-hooks/exhaustive-deps
 async function action(fn:()=>Promise<void>){setError('');setNotice('');setBusy(true);try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function loadPdf(file:File){const imported=await importQuotePdf(file);setSelected(null);setOrigin(undefined);setTitle(imported.title);setBody(imported.body);setNotice(`Read ${imported.pages} page${imported.pages===1?"":"s"}. Review the extracted text, then keep it in company memory. ${imported.warnings.join(" ")}`);}
 const choose=(r:MemoryRecord)=>{setSelected(r);setTitle(r.title);setBody(r.body);setNotice('');setError('');};
 return <dialog className="memory-dialog" ref={dialog} onCancel={e=>{e.preventDefault();onClose();}} aria-label="Company memory">
  <header><div><h2>Company memory</h2><p>{store.cloud?'Saved to your business account':'Browser prototype — stored on this device only'}</p></div><button className="secondary-button" onClick={onClose}>Close memory</button></header>
  <p>Keep quotes, decisions and reference material until you delete them. Saved work is also searchable while its 30-day retention lasts. Nothing is kept here automatically.</p>
  {!store.cloud && <p role="status">This prototype is not company account storage. Export records before clearing browser data.</p>}
  {busy && <p role="status">Working…</p>}
  {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  {ready===null && <p role="status">Loading company memory…</p>}
  {ready===false && <p role="status">Company memory is not configured yet. Apply database migration 007 to enable permanent records.</p>}
  <label className="memory-pdf-upload">Upload a PDF quote<input type="file" accept=".pdf,application/pdf" aria-label="Upload PDF quote" disabled={busy||!ready} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void action(async()=>{await loadPdf(file);});}}/></label>
  <p className="memory-disclosure">PDFs up to 2 MB and 20 pages. We extract text on our server without sending it to AI. The original PDF is not retained; only text you choose to keep is saved.</p>
  <form className="memory-search" onSubmit={e=>{e.preventDefault();void action(async()=>setHits(await store.search(query)));}}><label>Find company knowledge<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Quote 1276 or Dave’s Electrical" maxLength={2000}/></label><button className="secondary-button" disabled={!query.trim()||busy||!ready}>Search memory</button></form>
  {hits && <section aria-label="Memory search results"><h3>{hits.length? 'Matching sources':'No matching sources'}</h3>{hits.map((h,i)=><article className="memory-hit" key={i}><button className="text-button" onClick={()=>void action(async()=>{if(h.kind==='memory')choose(await store.get(h.id));else{setOrigin(undefined);setSelected(null);setTitle(h.title);setBody(h.excerpt);setNotice('This is an excerpt from saved work. Save it explicitly if you want to keep it beyond the workspace’s expiry.');}})}>{h.title}{h.row?` · row ${h.row}`:''}</button><p>{h.excerpt}</p><small>{h.kind==='memory'?'Company memory':'Temporary saved work'} · {new Date(h.updatedAt).toLocaleDateString()}</small>{h.kind==='workspace'&&<button className="text-button" onClick={()=>onOpenWork(h.id)}>Open saved workspace</button>}</article>)}</section>}
  <div className="memory-layout"><nav aria-label="Company memory records"><button className="secondary-button" onClick={()=>{setOrigin(undefined);setSelected(null);setTitle('');setBody('');setNotice('');}}>New memory</button>{records.map(r=><button className="memory-record" key={r.id} aria-current={selected?.id===r.id?'true':undefined} onClick={()=>choose(r)}><strong>{r.title}</strong><small>Updated {new Date(r.updated_at).toLocaleDateString()} · v{r.revision}</small></button>)}{!records.length&&<p>No permanent records yet.</p>}</nav>
  <form onSubmit={e=>{e.preventDefault();void action(async()=>{const r=await store.save({...(!selected?origin??{}:{}),title,body},selected?.id,selected?.revision);choose(r);await refresh();setNotice('Kept in company memory until you delete it.');});}}>
   <label>Memory title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required placeholder="Quote 1276 — Dave’s Electrical"/></label>
   <label>Reference material<textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={20000} required rows={12} placeholder="Paste the quote, decision or useful business context…"/></label>
   <p className="memory-disclosure">Retained independently of the original workspace. People signed into this business account can access it. Search stays in Naxium; choosing Use in chat and asking for a draft sends this record to the AI provider. No email is sent and no source file is changed.</p>
   <div className="memory-actions"><button className="primary-button" disabled={busy||!ready}>Keep in company memory</button>{selected&&<><button type="button" className="secondary-button" onClick={()=>onUse(selected)} disabled={busy}>Use in chat</button><button type="button" className="text-button" onClick={()=>download('naxium-memory-'+selected.id+'.json',JSON.stringify(selected,null,2),'application/json')}>Export record</button><button type="button" className="text-button" disabled={busy} onClick={()=>{if(window.confirm('Delete this company memory? Copies in previously saved answers remain until those workspaces are deleted.'))void action(async()=>{await store.remove(selected);setSelected(null);setTitle('');setBody('');await refresh();setNotice('Company memory deleted.');});}}>Delete memory</button></>}
   </div>{selected?.source_workspace_id&&<button className="text-button" type="button" onClick={()=>onOpenWork(selected.source_workspace_id!)}>Open original workspace (if still available)</button>}
  </form></div>
  <button className="text-button" disabled={!records.length} onClick={()=>download('naxium-company-memory.json',JSON.stringify(records,null,2),'application/json')}>Export all company memory</button>
 </dialog>;
}
