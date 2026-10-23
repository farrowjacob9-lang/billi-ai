import {ok,readJson,requireSession,route,HttpError} from '@/server/http';
import {requireMethods,executeMethod} from '@/server/methods';
import {takeRateLimit} from '@/server/limits';
export const POST=route(async(request:Request,context:{params:Promise<{id:string}>})=>{
  const s=await requireSession();await requireMethods();
  if(!await takeRateLimit(`method-run:${s.businessId}`,120,3600))throw new HttpError(429,'rate_limited','Too many approach runs. Try again later.');
  const b=await readJson(request,2.5*1024*1024);
  return ok(await executeMethod(s.businessId,(await context.params).id,b.revision,b.sheet));
});
