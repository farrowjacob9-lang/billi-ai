import {api} from './store';
export async function importQuotePdf(file:File){
 if(!/\.pdf$/i.test(file.name))throw new Error('Choose a PDF quote.');
 if(file.size>2*1024*1024)throw new Error('Choose a PDF under 2 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return api<{title:string;body:string;pages:number;warnings:string[]}>('/api/memory/pdf',{method:'POST',body:JSON.stringify({fileName:file.name,data:btoa(binary)})});
}
