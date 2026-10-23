import {withTenant,query,databaseConfigured} from './db.ts';
import {HttpError} from './errors.ts';
import {validateMemoryInput,memoryScore,memoryExcerpt,rankMemory,type MemoryRecord,type MemoryReference} from '../lib/company-memory.ts';
import type {Snapshot} from '../lib/workspace.ts';
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function memoryReady(){if(!databaseConfigured())return false;try{return (await query<{ready:boolean}>("SELECT to_regclass('public.company_memory') IS NOT NULL AS ready")).rows[0].ready;}catch{return false;}}
export async function requireMemory(){if(!await memoryReady())throw new HttpError(503,'memory_setup','Company memory needs database migration 007. Your existing work is unchanged.');}
const normalize=(r:MemoryRecord):MemoryRecord=>({...r,created_at:new Date(r.created_at).toISOString(),updated_at:new Date(r.updated_at).toISOString()});
export async function listMemory(business:string):Promise<MemoryRecord[]>{return withTenant(business,async c=>(await c.query('SELECT * FROM company_memory WHERE business_id=$1 ORDER BY updated_at DESC LIMIT 200',[business])).rows.map(normalize));}
export async function getMemory(business:string,id:string):Promise<MemoryRecord>{
 if(!validId(id))throw new HttpError(404,'not_found','This memory is unavailable. It may have been deleted.');
 const record=await withTenant(business,async c=>(await c.query('SELECT * FROM company_memory WHERE business_id=$1 AND id=$2',[business,id])).rows[0]);
 if(!record)throw new HttpError(404,'not_found','This memory is unavailable. It may have been deleted.');return normalize(record);
}
export async function saveMemory(business:string,user:string,raw:unknown,id?:string,revision?:unknown):Promise<MemoryRecord>{
 let input;try{input=validateMemoryInput(raw);}catch(e){throw new HttpError(422,'invalid_memory',(e as Error).message);}
 return withTenant(business,async c=>{
  await c.query('SELECT id FROM businesses WHERE id=$1 FOR UPDATE',[business]);
  let source:string|null=null;
  if(input.sourceWorkspaceId && validId(input.sourceWorkspaceId)){
   const found=await c.query('SELECT id FROM workspaces WHERE business_id=$1 AND id=$2 AND expires_at>now()',[business,input.sourceWorkspaceId]);source=found.rows[0]?.id??null;
  }
  let record;
  if(id){if(!validId(id) || !Number.isInteger(revision))throw new HttpError(400,'invalid_memory','Invalid memory revision.');
   record=(await c.query('UPDATE company_memory SET title=$3,body=$4,revision=revision+1,updated_at=now() WHERE business_id=$1 AND id=$2 AND revision=$5 RETURNING *',[business,id,input.title,input.body,revision])).rows[0];
   if(!record)throw new HttpError(409,'memory_conflict','This record changed or was deleted. Reopen it before editing.');
  }else{
   const count=(await c.query('SELECT count(*)::int AS n FROM company_memory WHERE business_id=$1',[business])).rows[0].n;
   if(count>=200)throw new HttpError(409,'memory_limit','Company memory supports 200 records in this version. Export or remove records before adding more.');
   record=(await c.query('INSERT INTO company_memory(business_id,created_by,title,body,source_workspace_id,source_message_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[business,user,input.title,input.body,source,source?input.sourceMessageId??null:null])).rows[0];
  }
  await c.query('INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,$3,$4)',[business,user,id?'memory.updated':'memory.created',record.id]);return normalize(record);
 });
}
export async function deleteMemory(business:string,user:string,id:string,revision:unknown){
 if(!validId(id)||!Number.isInteger(revision))throw new HttpError(400,'invalid_memory','Invalid memory revision.');
 await withTenant(business,async c=>{
  const removed=await c.query('DELETE FROM company_memory WHERE business_id=$1 AND id=$2 AND revision=$3',[business,id,revision]);
  if(!removed.rowCount)throw new HttpError(409,'memory_conflict','This record changed or was deleted. Refresh company memory.');
  await c.query('INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,$3,$4)',[business,user,'memory.deleted',id]);
 });
}
export async function searchMemory(business:string,question:string):Promise<MemoryReference[]>{
 const records=rankMemory(question,await listMemory(business));
 // Saved conversations and rows are retrieved in place, never copied into permanent memory.
 const work=await withTenant(business,async c=>(await c.query('SELECT id,name,snapshot,updated_at FROM workspaces WHERE business_id=$1 AND expires_at>now() ORDER BY updated_at DESC LIMIT 30',[business])).rows);
 const hits:{ref:MemoryReference;score:number}[]=[];
 for(const w of work){
  const snapshot=w.snapshot as Snapshot;
  const add=(body:string,locator:Partial<MemoryReference>)=>{const score=memoryScore(question,w.name,body);if(score>0)hits.push({score,ref:{id:w.id,title:w.name,excerpt:memoryExcerpt(body,question),updatedAt:new Date(w.updated_at).toISOString(),revision:0,kind:'workspace',...locator}});};
  for(const [index,sheet] of snapshot.sheets.entries()){
   for(const [i,row] of sheet.rows.entries())add(sheet.columns.map((c,j)=>c+': '+String(row[j]??'')).join(' · '),{sheetIndex:index,row:i+(sheet.headerRow??1)+1});
   const turns=snapshot.sheetMessages?.[String(index)]??(index===snapshot.sheetIndex?snapshot.messages:[]);
   for(const m of turns)if(m.kind!=='run')add(m.text,{sheetIndex:index,messageId:m.id});
  }
 }
 hits.sort((a,b)=>b.score-a.score || b.ref.updatedAt.localeCompare(a.ref.updatedAt));
 const seen=new Set<string>();const workspaceRefs=hits.filter(h=>{if(seen.has(h.ref.id))return false;seen.add(h.ref.id);return true;}).slice(0,6).map(h=>h.ref);
 return [...records,...workspaceRefs].sort((a,b)=>memoryScore(question,b.title,b.excerpt)-memoryScore(question,a.title,a.excerpt)).slice(0,6);
}
