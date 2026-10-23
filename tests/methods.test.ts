import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvSheet,executePlan} from '../src/lib/sheet.ts';
import {canonicalPlan,inputEvidence,recognizeMethod,simpleCorrection,oneOffIntent,describePlan,taskKey,validateMethod,type LearnedMethod} from '../src/lib/methods.ts';
import {validateSnapshot} from '../src/lib/workspace.ts';
const sheet=csvSheet('Amount,Status,Category\n100,Posted,Sales\n900,Pending,Sales\n-20,Posted,Travel','first.csv');
const base={operation:'sum' as const,column:'Amount'};
async function method():Promise<LearnedMethod> {
 return validateMethod({id:'00000000-0000-4000-8000-000000000001',question:'Total Amount',columns:sheet.columns,revision:1,versions:[{version:1,plan:simpleCorrection('Only posted transactions',base,sheet),correction:'Only posted transactions',acceptedAt:new Date().toISOString(),evidence:await inputEvidence(sheet,base)}],expiresAt:new Date(Date.now()+86400000).toISOString(),updatedAt:new Date().toISOString()});
}
test('accepted scope recognizes only the same request and headings, preserving explicit differences',async()=>{
 const m=await method();
 assert.equal(recognizeMethod([m],'  TOTAL   Amount! ',sheet).kind,'match');
 assert.equal(recognizeMethod([m],'Total Amount for Travel',sheet).kind,'new');
 assert.equal(recognizeMethod([m],'Total Amount before 2026-10-01',sheet).kind,'new');
 assert.notEqual(taskKey('before 2026-10-01'),taskKey('before 2026-10-02'));
 assert.equal(recognizeMethod([m],'Total Amount',csvSheet('Amount,Other\n2,A','changed.csv')).kind,'changed_input');
 assert.equal(recognizeMethod([{...m,expiresAt:'2000-01-01'}],'Total Amount',sheet).kind,'new');
 assert.equal(recognizeMethod([m,m],'Total Amount',sheet).kind,'ambiguous');
});
test('local corrections preserve other filters and never guess an ambiguous value',()=>{
 const corrected=simpleCorrection('Only Posted',base,sheet)!;
 assert.match(executePlan(sheet,corrected),/All rows: 80/);
 const withoutTravel=simpleCorrection('Exclude Travel',corrected,sheet)!;
 assert.match(executePlan(sheet,withoutTravel),/All rows: 100/);
 assert.equal(withoutTravel.filters!.length,2);
 assert.equal(simpleCorrection('Only Posted',base,csvSheet('Status,Other,Amount\nPosted,Posted,1','ambiguous')),null);
 assert.equal(simpleCorrection('Only missing',base,sheet),null);
 assert.equal(oneOffIntent('Only Posted this time'),true);
 assert.deepEqual(simpleCorrection('Only Posted this time',base,sheet),corrected);
 assert.equal(oneOffIntent('Only Posted'),false);
 assert.equal(simpleCorrection('Except only this customer next time',base,sheet),null);
 assert.equal(simpleCorrection('Include all rows',corrected,sheet)!.filters!.length,0);
 assert.equal(canonicalPlan({...base,untrusted:'ignored'},sheet).hasOwnProperty('untrusted'),false);
});
test('input evidence changes with input, never contains cells, and survives a saved conversation',async()=>{
 const evidence=await inputEvidence(sheet,base);
 const newer=await inputEvidence(csvSheet('Amount,Status,Category\n12,Posted,Sales','next.csv'),base);
 assert.notEqual(evidence.fingerprint,newer.fingerprint);
 assert.equal(evidence.matched,3);assert.doesNotMatch(JSON.stringify(evidence),/Pending|Travel/);
 const saved=validateSnapshot({sheets:[sheet],sheetIndex:0,messages:[{id:1,role:'assistant',text:executePlan(sheet,base),plan:base,task:{question:'Total Amount'},evidence,methodRef:{id:'00000000-0000-4000-8000-000000000001',version:2},accepted:'matching',methodStorage:'browser'}]});
 assert.deepEqual(saved.messages[0].evidence,evidence);assert.equal(saved.messages[0].methodRef!.version,2);
 assert.throws(()=>validateSnapshot({sheets:[sheet],sheetIndex:0,messages:[{id:1,role:'assistant',text:'bad',task:{question:''}}]}),/task context/);
});
test('method history rejects unknown headings, unsafe numeric filters and reordered versions',async()=>{
 const m=await method();
 assert.throws(()=>validateMethod({...m,versions:[{...m.versions[0],plan:{...base,column:'Invented'}}]}));
 assert.throws(()=>canonicalPlan({...base,filters:[{column:'Amount',operator:'gt',value:NaN}]},sheet));
 assert.throws(()=>validateMethod({...m,revision:2,versions:[{...m.versions[0],version:2},m.versions[0]]}),/history/);
 assert.throws(()=>validateMethod({...m,columns:['Amount','Amount']}));
});

test('approach summaries disclose result limits, order and relative-date scope',()=>{
 assert.match(describePlan({operation:'rows',column:'Amount',direction:'asc',limit:1}),/Up to 1 results, ascending/);
 assert.match(describePlan({operation:'count',dateAnchor:'today',filters:[{column:'Date',operator:'before',value:'$today'}]}),/today \(Australia\/Melbourne\)/);
});
