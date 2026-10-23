import {databaseConfigured} from '@/server/db';
import {HttpError,ok,readJson,requireSession,route} from '@/server/http';
import {takeRateLimit} from '@/server/limits';
import {readQuotePdf,PdfReadError,MAX_PDF_BYTES} from '@/server/read-pdf';
export const runtime='nodejs';
export const POST=route(async req=>{
 if(databaseConfigured()){const s=await requireSession();if(!await takeRateLimit(`memory-pdf:${s.businessId}`,30,3600))throw new HttpError(429,'rate_limited','Too many PDF uploads. Try again later.');}
 const b=await readJson(req,3*1024*1024);
 if(typeof b.fileName!=='string'||!b.fileName.trim()||b.fileName.length>200||!/\.pdf$/i.test(b.fileName)||typeof b.data!=='string')throw new HttpError(400,'invalid_pdf','Choose a PDF quote.');
 const bytes=Buffer.from(b.data,'base64');if(bytes.toString('base64')!==b.data)throw new HttpError(400,'invalid_pdf','The PDF upload is incomplete. Select it again.');
 if(!bytes.length||bytes.length>MAX_PDF_BYTES)throw new HttpError(413,'too_large','Choose a PDF under 2 MB.');
 try{return ok(await readQuotePdf(bytes,b.fileName));}catch(e){if(e instanceof PdfReadError)throw new HttpError(e.kind==='timeout'?503:422,'pdf_'+e.kind,e.message);throw e;}
});
