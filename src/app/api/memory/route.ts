import {ok,readJson,requireSession,route,HttpError} from '@/server/http';
import {memoryReady,requireMemory,listMemory,saveMemory} from '@/server/company-memory';
import {takeRateLimit} from '@/server/limits';
export const GET=route(async()=>{const s=await requireSession();const ready=await memoryReady();return ok({ready,records:ready?await listMemory(s.businessId):[]});});
export const POST=route(async req=>{const s=await requireSession();await requireMemory();if(!await takeRateLimit(`memory-write:${s.businessId}`,100,3600))throw new HttpError(429,'rate_limited','Too many memory changes. Try again later.');return ok({record:await saveMemory(s.businessId,s.userId,await readJson(req,100000))},201);});
