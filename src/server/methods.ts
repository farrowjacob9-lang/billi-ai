import {createHash} from 'node:crypto';
import {query,withTenant,databaseConfigured} from './db.ts';
import {HttpError} from './errors.ts';
import {taskKey,columnKey,validateMethod,canonicalPlan,currentVersion,sameInputShape,inputEvidence,validateTask,type LearnedMethod} from '../lib/methods.ts';
import {evaluatePlan,validateSheet} from '../lib/sheet.ts';
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function methodsReady() {
  if(!databaseConfigured())return false;
  const r=await query<{ready:boolean}>("SELECT to_regclass('public.learned_methods') IS NOT NULL AND to_regclass('public.method_executions') IS NOT NULL AS ready");
  return r.rows[0].ready;
}
export async function requireMethods() {if(!await methodsReady())throw new HttpError(503,'methods_setup','Account approaches are not enabled yet. You can accept an approach for this tab while setup is completed.');}
export async function listMethods(businessId:string) {
  return withTenant(businessId,async c=>{
    await c.query('DELETE FROM learned_methods WHERE business_id=$1 AND expires_at<=now()',[businessId]);
    const r=await c.query('SELECT definition FROM learned_methods WHERE business_id=$1 AND expires_at>now() ORDER BY updated_at DESC LIMIT 30',[businessId]);
    return r.rows.map(r=>validateMethod(r.definition));
  });
}
function conflict():never {throw new HttpError(409,'method_conflict','This approach changed in another tab, expired or was forgotten. Reopen the latest approach and run the request again before accepting changes.');}
export async function acceptMethod(businessId:string,userId:string,body:Record<string,unknown>) {
  let sheet,task,plan;
  try {sheet=validateSheet(body.sheet);task=validateTask(body.task);plan=canonicalPlan(body.plan,sheet);evaluatePlan(sheet,plan);}catch(e){throw new HttpError(422,'invalid_method',e instanceof Error?e.message:'Invalid approach.');}
  const evidence=await inputEvidence(sheet,plan), now=new Date().toISOString();
  return withTenant(businessId,async c=>{
    await c.query('SELECT id FROM businesses WHERE id=$1 FOR UPDATE',[businessId]);
    await c.query('DELETE FROM learned_methods WHERE business_id=$1 AND expires_at<=now()',[businessId]);
    const rows=await c.query('SELECT definition FROM learned_methods WHERE business_id=$1 AND task_key=$2 AND input_key=$3 FOR UPDATE',[businessId,hash(taskKey(task.question)),hash(columnKey(sheet.columns))]);
    const old=rows.rows[0]?validateMethod(rows.rows[0].definition):null;
    if(task.basedOn && (!old || old.id!==task.basedOn.id || old.revision!==task.basedOn.version))conflict();
    if(old && !task.basedOn)conflict();
    if(!old && (await c.query('SELECT count(*)::int AS n FROM learned_methods WHERE business_id=$1',[businessId])).rows[0].n>=30)throw new HttpError(409,'method_limit','Forget an approach before accepting another (maximum 30).');
    const revision=(old?.revision??0)+1;
    const method:LearnedMethod={id:old?.id??crypto.randomUUID(),question:old?.question??task.question,columns:sheet.columns,revision,versions:[...(old?.versions??[]),{version:revision,plan,correction:task.correction??'',acceptedAt:now,evidence}].slice(-20),expiresAt:new Date(Date.now()+30*86400000).toISOString(),updatedAt:now};
    if(JSON.stringify(method).length>120000)throw new HttpError(422,'method_size','This approach history is too large. Shorten the rules or forget it and accept a smaller approach.');
    if(old)await c.query('UPDATE learned_methods SET definition=$3,revision=$4,expires_at=$5,updated_at=now() WHERE business_id=$1 AND id=$2',[businessId,method.id,JSON.stringify(method),revision,method.expiresAt]);
    else await c.query('INSERT INTO learned_methods(id,business_id,created_by,task_key,input_key,definition,revision,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[method.id,businessId,userId,hash(taskKey(method.question)),hash(columnKey(method.columns)),JSON.stringify(method),revision,method.expiresAt]);
    await c.query("INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,'method.accepted',$3)",[businessId,userId,method.id]);
    return method;
  });
}
export async function methodDetail(businessId:string,id:string) {
  if(!validId(id))throw new HttpError(404,'not_found','Approach not found.');
  return withTenant(businessId,async c=>{
    const r=await c.query('SELECT definition FROM learned_methods WHERE business_id=$1 AND id=$2 AND expires_at>now()',[businessId,id]);
    if(!r.rows[0])throw new HttpError(404,'not_found','This approach expired or was forgotten.');
    const runs=await c.query('SELECT id,version,evidence,created_at AS at FROM method_executions WHERE business_id=$1 AND method_id=$2 ORDER BY created_at DESC LIMIT 20',[businessId,id]);
    return {method:validateMethod(r.rows[0].definition),runs:runs.rows};
  });
}
export async function changeMethod(businessId:string,userId:string,id:string,revision:unknown,restore?:unknown) {
  if(!validId(id)||!Number.isInteger(revision))throw new HttpError(400,'invalid_method','Choose an approach and its current version.');
  return withTenant(businessId,async c=>{
    const r=await c.query('SELECT definition FROM learned_methods WHERE business_id=$1 AND id=$2 AND expires_at>now() FOR UPDATE',[businessId,id]);
    const old=r.rows[0]?validateMethod(r.rows[0].definition):null;
    if(!old||old.revision!==revision)conflict();
    if(restore===undefined) {
      await c.query('DELETE FROM learned_methods WHERE business_id=$1 AND id=$2',[businessId,id]);
      await c.query("INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,'method.forgotten',$3)",[businessId,userId,id]);
      return null;
    }
    const version=old.versions.find(v=>v.version===restore);
    if(!version)throw new HttpError(422,'invalid_version','That version is no longer in the retained history.');
    const now=new Date().toISOString();
    const method:LearnedMethod={...old,revision:old.revision+1,versions:[...old.versions,{...version,version:old.revision+1,acceptedAt:now,restoredFrom:version.version}].slice(-20),updatedAt:now,expiresAt:new Date(Date.now()+30*86400000).toISOString()};
    await c.query('UPDATE learned_methods SET definition=$3,revision=$4,expires_at=$5,updated_at=now() WHERE business_id=$1 AND id=$2',[businessId,id,JSON.stringify(method),method.revision,method.expiresAt]);
    await c.query("INSERT INTO audit_events(business_id,user_id,action,subject_id) VALUES($1,$2,'method.restored',$3)",[businessId,userId,id]);
    return method;
  });
}
export async function executeMethod(businessId:string,id:string,revision:unknown,input:unknown) {
  if(!validId(id))throw new HttpError(404,'not_found','Approach not found.');
  let sheet;try{sheet=validateSheet(input);}catch(e){throw new HttpError(422,'invalid_sheet',(e as Error).message);}
  return withTenant(businessId,async c=>{
    const r=await c.query('SELECT definition FROM learned_methods WHERE business_id=$1 AND id=$2 AND expires_at>now() FOR SHARE',[businessId,id]);
    const method=r.rows[0]?validateMethod(r.rows[0].definition):null;
    if(!method||method.revision!==revision)conflict();
    if(!sameInputShape(method.columns,sheet.columns))throw new HttpError(422,'changed_input','The headings have changed. No established rules were applied. Review the input or ask a new, specific question.');
    const plan=currentVersion(method).plan;
    let result,evidence;try{result=evaluatePlan(sheet,plan);evidence=await inputEvidence(sheet,plan);}catch(e){throw new HttpError(422,'method_needs_input',(e as Error).message);}
    await c.query('INSERT INTO method_executions(business_id,method_id,version,evidence) VALUES($1,$2,$3,$4)',[businessId,id,revision,JSON.stringify(evidence)]);
    await c.query('DELETE FROM method_executions WHERE business_id=$1 AND method_id=$2 AND id NOT IN (SELECT id FROM method_executions WHERE business_id=$1 AND method_id=$2 ORDER BY created_at DESC LIMIT 50)',[businessId,id]);
    return {text:result.text,plan,evidence,methodRef:{id:method.id,version:method.revision}};
  });
}
