import type { Session } from "./auth.ts";
import { aiConfigured, anonymousAiAllowed } from "./ai.ts";
import { databaseConfigured } from "./db.ts";
import { emailConfigured } from "./email.ts";
import { clientIp, currentSession, HttpError } from "./http.ts";
import { takeAiAllowance } from "./limits.ts";
import type { Capabilities } from "../lib/store.ts";

// Until its email is verified, an account gets reports but not the model, so a sign-up with
// someone else's address can't spend. Without email set up there is no way to verify: no gate.
export const aiAllowedFor = (session: Session) => session.emailVerified || !emailConfigured();

export async function capabilities(): Promise<Capabilities> {
  const session = await currentSession();
  return {
    mode: databaseConfigured() ? "cloud" : "local",
    ai: aiConfigured() && (session ? aiAllowedFor(session) : !databaseConfigured() && anonymousAiAllowed()),
    email: databaseConfigured() && emailConfigured(),
    user: session ? { email: session.email, businessName: session.businessName, emailVerified: session.emailVerified } : null,
  };
}

// Best effort only: memory is per server instance. Real quotas need accounts (ai_usage table).
const anonymousCalls = new Map<string, { windowStart: number; count: number }>();
const ANONYMOUS_LIMIT = 20, ANONYMOUS_WINDOW_MS = 60 * 60 * 1000;

function takeAnonymousCall(key: string) {
  const now = Date.now(), entry = anonymousCalls.get(key);
  if (anonymousCalls.size > 10_000) for (const [k, v] of anonymousCalls) if (now - v.windowStart > ANONYMOUS_WINDOW_MS) anonymousCalls.delete(k);
  if (!entry || now - entry.windowStart > ANONYMOUS_WINDOW_MS) { anonymousCalls.set(key, { windowStart: now, count: 1 }); return true; }
  if (entry.count >= ANONYMOUS_LIMIT) return false;
  entry.count++; return true;
}

// Every model call passes here: who may spend, and whether today's allowance is left.
export async function requireAiAccess(): Promise<Session | null> {
  if (!aiConfigured()) throw new HttpError(404, "ai_disabled", "No AI model is connected on this deployment.");
  const session = await currentSession();
  if (session) {
    if (!aiAllowedFor(session)) throw new HttpError(403, "verify_email", "Confirm your email to turn on the AI assistant. Reports still work with the template summary.");
    const allowance = await takeAiAllowance(session.businessId);
    if (allowance === "business_limit") throw new HttpError(429, "ai_quota", "Today’s AI allowance for this business is used up. Reports still work with the template summary.");
    if (allowance === "global_limit") throw new HttpError(429, "ai_quota", "The AI assistant is resting until tomorrow. Reports still work with the template summary.");
    return session;
  }
  if (databaseConfigured() || !anonymousAiAllowed()) throw new HttpError(401, "signed_out", "Sign in to use the AI assistant.");
  if (!takeAnonymousCall(await clientIp())) throw new HttpError(429, "ai_rate_limited", "That’s a lot of questions for one hour. Try again a little later.");
  return null;
}
