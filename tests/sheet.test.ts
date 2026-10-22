import { test } from "node:test";
import assert from "node:assert/strict";
import { csvSheet, executePlan, validateSheet, validatePlan } from "../src/lib/sheet.ts";

const sheet = csvSheet("Date,Category,Amount\n2026-10-01,Travel,-10.10\n2026-10-15,Travel,-20.20\n2026-11-01,Sales,100.50", "transactions.csv");

test("spreadsheets cover multiple months and decimal totals are calculated exactly", () => {
  assert.match(executePlan(sheet, { operation: "sum", column: "Amount" }), /All rows: 70.2/);
  assert.match(executePlan(sheet, { operation: "sum", column: "Amount", filters: [{ column: "Amount", operator: "lt", value: 0 }] }), /All rows: -30.3/);
});
test("filters, grouped totals and sorted source rows include provenance", () => {
  const answer = executePlan(sheet, { operation: "sum", column: "Amount", groupBy: "Category" });
  assert.match(answer, /Sales: 100.5\nTravel: -30.3/);
  assert.match(answer, /Matched 3 of 3 rows/);
  const filtered = executePlan(sheet, { operation: "rows", column: "Amount", direction: "asc", limit: 1, filters: [{ column: "Category", operator: "equals", value: "travel" }] });
  assert.match(filtered, /Row 3: Date: 2026-10-15/);
  assert.match(filtered, /Showing 1 of 2/);
});
test("ambiguous values and invented columns do not silently produce totals", () => {
  const mixed = csvSheet("Name,Amount\nA,10\nB,unknown", "mixed.csv");
  assert.throws(() => executePlan(mixed, { operation: "sum", column: "Amount" }), /non-numeric/);
  assert.throws(() => validatePlan({ operation: "sum", column: "Imaginary" }, sheet), /numeric column/);
  assert.throws(() => validatePlan({ operation: "execute", code: "fetch()" }, sheet), /calculate totals/);
  assert.throws(() => validateSheet({ ...sheet, rows: [[{}]] }), /Invalid spreadsheet/);
});
test("malformed CSVs, duplicate headings and oversized cells are rejected", () => {
  assert.throws(() => csvSheet("Amount,amount\n1,2", "a.csv"), /unique heading/);
  assert.throws(() => csvSheet("A,B\n1", "a.csv"), /different numbers/);
  assert.throws(() => csvSheet(`A\n${"x".repeat(2001)}`, "a.csv"), /2,000/);
});
test("empty rows preserve original row numbers", () => {
  const sparse = csvSheet("Name,Amount\nA,1\n,\nB,2", "sparse.csv");
  assert.match(executePlan(sparse, { operation: "rows", filters: [{ column: "Name", operator: "equals", value: "B" }] }), /Row 4:/);
});
