import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryScore,memoryTerms,rankMemory,validateMemoryInput,validateMemoryReferences,type MemoryRecord} from '../src/lib/company-memory.ts';
const r:MemoryRecord={id:'a',title:'Quote 1276 — Dave’s Electrical',body:'Install lighting. Price 1200 AUD. Confirm site details.',revision:1,created_at:'2026-10-24',updated_at:'2026-10-24',source_workspace_id:null,source_message_id:null};
test('memory exact identifiers cannot match prefixes and names find relevant business records',()=>{
 assert.equal(rankMemory('Find quote 1276',[r])[0].id,'a');
 assert.equal(rankMemory('Find quote 127',[r]).length,0);assert.equal(rankMemory('Quote 12760',[r]).length,0);
 assert.ok(memoryScore('Dave’s Electrical',r.title,r.body)>0);assert.equal(memoryScore('Johns Electrical',r.title,r.body),0);
 assert.deepEqual(memoryTerms('Help me build a quote'),[]);
});
test('memory input and citations are bounded and cannot supply arbitrary links',()=>{
 assert.throws(()=>validateMemoryInput({title:'',body:'a'}));assert.throws(()=>validateMemoryInput({title:'a',body:'a'.repeat(20001)}));
 assert.equal(validateMemoryInput({title:'  Quote ',body:' detail '}).title,'Quote');
 const refs=rankMemory('1276',[r]);assert.deepEqual(validateMemoryReferences(refs),refs);
 assert.throws(()=>validateMemoryReferences([{...refs[0],id:'https://foreign.example'}]));assert.throws(()=>validateMemoryReferences([{...refs[0],excerpt:'a'.repeat(1201)}]));
});
