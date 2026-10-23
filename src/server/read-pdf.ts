import {getDocumentProxy} from 'unpdf';
export const MAX_PDF_BYTES=2*1024*1024;
export class PdfReadError extends Error {kind:string;constructor(kind:string,message:string){super(message);this.kind=kind;}}
export async function readQuotePdf(bytes:Uint8Array,fileName:string):Promise<{title:string;body:string;pages:number;warnings:string[]}>{
 if(!bytes.length || bytes.length>MAX_PDF_BYTES)throw new PdfReadError('size','Choose a PDF under 2 MB.');
 if(Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-')throw new PdfReadError('format','This file is not a readable PDF. Choose the original PDF quote.');
 let pdf:Awaited<ReturnType<typeof getDocumentProxy>>|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const work=async()=>{
  try{
   pdf=await getDocumentProxy(Uint8Array.from(bytes),{maxImageSize:0,disableFontFace:true,useSystemFonts:false,stopAtErrors:true});
   if(pdf.numPages>20)throw new PdfReadError('pages','Choose a quote with up to 20 pages.');
   const parts:string[]=[],warnings:string[]=[];
   const title=fileName.replace(/\.pdf$/i,'').slice(0,120);
   const prefix=`Imported from PDF: ${fileName}\nReview extracted text against the original before using it.\n\n`;
   let length=prefix.length,readable=0;
   for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i),content=await page.getTextContent();
    const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();
    if(text)readable+=text.length;else warnings.push(`Page ${i} has no readable text. Images and scanned content have not been extracted.`);
    const section=`Page ${i}\n${text||'[No readable text on this page]'}\n`;
    length+=section.length+1;if(length>20000)throw new PdfReadError('text_limit','This PDF contains more text than one memory record can hold. Upload a shorter quote or selected pages.');parts.push(section);page.cleanup();
   }
   if(readable<10)throw new PdfReadError('scanned','This PDF appears to be scanned or image-only. Text extraction needs a PDF exported from your quoting software; scanned-document OCR is not available yet.');
   return {title:title||'PDF quote',body:prefix+parts.join('\n'),pages:pdf.numPages,warnings};
  }catch(e){if(e instanceof PdfReadError)throw e;if(e instanceof Error && e.name==='PasswordException')throw new PdfReadError('encrypted','This PDF is password protected. Upload an unlocked copy.');throw new PdfReadError('reader','This PDF could not be read. Try exporting a fresh PDF from your quoting software.');}
  finally{await pdf?.loadingTask.destroy().catch(()=>{});}
 };
 try{return await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new PdfReadError('timeout','Reading this PDF took too long. Try a smaller PDF.')),10000);})]);}finally{if(timer)clearTimeout(timer);}
}
