import { HttpError, ok, readJson, requireSession, route } from "@/server/http";
import { createRoutine, listRoutines } from "@/server/repo";

export const GET = route(async () => {
  const session = await requireSession();
  return ok({ routines: await listRoutines(session.businessId) });
});

export const POST = route(async request => {
  const session = await requireSession();
  const body = await readJson(request, 4096);
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 80) throw new HttpError(400, "invalid_input", "Give the routine a name of up to 80 characters.");
  return ok({ routine: await createRoutine(session.businessId, session.userId, name) }, 201);
});
