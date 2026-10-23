import {ok,readJson,requireSession,route} from '@/server/http';
import {requireMemory,getMemory,saveMemory,deleteMemory} from '@/server/company-memory';
type Context={params:Promise<{id:string}>};
export const GET=route(async(_req:Request,ctx:Context)=>{const s=await requireSession();await requireMemory();return ok({record:await getMemory(s.businessId,(await ctx.params).id)});});
export const POST=route(async(req:Request,ctx:Context)=>{const s=await requireSession();await requireMemory();const b=await readJson(req,100000);return ok({record:await saveMemory(s.businessId,s.userId,b,(await ctx.params).id,b.revision)});});
export const DELETE=route(async(req:Request,ctx:Context)=>{const s=await requireSession();await requireMemory();const b=await readJson(req,4096);await deleteMemory(s.businessId,s.userId,(await ctx.params).id,b.revision);return ok({deleted:true});});
