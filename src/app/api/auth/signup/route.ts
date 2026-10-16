import { signUp } from "@/server/auth";
import { clientIp, HttpError, ok, readJson, requireDatabase, route, setSessionCookie } from "@/server/http";
import { LIMITS, takeRateLimit } from "@/server/limits";

export const POST = route(async request => {
  requireDatabase();
  const body = await readJson(request, 4096);
  if (!await takeRateLimit(`signup:ip:${await clientIp()}`, LIMITS.signupsPerIpPerHour(), 3600)) throw new HttpError(429, "rate_limited", "Too many new workspaces from this network. Try again in an hour.");
  const { token, session } = await signUp({ email: body.email, password: body.password, businessName: body.businessName });
  await setSessionCookie(token);
  return ok({ user: { email: session.email, businessName: session.businessName } }, 201);
});
