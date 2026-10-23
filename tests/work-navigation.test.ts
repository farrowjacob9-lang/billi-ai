import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkHash,workHash} from '../src/lib/work-navigation.ts';
test('work destinations round trip identifiers without exposing spreadsheet content',()=>{
 for(const location of [{view:'workspace',workId:'local_abc-123'},{view:'workspace',reportId:'report-1'},{view:'workflows'},{view:'history'},{view:'routines'}] as const) assert.deepEqual(parseWorkHash(workHash(location)),location);
 assert.equal(workHash({view:'workspace',workId:'../private?cells=1'}),'#/work');
 assert.deepEqual(parseWorkHash('#/work/not%20an%20id'),{view:'workspace'});
});
