export type MemoryRecord = { id:string; title:string; body:string; revision:number; created_at:string; updated_at:string; source_workspace_id:string|null; source_message_id:number|null };
export type MemoryReference = {id:string; title:string; excerpt:string; updatedAt:string; revision:number; kind:"memory"|"workspace"; messageId?:number; sheetIndex?:number; row?:number};
export type MemoryInput = {title:string;body:string;sourceWorkspaceId?:string;sourceMessageId?:number};
export function validateMemoryInput(value:unknown):MemoryInput {
 const v=value as MemoryInput;
 if(!v || typeof v.title!=="string" || !v.title.trim() || v.title.trim().length>120 || typeof v.body!=="string" || !v.body.trim() || v.body.length>20000)throw new Error("Add a title (up to 120 characters) and text (up to 20,000 characters).");
 return {title:v.title.trim(),body:v.body.trim(),...(typeof v.sourceWorkspaceId==="string"?{sourceWorkspaceId:v.sourceWorkspaceId}:{}),...(typeof v.sourceMessageId==="number" && Number.isFinite(v.sourceMessageId)?{sourceMessageId:v.sourceMessageId}:{})};
}
const stop=new Set("a an the to of for me my our in on is it we with help build create make find show tell about what how from previous earlier conversation memory company quote quotation quotes please can could would using use draft new electrical".split(" "));
export function memoryTerms(question:string):string[]{
 return [...new Set((question.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]).filter(t=>t.length>1 && !stop.has(t)))].slice(0,12);
}
export function memoryScore(question:string,title:string,body:string):number {
 const terms=memoryTerms(question); if(!terms.length)return 0;
 const heading=title.toLowerCase(), text=(title+" "+body).toLowerCase();
 // A requested identifier must match exactly: Quote 1276 must not return Quote 12760.
 const ids=terms.filter(t=>/^\d+$/.test(t));
 const words=new Set(text.match(/[\p{L}\p{N}]+/gu)??[]);
 if(ids.some(id=>!words.has(id)))return 0;
 return terms.reduce((score,t)=>score+(words.has(t)?heading.includes(t)?5:2:0),0);
}
export function memoryExcerpt(body:string,question:string,max=1000):string {
 const terms=memoryTerms(question);const lower=body.toLowerCase();const found=terms.map(t=>lower.indexOf(t)).filter(i=>i>=0);const start=found.length?Math.max(0,Math.min(...found)-120):0;
 return (start?"…":"")+body.slice(start,start+max)+(body.length>start+max?"…":"");
}
export function rankMemory(question:string,records:MemoryRecord[]):MemoryReference[]{
 return records.map(r=>({r,score:memoryScore(question,r.title,r.body)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || b.r.updated_at.localeCompare(a.r.updated_at)).slice(0,6).map(({r})=>({id:r.id,title:r.title,excerpt:memoryExcerpt(r.body,question),updatedAt:r.updated_at,revision:r.revision,kind:"memory"}));
}
export function validateMemoryReferences(value:unknown):MemoryReference[]{
 if(!Array.isArray(value) || value.length>6)throw new Error("Invalid memory references.");
 return value.map(v=>{
  if(!v || typeof v.id!=="string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.id) || typeof v.title!=="string" || v.title.length>120 || typeof v.excerpt!=="string" || v.excerpt.length>1200 || !["memory","workspace"].includes(v.kind) || typeof v.updatedAt!=="string" || !Number.isInteger(v.revision) || v.revision<0)throw new Error("Invalid memory reference.");
  return {id:v.id,title:v.title,excerpt:v.excerpt,updatedAt:v.updatedAt,revision:v.revision,kind:v.kind,...(Number.isFinite(v.messageId)?{messageId:v.messageId}:{}),...(Number.isInteger(v.sheetIndex)?{sheetIndex:v.sheetIndex}:{}),...(Number.isInteger(v.row)?{row:v.row}:{})};
 });
}
export const memoryIntent=(text:string)=>/\b(memory|remember|previous|earlier|quote|quotation|quotes|last time|reference)\b/i.test(text);
