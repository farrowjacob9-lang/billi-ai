import { serve } from "inngest/next";
import { workflows } from "@/server/workflows/client";
import { runRoutine, scheduledRoutines } from "@/server/workflows/functions";
export const { GET, POST, PUT } = serve({
  client: workflows,
  functions: [runRoutine, scheduledRoutines],
});
