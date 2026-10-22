import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseWorkbook } from "../src/server/read-workbook.ts";
import { workbookFailureKind, WorkbookReadError } from "../src/lib/workbook-error.ts";

test("the actual downloadable workbook parses through the Node reader", async () => {
  const bytes = await readFile(new URL("./tricky-transactions.xlsx", import.meta.url));
  const sheets = await parseWorkbook(Uint8Array.from(bytes).buffer, "tricky.xlsx");
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].rows.length, 18);
  assert.equal(sheets[0].rows[0][3], 1000);
});

test("runtime failures are not described as password-protected files", () => {
  assert.equal(workbookFailureKind(new Error("SaxesParser is not a constructor")), "parser-runtime");
  const message = new WorkbookReadError("parser-runtime", "testref").message;
  assert.match(message, /Our Excel reader/);
  assert.match(message, /testref/);
  assert.doesNotMatch(message, /password|SaxesParser/);
  assert.equal(workbookFailureKind(new Error("Encrypted workbook")), "encrypted");
});
