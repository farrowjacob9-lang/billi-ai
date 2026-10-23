import test from "node:test";
import assert from "node:assert/strict";
import { runWorkflow, validateWorkflow, requiredWorkflowColumns } from "../src/lib/workflow.ts";
import { csvSheet, evaluatePlan, executePlan, validatePlan } from "../src/lib/sheet.ts";
import { validateSnapshot } from "../src/lib/workspace.ts";
const sheet = csvSheet('Date,Category,Amount\n2026-09-01,Travel,-20.10\n2026-09-02,Travel,5.10\n2026-10-01,Software,-10', 'actuals');
const workflow = {version:1,steps:[{name:'Total',question:'Total Amount',plan:{operation:'sum',column:'Amount'}},{name:'By month',question:'Monthly total',plan:{operation:'sum',column:'Amount',groupBy:'Date',period:'month'}}]};
test('approved multi-step workflows reuse exact plans on new input',()=>{
 const results = runWorkflow(workflow,sheet);
 assert.match(results[0].text,/All rows: -25/);
 assert.match(results[1].text,/2026-09: -15/);
 assert.deepEqual(requiredWorkflowColumns(workflow),['Amount','Date']);
 const fresh=csvSheet('Date,Category,Amount\n2026-11-01,Travel,-50','new month');
 assert.match(runWorkflow(workflow,fresh)[0].text,/All rows: -50/);
 assert.throws(()=>runWorkflow(workflow,csvSheet('Other\n1','wrong')),/numeric column/);
 assert.throws(()=>validateWorkflow({version:1,steps:[]},sheet),/1–12/);
});
test('source evidence, date filters and distinct counts are computed from validated input',()=>{
 const result=evaluatePlan(sheet,{operation:'sum',column:'Amount',filters:[{column:'Date',operator:'before',value:'2026-10-01'}]});
 assert.deepEqual(result.sourceRows,[2,3]);assert.equal(result.matched,2);assert.deepEqual(result.values,[{label:'All rows',value:-15}]);
 assert.match(executePlan(sheet,{operation:'distinct',column:'Category'}),/All rows: 2/);
 assert.throws(()=>executePlan(sheet,{operation:'count',filters:[{column:'Date',operator:'after',value:'01/10/2026'}]}),/YYYY-MM-DD/);
 assert.throws(()=>validatePlan({operation:'sum',column:'Amount',period:'week',groupBy:'Date'},sheet),/monthly or yearly/);
});
test('header offsets survive saving and source citations',()=>{
 const imported=csvSheet('My bank report\nDate,Amount\n2026-10-01,12','bank',2);
 assert.equal(imported.headerRow,2);
 assert.deepEqual(evaluatePlan(imported,{operation:'sum',column:'Amount'}).sourceRows,[3]);
 const snapshot=validateSnapshot({sheets:[imported,sheet],sheetIndex:0,messages:[],sheetMessages:{'1':[{id:1,role:'assistant',text:'total',plan:{operation:'sum',column:'Amount'}}]}});
 assert.equal(snapshot.sheets[0].headerRow,2);
 assert.equal(snapshot.sheetMessages?.['1'].length,1);
});
