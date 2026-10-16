import { logIn, pruneAuthTables } from "@/server/auth";
import { ok, readJson, requireDatabase, route, setSessionCookie } from "@/server/http";

export const POST = route(async request => {
  requireDatabase();
  const body = await readJson(request, 4096);
  const { token, session } = await logIn({ email: body.email, password: body.password });
  await setSessionCookie(token);
  void pruneAuthTables().catch(() => undefined);
  return ok({ user: { email: session.email, businessName: session.businessName } });
});
