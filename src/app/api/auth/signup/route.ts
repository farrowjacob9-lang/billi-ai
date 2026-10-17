import { after } from "next/server";
import { signUp } from "@/server/auth";
import { emailConfigured, sendVerificationEmail } from "@/server/email";
import { clientIp, HttpError, ok, readJson, requireDatabase, route, setSessionCookie } from "@/server/http";
import { LIMITS, takeRateLimit } from "@/server/limits";

export const POST = route(async request => {
  requireDatabase();
  const body = await readJson(request, 4096);
  if (!await takeRateLimit(`signup:ip:${await clientIp()}`, LIMITS.signupsPerIpPerHour(), 3600)) throw new HttpError(429, "rate_limited", "Too many new workspaces from this network. Try again in an hour.");
  const { token, session, verification } = await signUp({ email: body.email, password: body.password, businessName: body.businessName });
  await setSessionCookie(token);
  if (emailConfigured()) after(() => sendVerificationEmail(verification));
  return ok({ user: { email: session.email, businessName: session.businessName, emailVerified: session.emailVerified } }, 201);
});
