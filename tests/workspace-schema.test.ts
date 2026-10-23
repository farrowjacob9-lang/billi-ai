import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("saved workspace schema enforces tenant reads/writes and cascading deletion in Postgres", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE billions_app;");
    for (const name of [
      "001_init.sql",
      "002_rate_limits.sql",
      "003_close_data_api_grants.sql",
      "004_account_recovery.sql",
      "005_workspaces.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../db/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    const a = "00000000-0000-4000-8000-000000000001",
      b = "00000000-0000-4000-8000-000000000002",
      w = "00000000-0000-4000-8000-000000000003";
    await db.query("INSERT INTO businesses(id,name) VALUES($1,$2),($3,$4)", [
      a,
      "Business A",
      b,
      "Business B",
    ]);
    await db.exec("SET ROLE billions_app");
    await db.query("SELECT set_config('app.business_id',$1,false)", [a]);
    await db.query(
      "INSERT INTO workspaces(id,business_id,name,snapshot) VALUES($1,$2,'A workspace','{}')",
      [w, a],
    );
    await db.query(
      "INSERT INTO workspace_routines(business_id,workspace_id,name,sheet_index,question,plan,cadence) VALUES($1,$2,'Sum',0,'total Amount','{}','manual')",
      [a, w],
    );
    await db.query("SELECT set_config('app.business_id',$1,false)", [b]);
    assert.equal((await db.query("SELECT * FROM workspaces")).rows.length, 0);
    assert.equal(
      (await db.query("SELECT * FROM workspace_routines")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO workspaces(business_id,name,snapshot) VALUES($1,'intrusion','{}')",
        [a],
      ),
      /row-level security/i,
    );
    await db.query("SELECT set_config('app.business_id',$1,false)", [a]);
    assert.equal((await db.query("SELECT * FROM workspaces")).rows.length, 1);
    await db.query("DELETE FROM workspaces WHERE id=$1", [w]);
    assert.equal(
      (await db.query("SELECT * FROM workspace_routines")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
