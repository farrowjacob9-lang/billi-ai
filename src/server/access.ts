import { headers } from "next/headers";
import type { Session } from "./auth.ts";
import { aiConfigured, aiDailyLimit, anonymousAiAllowed } from "./ai.ts";
import { databaseConfigured } from "./db.ts";
import { currentSession, HttpError } from "./http.ts";
import { takeAiCall } from "./repo.ts";
import type { Capabilities } from "../lib/store.ts";

export async function capabilities(): Promise<Capabilities> {
  const session = await currentSession();
  return {
    mode: databaseConfigured() ? "cloud" : "local",
    ai: aiConfigured() && (session ? true : !databaseConfigured() && anonymousAiAllowed()),
    user: session ? { email: session.email, businessName: session.businessName } : null,
  };
}

// Best effort only: memory is per server instance. Real quotas need accounts (ai_usage table).
const anonymousCalls = new Map<string, { windowStart: number; count: number }>();
const ANONYMOUS_LIMIT = 20, ANONYMOUS_WINDOW_MS = 60 * 60 * 1000;

function takeAnonymousCall(key: string) {
  const now = Date.now(), entry = anonymousCalls.get(key);
  if (!entry || now - entry.windowStart > ANONYMOUS_WINDOW_MS) { anonymousCalls.set(key, { windowStart: now, count: 1 }); return true; }
  if (entry.count >= ANONYMOUS_LIMIT) return false;
  entry.count++; return true;
}

// Every model call passes here: who may spend, and whether today's allowance is left.
export async function requireAiAccess(): Promise<Session | null> {
  if (!aiConfigured()) throw new HttpError(404, "ai_disabled", "No AI model is connected on this deployment.");
  const session = await currentSession();
  if (session) {
    if (!await takeAiCall(session.businessId, aiDailyLimit())) throw new HttpError(429, "ai_quota", "Today’s AI allowance for this business is used up. Reports still work with the template summary.");
    return session;
  }
  if (databaseConfigured() || !anonymousAiAllowed()) throw new HttpError(401, "signed_out", "Sign in to use the AI assistant.");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!takeAnonymousCall(ip)) throw new HttpError(429, "ai_rate_limited", "That’s a lot of questions for one hour. Try again a little later.");
  return null;
}
