import {ok,readJson,requireSession,route} from '@/server/http';
import {requireMethods,methodDetail,changeMethod} from '@/server/methods';
type Context={params:Promise<{id:string}>};
export const GET=route(async(_request:Request,context:Context)=>{
  const s=await requireSession();await requireMethods();return ok(await methodDetail(s.businessId,(await context.params).id));
});
export const POST=route(async(request:Request,context:Context)=>{
  const s=await requireSession();await requireMethods();const b=await readJson(request,4096);
  return ok({method:await changeMethod(s.businessId,s.userId,(await context.params).id,b.revision,b.restoreVersion??null)});
});
export const DELETE=route(async(request:Request,context:Context)=>{
  const s=await requireSession();await requireMethods();const b=await readJson(request,4096);
  await changeMethod(s.businessId,s.userId,(await context.params).id,b.revision);return ok({deleted:true});
});
