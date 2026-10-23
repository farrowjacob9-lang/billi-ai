import { ok, requireSession, route } from "@/server/http";
import { workspaceStorageReady } from "@/server/workspaces";
import { emailConfigured } from "@/server/email";
import { workflowsConfigured } from "@/server/workflows/client";
import { aiConfigured } from "@/server/ai";
export const GET = route(async () => {
  await requireSession();
  return ok({storage:await workspaceStorageReady(), ai:aiConfigured(), accountEmail:emailConfigured(), scheduledWorkflows:workflowsConfigured(),billing:false});
});
