import { changePassword } from "@/server/auth";
import { ok, readJson, requireSession, route, sessionToken } from "@/server/http";

export const POST = route(async request => {
  const session = await requireSession();
  const body = await readJson(request, 4096);
  await changePassword(session, (await sessionToken())!, { currentPassword: body.currentPassword, newPassword: body.newPassword });
  return ok({ changed: true });
});
