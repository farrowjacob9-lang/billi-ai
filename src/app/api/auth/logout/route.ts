import { cookies } from "next/headers";
import { endSession, SESSION_COOKIE } from "@/server/auth";
import { clearSessionCookie, ok, requireDatabase, route } from "@/server/http";

export const POST = route(async () => {
  requireDatabase();
  await endSession((await cookies()).get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  return ok({ signedOut: true });
});
