import { resetPassword } from "@/server/auth";
import { clientIp, HttpError, ok, readJson, requireDatabase, route, setSessionCookie } from "@/server/http";
import { LIMITS, takeRateLimit } from "@/server/limits";

export const POST = route(async request => {
  requireDatabase();
  const body = await readJson(request, 4096);
  if (!await takeRateLimit(`link:ip:${await clientIp()}`, LIMITS.linkRedemptionsPerIpPer15Minutes(), 900)) throw new HttpError(429, "rate_limited", "Too many attempts from this network. Wait 15 minutes, then try again.");
  const { token, session } = await resetPassword({ token: body.token, password: body.password });
  await setSessionCookie(token);
  return ok({ user: { email: session.email, businessName: session.businessName, emailVerified: session.emailVerified } });
});
