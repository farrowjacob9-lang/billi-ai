import {ok,readJson,requireSession,route,HttpError} from '@/server/http';
import {methodsReady,requireMethods,listMethods,acceptMethod} from '@/server/methods';
import {takeRateLimit} from '@/server/limits';
export const GET=route(async()=>{
  const session=await requireSession();
  const ready=await methodsReady();
  return ok({ready,methods:ready?await listMethods(session.businessId):[]});
});
export const POST=route(async request=>{
  const session=await requireSession();await requireMethods();
  if(!await takeRateLimit(`methods:${session.businessId}`,60,3600))throw new HttpError(429,'rate_limited','Too many approach changes. Try again later.');
  const body=await readJson(request,2.5*1024*1024);
  return ok({method:await acceptMethod(session.businessId,session.userId,body)},201);
});
