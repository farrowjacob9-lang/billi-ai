import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

const unique = () => `${randomBytes(4).toString("hex")}@example.com`;
const PASSWORD = "correct horse battery";

async function signUp(page: Page, email: string, business: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "New to Billions? Create a workspace" }).click();
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Workspace settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
}

test("signed-out visitors see only the sign-in screen and the API refuses them", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try this report" })).toHaveCount(0);
  for (const path of ["/api/runs", "/api/routines"]) expect((await request.get(path)).status()).toBe(401);
  expect((await request.post("/api/chat", { data: { question: "hi" } })).status()).toBe(401);
});

test("a business's reports and routines persist on the server and stay private to it", async ({ page, browser }) => {
  const a = unique(), b = unique();
  await signUp(page, a, "Harbour Studio");
  await expect(page.getByText("Reports are saved to Harbour Studio only.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Try this report" }).click();
  await expect(page.getByText("Written by Claude · figures verified")).toBeVisible();
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await page.getByLabel("Routine name").fill("Harbour Monday snapshot");
  await page.getByRole("button", { name: "Save routine", exact: true }).last().click();
  await expect(page.getByText("Routine saved to Harbour Studio.", { exact: false })).toBeVisible();
  const routineId = await page.evaluate(async () => (await (await fetch("/api/routines")).json()).routines[0].id as string);

  // A fresh browser has no local storage: whatever it shows came from the server.
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "Sign in" }).waitFor();
  await second.getByLabel("Email").fill(a);
  await second.getByLabel("Password").fill(PASSWORD);
  await second.getByRole("button", { name: "Sign in" }).click();
  await second.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(second.getByRole("button", { name: /sample-week\.csv/ }).last()).toBeVisible();
  await other.close();

  await signOut(page);
  await signUp(page, b, "Other Co");
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await expect(page.getByRole("heading", { name: "Your work has a place here." })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: /Routines/ }).click();
  await expect(page.getByRole("heading", { name: "Make the next time easier." })).toBeVisible();
  const status = await page.evaluate(async id => (await fetch(`/api/routines/${id}`, { method: "DELETE" })).status, routineId);
  expect(status).toBe(404);
});

test("wrong passwords are refused with a clear message", async ({ page }) => {
  const email = unique();
  await signUp(page, email, "Typo Pty Ltd");
  await signOut(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not my password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".error-card[role=alert]")).toContainText("That email and password don’t match an account.");
});
