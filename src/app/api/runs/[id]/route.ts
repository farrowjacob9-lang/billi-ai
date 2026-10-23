import { HttpError, ok, requireSession, route } from "@/server/http";
import { deleteRun } from "@/server/repo";

export const DELETE = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await context.params;
  if (!await deleteRun(session.businessId, session.userId, id)) throw new HttpError(404, "not_found", "That report no longer exists.");
  return ok({ deleted: true });
});
