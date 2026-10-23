import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readQuotePdf,PdfReadError} from '../src/server/read-pdf.ts';
const PDFDocument=createRequire(import.meta.url)('pdfkit');
async function pdf(text?:string,pages=1):Promise<Buffer>{return new Promise(resolve=>{const doc=new PDFDocument(),chunks:Buffer[]=[];doc.on('data',(c:Buffer)=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));if(text)doc.text(text);for(let i=1;i<pages;i++){doc.addPage();if(text)doc.text(text);}doc.end();});}
test('actual PDF quote text preserves identifiers, prices and page boundaries for memory',async()=>{
 const result=await readQuotePdf(await pdf('Quote 1276 - Daves Electrical\nInstall lighting\nTotal AUD 880',2),'quote-1276.pdf');
 assert.equal(result.pages,2);assert.equal(result.title,'quote-1276');assert.match(result.body,/Quote 1276/);assert.match(result.body,/Total AUD 880/);assert.match(result.body,/Page 2/);assert.deepEqual(result.warnings,[]);
});
test('PDF reader refuses wrong files, scanned pages, excessive pages and oversized inputs',async()=>{
 await assert.rejects(readQuotePdf(Buffer.from('not PDF'),'fake.pdf'),(e:unknown)=>e instanceof PdfReadError&&e.kind==='format');
 await assert.rejects(readQuotePdf(await pdf(),'scan.pdf'),(e:unknown)=>e instanceof PdfReadError&&e.kind==='scanned');
 await assert.rejects(readQuotePdf(await pdf('Quote 1276',21),'long.pdf'),(e:unknown)=>e instanceof PdfReadError&&e.kind==='pages');
 await assert.rejects(readQuotePdf(new Uint8Array(2*1024*1024+1),'large.pdf'),(e:unknown)=>e instanceof PdfReadError&&e.kind==='size');
});
