import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSnapshot } from "../src/lib/workspace.ts";
import { csvSheet } from "../src/lib/sheet.ts";
const sheet = csvSheet("Name,Amount\nA,12.50", "data.csv");
const snapshot = {
  sheets: [sheet],
  sheetIndex: 0,
  messages: [
    {
      id: 1,
      role: "assistant",
      text: "All rows: 12.5",
      plan: { operation: "sum", column: "Amount" },
      decision: {
        action: "changed",
        note: "Keep original answer; source needs checking.",
      },
    },
  ],
};
test("saved work preserves source data, the original answer and a separate review decision", () => {
  const saved = validateSnapshot(snapshot);
  assert.equal(saved.messages[0].text, "All rows: 12.5");
  assert.equal(saved.messages[0].decision?.action, "changed");
  assert.equal(saved.sheets[0].rows[0][1], "12.50");
});
test("saved work rejects malformed cells, oversized conversations and invented query columns", () => {
  assert.throws(
    () =>
      validateSnapshot({
        ...snapshot,
        messages: [
          ...snapshot.messages,
          { id: 2, role: "assistant", text: "x".repeat(40001) },
        ],
      }),
    /Invalid conversation/,
  );
  assert.throws(
    () =>
      validateSnapshot({
        ...snapshot,
        messages: [
          {
            ...snapshot.messages[0],
            plan: { operation: "sum", column: "Invented" },
          },
        ],
      }),
    /numeric column/,
  );
  assert.throws(
    () => validateSnapshot({ ...snapshot, sheetIndex: 9 }),
    /Save up to/,
  );
});
