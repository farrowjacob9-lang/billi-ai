import {api} from './store';
import {canonicalPlan,columnKey,currentVersion,inputEvidence,taskKey,validateMethod,sameInputShape,type LearnedMethod,type MethodRun,type TaskContext} from './methods.ts';
import {evaluatePlan,type Sheet,type Plan} from './sheet.ts';
const KEY='nx-established-methods-v1', RUNS='nx-method-runs-v1';
export type MethodStorage='tab'|'browser'|'account';
export class MethodStore {
  private temporary:LearnedMethod[]=[];
  private temporaryRuns:Record<string,MethodRun[]>={};
  ready=false;
  constructor(readonly cloud:boolean) {}
  storage(id?:string):MethodStorage {return id && this.temporary.some(m=>m.id===id) || this.cloud && !this.ready ? 'tab':this.cloud?'account':'browser';}
  private local():LearnedMethod[] {
    let value:unknown;try{value=JSON.parse(localStorage.getItem(KEY)??'[]');}catch{throw new Error('Established approaches could not be read. Check browser storage before continuing.');}
    if(!Array.isArray(value)||value.length>30)throw new Error('Stored approaches need attention. No remembered rules were applied.');
    const all=value.map(validateMethod), current=all.filter(m=>Date.parse(m.expiresAt)>Date.now());
    if(current.length!==all.length)this.write(current);
    try{const runs=JSON.parse(localStorage.getItem(RUNS)??'{}');if(runs && typeof runs==='object' && !Array.isArray(runs)){const keep=new Set(current.map(m=>m.id));const cleaned=Object.fromEntries(Object.entries(runs).filter(([id])=>keep.has(id)));if(Object.keys(cleaned).length!==Object.keys(runs).length)localStorage.setItem(RUNS,JSON.stringify(cleaned));}}catch{/* Optional local run metadata is not used to select rules. */}
    return current;
  }
  private write(methods:LearnedMethod[]) {
    const text=JSON.stringify(methods);
    if(new TextEncoder().encode(text).length>2*1024*1024)throw new Error('Approach storage is full. Forget an old approach first.');
    try{localStorage.setItem(KEY,text);}catch{throw new Error('The approach was not saved. Browser storage may be full or unavailable.');}
  }
  async list():Promise<LearnedMethod[]> {
    if(!this.cloud){this.ready=true;return this.local();}
    const r=await api<{ready:boolean;methods:LearnedMethod[]}>('/api/methods');this.ready=r.ready;
    this.temporary=this.temporary.filter(m=>Date.parse(m.expiresAt)>Date.now());
    return [...r.methods.map(validateMethod),...this.temporary];
  }
  async accept(task:TaskContext,plan:Plan,sheet:Sheet,targetStorage:MethodStorage=this.storage()) {
    if(!this.cloud && navigator.locks)return navigator.locks.request('nx-established-methods',()=>this.acceptUnlocked(task,plan,sheet,targetStorage));
    return this.acceptUnlocked(task,plan,sheet,targetStorage);
  }
  private async acceptUnlocked(task:TaskContext,plan:Plan,sheet:Sheet,targetStorage:MethodStorage) {
    const all=await this.list();
    if(this.cloud && targetStorage!=='tab' && this.ready && (!task.basedOn || !this.temporary.some(m=>m.id===task.basedOn!.id))) {
      const {method}=await api<{method:LearnedMethod}>('/api/methods',{method:'POST',body:JSON.stringify({task,plan,sheet})});
      return validateMethod(method);
    }
    const old=all.find(m=>taskKey(m.question)===taskKey(task.question) && columnKey(m.columns)===columnKey(sheet.columns));
    if(old && (!task.basedOn || old.id!==task.basedOn.id || old.revision!==task.basedOn.version) || !old && task.basedOn)throw new Error('This approach changed, expired or was forgotten. Run the request again before accepting changes.');
    if(!old && all.length>=30)throw new Error('Forget an approach before accepting another (maximum 30).');
    const now=new Date().toISOString(),revision=(old?.revision??0)+1;
    const method=validateMethod({id:old?.id??crypto.randomUUID(),question:old?.question??task.question,columns:sheet.columns,revision,versions:[...(old?.versions??[]),{version:revision,plan:canonicalPlan(plan,sheet),correction:task.correction??'',acceptedAt:now,evidence:await inputEvidence(sheet,plan)}].slice(-20),expiresAt:new Date(Date.now()+30*86400000).toISOString(),updatedAt:now});
    // The digest is asynchronous; compare again so another tab can't be overwritten silently.
    const latest=this.cloud?this.temporary:this.local();
    if(old && latest.find(m=>m.id===old.id)?.revision!==old.revision || !old && latest.some(m=>taskKey(m.question)===taskKey(task.question)&&sameInputShape(m.columns,sheet.columns)))throw new Error('The approach changed in another tab. Run the request again.');
    const next=[method,...latest.filter(m=>m.id!==method.id)];
    if(this.cloud)this.temporary=next;else this.write(next);
    return method;
  }
  async execute(method:LearnedMethod,sheet:Sheet) {
    if(this.storage(method.id)==='account')return api<{text:string;plan:Plan;evidence:Awaited<ReturnType<typeof inputEvidence>>;methodRef:{id:string;version:number}}>(`/api/methods/${method.id}/run`,{method:'POST',body:JSON.stringify({revision:method.revision,sheet})});
    const latest=(await this.list()).find(m=>m.id===method.id);
    if(!latest||latest.revision!==method.revision)throw new Error('The approach changed. Run the request again.');
    if(!sameInputShape(method.columns,sheet.columns))throw new Error('The headings changed. No established rules were applied.');
    const plan=currentVersion(method).plan,text=evaluatePlan(sheet,plan).text,evidence=await inputEvidence(sheet,plan);
    const run={id:crypto.randomUUID(),version:method.revision,at:new Date().toISOString(),evidence};
    const previous=(await this.detail(method)).runs;
    this.temporaryRuns[method.id]=[run,...previous].slice(0,20);
    if(!this.cloud){try{const runs=JSON.parse(localStorage.getItem(RUNS)??'{}');runs[method.id]=this.temporaryRuns[method.id];localStorage.setItem(RUNS,JSON.stringify(runs));}catch{/* Run remains usable; history in this tab still exists. */}}
    return {text,plan,evidence,methodRef:{id:method.id,version:method.revision}};
  }
  async detail(method:LearnedMethod):Promise<{method:LearnedMethod;runs:MethodRun[]}> {
    if(this.storage(method.id)==='account')return api(`/api/methods/${method.id}`);
    const latest=(await this.list()).find(m=>m.id===method.id);if(!latest)throw new Error('This approach expired or was forgotten.');
    let runs=this.temporaryRuns[method.id]??[];
    if(!this.cloud)try{const raw=JSON.parse(localStorage.getItem(RUNS)??'{}')[method.id];if(Array.isArray(raw))runs=raw.filter(r=>r && typeof r.id==='string' && Number.isInteger(r.version) && typeof r.at==='string' && r.evidence && typeof r.evidence.fingerprint==='string' && typeof r.evidence.sourceName==='string').slice(0,20);}catch{/* Optional usage history. */}
    return {method:latest,runs};
  }
  async change(method:LearnedMethod,restore?:number) {
    if(!this.cloud && navigator.locks)return navigator.locks.request('nx-established-methods',()=>this.changeUnlocked(method,restore));
    return this.changeUnlocked(method,restore);
  }
  private async changeUnlocked(method:LearnedMethod,restore?:number) {
    if(this.storage(method.id)==='account') {
      const r=await api<{method?:LearnedMethod}>(`/api/methods/${method.id}`,{method:restore===undefined?'DELETE':'POST',body:JSON.stringify({revision:method.revision,restoreVersion:restore})});
      return r.method;
    }
    const all=await this.list(),old=all.find(m=>m.id===method.id);
    if(!old||old.revision!==method.revision)throw new Error('This approach changed in another tab. Refresh before changing it.');
    const version=restore===undefined?undefined:old.versions.find(v=>v.version===restore);
    if(restore!==undefined&&!version)throw new Error('That version is no longer retained.');
    const now=new Date().toISOString();
    const next=version?validateMethod({...old,revision:old.revision+1,versions:[...old.versions,{...version,version:old.revision+1,acceptedAt:now,restoredFrom:version.version}].slice(-20),updatedAt:now,expiresAt:new Date(Date.now()+30*86400000).toISOString()}):undefined;
    const updated=all.filter(m=>m.id!==method.id);if(next)updated.unshift(next);
    if(this.cloud)this.temporary=updated;else {this.write(updated);if(!next)try{const runs=JSON.parse(localStorage.getItem(RUNS)??'{}');delete runs[method.id];localStorage.setItem(RUNS,JSON.stringify(runs));}catch{/* Nonessential history. */}}
    if(!next)delete this.temporaryRuns[method.id];return next;
  }
}
