import test from "node:test";
import assert from "node:assert/strict";
import { inspectSheet, matchingRowIndexes, suggestedQuestions } from "../src/lib/sheet-inspection.ts";

const sheet = { name: "Expenses", columns: ["Category", "Amount", "Note"], rows: [["Travel", "-20.10", null], ["Software", 10, "ok"], ["Software", 10, "ok"], ["Travel", "unknown", "  "]] };
test("inspection flags exact repeats and mixed numeric columns without changing data", () => {
  const before = JSON.stringify(sheet);
  const profile = inspectSheet(sheet);
  assert.deepEqual(profile.duplicates, [2]);
  assert.equal(profile.columns[1].numeric, 3);
  assert.equal(profile.columns[2].blanks, 2);
  assert.deepEqual(matchingRowIndexes(sheet, "SOFT", "duplicates", profile.duplicates), [2]);
  assert.deepEqual(matchingRowIndexes(sheet, "", "blanks", profile.duplicates), [0, 3]);
  assert.deepEqual(matchingRowIndexes(sheet, "-20.10", "all", profile.duplicates), [0]);
  assert.equal(JSON.stringify(sheet), before);
  assert.deepEqual(suggestedQuestions(sheet), ["How many rows?"]);
});
test("suggestions use exact uploaded headings and only fully numeric columns", () => {
  assert.deepEqual(suggestedQuestions({name:"x", columns:["Department", "Cost"], rows:[["A", "1,200.50"], ["B", -2]]}), ["How many rows?", "Total Cost", "Average Cost", "Sum Cost by Department"]);
});
