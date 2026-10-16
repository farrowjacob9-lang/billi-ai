import { test, expect } from "@playwright/test";

test("sample report, checks, download, routine and history work across refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();
  await page.screenshot({ path: "/tmp/billions-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Try this report" }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  await expect(page.getByText("$16,060", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "12 records checked. Totals reconciled." }).click();
  await expect(page.getByText("Original file unchanged", { exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("billions-report-2026-10-05.md");
  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  expect(content).toContain("$16,060.00");
  expect(content).toContain("not an AI model");
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await page.getByLabel("Routine name").fill("Monday business snapshot");
  await page.getByRole("button", { name: "Save routine", exact: true }).last().click();
  await page.getByRole("navigation").getByRole("button", { name: /Routines/ }).click();
  await expect(page.getByRole("heading", { name: "Monday business snapshot" })).toBeVisible();
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("button", { name: /sample-week.csv/ }).last()).toBeVisible();
  await page.getByLabel("Search run history").fill("missing.csv");
  await expect(page.getByRole("heading", { name: "No matching reports" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("real uploaded data drives calculations, errors stop invalid reports", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Upload weekly CSV").setInputFiles({ name: "my-week.csv", mimeType: "text/csv", buffer: Buffer.from("date,description,category,amount\n2026-10-05,Consulting,Sales,1250.50\n2026-10-06,Travel,Operations,-50.25") });
  await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  await expect(page.getByText("$1,200.25", { exact: true })).toBeVisible();
  await page.getByLabel("Message Billions").fill("Break down my expenses");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Your expenses total \$50.25/)).toBeVisible();
  await page.getByLabel("Upload weekly CSV").setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from("date,amount\n2026-10-05,10") });
  await expect(page.getByRole("region", { name: "Conversation workspace" }).getByRole("alert")).toContainText("Missing description, category columns");
  await expect(page.getByRole("button", { name: "Download report" })).toHaveCount(0);
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("button", { name: /my-week.csv/ }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /invalid.csv/ })).toHaveCount(0);
});

test("mobile navigation, dialog and report fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/billions-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation").getByRole("button", { name: /Routines/ }).click();
  await expect(page.getByRole("heading", { name: "Your routines." })).toBeVisible();
  await page.getByRole("button", { name: "Create your first routine" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("cancelling an in-progress report does not save a completed run", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try this report" }).click();
  await page.getByRole("button", { name: "Cancel report" }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toHaveCount(0);
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("heading", { name: "Your work has a place here." })).toBeVisible();
});
