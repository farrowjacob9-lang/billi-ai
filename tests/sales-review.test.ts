import test from "node:test";
import assert from "node:assert/strict";
import {csvSheet} from "../src/lib/sheet.ts";
import {dailySalesReview} from "../src/lib/sales-review.ts";
import {runWorkflow,validateWorkflow} from "../src/lib/workflow.ts";
test('daily sales proposal uses relative dates, excludes closed deals and surfaces missing dates',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.UTC(2026,9,23,0)});
 const sheet=csvSheet('Company,Stage,Deal value,Next follow-up\nOld,Proposal,100,2026-10-22\nToday,Qualified,200,2026-10-23\nLost,Closed Lost,300,2026-10-20\nMissing,Discovery,50,\nFuture,Negotiation,400,2026-10-24','CRM');
 const definition=validateWorkflow(dailySalesReview(sheet),sheet);
 const result=runWorkflow(definition,sheet);
 assert.match(result[0].text,/Company: Old/);assert.doesNotMatch(result[0].text,/Company: Lost|Company: Today/);
 assert.match(result[1].text,/Company: Today/);assert.match(result[2].text,/Company: Missing/);
 t.mock.timers.setTime(Date.UTC(2026,9,24,0));
 assert.match(runWorkflow(definition,sheet)[1].text,/Company: Future/);
 t.mock.timers.reset();
});
test('CRM draft does not silently turn malformed source dates into blanks',()=>{
 const sheet=csvSheet('Stage,Deal value,Next follow-up\nProposal,100,43','CRM');
 assert.throws(()=>runWorkflow(dailySalesReview(sheet),sheet),/non-ISO dates/);
});
