import { test, expect } from "@playwright/test";

test("sample report, checks, download, routine and history work across refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What would you like to work on?" })).toBeVisible();
  await page.screenshot({ path: "/tmp/billions-desktop.png", fullPage: true });
  // The conversation has the page to itself until a report exists, then shares it.
  await expect(page.getByRole("region", { name: "Report" })).toHaveCount(0);
  await page.getByRole("button", { name: "Try a sample report" }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Report" })).toBeVisible();
  const [chat, output] = await Promise.all([page.getByRole("region", { name: "Conversation workspace" }).boundingBox(), page.getByRole("region", { name: "Report" }).boundingBox()]);
  expect(output!.x).toBeGreaterThan(chat!.x + chat!.width - 1);
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
  await page.getByRole("navigation").getByRole("button", { name: /Report routines/ }).click();
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
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "my-week.csv", mimeType: "text/csv", buffer: Buffer.from("date,description,category,amount\n2026-10-05,Consulting,Sales,1250.50\n2026-10-06,Travel,Operations,-50.25") });
  await page.getByText("Weekly report", {exact:true}).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Prepare weekly report", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  await expect(page.getByText("$1,200.25", { exact: true })).toBeVisible();
  await page.getByLabel("Message Naxium").fill("Break down my expenses");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Your expenses total \$50.25/)).toBeVisible();
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from("date,amount\n2026-10-05") });
  await expect(page.getByRole("region", { name: "Conversation workspace" }).getByRole("alert")).toContainText("CSV rows have different numbers of fields");
  await expect(page.getByRole("region", { name: "Conversation workspace" }).getByRole("alert")).toContainText("Let’s check that file.");
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("button", { name: /my-week.csv/ }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /invalid.csv/ })).toHaveCount(0);
});

test("the app has icons, and the logo and breadcrumb return to Overview without a reload", async ({ page, request }) => {
  for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon.png"]) expect((await request.get(path)).status(), path).toBe(200);
  await page.goto("/");
  await expect(page.locator("link[rel=icon]").first()).toHaveAttribute("href", /favicon\.ico|icon/);
  await page.evaluate(() => { (window as unknown as { marker: boolean }).marker = true; });
  await page.getByRole("navigation").getByRole("button", { name: /Report routines/ }).click();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What would you like to work on?" })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await page.getByRole("link", { name: "Naxium overview" }).click();
  await expect(page.getByRole("heading", { name: "What would you like to work on?" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
  await expect(page.locator(".workspace-picker svg")).toHaveCount(0);
});

test("one report can be deleted from run history, leaving the rest", async ({ page }) => {
  await page.goto("/");
  for (const name of ["first.csv", "second.csv"]) {
    await page.getByLabel("Upload spreadsheet").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from("date,description,category,amount\n2026-10-05,Consulting,Sales,100.00") });
    await page.getByText("Weekly report", {exact:true}).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Prepare weekly report", exact: true }).click();
    await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  }
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await page.getByRole("button", { name: /^Delete report first\.csv/ }).click();
  await expect(page.getByText("Report deleted.")).toBeVisible();
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("button", { name: /second\.csv/ }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /first\.csv/ })).toHaveCount(0);
});

test("mobile navigation, dialog and report fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/billions-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation").getByRole("button", { name: /Report routines/ }).click();
  await expect(page.getByRole("heading", { name: "Your routines." })).toBeVisible();
  await page.getByRole("button", { name: "Create your first routine" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("cancelling an in-progress report does not save a completed run", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample report" }).click();
  await page.getByRole("button", { name: "Cancel report" }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toHaveCount(0);
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("heading", { name: "Your work has a place here." })).toBeVisible();
});
