import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

const unique = () => `${randomBytes(4).toString("hex")}@example.com`;
const PASSWORD = "correct horse battery";

// The fake Resend server (tests/fake-resend.ts) keeps every email; wait for the nth to an address.
async function emailedLink(email: string, path: string, nth = 1): Promise<string> {
  let link = "";
  await expect.poll(async () => {
    const sent = await (await fetch(`http://127.0.0.1:4011/emails?to=${encodeURIComponent(email)}`)).json() as { text: string }[];
    const links = sent.map(m => new RegExp(`http://127\\.0\\.0\\.1:3001${path}#token=[\\w-]+`).exec(m.text)?.[0]).filter(Boolean) as string[];
    link = links[nth - 1] ?? "";
    return link;
  }, { timeout: 15_000 }).not.toBe("");
  return link;
}

async function signUp(page: Page, email: string, business: string, { verify = true } = {}) {
  await page.goto("/");
  await page.getByRole("button", { name: "New to Billions? Create a workspace" }).click();
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();
  if (!verify) return;
  await page.goto(await emailedLink(email, "/verify-email"));
  await expect(page.getByRole("heading", { name: "Email confirmed." })).toBeVisible();
  await page.getByRole("link", { name: "Go to Billions" }).click();
  await expect(page.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Workspace settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
}

test("signed-out visitors see only the sign-in screen and the API refuses them", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try a sample report" })).toHaveCount(0);
  for (const path of ["/api/runs", "/api/routines"]) expect((await request.get(path)).status()).toBe(401);
  expect((await request.post("/api/chat", { data: { question: "hi" } })).status()).toBe(401);
});

test("a business's reports and routines persist on the server and stay private to it", async ({ page, browser }) => {
  const a = unique(), b = unique();
  await signUp(page, a, "Harbour Studio");
  await expect(page.getByText("Reports are saved to Harbour Studio only.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Try a sample report" }).click();
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

test("an ended session returns to the sign-in screen, and single reports can be deleted", async ({ page, context }) => {
  await signUp(page, unique(), "Expiry Co");
  await page.getByRole("button", { name: "Try a sample report" }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: /Run history/ }).click();
  await page.getByRole("button", { name: /^Delete report sample-week\.csv/ }).click();
  await expect(page.getByText("Report deleted.")).toBeVisible();
  expect(await page.evaluate(async () => (await (await fetch("/api/runs")).json()).runs.length)).toBe(0);

  await context.clearCookies();
  await page.getByRole("button", { name: /^New conversation/ }).click();
  await page.getByRole("button", { name: "Try a sample report" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByText("Your session has ended.", { exact: false })).toBeVisible();
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

test("a new account can report straight away, and turns on the AI by confirming its email", async ({ page }) => {
  const email = unique();
  await signUp(page, email, "Unverified Co", { verify: false });
  await expect(page.getByText("Confirm your email to turn on the AI assistant.")).toBeVisible();
  await page.getByRole("button", { name: "Try a sample report" }).click();
  await expect(page.getByText("Template summary")).toBeVisible();
  expect((await page.evaluate(async () => (await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "hi" }) })).json())).error.code).toBe("verify_email");

  await page.getByRole("button", { name: "Send a new link" }).click();
  await expect(page.getByText("We’ve sent a new link", { exact: false })).toBeVisible();
  const first = await emailedLink(email, "/verify-email", 1), second = await emailedLink(email, "/verify-email", 2);
  await page.goto(first);
  await expect(page.getByRole("heading", { name: "We couldn’t confirm that." })).toBeVisible();
  await page.goto("about:blank"); // an emailed link opens a fresh page, not a same-page hash change
  await page.goto(second);
  await expect(page.getByRole("heading", { name: "Email confirmed." })).toBeVisible();
  expect(new URL(page.url()).hash, "the token is dropped from the address bar").toBe("");
  await page.getByRole("link", { name: "Go to Billions" }).click();
  await expect(page.getByText("Confirm your email to turn on the AI assistant.")).toHaveCount(0);
  await page.getByRole("button", { name: "Try a sample report" }).click();
  await expect(page.getByText("Written by Claude · figures verified")).toBeVisible();
});

test("a forgotten password is reset from an emailed link, which also lifts a lockout", async ({ page, browser }) => {
  const email = unique();
  await signUp(page, email, "Forgetful Co");
  const other = await browser.newContext();
  const elsewhere = await other.newPage();
  await elsewhere.goto("/");
  await signIn(elsewhere, email);
  await expect(elsewhere.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();
  await signOut(page);

  for (let i = 0; i < 6; i++) { await signIn(page, email, "not my password"); await expect(page.locator(".error-card[role=alert]")).toBeVisible(); }
  await expect(page.locator(".error-card[role=alert]")).toContainText("Too many attempts");

  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText("a reset link is on its way", { exact: false })).toBeVisible();
  const link = await emailedLink(email, "/reset-password");
  await page.goto(link);
  await page.getByLabel("New password", { exact: true }).fill("a brand new passphrase");
  await page.getByLabel("Confirm new password").fill("a brand new passphrase");
  await page.getByRole("button", { name: "Save and sign in" }).click();
  await expect(page.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();

  await page.goto(link);
  await page.getByLabel("New password", { exact: true }).fill("yet another passphrase");
  await page.getByLabel("Confirm new password").fill("yet another passphrase");
  await page.getByRole("button", { name: "Save and sign in" }).click();
  await expect(page.locator(".error-card[role=alert]")).toContainText("expired or was already used");

  await elsewhere.reload();
  await expect(elsewhere.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await signIn(elsewhere, email, "a brand new passphrase");
  await expect(elsewhere.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();
  await other.close();
});

test("an unknown email gets the same reset answer and no email", async ({ page }) => {
  const email = unique();
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText("a reset link is on its way", { exact: false })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await (await fetch(`http://127.0.0.1:4011/emails?to=${encodeURIComponent(email)}`)).json()).toEqual([]);
});

test("settings change the password, link the legal pages, and delete the account", async ({ page, browser }) => {
  const email = unique();
  await signUp(page, email, "Leaving Co");
  await page.getByRole("button", { name: "Try a sample report" }).click();
  await expect(page.getByRole("button", { name: "Download report" })).toBeVisible();
  const other = await browser.newContext();
  const elsewhere = await other.newPage();
  await elsewhere.goto("/");
  await signIn(elsewhere, email);
  await expect(elsewhere.getByRole("heading", { name: "Make room for your best work." })).toBeVisible();

  await page.getByRole("button", { name: "Workspace settings" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("dialog").getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  await page.getByRole("button", { name: "Change password" }).click();
  await page.getByLabel("Current password").fill("wrong password!");
  await page.getByLabel("New password", { exact: true }).fill("a brand new passphrase");
  await page.getByLabel("Confirm new password").fill("a brand new passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("That password isn’t right.");
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.", { exact: false })).toBeVisible();
  await elsewhere.reload();
  await expect(elsewhere.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await other.close();

  await page.getByRole("button", { name: "Workspace settings" }).click();
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByLabel("Password").fill("a brand new passphrase");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Delete account and data" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await signIn(page, email, "a brand new passphrase");
  await expect(page.locator(".error-card[role=alert]")).toContainText("don’t match an account");
});

test("sign-up links the draft legal pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New to Billions? Create a workspace" }).click();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  for (const [path, heading] of [["/privacy", "Privacy Policy."], ["/terms", "Terms of Service."]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Draft for review");
  }
});
