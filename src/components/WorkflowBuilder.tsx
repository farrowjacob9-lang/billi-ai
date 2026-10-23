"use client";
import { useEffect, useRef, useState } from "react";
import { dailySalesReview } from "@/lib/sales-review";
import { api } from "@/lib/store";
import type { Sheet } from "@/lib/sheet";
import type { Snapshot, WorkspaceMessage } from "@/lib/workspace";
import { requiredWorkflowColumns, runWorkflow, type WorkflowDefinition, type WorkflowStep } from "@/lib/workflow";

type SavedWorkflow = { id: string; name: string; question: string; plan: unknown; cadence: string; workspace_id?:string };
export function WorkflowBuilder({workflowRequest,onLibraryChange,onOpenSource,onContinueChat,onPickInput,salesDraft,onCloseSalesDraft,snapshot,workspaceId,cloud,onResults,onNotice}: {workflowRequest:{name:string;token:number}|null;onLibraryChange:()=>void;onOpenSource:(id:string)=>void;onContinueChat:()=>void;onPickInput:()=>void;salesDraft:boolean;onCloseSalesDraft:()=>void;snapshot:Snapshot|null;workspaceId:string;cloud:boolean;onResults:(messages:WorkspaceMessage[], source:Sheet)=>void;onNotice:(message:string)=>void}) {
  const handledRequest=useRef<number|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [followScope,setFollowScope] = useState<"due"|"overdue">("due");
  const [steps,setSteps] = useState<WorkflowStep[]>([]);
  const [name,setName] = useState("");
  const [library,setLibrary] = useState<SavedWorkflow[]>([]);
  const [busy,setBusy] = useState(false);
  const [selected,setSelected] = useState("");
  const [result,setResult] = useState("");
  const sheet = snapshot?.sheets[snapshot.sheetIndex];
  async function refresh() {
    if (cloud) setLibrary((await api<{routines:SavedWorkflow[]}>("/api/workspace-routines")).routines);
    else { try { setLibrary(JSON.parse(localStorage.getItem("nx-workflows") || "[]")); } catch { setLibrary([]); } }
    setLoaded(true);
  }
  useEffect(()=> { void refresh().catch(()=>{}); },[cloud]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = library.find(w=>w.id===selected);
  const missing = current && sheet ? requiredWorkflowColumns(current.plan).filter(c=>!sheet.columns.includes(c)) : [];
  async function perform(fn:()=>Promise<void>) { setBusy(true); try { await fn(); } catch(e) {onNotice(e instanceof Error ? e.message : "Workflow failed.");} finally {setBusy(false);} }
  async function execute(workflow:SavedWorkflow) {
    if(!sheet) {onNotice("Upload or reopen a spreadsheet, then run the selected workflow.");return;}
    const absent=requiredWorkflowColumns(workflow.plan).filter(c=>!sheet.columns.includes(c));
    if(absent.length) throw new Error(`Missing columns: ${absent.join(", ")}. No steps have run.`);
        const results = cloud ? (await api<{results:ReturnType<typeof runWorkflow>}>("/api/workspace-routines",{method:"POST",body:JSON.stringify({action:"apply",id:workflow.id,sheet})})).results : runWorkflow(workflow.plan,sheet);
        onResults(results.flatMap((r,i)=>[{id:Date.now()+i*2,role:"user" as const,text:`${workflow.name} / ${r.name}: ${r.question}`},{id:Date.now()+i*2+1,role:"assistant" as const,text:r.text,plan:r.plan}]),sheet);
        setResult(`Completed ${results.length} steps. Review the answers in your conversation, then save the workspace to retain this run.`);
  }
  useEffect(()=> {
    if(!workflowRequest || !loaded || handledRequest.current===workflowRequest.token)return;
    handledRequest.current=workflowRequest.token;
    const matches=library.filter(w=>w.name.toLowerCase()===workflowRequest.name.toLowerCase());
    if(matches.length!==1) {onNotice(matches.length ? "More than one workflow has that name. Choose the one you want in Workflow." : "No saved workflow has that name. Choose one in Workflow or build it first.");return;}
    setSelected(matches[0].id);setResult("");void perform(()=>execute(matches[0]));
  },[workflowRequest,loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidates = snapshot?.messages.filter(m=>m.role==="assistant" && m.plan && m.decision?.action !== "excluded") ?? [];
  return <section className="workflow-panel" aria-label="Workflow builder">
    <h2>Workflows</h2>
    {salesDraft && sheet && <SalesReviewProposal sheet={sheet} scope={followScope} onScope={setFollowScope} busy={busy} onClose={onCloseSalesDraft} onSave={definition=>void perform(async()=> {
      let sourceId=workspaceId;
      if(cloud && !sourceId) sourceId=(await api<{workspace:{id:string}}>("/api/workspaces",{method:"POST",body:JSON.stringify({name:"Sales review source",snapshot})})).workspace.id;
      if(cloud) await api("/api/workspace-routines",{method:"POST",body:JSON.stringify({action:"create",workspaceId:sourceId,sheetIndex:snapshot!.sheetIndex,name:"Daily sales review",question:"Daily follow-up review",plan:definition,cadence:"manual"})});
      else {if(library.length>=30) throw new Error("Delete a workflow before saving another.");localStorage.setItem("nx-workflows",JSON.stringify([...library,{id:crypto.randomUUID(),name:"Daily sales review",question:"Daily follow-up review",plan:definition,cadence:"manual"}]));}
      await refresh();onLibraryChange();onCloseSalesDraft();onNotice("Daily sales review saved. Choose it below to run on your current or next CRM upload.");
    })} /> }
    <p>Approved ways of working, ready to reuse. Open one here or continue in your conversation.</p>
    <button className="secondary-button" onClick={onContinueChat}>Continue in chat</button>
    <details><summary>Build from successful answers · {steps.length} steps</summary>
      <label>Workflow name<input value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Monthly expense review" /></label>
      {!candidates.length && <p>Ask a calculation question first. Successful answers become steps you can choose to remember.</p>}
      {candidates.map((m,i)=><div className="workflow-step" key={m.id}><span>{m.plan!.operation} {m.plan!.column ?? "rows"}{m.plan!.groupBy ? ` by ${m.plan!.groupBy}` : ""}</span><button className="secondary-button" disabled={steps.length>=12} onClick={()=> {
        const index = snapshot!.messages.findIndex(x=>x.id===m.id);
        const question = snapshot!.messages.slice(0,index).filter(x=>x.role==="user").at(-1)?.text ?? "Saved calculation";
        setSteps(previous=>[...previous,{name:`Step ${previous.length+1}: ${question}`.slice(0,120),question,plan:m.plan!}]);
      }}>Add answer {i+1} as step</button></div>)}
      <ol>{steps.map((step,i)=><li key={i}><label>Step {i+1} name<input value={step.name} maxLength={120} onChange={e=>setSteps(old=>old.map((s,j)=>j===i?{...s,name:e.target.value}:s))}/></label><p>{step.question}</p><button className="secondary-button" disabled={i===0} onClick={()=>setSteps(old=>{const next=[...old];[next[i-1],next[i]]=[next[i],next[i-1]];return next;})}>Move earlier</button><button className="secondary-button" onClick={()=>setSteps(old=>old.filter((_,j)=>j!==i))}>Remove step</button></li>)}</ol>
      <button className="primary-button" disabled={busy || !sheet || !name.trim() || !steps.length || cloud && !workspaceId} onClick={()=>void perform(async()=> {
        const plan:WorkflowDefinition={version:1,steps};
        runWorkflow(plan,sheet!);
        if (cloud) await api("/api/workspace-routines",{method:"POST",body:JSON.stringify({action:"create",workspaceId,sheetIndex:snapshot!.sheetIndex,name,question:steps.map(s=>s.question).join("; ").slice(0,2000),plan,cadence:"manual"})});
        else {if(library.length>=30) throw new Error("Delete a workflow before saving another (maximum 30)."); const next=[...library,{id:crypto.randomUUID(),name,question:"Approved workflow",plan,cadence:"manual"}];localStorage.setItem("nx-workflows",JSON.stringify(next));}
        await refresh();setSteps([]);onNotice("Workflow remembered. You can inspect, reuse or delete its steps.");
      })}>Approve and remember workflow</button>
      <p>{cloud ? "Save the source workspace first. Workflows are linked to it and are removed when it expires or is deleted." : "Workflows are stored in this browser, including chosen questions and rules. Clearing browser storage removes them."}</p>
    </details>
    <label>Saved workflow<select aria-label="Saved workflow" disabled={!library.length} value={selected} onChange={e=>{setSelected(e.target.value);setResult("");}}><option value="">{library.length ? "Choose a workflow" : "No saved workflows yet"}</option>{library.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    {loaded && !library.length && <p>Start in chat with a spreadsheet. Ask for a daily sales review, or add successful answers as steps above, then approve the workflow to reuse it.</p>}
    {current && <>
      <div className="tools-row"><button className="secondary-button" onClick={onPickInput}>Upload new input</button>{current.workspace_id && <button className="secondary-button" onClick={()=>onOpenSource(current.workspace_id!)}>Open source in chat</button>}</div>
      <details><summary>Inspect remembered rules</summary><pre>{JSON.stringify(current.plan,null,2)}</pre></details>
      <p>{sheet ? `Input: ${sheet.name} · ${sheet.rows.length} rows` : "Upload or reopen a spreadsheet to run this workflow."}</p>
      {missing.length>0 && <p role="alert">Missing columns: {missing.join(", ")}. Upload a matching file or build a corrected workflow. No steps have run.</p>}
      <p>Uses the currently selected sheet. Preview search filters do not apply. Saved workflow rules stay unchanged.</p>
      <button className="primary-button" disabled={busy || !sheet || missing.length>0} onClick={()=>void perform(async()=> {
        await execute(current);
      })}>{busy ? "Running…" : "Run workflow on current sheet"}</button>
      <button className="secondary-button" disabled={busy} onClick={()=>void perform(async()=> {
        if(cloud) await api("/api/workspace-routines",{method:"POST",body:JSON.stringify({action:"delete",id:current.id})});
        else localStorage.setItem("nx-workflows",JSON.stringify(library.filter(w=>w.id!==current.id)));
        setSelected("");await refresh();onNotice("Workflow forgotten.");
      })}>Forget workflow</button>
    </>}
    {result && <p role="status">{result}</p>}
    <button className="secondary-button" disabled={busy} onClick={()=>void perform(refresh)}>Refresh workflows</button>
  </section>;
}

function SalesReviewProposal({sheet,scope,onScope,busy,onSave,onClose}:{sheet:Sheet;scope:"due"|"overdue";onScope:(scope:"due"|"overdue")=>void;busy:boolean;onSave:(definition:WorkflowDefinition)=>void;onClose:()=>void}) {
  let definition:WorkflowDefinition|null=null,error="";
  try {definition=dailySalesReview(sheet,scope);} catch(e){error=e instanceof Error?e.message:"Check CRM headings.";}
  let preview:ReturnType<typeof runWorkflow>|null=null,previewError="";
  if(definition) try {preview=runWorkflow(definition,sheet);} catch(e){previewError=e instanceof Error?e.message:"Check source dates.";}
  return <section id="sales-review-draft" aria-label="Proposed daily sales review" className="sheet-checks">
    <h3>Daily sales review</h3><p>Proposed workflow for your current CRM. Closed Won and Closed Lost deals are excluded. Dates use Australia/Melbourne; “today” updates each time you run it.</p>
    <label>Follow-up scope<select aria-label="Follow-up scope" value={scope} onChange={e=>onScope(e.target.value as typeof scope)}><option value="due">Overdue and due today</option><option value="overdue">Overdue only</option></select></label>
    {error && <p role="alert">{error}</p>}
    <ol>{definition?.steps.map(step=><li key={step.name}><strong>{step.name}</strong><p>{step.question}</p></li>)}</ol>
    {previewError && <p role="alert">The draft is ready, but this file needs attention before it can run: {previewError} No rows have been silently removed.</p>}
    {preview && <details><summary>Preview results</summary>{preview.map(step=><div key={step.name}><strong>{step.name}</strong><pre>{step.text}</pre></div>)}</details>}
    <p>Saving remembers these rules and retains a source workspace for 30 days. This is an on-demand workflow; it sends no emails and does not schedule itself.</p>
    <button className="primary-button" disabled={busy || !definition} onClick={()=>definition && onSave(definition)}>Save sales review</button><button className="secondary-button" onClick={onClose}>Cancel proposal</button>
  </section>;
}
