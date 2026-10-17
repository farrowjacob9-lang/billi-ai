import { HttpError, ok, requireSession, route } from "@/server/http";
import { deleteRoutine } from "@/server/repo";

export const DELETE = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await context.params;
  if (!await deleteRoutine(session.businessId, session.userId, id)) throw new HttpError(404, "not_found", "That routine no longer exists.");
  return ok({ deleted: true });
});
