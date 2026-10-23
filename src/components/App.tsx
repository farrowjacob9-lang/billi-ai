"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, MailCheck, Menu, Settings2 } from "lucide-react";
import { AppDialog, type AccountActions } from "@/components/AppDialog";
import { HistoryView, RoutinesView } from "@/components/ListViews";
import { Sidebar } from "@/components/Sidebar";
import { Toast } from "@/components/ui";
import {parseWorkHash,writeWorkLocation,type WorkReference,type WorkLocation} from "@/lib/work-navigation";
import {MemoryLibrary} from "@/components/MemoryLibrary";
import {MemoryStore} from "@/lib/memory-store";
import {memoryIntent,memoryTerms,type MemoryInput,type MemoryRecord,type MemoryReference} from "@/lib/company-memory";
import { MethodsLibrary } from "@/components/MethodsLibrary";
import { MethodStore } from "@/lib/method-store";
import { canonicalPlan, inputEvidence, recognizeMethod, simpleCorrection, oneOffIntent, type LearnedMethod, type MethodRef, type TaskContext } from "@/lib/methods";
import { WorkspaceTools } from "@/components/WorkspaceTools";
import { WorkspaceView } from "@/components/WorkspaceView";
import { compactForModel } from "@/lib/ai/verify";
import { download } from "@/lib/browser";
import { modeCopy } from "@/lib/copy";
import { localReply } from "@/lib/local-reply";
import { createReport, reportMarkdown, SAMPLE_CSV, type Report } from "@/lib/report";
import { AuthScreen } from "@/components/AuthScreen";
import { api, ApiError, cloudStore, localStore, SIGNED_OUT_EVENT, type Capabilities } from "@/lib/store";
import type { Message, Modal, Routine, UiError, View } from "@/lib/types";
import { readSpreadsheet } from "@/lib/read-workbook";
import { executePlan, evaluatePlan, simplePlan, type Sheet, type Plan } from "@/lib/sheet";

const pause = () => new Promise(resolve => setTimeout(resolve, 180));

// A rejected file is the user's to fix; anything else is the session or our side.
function uiError(e: unknown): UiError {
  if (e instanceof ApiError) {
    if (e.status === 401) return { kind: "session", message: e.message };
    if ([400, 413, 422].includes(e.status)) return { kind: "file", message: e.message };
    return { kind: "server", message: e.message };
  }
  if (e instanceof TypeError) return { kind: "server", message: "We couldn’t reach Naxium. Check your connection and try again." };
  return { kind: "file", message: e instanceof Error ? e.message : "We couldn’t read that file. Try a fresh CSV export." };
}

// The server decides the mode (browser-only or accounts) and who is signed in before the first render.
export function App({ caps }: { caps: Capabilities }) {
  const [savedWork,setSavedWork] = useState<WorkReference[]>([]);
  const [workIdentity,setWorkIdentity] = useState<WorkReference|null>(null);
  const activeWorkRef = useRef<WorkReference|null>(null);
  const activeReportRef = useRef<string|null>(null);
  const reportChats = useRef<Record<string,Message[]>>({});
  const [requestedWork,setRequestedWork] = useState<{id:string;token:number;messages?:Message[]}|null>(null);
  const [pendingReport,setPendingReport] = useState<string|null>(null);
  const [runsLoaded,setRunsLoaded] = useState(false);
  const locationHandler = useRef<(location:WorkLocation)=>void>(()=>{});
  const [composerDraft,setComposerDraft]=useState("");
  const threadPosition=useRef<{top:number;follow:boolean}|null>(null);
  const [saveStatus,setSaveStatus] = useState("");
  const [panel,setPanel] = useState<"data"|"workflow"|"results"|"manage"|null>(null);
  const [toolsMount,setToolsMount] = useState<HTMLDivElement|null>(null);
  const [workflowMount,setWorkflowMount] = useState<HTMLDivElement|null>(null);
  const [workflowRequest,setWorkflowRequest] = useState<{name:string;token:number}|null>(null);
  const [manualWorkflowsOpen,setManualWorkflowsOpen]=useState(false);
  const [salesDraft,setSalesDraft] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [view, setView] = useState<View>("workspace");
  const [report, setReport] = useState<Report | null>(null);
  const [workspaceSession,setWorkspaceSession]=useState(0);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheet = sheets[sheetIndex] ?? null;
  useEffect(() => { setPanel(null);setMemoryContext(null); }, [sheet]);
  useEffect(() => { if(report) setPanel("results"); }, [report]);
  useEffect(() => { if(salesDraft) setPanel("workflow"); }, [salesDraft]);
  const activeSheetRef = useRef(sheet);
  activeSheetRef.current = sheet;
  const [runs, setRuns] = useState<Report[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const sheetMessages = useRef<Record<string, Message[]>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [replying, setReplying] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<UiError | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  // Bumped whenever the conversation changes, so a late chat reply can't land in the wrong one.
  const conversation = useRef(0);

  const signedOut = caps.mode === "cloud" && (!caps.user || sessionEnded);
  const store = useMemo(() => caps.mode === "cloud" ? cloudStore() : localStore(caps), [caps]);
  const copy = modeCopy(caps);
  const methodStore=useMemo(()=>new MethodStore(caps.mode==="cloud"),[caps.mode,caps.user?.email]);
  const [methods,setMethods]=useState<LearnedMethod[]>([]);
  const [methodError,setMethodError]=useState("");
  const [methodBusy,setMethodBusy]=useState(false);
  const [methodFocus,setMethodFocus]=useState<{id:string;token:number}|null>(null);
  const memoryStore=useMemo(()=>new MemoryStore(caps.mode==="cloud"),[caps.mode,caps.user?.email]);
  const [memoryPdf,setMemoryPdf]=useState<File|undefined>();
  const [memoryOpen,setMemoryOpen]=useState(false);
  const [memorySeed,setMemorySeed]=useState<MemoryInput|undefined>();
  const [memoryFocus,setMemoryFocus]=useState<string|undefined>();
  const [memoryContext,setMemoryContext]=useState<MemoryRecord|null>(null);
  const [blockedTask,setBlockedTask]=useState("");
  const methodLoad=useRef(0);
  const methodAction=useRef(false);
  async function loadMethods() {
    const request=++methodLoad.current;
    try {const result=await methodStore.list();if(methodLoad.current===request){setMethods(result);setMethodError("");}return result;}
    catch(e){if(methodLoad.current===request)setMethodError((e as Error).message);throw e;}
  }
  useEffect(()=>{if(signedOut)return;void loadMethods().catch(()=>{});const changed=()=>void loadMethods().catch(()=>{});window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);},[methodStore,signedOut]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>setBlockedTask(""),[sheet]);

  useEffect(() => {
    if (signedOut) return;
    let live = true;
    Promise.all([store.listRuns(), store.listRoutines()])
      .then(([r, t]) => { if (live) { setRuns(r); setRoutines(t); setRunsLoaded(true); } })
      .catch(() => { if (live) setToast("We couldn’t load your saved work. Refresh to try again."); });
    return () => { live = false; };
  }, [store, signedOut]);
  // Any API call that finds the session expired or revoked returns the user to the sign-in screen.
  useEffect(() => {
    if (!caps.user) return;
    const ended = () => { operation.current++; abort.current?.abort(); setModal(null); setSessionEnded(true); };
    window.addEventListener(SIGNED_OUT_EVENT, ended);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, ended);
  }, [caps.user]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => () => { operation.current++; abort.current?.abort(); }, []);

  const say = (role: Message["role"], text: string, kind?: Message["kind"]) => setMessages(previous => [...previous, { id: Date.now() + Math.random(), role, text, kind }]);
  function navigate(next: View, replace=false) { setView(next); setMobileNav(false); writeWorkLocation({view:next,...(next==="workspace" ? activeWorkRef.current ? {workId:activeWorkRef.current.id} : activeReportRef.current ? {reportId:activeReportRef.current} : {} : {})},replace); }
  function openWork(id:string, contextMessages?:Message[]) {
    if(activeWorkRef.current?.id===id && sheet) {if(contextMessages)setMessages(old=>[...old,...contextMessages]);navigate("workspace");return;}
    setRequestedWork({id,token:Date.now()+Math.random(),messages:contextMessages});
  }
  locationHandler.current = location => {
    if(location.workId) openWork(location.workId);
    else if(location.reportId) setPendingReport(location.reportId);
    else {if(location.view==="workspace" && (activeWorkRef.current || activeReportRef.current)) newConversation();else {setView(location.view);setMobileNav(false);}}
  };
  useEffect(()=> {
    const restore=()=>locationHandler.current(parseWorkHash(window.location.hash));
    restore();window.addEventListener("hashchange",restore);
    return ()=>{window.removeEventListener("hashchange",restore);};
  },[]);
  useEffect(()=> {if(report && !sheet)reportChats.current[report.id]=messages;},[report,sheet,messages]);
  useEffect(()=> {if(pendingReport && runsLoaded) {const found=runs.find(r=>r.id===pendingReport);if(found)openRun(found,true);else {setToast("This report is unavailable or was deleted.");navigate("history",true);}setPendingReport(null);}},[pendingReport,runsLoaded,runs]); // eslint-disable-line react-hooks/exhaustive-deps
  function cancelRun() { operation.current++; abort.current?.abort(); setBusy(false); }
  function openRun(run: Report, _clearMessages: boolean) {
    if(unsaved && !window.confirm("Save your current work first if you want to keep it. Open this saved report?")) {navigate("workspace",true);return;}
    setComposerDraft("");threadPosition.current=null;sheetMessages.current={};setWorkspaceSession(n=>n+1);cancelRun();conversation.current++;
    activeWorkRef.current=null;setWorkIdentity(null);activeReportRef.current=run.id;
    setSheets([]);setReplying(false);setReport(run);setError(null);
    setMessages(reportChats.current[run.id] ?? [{id:Date.now(),role:"assistant",kind:"run",text:`Opened ${run.fileName}, covering ${run.startDate} to ${run.endDate}. This saved report contains calculated totals; an earlier conversation is not retained after reload. Ask about these results to continue.`}]);
    navigate("workspace");setPanel("results");
  }
  function newConversation() { if (unsaved && !window.confirm("Discard unsaved changes and start a new conversation?")) {navigate("workspace",true);return;} setMemoryContext(null);setComposerDraft("");threadPosition.current=null;activeWorkRef.current=null;activeReportRef.current=null;setWorkIdentity(null);setPanel(null);sheetMessages.current = {}; setWorkspaceSession(n=>n+1); conversation.current++; setReplying(false); cancelRun(); setReport(null); setSheets([]); setMessages([]); setError(null); navigate("workspace"); }

  async function runCsv(csv: string, fileName: string) {
    if (sheet && unsaved && !window.confirm("Save your spreadsheet first if you want to keep it. Continue to the weekly report?")) return;
    cancelRun(); conversation.current++; setReplying(false);
    const current = ++operation.current, controller = new AbortController();
    abort.current = controller;
    const stale = () => operation.current !== current;
    navigate("workspace"); setBusy(true); setStage(0); setError(null); setReport(null);
    say("user", `Prepare a weekly report from ${fileName}.`, "run");
    try {
      await pause(); if (stale()) return;
      const local = createReport(csv, fileName, crypto.randomUUID());
      setStage(1); await pause(); if (stale()) return;
      setStage(2);
      const [{ report: result, saved }] = await Promise.all([store.createRun(csv, fileName, local, controller.signal), pause()]);
      if (stale()) return;
      activeWorkRef.current=null;activeReportRef.current=result.id;setWorkIdentity(null);writeWorkLocation({view:"workspace",reportId:result.id},true);
      setReport(result); setSheets([]);
      setRuns(previous => [result, ...previous.filter(r => r.id !== result.id)].slice(0, 30));
      if (!saved) setToast("Browser storage is unavailable. You can still download this report, but history won’t survive a refresh.");
      say("assistant", `Your report is ready. I checked all ${result.rowCount} transactions and reconciled the totals. Review the report and its checks on the right. Your original file is unchanged.`, "run");
    } catch (e) {
      if (stale() || controller.signal.aborted) return;
      setError(uiError(e));
    } finally { if (!stale()) setBusy(false); }
  }

  const reportInput=useRef(false);
  async function upload(file: File) {
    if(/\.pdf$/i.test(file.name)){if(busy)return;reportInput.current=false;setMemoryPdf(file);setMemorySeed(undefined);setMemoryFocus(undefined);setMemoryOpen(true);return;}
    if(reportInput.current) {reportInput.current=false;if(!file.name.toLowerCase().endsWith(".csv")){setToast("Weekly report workflows require a CSV with date, description, category and amount columns.");return;}await runCsv(await file.text(),file.name);return;}
    if (busy) return;
    if (unsaved && !window.confirm("Replace the current spreadsheet? Save it first if you want to keep your changes.")) return;
    cancelRun(); conversation.current++; setReplying(false); setBusy(true); setStage(0); setError(null); navigate("workspace");
    const current = operation.current;
    try {
      const loaded = await readSpreadsheet(file, headerRow);
      if (current !== operation.current) return;
      setComposerDraft("");threadPosition.current=null;activeWorkRef.current=null;activeReportRef.current=null;setWorkIdentity(null);writeWorkLocation({view:"workspace"});
      sheetMessages.current = {}; setWorkspaceSession(n=>n+1); setSheets(loaded); setSheetIndex(0); setReport(null); setMessages([]);
      say("user", `Work with ${file.name}.`, "run");
      say("assistant", `Loaded ${loaded[0].rows.length} rows and ${loaded[0].columns.length} columns. Ask a question, or tell me what you want to get done. Adjust a useful result, then accept it to establish your approach.`, "run");
    } catch (e) { if (current === operation.current) setError(uiError(e)); }
    finally { if (current === operation.current) setBusy(false); }
  }

  function inspectMethod(ref:MethodRef) {setMethodFocus({id:ref.id,token:Date.now()+Math.random()});setPanel("workflow");}
  async function checkedAnswer(message:Message) {
    const source=activeSheetRef.current;
    if(!source || !message.plan || !message.task || !message.evidence || evaluatePlan(source,message.plan).text!==message.text || (await inputEvidence(source,message.plan)).fingerprint!==message.evidence.fingerprint)throw new Error("This answer belongs to different or changed input. Run the request on the current sheet before adjusting or accepting it.");
    return source;
  }
  async function acceptAnswer(message:Message,scope:"once"|"matching"):Promise<string|null> {
    if(methodAction.current)return "Another approach change is in progress.";
    methodAction.current=true;setMethodBusy(true);const asked=conversation.current;const intendedStorage=methodStore.storage();
    try {
      const source=await checkedAnswer(message);
      if(asked!==conversation.current || activeSheetRef.current!==source)throw new Error("The active work changed. Accept the result in its original workspace.");
      if(scope==="once") {setMessages(old=>old.map(m=>m.id===message.id?{...m,accepted:"once",decision:{action:"approved",note:"Accepted for this result only."}}:m));return null;}
      let method:LearnedMethod;
      if(message.methodRef && !message.task!.correction) {
        const found=(await loadMethods()).find(m=>m.id===message.methodRef!.id);
        if(!found || found.revision!==message.methodRef.version)throw new Error("This approach changed or expired. Run the request again.");
        method=found;
      } else method=await methodStore.accept(message.task!,message.plan!,source,intendedStorage);
      await loadMethods();
      if(asked===conversation.current && source===activeSheetRef.current)setMessages(old=>old.map(m=>m.id===message.id?{...m,accepted:"matching",methodRef:{id:method.id,version:method.revision},methodStorage:methodStore.storage(method.id),decision:{action:"approved",note:"Accepted for matching requests with the same headings."}}:m));
      setToast(methodStore.storage(method.id)==="tab"?"Accepted for matching requests in this tab only. Account memory needs setup; refreshing this tab forgets the approach.":"Approach accepted for matching requests for 30 days. The original spreadsheet is not retained with it.");return null;
    }catch(e){return (e as Error).message;}finally{methodAction.current=false;setMethodBusy(false);}
  }
  async function correctAnswer(message:Message,correction:string):Promise<string|null> {
    if(methodAction.current)return "Another approach change is in progress.";
    methodAction.current=true;setMethodBusy(true);const asked=conversation.current;
    try {
      const source=await checkedAnswer(message);
      let plan=simpleCorrection(correction,message.plan!,source);
      if(!plan) {
        if(!caps.ai)return 'Try a precise change such as “Only Posted”, “Exclude Travel”, or “Include all rows”. Other adjustments need an AI connection.';
        const r=await api<{reply:string;plan?:Plan}>("/api/sheet-question",{method:"POST",body:JSON.stringify({sheet:source,question:message.task!.question,basePlan:message.plan,correction})});
        if(!r.plan)return r.reply;
        plan=canonicalPlan(r.plan,source);
      }
      const text=executePlan(source,plan),evidence=await inputEvidence(source,plan);
      if(asked!==conversation.current || source!==activeSheetRef.current)throw new Error("The active work changed. No correction was added to the new conversation.");
      const task:TaskContext={question:message.task!.question,...(oneOffIntent(correction)||message.task!.scopeHint==='once'?{scopeHint:'once' as const}:{}),correction:[message.task!.correction,correction].filter(Boolean).join("; ").slice(-2000),...(message.methodRef?{basedOn:message.methodRef}:message.task!.basedOn?{basedOn:message.task!.basedOn}:{})};
      setMessages(old=>[...old,{id:Date.now()+Math.random(),role:"user",text:correction},{id:Date.now()+Math.random(),role:"assistant",text,plan,task,evidence}]);return null;
    }catch(e){return (e as Error).message;}finally{methodAction.current=false;setMethodBusy(false);}
  }

  function openMemory(){setMemoryPdf(undefined);setMemorySeed(undefined);setMemoryFocus(undefined);setMemoryOpen(true);}
  function rememberAnswer(message:Message){setMemoryPdf(undefined);setMemoryFocus(undefined);setMemorySeed({title:(message.task?.question??"Business reference").slice(0,120),body:message.text.slice(0,20000),...(workIdentity?{sourceWorkspaceId:workIdentity.id,sourceMessageId:message.id}:{})});setMemoryOpen(true);}
  function openReference(reference:MemoryReference){
    if(reference.kind==="workspace"){openWork(reference.id);setToast(reference.row?`Source: sheet ${1+(reference.sheetIndex??0)}, row ${reference.row}.`:'Opening the saved conversation.');return;}
    setMemoryPdf(undefined);setMemorySeed(undefined);setMemoryFocus(reference.id);setMemoryOpen(true);
  }
  async function memoryReply(text:string):Promise<boolean>{
    if(/\b(weather|news|latest news)\b/i.test(text) || (sheet && simplePlan(text,sheet)))return false;
    if(!memoryContext && (!memoryIntent(text) || (!memoryTerms(text).length && !/\b(memory|remember|previous|earlier)\b/i.test(text))))return false;
    const asked=conversation.current;setReplying(true);
    try {
      let reply:string, references:MemoryReference[];
      if(memoryContext){
        if(caps.mode!=="cloud" || !caps.ai){const r=await memoryStore.get(memoryContext.id);reply="Reference material — "+r.title+"\n\n"+r.body+"\n\nAI drafting needs an enabled business account. This reference has not been changed.";references=[{id:r.id,title:r.title,excerpt:r.body.slice(0,1000),updatedAt:r.updated_at,revision:r.revision,kind:"memory"}];}
        else {const result=await api<{reply:string;references:MemoryReference[]}>("/api/memory/draft",{method:"POST",body:JSON.stringify({id:memoryContext.id,revision:memoryContext.revision,question:text})});reply=result.reply;references=result.references;}
      }else{
        references=await memoryStore.search(text);
        if(!references.length){if(/\b(memory|remember|previous|earlier|quote|quotation|quotes)\b/i.test(text)){reply="I couldn't find a matching record in your saved company material. Add the quote or note to Company memory, or save the workspace containing it. I haven't invented a reference.";}else return false;}
        else reply=references.length===1?"I found this saved reference. Open the source to inspect it. For a permanent memory, choose Use in chat to adapt it into a draft.":"I found several possible references. Open the one you mean before using it as a starting point; I haven't assumed which is correct.";
      }
      if(asked===conversation.current)setMessages(old=>[...old,{id:Date.now()+Math.random(),role:"assistant",text:reply,memoryReferences:references}]);
      return true;
    }catch(e){if(asked===conversation.current)say("assistant",(e as Error).message);return true;}finally{if(asked===conversation.current)setReplying(false);}
  }
  async function send(text: string, fresh=false) {
    setBlockedTask("");
    say("user", text);
    if (/^(?:show|open)(?: my| the)? workflows[.!]?$/i.test(text.trim())) {navigate("workflows");return;}
    if (/^(?:show|open)(?: my| the)? activity[.!]?$/i.test(text.trim())) {navigate("history");return;}
    const runRequest=text.trim().match(/^run (?:the )?workflow [“"']?(.+?)[”"']?[.!]?$/i);
    if(runRequest) {setManualWorkflowsOpen(true);setWorkflowRequest({name:runRequest[1].trim(),token:Date.now()});setPanel("workflow");return;}
    if(await memoryReply(text))return;
    if (sheet) {
      const workflowIntent = /(?:create|build|make|set up).*?(?:daily.*sales.*review|sales.*workflow)/i.test(text);
      const continuing = /follow.?up date/i.test(text) && messages.some(m => m.role === "user" && /daily sales review/i.test(m.text));
      if (workflowIntent || continuing) {
        setManualWorkflowsOpen(true);setSalesDraft(true); setPanel("workflow");
        say("assistant","I've proposed a daily follow-up review: overdue open deals, follow-ups due today, and missing follow-up dates. Review the proposal in Workflow and choose Save sales review. You can change the scope there.");
        requestAnimationFrame(() => document.getElementById("sales-review-draft")?.scrollIntoView({block:"start"}));
        return;
      }
      const asked = conversation.current;
      setReplying(true);
      let answer: string;
      let usedPlan: import("@/lib/sheet").Plan | undefined;
      let learned: Awaited<ReturnType<MethodStore["execute"]>>|undefined;
      let evidence: Awaited<ReturnType<typeof inputEvidence>>|undefined;
      try {
        if(!fresh) {
          const known=recognizeMethod(await loadMethods(),text,sheet);
          if(known.kind==="changed_input" || known.kind==="ambiguous") {
            if(asked!==conversation.current)return;
            say("assistant",known.kind==="changed_input"?"I recognize this request, but the sheet headings have changed. I haven't applied your established rules. Inspect the approach or run this as a new task for the current input.":"More than one approach matches this request. Inspect the approaches before choosing how to proceed.");
            setBlockedTask(text);setReplying(false);return;
          }
          if(known.kind==="match")learned=await methodStore.execute(known.method,sheet);
        }
        const plan = learned?learned.plan:simplePlan(text, sheet);
        if(learned){answer=learned.text;usedPlan=learned.plan;evidence=learned.evidence;}
        else
        if (plan) { answer = executePlan(sheet, plan); usedPlan = plan; }
        else if (caps.ai) {
          const history = messages.filter(m => m.role === "user" && m.kind !== "run").slice(-6).map(m => m.text);
          const result = await api<{ reply: string; general?:boolean; plan?: import("@/lib/sheet").Plan }>("/api/sheet-question", { method: "POST", body: JSON.stringify({ sheet, question: text, history }) }); if(result.general){const general=await api<{reply:string|null}>("/api/chat",{method:"POST",body:JSON.stringify({question:text,general:true,history:messages.filter(m=>m.kind!=="run").slice(-6).map(({role,text})=>({role,text}))})});answer=general.reply??"I couldn’t answer that right now. Please try again.";}else answer = result.reply; usedPlan = result.plan;
        } else answer = `Open-ended questions need an AI connection on this deployment. You can still ask “how many rows”, “total ${sheet.columns[0]}” or “average ${sheet.columns[0]}” (use a numeric column for totals and averages).`;
        if(usedPlan && !evidence)evidence=await inputEvidence(sheet,usedPlan);
      } catch (e) { answer = e instanceof Error ? e.message : "The question couldn't be answered. Try again."; usedPlan=undefined;learned=undefined;evidence=undefined; }
      if (conversation.current !== asked) return;
      setReplying(false); setMessages(previous => [...previous, {id:Date.now()+Math.random(),role:"assistant",text:answer,...(usedPlan ? {plan:usedPlan,task:{question:text,...(oneOffIntent(text)?{scopeHint:'once' as const}:{})},evidence,...(learned?{methodRef:learned.methodRef,methodStorage:methodStore.storage(learned.methodRef.id)}:{})}:{})}]); return;
    }
    if (!caps.ai) { say("assistant", localReply(text, report)); return; }
    const asked = conversation.current, about = report;
    setReplying(true);
    let answer: string;
    try {
      const history = messages.filter(m => m.kind !== "run").slice(-8).map(({ role, text }) => ({ role, text }));
      const { reply } = await api<{ reply: string | null }>("/api/chat", { method: "POST", body: JSON.stringify({ question: text, general:!about, report: about && compactForModel(about), history }) });
      answer = reply || localReply(text, about, true);
    } catch (e) { answer = e instanceof ApiError && e.status === 429 ? e.message : localReply(text, about, true); }
    if (conversation.current !== asked) return;
    setReplying(false);
    say("assistant", answer);
  }

  async function saveRoutine(name: string) {
    try {
      const routine = await store.createRoutine(name);
      if (!routine) { setToast("Browser storage is unavailable, so the routine couldn’t be saved."); return; }
      setRoutines(previous => [routine, ...previous].slice(0, 30)); setModal(null); setToast(copy.routineSaved);
    } catch (e) { setToast(e instanceof ApiError ? e.message : "The routine couldn’t be saved. Please try again."); }
  }

  async function deleteRoutine(routine: Routine) {
    try { if (await store.deleteRoutine(routine.id)) { setRoutines(previous => previous.filter(r => r.id !== routine.id)); setToast("Routine removed."); } }
    catch { setToast("The routine couldn’t be removed. Please try again."); }
  }

  async function deleteRun(run: Report) {
    const remove = () => setRuns(previous => previous.filter(r => r.id !== run.id));
    try { if (await store.deleteRun(run.id)) { remove(); setToast("Report deleted."); } }
    catch (e) {
      if (e instanceof ApiError && e.status === 404) { remove(); setToast("That report was already deleted."); }
      else setToast("The report couldn’t be deleted. Please try again.");
    }
  }

  async function clearHistory() {
    try { if (await store.clearRuns()) { setRuns([]); setToast(copy.historyCleared); } }
    catch { setToast("History couldn’t be cleared. Please try again."); }
  }

  async function resendVerification() {
    try {
      const { verified } = await api<{ sent: boolean; verified: boolean }>("/api/auth/verify/resend", { method: "POST" });
      if (verified) { window.location.reload(); return; }
      setToast(`We’ve sent a new link to ${caps.user?.email}. It works once and expires in 24 hours.`);
    } catch (e) { setToast(e instanceof ApiError ? e.message : "The link couldn’t be sent. Please try again."); }
  }

  const failure = (e: unknown) => e instanceof ApiError ? e.message : "We couldn’t reach Naxium. Check your connection and try again.";
  const account: AccountActions | undefined = caps.user ? {
    async changePassword(currentPassword, newPassword) {
      try {
        await api("/api/account/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
        setModal(null); setToast("Password changed. Every other device has been signed out.");
        return null;
      } catch (e) { return failure(e); }
    },
    async deleteAccount(password) {
      try {
        await api("/api/account/delete", { method: "POST", body: JSON.stringify({ password }) });
        window.location.replace("/");
        return null;
      } catch (e) { return failure(e); }
    },
  } : undefined;

  async function signOut() {
    if (unsaved && !window.confirm("Sign out and discard unsaved changes?")) return;
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* the session cookie is cleared server-side either way */ }
    window.location.reload();
  }

  const runSample = () => { void runCsv(SAMPLE_CSV, "sample-week.csv"); };
  if (signedOut) return <AuthScreen canEmail={caps.email} notice={sessionEnded ? "Your session has ended. Sign in again to pick up where you left off." : undefined} />;
  const unverified = caps.email && caps.user && !caps.user.emailVerified;
  const title = view === "routines" ? "Report workflows" : view === "history" ? "Activity" : view === "workflows" ? "Workflows" : "Your work";

  const methodsLibrary=<MethodsLibrary methods={methods} store={methodStore} sheet={sheet} error={methodError} focus={methodFocus} onRefresh={loadMethods} onRun={question=>{navigate("workspace");void send(question);}} onNotice={setToast}/>;
  return <div className={`app-shell ${view === "workspace" ? "chat-app" : ""}`}>
    <Sidebar onMemory={openMemory} savedWork={savedWork} activeWorkId={workIdentity?.id??""} onOpenWork={openWork} workflowActive={view === "workspace" && panel === "workflow"} view={view} open={mobileNav} runs={runs} routineCount={routines.length} workspaceName={copy.workspaceName} workspaceDetail={copy.workspaceDetail} accountLabel={copy.accountLabel} accountDetail={copy.accountDetail}
      onWorkflows={() => navigate("workflows")} onNavigate={navigate} onNewConversation={newConversation} onOpenRun={run => openRun(run, false)} onSettings={() => setModal("settings")} onClose={() => setMobileNav(false)} />

    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><button className="breadcrumb-link" onClick={() => navigate("workspace")}>Workspace</button><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-right"><span className="prototype-badge"><span /> {copy.badge}</span><button className="icon-button" aria-label="Workspace settings" onClick={() => setModal("settings")}><Settings2 size={18} /></button></div></header>
      <div className="page-content">
        {!signedOut && <WorkspaceTools workflowRequest={workflowRequest} onSavedList={setSavedWork} requestedWork={requestedWork} onActive={work=>{activeWorkRef.current=work;activeReportRef.current=null;setWorkIdentity(work);writeWorkLocation({view:"workspace",...(work?{workId:work.id}:{})},true);}} onOpenSource={openWork} onContinueChat={()=>{setManualWorkflowsOpen(true);navigate("workspace");setPanel("workflow");}} onPickInput={()=>{reportInput.current=false;fileInput.current?.click();}} toolsMount={toolsMount} workflowMount={workflowMount} onStatus={setSaveStatus} salesDraft={salesDraft} onCloseSalesDraft={() => setSalesDraft(false)} onResults={(results, source) => { if (activeSheetRef.current !== source) { setToast("The active sheet changed while the workflow ran. Run it again on the selected sheet."); return; } conversation.current++; setReplying(false); setMessages(old => [...old,...results]); navigate("workspace"); }} onDirty={setUnsaved} sessionKey={workspaceSession} caps={caps} snapshot={sheet ? {sheets,sheetIndex,messages,sheetMessages:sheetMessages.current} : null} onRestore={(saved,work) => {setComposerDraft("");threadPosition.current=null;activeWorkRef.current=work;activeReportRef.current=null;setWorkIdentity(work); sheetMessages.current = saved.sheetMessages ?? {}; cancelRun(); conversation.current++; setReport(null); setSheets(saved.sheets); setSheetIndex(saved.sheetIndex); setMessages([...saved.messages,...(requestedWork?.id===work.id ? requestedWork.messages??[] : [])]); setError(null); setReplying(false); navigate("workspace"); }} onReview={(id,decision)=>setMessages(previous=>previous.map(m=>m.id===id?{...m,decision}:m))} onNotice={setToast} />}

        {unverified && <div className="verify-banner" role="status"><MailCheck size={18} /><p>Confirm your email to turn on the AI assistant. We sent a link to <strong>{caps.user!.email}</strong>. Reports work in the meantime.</p><button className="secondary-button" onClick={() => void resendVerification()}>Send a new link</button></div>}
        {view === "workspace" ? <WorkspaceView onMemory={openMemory} onRemember={rememberAnswer} onReference={openReference} memoryContext={memoryContext?.title} onClearMemory={()=>setMemoryContext(null)} advancedWorkflow={manualWorkflowsOpen} onAdvancedWorkflow={setManualWorkflowsOpen} methodsLibrary={methodsLibrary} methodBusy={methodBusy} methodStorage={methodStore.storage()} onAcceptAnswer={acceptAnswer} onCorrectAnswer={correctAnswer} onInspectMethod={inspectMethod} blockedTask={blockedTask} onFreshTask={()=>void send(blockedTask,true)} draft={composerDraft} onDraft={setComposerDraft} threadPosition={threadPosition} workName={workIdentity?.name} panel={panel} onPanel={setPanel} onToolsMount={setToolsMount} onWorkflowMount={setWorkflowMount} saveStatus={saveStatus} headerRow={headerRow} onHeaderRow={setHeaderRow} onPrepareSheetReport={() => { if (!sheet) return; const csv = [sheet.columns, ...sheet.rows].map(row => row.map(c => '"' + String(c ?? "").replaceAll('"', '""') + '"').join(",")).join("\n"); void runCsv(csv, sheet.name); }} sheet={sheet} sheets={sheets} sheetIndex={sheetIndex} onSelectSheet={index => { conversation.current++; setReplying(false); sheetMessages.current[sheetIndex] = messages; setSheetIndex(index); setMessages(sheetMessages.current[index] ?? []); setError(null); }} report={report} messages={messages} busy={busy} replying={replying||methodBusy} stage={stage} error={error} privacyNote={sheet ? "Excel workbooks are parsed on our server without being saved. CSV files are parsed in this tab. AI questions are calculated on our server; Claude receives column headings, your questions and any calculation rules you ask it to adjust, not source rows. Save workspace retains cells and conversation for 30 days. Company memory keeps only material you explicitly save there, until deleted; using a record for an AI draft sends its text to the provider. Accepting matching requests retains the approach separately, as shown on the result." : copy.privacyNote} modeLabel={copy.modeLabel}
          onPickFile={() => {reportInput.current=false;fileInput.current?.click();}} onUpload={file => {reportInput.current=false;void upload(file);}} onRunSample={runSample} onCancel={() => { cancelRun(); setToast("Report cancelled. Your file is unchanged."); }} onDismissError={() => setError(null)}
          onSend={text => void send(text)} onDownloadReport={() => { if (report) download(`billions-report-${report.startDate}.md`, reportMarkdown(report), "text/markdown"); }}
          onDownloadSample={() => download("billions-sample.csv", SAMPLE_CSV, "text/csv")} onSaveRoutine={() => setModal("routine")} onViewRoutines={() => navigate("routines")} />
          : view === "workflows" ? <div className="connected-library"><header><h1>Workflows</h1><p>Open an approved way of working, choose an input, and continue in chat.</p></header>{methodsLibrary}<details open={manualWorkflowsOpen} onToggle={e=>setManualWorkflowsOpen(e.currentTarget.open)} className="legacy-workflows"><summary>Advanced: build calculation steps</summary><div ref={setWorkflowMount}/></details><details className="legacy-workflows"><summary>Weekly report workflows ({routines.length})</summary><RoutinesView routines={routines} storageNote={copy.storageNote} banner={copy.routinesBanner} onCreate={()=>setModal("routine")} onDelete={routine=>void deleteRoutine(routine)} onRun={()=>{reportInput.current=true;fileInput.current?.click();}}/></details></div>
          : view === "history" ? <HistoryView cloud={caps.mode==="cloud"} onContinueRun={(job)=>openWork(job.workspace_id,[{id:Date.now(),role:"assistant",kind:"run",text:`Recorded workflow run: ${job.name}.\n${job.result??job.error??job.status}\nThe current source workspace may have changed since this run.`}])} runs={runs} storageNote={copy.storageNote} onOpen={run => openRun(run, true)} onDelete={run => void deleteRun(run)} onClear={() => void clearHistory()} onRunSample={runSample} />
          : <RoutinesView routines={routines} storageNote={copy.storageNote} banner={copy.routinesBanner} onCreate={() => setModal("routine")} onDelete={routine => void deleteRoutine(routine)} onRun={()=>{reportInput.current=true;fileInput.current?.click();}} />}
      </div>
    </main>

    <input className="sr-only" type="file" accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Upload spreadsheet or PDF" ref={fileInput} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    {memoryOpen && <MemoryLibrary initialFile={memoryPdf} store={memoryStore} seed={memorySeed} focus={memoryFocus} onClose={()=>setMemoryOpen(false)} onUse={record=>{setMemoryContext(record);setMemoryOpen(false);navigate("workspace");setComposerDraft("Help me adapt this reference for ");requestAnimationFrame(()=>document.getElementById("message")?.focus());}} onOpenWork={id=>{setMemoryOpen(false);openWork(id);}}/>}
    <AppDialog modal={modal} settings={copy.settings} businessName={copy.workspaceName} onClose={() => setModal(null)} onOpen={setModal} onSaveRoutine={saveRoutine} onManageHistory={() => { setModal(null); navigate("history"); }} onSignOut={caps.user ? () => void signOut() : undefined} account={account} />
    {toast && <Toast text={toast} onDismiss={() => setToast("")} />}
  </div>;
}
