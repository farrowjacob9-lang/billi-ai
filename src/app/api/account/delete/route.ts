import { deleteAccount } from "@/server/auth";
import { clearSessionCookie, ok, readJson, requireSession, route } from "@/server/http";

// Permanent: the user, their business and all of its reports, routines and records.
export const POST = route(async request => {
  const session = await requireSession();
  const body = await readJson(request, 4096);
  await deleteAccount(session, body.password);
  await clearSessionCookie();
  return ok({ deleted: true });
});
