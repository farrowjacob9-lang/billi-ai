import { signUp } from "@/server/auth";
import { ok, readJson, requireDatabase, route, setSessionCookie } from "@/server/http";

export const POST = route(async request => {
  requireDatabase();
  const body = await readJson(request, 4096);
  const { token, session } = await signUp({ email: body.email, password: body.password, businessName: body.businessName });
  await setSessionCookie(token);
  return ok({ user: { email: session.email, businessName: session.businessName } }, 201);
});
