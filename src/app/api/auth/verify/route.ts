import { verifyEmail } from "@/server/auth";
import { clientIp, HttpError, ok, readJson, requireDatabase, route } from "@/server/http";
import { LIMITS, takeRateLimit } from "@/server/limits";

// Works without a session: the link may be opened on a different device from the one signed in.
export const POST = route(async request => {
  requireDatabase();
  const body = await readJson(request, 4096);
  if (!await takeRateLimit(`link:ip:${await clientIp()}`, LIMITS.linkRedemptionsPerIpPer15Minutes(), 900)) throw new HttpError(429, "rate_limited", "Too many attempts from this network. Wait 15 minutes, then try again.");
  await verifyEmail(body.token);
  return ok({ verified: true });
});
