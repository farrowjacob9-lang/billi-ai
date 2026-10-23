import { ok, requireSession, route, HttpError } from "@/server/http";
import {
  requireWorkspaceStorage,
  getWorkspace,
  deleteWorkspace,
} from "@/server/workspaces";
export const GET = route(
  async (_req, ctx: { params: Promise<{ id: string }> }) => {
    const s = await requireSession();
    await requireWorkspaceStorage();
    const w = await getWorkspace(s.businessId, (await ctx.params).id);
    if (!w) throw new HttpError(404, "not_found", "Workspace not found.");
    return ok({ workspace: w });
  },
);
export const DELETE = route(
  async (_req, ctx: { params: Promise<{ id: string }> }) => {
    const s = await requireSession();
    await requireWorkspaceStorage();
    return ok({
      deleted: await deleteWorkspace(
        s.businessId,
        s.userId,
        (await ctx.params).id,
      ),
    });
  },
);
