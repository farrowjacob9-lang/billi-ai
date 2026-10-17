import { after } from "next/server";
import { startEmailVerification } from "@/server/auth";
import { sendVerificationEmail } from "@/server/email";
import { HttpError, ok, requireEmail, requireSession, route } from "@/server/http";
import { LIMITS, takeRateLimit } from "@/server/limits";

export const POST = route(async () => {
  requireEmail();
  const session = await requireSession();
  if (session.emailVerified) return ok({ sent: false, verified: true });
  if (!await takeRateLimit(`verify:user:${session.userId}`, LIMITS.verifyEmailsPerUserPerHour, 3600)) throw new HttpError(429, "rate_limited", "We’ve sent a few links already. Check your inbox and spam folder, or try again in an hour.");
  const link = await startEmailVerification(session.userId);
  if (link) after(() => sendVerificationEmail(link));
  return ok({ sent: !!link, verified: !link });
});
