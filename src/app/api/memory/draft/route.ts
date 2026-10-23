import {ok,readJson,requireSession,route,HttpError} from '@/server/http';
import {requireAiAccess} from '@/server/access';
import {requireMemory,getMemory} from '@/server/company-memory';
import {draftFromMemory} from '@/server/ai';
import {aiContext} from '@/server/metering';
export const POST=route(async req=>{const s=await requireSession();await requireMemory();const b=await readJson(req,12000);
 if(typeof b.id!=='string'||typeof b.question!=='string'||!b.question.trim()||b.question.length>2000)throw new HttpError(400,'invalid_input','Choose a memory and describe what to draft.');
 const record=await getMemory(s.businessId,b.id);
 if(record.revision!==b.revision)throw new HttpError(409,'memory_conflict','The reference changed. Reopen it before creating a draft.');
 await requireAiAccess();
 const reply=await aiContext.run({businessId:s.businessId,operation:'memory-draft'},()=>draftFromMemory(b.question as string,{title:record.title,body:record.body},req.signal));
 if(!reply)throw new HttpError(503,'ai_unavailable','The draft could not be created. Your reference is still available.');
 // A deleted or edited record cannot become the source of a late new answer.
 if((await getMemory(s.businessId,record.id)).revision!==record.revision)throw new HttpError(409,'memory_conflict','The source changed while drafting. Reopen it and try again.');
 return ok({reply:'Review draft — based on saved company material. Confirm prices and job details before use.\n\n'+reply.slice(0,6000),references:[{id:record.id,title:record.title,excerpt:record.body.slice(0,1000),updatedAt:record.updated_at,revision:record.revision,kind:'memory'}]});
});
