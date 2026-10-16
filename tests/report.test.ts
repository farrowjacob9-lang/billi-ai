import test from "node:test";
import assert from "node:assert/strict";
import { createReport, parseCsv, reportMarkdown, SAMPLE_CSV } from "../src/lib/report.ts";

test("sample calculations reconcile all transactions and categories", () => {
  const r = createReport(SAMPLE_CSV, "sample.csv");
  assert.equal(r.income, 2435000);
  assert.equal(r.expenses, 829000);
  assert.equal(r.net, 1606000);
  assert.equal(r.rowCount, 12);
  assert.equal(r.days.length, 7);
  assert.equal(r.categories.reduce((s, c) => s + c.cents, 0), r.expenses);
  assert.equal(r.days.reduce((s, d) => s + d.income - d.expenses, 0), r.net);
  assert.match(reportMarkdown(r), /\$16,060\.00/);
});

test("quoted fields, escaped quotes, CRLF and BOM parse without dropping records", () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"hello, world","a ""quote""\nnext line"\r\n'), [["a", "b"], ["hello, world", 'a "quote"\nnext line']]);
});

test("currency sums in integer cents without floating point drift", () => {
  const r = createReport("date,description,category,amount\n2026-10-05,A,Sales,0.10\n2026-10-05,B,Sales,0.20\n2026-10-05,C,Fees,-0.01", "cents.csv");
  assert.equal(r.income, 30);
  assert.equal(r.net, 29);
});

test("invalid records fail with actionable messages rather than producing partial results", () => {
  const head = "date,description,category,amount\n";
  assert.throws(() => createReport(head + "2026-02-30,A,Sales,10", "bad.csv"), /Record 2.*real date/);
  assert.throws(() => createReport(head + "2026-10-05,A,Sales,1.001", "bad.csv"), /two decimal places/);
  assert.throws(() => createReport(head + "2026-10-05,,Sales,1", "bad.csv"), /cannot be empty/);
  assert.throws(() => createReport(head + "2026-10-05,A,Sales,1,extra", "bad.csv"), /expected 4/);
  assert.throws(() => createReport("date,amount\n2026-10-05,10", "bad.csv"), /Missing description, category/);
  assert.throws(() => createReport("date,date,description,category,amount", "bad.csv"), /duplicate/);
  assert.throws(() => parseCsv('a,b\n"unclosed,value'), /closing quote/);
  assert.throws(() => parseCsv('a,b\n"closed"oops,value'), /unexpected quote/);
});

test("reporting periods cannot silently mix weeks", () => {
  assert.throws(() => createReport("date,description,category,amount\n2026-10-01,A,Sales,10\n2026-10-08,B,Sales,10", "bad.csv"), /seven calendar days/);
});

test("duplicate-looking transactions are preserved, not silently deduplicated", () => {
  const r = createReport("date,description,category,amount\n2026-10-05,A,Sales,10\n2026-10-05,A,Sales,10", "duplicates.csv");
  assert.equal(r.income, 2000);
  assert.equal(r.rowCount, 2);
});
