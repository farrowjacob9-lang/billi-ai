import { logIn, pruneAuthTables } from "@/server/auth";
import { clientIp, HttpError, ok, readJson, requireDatabase, route, setSessionCookie } from "@/server/http";
import { LIMITS, pruneRateLimits, takeRateLimit } from "@/server/limits";

export const POST = route(async request => {
  requireDatabase();
  const body = await readJson(request, 4096);
  if (!await takeRateLimit(`signin:ip:${await clientIp()}`, LIMITS.signInsPerIpPer15Minutes(), 900)) throw new HttpError(429, "rate_limited", "Too many sign-in attempts from this network. Wait 15 minutes, then try again.");
  const { token, session } = await logIn({ email: body.email, password: body.password });
  await setSessionCookie(token);
  void Promise.all([pruneAuthTables(), pruneRateLimits()]).catch(() => undefined);
  return ok({ user: { email: session.email, businessName: session.businessName, emailVerified: session.emailVerified } });
});
