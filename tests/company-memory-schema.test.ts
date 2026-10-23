import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('company memory is independent, tenant isolated and removed with its business',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE billions_app;');
 for(const name of ['001_init.sql','002_rate_limits.sql','003_close_data_api_grants.sql','004_account_recovery.sql','005_workspaces.sql','006_learned_methods.sql','007_company_memory.sql'])await db.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
 await db.query("INSERT INTO businesses(id,name) VALUES($1,'A'),($2,'B')",[a,b]);await db.exec('SET ROLE billions_app');await db.query("SELECT set_config('app.business_id',$1,false)",[a]);
 await db.query("INSERT INTO company_memory(id,business_id,title,body) VALUES($1,$2,'Quote 1276','Lighting')",[id,a]);
 await db.query("INSERT INTO workspaces(business_id,name,snapshot) VALUES($1,'source','{}')",[a]);await db.query('DELETE FROM workspaces WHERE business_id=$1',[a]);assert.equal((await db.query('SELECT * FROM company_memory')).rows.length,1);
 await db.query("SELECT set_config('app.business_id',$1,false)",[b]);assert.equal((await db.query('SELECT * FROM company_memory')).rows.length,0);
 assert.equal((await db.query("UPDATE company_memory SET body='intrusion' WHERE id=$1",[id])).affectedRows,0);
 await assert.rejects(db.query("INSERT INTO company_memory(business_id,title,body) VALUES($1,'bad','bad')",[a]),/row-level security/);
 await db.query("SELECT set_config('app.business_id',$1,false)",[a]);await db.query("UPDATE company_memory SET revision=2 WHERE id=$1 AND revision=1",[id]);assert.equal((await db.query('DELETE FROM company_memory WHERE id=$1 AND revision=1',[id])).affectedRows,0);
 await db.exec('RESET ROLE');await db.query('DELETE FROM businesses WHERE id=$1',[a]);assert.equal((await db.query('SELECT * FROM company_memory')).rows.length,0);
 }finally{await db.close();}
});
