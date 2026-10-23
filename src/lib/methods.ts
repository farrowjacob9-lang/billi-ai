import { evaluatePlan, validatePlan, validateSheet, type Plan, type Sheet } from './sheet.ts';

export const METHOD_DAYS = 30;
export type InputEvidence = { fingerprint:string; sourceName:string; rowCount:number; matched:number };
export type MethodRef = { id:string; version:number };
export type TaskContext = { question:string; correction?:string; basedOn?:MethodRef; scopeHint?:"once" };
export const oneOffIntent=(text:string)=>/\b(?:this time|just this (?:result|run|time)|for this (?:result|run) only|one[- ]off)\b/i.test(text);
export type MethodVersion = { version:number; plan:Plan; correction:string; acceptedAt:string; evidence:InputEvidence; restoredFrom?:number };
export type LearnedMethod = { id:string; question:string; columns:string[]; revision:number; versions:MethodVersion[]; expiresAt:string; updatedAt:string };
export type MethodRun = { id:string; version:number; at:string; evidence:InputEvidence };

// Deliberately conservative recognition: never erase numbers, dates, conditions or column names.
export const taskKey = (question:string) => question.normalize('NFKC').trim().toLowerCase().replace(/[.!?]+$/u,'').replace(/\s+/gu,' ');
export const columnKey = (columns:string[]) => JSON.stringify([...columns].sort());
export const sameInputShape = (a:string[], b:string[]) => columnKey(a) === columnKey(b);
export function canonicalPlan(value:unknown, sheet:Sheet):Plan {
  const p=validatePlan(value,sheet);
  if(p.filters?.some(f=>typeof f.value==='number' && !Number.isFinite(f.value)))throw new Error('Use finite filter values.');
  return {operation:p.operation,...(p.column!==undefined?{column:p.column}:{}),...(p.groupBy!==undefined?{groupBy:p.groupBy}:{}),...(p.period?{period:p.period}:{}),...(p.dateAnchor?{dateAnchor:p.dateAnchor}:{}),...(p.direction?{direction:p.direction}:{}),...(p.limit!==undefined?{limit:p.limit}:{}),...(p.filters?{filters:p.filters.map(({column,operator,value})=>({column,operator,value}))}:{})};
}
export function schemaSheet(columns:unknown):Sheet {
  if(!Array.isArray(columns) || !columns.length || columns.some(c=>typeof c!=='string' || c!==c.trim()))throw new Error('Invalid method headings.');
  return validateSheet({name:'Method headings',columns,rows:[columns.map(()=>0)]});
}
export function validateEvidence(value:unknown):InputEvidence {
  const e=value as InputEvidence;
  if(!e || !/^[a-f0-9]{64}$/.test(e.fingerprint) || typeof e.sourceName!=='string' || !e.sourceName || e.sourceName.length>200 || !Number.isInteger(e.rowCount) || e.rowCount<1 || e.rowCount>10000 || !Number.isInteger(e.matched) || e.matched<0 || e.matched>e.rowCount) throw new Error('Invalid input evidence.');
  return {fingerprint:e.fingerprint,sourceName:e.sourceName,rowCount:e.rowCount,matched:e.matched};
}
export function validateTask(value:unknown):TaskContext {
  const t=value as TaskContext;
  if(!t || typeof t.question!=='string' || !t.question.trim() || t.question.length>2000 || t.correction!==undefined && (typeof t.correction!=='string'||t.correction.length>2000))throw new Error('Invalid task context.');
  const basedOn=t.basedOn?validateMethodRef(t.basedOn):undefined;
  return {question:t.question.trim(),...(t.correction?{correction:t.correction}:{}),...(basedOn?{basedOn}:{}),...(t.scopeHint==='once'?{scopeHint:'once' as const}:{})};
}
export function validateMethodRef(value:unknown):MethodRef {
  const r=value as MethodRef;
  if(!r || typeof r.id!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(r.id) || !Number.isInteger(r.version) || r.version<1)throw new Error('Invalid method version.');
  return {id:r.id,version:r.version};
}
export function validateMethod(value:unknown):LearnedMethod {
  const m=value as LearnedMethod;
  validateMethodRef({id:m?.id,version:m?.revision});
  const task=validateTask({question:m.question}), sheet=schemaSheet(m.columns);
  if(!Array.isArray(m.versions) || !m.versions.length || m.versions.length>20 || !Number.isFinite(Date.parse(m.expiresAt)) || !Number.isFinite(Date.parse(m.updatedAt)))throw new Error('Invalid established approach.');
  let previous=0;
  const versions=m.versions.map(v=>{
    if(!Number.isInteger(v.version)||v.version<=previous || v.version>m.revision || typeof v.correction!=='string' || v.correction.length>2000 || !Number.isFinite(Date.parse(v.acceptedAt)) || v.restoredFrom!==undefined && (!Number.isInteger(v.restoredFrom)||v.restoredFrom<1||v.restoredFrom>=v.version))throw new Error('Invalid approach history.');
    previous=v.version;
    return {version:v.version,plan:canonicalPlan(v.plan,sheet),correction:v.correction,acceptedAt:v.acceptedAt,evidence:validateEvidence(v.evidence),...(v.restoredFrom?{restoredFrom:v.restoredFrom}:{})};
  });
  if(previous!==m.revision)throw new Error('Invalid current approach.');
  return {id:m.id,question:task.question,columns:sheet.columns,revision:m.revision,versions,expiresAt:m.expiresAt,updatedAt:m.updatedAt};
}
export function currentVersion(method:LearnedMethod) {return method.versions.at(-1)!;}
export function recognizeMethod(methods:LearnedMethod[],question:string,sheet:Sheet) {
  const relevant=methods.filter(m=>Date.parse(m.expiresAt)>Date.now() && taskKey(m.question)===taskKey(question));
  const exact=relevant.filter(m=>sameInputShape(m.columns,sheet.columns));
  if(exact.length>1)return {kind:'ambiguous' as const,methods:exact};
  if(exact.length===1)return {kind:'match' as const,method:exact[0]};
  return relevant.length ? {kind:'changed_input' as const,methods:relevant} : {kind:'new' as const};
}
export async function inputEvidence(sheet:Sheet,plan:Plan):Promise<InputEvidence> {
  const bytes=new TextEncoder().encode(JSON.stringify(sheet));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return {fingerprint:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),sourceName:sheet.name,rowCount:sheet.rows.length,matched:evaluatePlan(sheet,plan).matched};
}
export function describePlan(plan:Plan):string {
  const action={sum:'Total',average:'Average',min:'Minimum',max:'Maximum',count:'Count',rows:'List',distinct:'Count distinct'}[plan.operation];
  const filters=plan.filters?.map(f=>`${f.column} ${f.operator.replaceAll('_',' ')} ${plan.dateAnchor==='today' && f.value==='$today'?'today (Australia/Melbourne)':f.value}`).join(' and ');
  const ordering=plan.operation==='rows'||plan.groupBy ? ` · Up to ${plan.limit??20} results${plan.column||plan.groupBy?`, ${plan.direction==='asc'?'ascending':'descending'}`:''}` : '';
  return `${action} ${plan.column??'rows'}${plan.groupBy?` by ${plan.groupBy}${plan.period?` (${plan.period})`:''}`:''}${filters?` · ${filters}`:' · All rows'}${ordering}`;
}

// Narrow, data-local corrections. Ambiguous values fall through to the constrained AI planner.
export function simpleCorrection(text:string,base:Plan,sheet:Sheet):Plan|null {
  const t=text.trim().replace(/[.!]+$/,'').replace(/\s+(?:just )?this time$/i,'');
  if(/^(?:include|use|show) all (?:rows|records|transactions)$/i.test(t))return canonicalPlan({...base,filters:[]},sheet);
  const match=t.match(/^(only(?: include| show| use)?|exclude|leave out)\s+(.+?)(?:\s+(?:ones|rows|records|transactions))?$/i);
  if(!match)return null;
  const target=match[2].replace(/^["“']|["”']$/g,'').trim().toLowerCase();
  const found=sheet.columns.flatMap((column,i)=>{
    const values=[...new Set(sheet.rows.map(r=>r[i]).filter((v):v is string=>typeof v==='string' && v.trim().toLowerCase()===target))];
    return values.length===1?[{column,value:values[0]}]:[];
  });
  if(found.length!==1)return null;
  const operator=/^only/i.test(match[1])?'equals' as const:'not_equals' as const;
  const filter={...found[0],operator};
  const filters=[...(base.filters??[]).filter(f=>!(f.column===filter.column && f.operator===operator)),filter];
  return canonicalPlan({...base,filters},sheet);
}
