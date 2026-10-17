import { after } from "next/server";
import { normalizeEmail, requestPasswordReset } from "@/server/auth";
import { sendPasswordResetEmail } from "@/server/email";
import { clientIp, HttpError, ok, readJson, requireEmail, route } from "@/server/http";
import { LIMITS, takeRateLimit } from "@/server/limits";

// Answers the same way, at the same speed, whether or not the email has an account: the lookup
// and the send both happen after the response.
export const POST = route(async request => {
  requireEmail();
  const body = await readJson(request, 4096);
  const email = normalizeEmail(body.email);
  if (!email) throw new HttpError(400, "invalid_input", "Enter the email you signed up with.");
  if (!await takeRateLimit(`reset:ip:${await clientIp()}`, LIMITS.resetRequestsPerIpPerHour, 3600)) throw new HttpError(429, "rate_limited", "Too many reset requests from this network. Try again in an hour.");
  after(async () => {
    try {
      if (!await takeRateLimit(`reset:email:${email}`, LIMITS.resetEmailsPerAddressPerHour, 3600)) return;
      const link = await requestPasswordReset(email);
      if (link) await sendPasswordResetEmail(link);
    } catch (e) { console.error("[auth] password reset request failed", e instanceof Error ? e.message : e); }
  });
  return ok({ sent: true }, 202);
});
