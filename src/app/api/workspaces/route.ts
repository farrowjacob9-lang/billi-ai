import { validateSnapshot } from "@/lib/workspace";
import { ok, readJson, requireSession, route, HttpError } from "@/server/http";
import {
  requireWorkspaceStorage,
  listWorkspaces,
  saveWorkspace,
} from "@/server/workspaces";
export const GET = route(async () => {
  const s = await requireSession();
  await requireWorkspaceStorage();
  return ok({ workspaces: await listWorkspaces(s.businessId) });
});
export const POST = route(async (req) => {
  const s = await requireSession();
  await requireWorkspaceStorage();
  const b = await readJson(req, 2.5 * 1024 * 1024);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 120)
    throw new HttpError(
      400,
      "invalid_input",
      "Give your workspace a name (up to 120 characters).",
    );
  let snapshot;
  try {
    snapshot = validateSnapshot(b.snapshot);
  } catch (e) {
    throw new HttpError(
      422,
      "invalid_workspace",
      e instanceof Error ? e.message : "Invalid workspace.",
    );
  }
  return ok(
    {
      workspace: await saveWorkspace(
        s.businessId,
        s.userId,
        name,
        snapshot,
        typeof b.id === "string" ? b.id : undefined,
        typeof b.revision === "string" ? b.revision : undefined,
      ),
    },
    201,
  );
});
