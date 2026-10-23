import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseWorkbook } from "../src/server/read-workbook.ts";
import { workbookFailureKind, WorkbookReadError, workbookDiagnostic } from "../src/lib/workbook-error.ts";

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

 test("reader diagnostics never log error messages or uploaded content", () => {
  const error = new Error("private customer cell and XML");
  error.stack = "Error: private customer cell and XML\n at x (/app/node_modules/exceljs/lib/xlsx/xlsx.js:12:3)\n at privateCustomerFile.xlsx:2:3";
  const diagnostic = workbookDiagnostic(error,"parse");
  assert.deepEqual(diagnostic,{stage:"parse",name:"Error",frames:["exceljs/lib/xlsx/xlsx.js:12:3"]});
  assert.doesNotMatch(JSON.stringify(diagnostic),/private|customer|XML/);
 });

test("the exact CRM workbook with prefixed Excel XML imports correctly", async () => {
  const bytes = await readFile(new URL("./fixtures/naxium-sales-crm-prefixed.xlsx", import.meta.url));
  assert.equal(bytes.length,6768);
  const [sheet] = await parseWorkbook(Uint8Array.from(bytes).buffer,"crm.xlsx");
  assert.equal(sheet.rows.length,24);
  assert.equal(sheet.columns.length,10);
  assert.equal(sheet.rows[0][0],"Acacia Office Co");
  assert.equal(sheet.rows.reduce((n,r)=>n+Number(r[4]),0),442300);
  assert.equal(sheet.rows[0][5],"2026-10-12");
});

test("namespace conversion preserves text and resolves arbitrary prefixes by URI", async () => {
  const {normalizeSpreadsheetXml} = await import("../src/server/workbook-namespaces.ts");
  const main="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const xml=`<ss:sst xmlns:ss="${main}"><ss:si><ss:t xml:space="preserve"> x:workbook &amp; &lt;x:f&gt; </ss:t></ss:si></ss:sst>`;
  const normalized=normalizeSpreadsheetXml(xml);
  assert.match(normalized,/<sst /);
  assert.match(normalized,/ x:workbook &amp; &lt;x:f&gt; /);
  assert.match(normalized,/xml:space="preserve"/);
  assert.throws(()=>normalizeSpreadsheetXml('<!DOCTYPE workbook [<!ENTITY x "private">]><workbook/>'),/document type/);
});

test("prefixed formula cells remain rejected after namespace conversion", async () => {
  const {default:JSZip} = await import("jszip");
  const bytes=await readFile(new URL("./fixtures/naxium-sales-crm-prefixed.xlsx",import.meta.url));
  const zip=await JSZip.loadAsync(bytes);
  const xml=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  zip.file("xl/worksheets/sheet1.xml",xml.replace('<x:c r="E2" s="1"><x:v>18000</x:v></x:c>','<x:c r="E2" s="1"><x:f>1+1</x:f><x:v>2</x:v></x:c>'));
  const altered=await zip.generateAsync({type:"uint8array"});
  await assert.rejects(parseWorkbook(Uint8Array.from(altered).buffer,"formula.xlsx"),/contains formulas/);
});
