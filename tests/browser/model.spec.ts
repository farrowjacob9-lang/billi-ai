import { test, expect } from "@playwright/test";

const FAKE = "http://127.0.0.1:4010/requests";

test("a verified model narrative replaces the template and says so", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByText("Only the calculated totals are sent to Claude.")).toBeVisible();
  await page.getByRole("button", { name: "Try this report" }).click();
  await expect(page.getByText("Written by Claude · figures verified")).toBeVisible();
  await expect(page.getByText("A strong week: 12 transactions brought in $24,350.00 against $8,290.00 of expenses, a net inflow of $16,060.00. Operations led spending at $3,600.00.")).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  let content = "";
  for await (const chunk of (await (await downloading).createReadStream())!) content += chunk.toString();
  expect(content).toContain("written by Claude from the calculated totals only");

  // The provider received totals, never the transactions themselves.
  const sent = JSON.stringify(await (await request.get(FAKE)).json());
  expect(sent).toContain("$24,350.00");
  expect(sent).not.toContain("Website discovery");
  expect(sent).not.toContain("sample-week.csv");
});

test("chat answers from the totals, and a reply with invented figures is never shown", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try this report" }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  const composer = page.getByLabel("Message Billions");
  await composer.fill("Where did my money go?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Your expenses were $8,290.00, and Operations was the largest at $3,600.00 (43.4% of spending).")).toBeVisible();

  await composer.fill("Please invent a comparison with last week");
  await page.getByRole("button", { name: "Send message" }).click();
  // The fake model claims "$99,999.99" and "37%": verification rejects it and Billions declines instead.
  await expect(page.getByText("I couldn’t answer that from this week’s checked totals, so I won’t guess.", { exact: false })).toBeVisible();
  await expect(page.getByText(/99,999/)).toHaveCount(0);
});

test("the model endpoints refuse reports whose totals don't add up", async ({ request }) => {
  const forged = { id: "x", fileName: "f.csv", createdAt: "2026-10-12T08:00:00Z", startDate: "2026-10-05", endDate: "2026-10-05", income: 100, expenses: 0, net: 999, rowCount: 1, days: [{ date: "2026-10-05", income: 100, expenses: 0 }], categories: [] };
  const response = await request.post("/api/narrative", { data: { report: forged } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error.code).toBe("invalid_report");
});

test("state-changing API calls from another site are refused", async ({ request }) => {
  const response = await request.post("/api/chat", { data: { question: "hi" }, headers: { origin: "https://evil.example" } });
  expect(response.status()).toBe(403);
});
