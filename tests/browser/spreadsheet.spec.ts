import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";

test("real multi-sheet Excel supports totals, category questions, matching rows and switching sheets", async ({ page, request }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Expenses").addRows([
    ["Date", "Description", "Category", "Amount"],
    ["2026-10-01", "Private vendor alpha", "Travel", -10.10],
    ["2026-11-01", "Private vendor beta", "Travel", -20.20],
    ["2026-11-15", "Private vendor gamma", "Software", -50],
  ]);
  workbook.addWorksheet("Other").addRows([["Name", "Amount"], ["Example", 200]]);
  await page.goto("/");
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "real-expenses.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
  await expect(page.getByRole("region", { name: "Spreadsheet preview" })).toBeVisible();
  const composer = page.getByLabel("Message Billions");
  async function ask(q: string) { await composer.fill(q); await page.getByRole("button", { name: "Send message" }).click(); }
  await ask("total Amount");
  await expect(page.getByText(/All rows: -80.3/)).toBeVisible();
  await ask("sum Amount by Category");
  await expect(page.getByText(/Travel: -30.3\s+Software: -50/)).toBeVisible();
  await ask("Show the largest negative Amount transaction");
  await expect(page.getByText(/Row 4: Date: 2026-11-15/)).toBeVisible();
  const sent = JSON.stringify(await (await request.get("http://127.0.0.1:4010/requests")).json());
  expect(sent).toContain("Translate a spreadsheet question");
  expect(sent).not.toContain("Private vendor");
  await page.getByLabel("Active sheet").selectOption("1");
  await ask("total Amount");
  await expect(page.getByText(/All rows: 200/)).toBeVisible();
  await expect(page.getByText(/All rows: -80.3/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Spreadsheet preview" })).toHaveCount(0);
});

test("invalid plans cannot invent a column and formula cells are rejected", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "test.csv", mimeType: "text/csv", buffer: Buffer.from("Category,Amount\nTravel,-12.50") });
  await expect(page.getByRole("region", { name: "Spreadsheet preview" })).toBeVisible();
  await page.getByLabel("Message Billions").fill("invent a total");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Which numeric column should I use?")).toBeVisible();
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet("Formulas");
  ws.addRow(["Amount"]); ws.addRow([{ formula: "1+1", result: 2 }]);
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "formulas.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await book.xlsx.writeBuffer()) });
  await expect(page.getByRole("region", { name: "Conversation workspace" }).getByRole("alert")).toContainText("contains formulas");
});

test("spreadsheet endpoint enforces AI access and rejects cross-site requests", async ({ request }) => {
  const body = { sheet: { name: "test", columns: ["Amount"], rows: [[10]] }, question: "total Amount" };
  const crossSite = await request.post("/api/sheet-question", { data: body, headers: { origin: "https://evil.example" } });
  expect(crossSite.status()).toBe(403);
  const invalid = await request.post("/api/sheet-question", { data: { ...body, sheet: { name: "x", columns: ["Amount"], rows: [[{}]] } } });
  expect(invalid.status()).toBe(422);
});
