import test from "node:test";
import assert from "node:assert/strict";
import { createReport, SAMPLE_CSV } from "../src/lib/report.ts";
import { reportFacts, verifyFigures } from "../src/lib/ai/verify.ts";

const report = createReport(SAMPLE_CSV, "sample.csv");

test("figures that match the calculated totals pass", () => {
  const text = "12 transactions brought in $24,350.00 of income against $8,290 in expenses, a net inflow of $16,060.00. Operations was the largest expense at $3,600.00, 43.4% of spending, across 7 days from 5 to 11 October 2026.";
  assert.deepEqual(verifyFigures(text, report), { ok: true, unverified: [] });
});

test("invented, rounded or derived figures fail", () => {
  assert.deepEqual(verifyFigures("Income was $24,351.00.", report).unverified, ["$24,351.00"]);
  assert.equal(verifyFigures("Income was about $24k.", report).ok, false);
  assert.equal(verifyFigures("Expenses were 35% of income.", report).ok, false); // real ratio is 34.0%
  assert.equal(verifyFigures("Expenses were 34% of income.", report).ok, true);
  assert.equal(verifyFigures("Average daily income was 3478.57 AUD.", report).ok, false);
  assert.equal(verifyFigures("You made 13 sales.", report).ok, false);
  assert.equal(verifyFigures("Income rose 20 percent on last week.", report).ok, false);
  assert.equal(verifyFigures("Net movement was −$16,060.", report).ok, true);
});

test("dates outside the reporting period fail", () => {
  assert.equal(verifyFigures("On 2026-10-08 you spent $960.00 on People.", report).ok, true);
  assert.equal(verifyFigures("On 2026-10-19 you spent $960.00.", report).ok, false);
});

test("without a report only the CSV contract's own numbers pass", () => {
  assert.equal(verifyFigures("Upload up to 7 days, under 2 MB and at most 10,000 transactions with 4 columns.", null).ok, true);
  assert.equal(verifyFigures("Your income was $500.", null).ok, false);
});

test("the model receives totals only, never descriptions or the file name", () => {
  const facts = JSON.stringify(reportFacts(report));
  assert.doesNotMatch(facts, /Website discovery|Studio rent|sample\.csv/);
  assert.match(facts, /"income":"24350.00"/);
});
