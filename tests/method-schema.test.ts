import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('approaches survive source deletion, remain tenant isolated, and cascade their own run evidence',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE billions_app;');
  for(const name of ['001_init.sql','002_rate_limits.sql','003_close_data_api_grants.sql','004_account_recovery.sql','005_workspaces.sql','006_learned_methods.sql'])await db.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
  await db.query("INSERT INTO businesses(id,name) VALUES($1,'A'),($2,'B')",[a,b]);
  await db.exec('SET ROLE billions_app');await db.query("SELECT set_config('app.business_id',$1,false)",[a]);
  await db.query("INSERT INTO learned_methods(id,business_id,task_key,input_key,definition,revision) VALUES($1,$2,'task','shape','{}',1)",[id,a]);
  await db.query("INSERT INTO workspaces(business_id,name,snapshot) VALUES($1,'temporary','{}')",[a]);
  await db.query('DELETE FROM workspaces WHERE business_id=$1',[a]);
  assert.equal((await db.query('SELECT * FROM learned_methods')).rows.length,1);
  await db.query("INSERT INTO method_executions(business_id,method_id,version,evidence) VALUES($1,$2,1,'{}')",[a,id]);
  await db.query("SELECT set_config('app.business_id',$1,false)",[b]);
  assert.equal((await db.query('SELECT * FROM learned_methods')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM method_executions')).rows.length,0);
  assert.equal((await db.query('UPDATE learned_methods SET revision=2 WHERE id=$1',[id])).affectedRows,0);
  await assert.rejects(db.query("INSERT INTO learned_methods(business_id,task_key,input_key,definition,revision) VALUES($1,'intrusion','shape','{}',1)",[a]),/row-level security/);
  await assert.rejects(db.query("INSERT INTO method_executions(business_id,method_id,version,evidence) VALUES($1,$2,1,'{}')",[b,id]),/foreign key/);
  await db.query("SELECT set_config('app.business_id',$1,false)",[a]);
  await db.query('DELETE FROM learned_methods WHERE id=$1',[id]);
  assert.equal((await db.query('SELECT * FROM method_executions')).rows.length,0);
 }finally{await db.close();}
});
