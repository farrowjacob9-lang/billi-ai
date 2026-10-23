import {api} from './store';
import {validateMemoryInput,rankMemory,type MemoryInput,type MemoryRecord,type MemoryReference} from './company-memory';
const key='naxium-company-memory-v1';
export class MemoryStore {
 constructor(public cloud:boolean){}
 private local():MemoryRecord[]{try{return JSON.parse(localStorage.getItem(key)??'[]');}catch{return [];}}
 async list():Promise<{ready:boolean;records:MemoryRecord[]}>{return this.cloud?api('/api/memory'):{ready:true,records:this.local()};}
 async get(id:string):Promise<MemoryRecord>{if(this.cloud)return (await api<{record:MemoryRecord}>(`/api/memory/${id}`)).record;const r=this.local().find(r=>r.id===id);if(!r)throw new Error('This memory is unavailable. It may have been deleted.');return r;}
 async save(input:MemoryInput,id?:string,revision?:number):Promise<MemoryRecord>{
  const v=validateMemoryInput(input);
  if(this.cloud)return (await api<{record:MemoryRecord}>(id?`/api/memory/${id}`:'/api/memory',{method:'POST',body:JSON.stringify({...v,revision})})).record;
  const records=this.local(),old=records.find(r=>r.id===id);if(id && (!old||old.revision!==revision))throw new Error('This record changed or was deleted. Reopen it.');
  if(!id && records.length>=200)throw new Error('Company memory supports up to 200 records.');
  const now=new Date().toISOString(),r:MemoryRecord={id:id??crypto.randomUUID(),title:v.title,body:v.body,revision:(old?.revision??0)+1,created_at:old?.created_at??now,updated_at:now,source_workspace_id:old?.source_workspace_id??v.sourceWorkspaceId??null,source_message_id:old?.source_message_id??v.sourceMessageId??null};
  localStorage.setItem(key,JSON.stringify([r,...records.filter(x=>x.id!==r.id)]));return r;
 }
 async remove(r:MemoryRecord){if(this.cloud)await api(`/api/memory/${r.id}`,{method:'DELETE',body:JSON.stringify({revision:r.revision})});else{const current=this.local();if(current.find(x=>x.id===r.id)?.revision!==r.revision)throw new Error('This record changed. Reopen it.');localStorage.setItem(key,JSON.stringify(current.filter(x=>x.id!==r.id)));}}
 async search(question:string):Promise<MemoryReference[]>{return this.cloud?(await api<{references:MemoryReference[]}>('/api/memory/search',{method:'POST',body:JSON.stringify({question})})).references:rankMemory(question,this.local());}
}
