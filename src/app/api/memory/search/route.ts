import {ok,readJson,requireSession,route,HttpError} from '@/server/http';
import {requireWorkspaceStorage} from '@/server/workspaces';
import {memoryReady,searchMemory} from '@/server/company-memory';
import {takeRateLimit} from '@/server/limits';
export const POST=route(async req=>{const s=await requireSession();await requireWorkspaceStorage();if(!await memoryReady())return ok({references:[],ready:false});
 if(!await takeRateLimit(`memory-search:${s.businessId}`,120,3600))throw new HttpError(429,'rate_limited','Too many searches. Try again later.');
 const b=await readJson(req,12000);if(typeof b.question!=='string'||!b.question.trim()||b.question.length>2000)throw new HttpError(400,'invalid_input','Search using up to 2,000 characters.');
 return ok({references:await searchMemory(s.businessId,b.question),ready:true});});
