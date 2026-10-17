import { createHash } from "node:crypto";
import type { EmailLink } from "./auth.ts";

// The only module that sends email, through Resend's HTTP API. Every message is transactional
// and goes only to the address that asked for it.

// Links are built from configuration, never from the request's Host header, so a forged Host
// can't make a reset email point somewhere else.
export function appUrl(): string | null {
  const configured = process.env.BILLIONS_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.hostname === "127.0.0.1" || url.hostname === "localhost" ? url.origin : null;
  } catch { return null; }
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM && !!appUrl();
// Some email settings present but not all valid: a mistake, not a choice to run without email.
export const emailMisconfigured = () => !emailConfigured() && !!(process.env.RESEND_API_KEY || process.env.EMAIL_FROM || process.env.BILLIONS_APP_URL);

type Message = { to: string; subject: string; text: string };

// Returns false when the message couldn't be handed to Resend. Never logs the address or the link.
export async function sendEmail(message: Message, idempotencyKey: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const response = await fetch(`${process.env.RESEND_BASE_URL || "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) { console.error(`[email] Resend refused a message: ${response.status}`); return false; }
    return true;
  } catch (error) {
    console.error(`[email] could not reach Resend: ${error instanceof Error ? error.name : "unknown error"}`);
    return false;
  }
}

// The token travels in the URL fragment: browsers never send it to the server or in a Referer,
// and the page posts it only when the person acts on it.
const link = (path: string, token: string) => `${appUrl()}${path}#token=${token}`;
const keyFor = (token: string) => createHash("sha256").update(`email:${token}`).digest("hex");

export function sendVerificationEmail({ email, token }: EmailLink) {
  return sendEmail({
    to: email,
    subject: "Confirm your email for Billions",
    text: `Welcome to Billions.\n\nConfirm this is your email address to turn on the AI assistant:\n${link("/verify-email", token)}\n\nThe link works once and expires in 24 hours. If you didn’t create a Billions workspace, ignore this email.\n`,
  }, keyFor(token));
}

export function sendPasswordResetEmail({ email, token }: EmailLink) {
  return sendEmail({
    to: email,
    subject: "Reset your Billions password",
    text: `Someone asked to reset the password for this Billions account.\n\nChoose a new password here:\n${link("/reset-password", token)}\n\nThe link works once and expires in 30 minutes. Resetting signs out every other device. If you didn’t ask for this, ignore this email; your password stays the same.\n`,
  }, keyFor(token));
}
