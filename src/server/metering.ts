import { AsyncLocalStorage } from "node:async_hooks";
import { withTenant } from "./db.ts";
import { workspaceStorageReady } from "./workspaces";
export const aiContext = new AsyncLocalStorage<{
  businessId: string;
  operation: string;
}>();
export async function recordCall(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null,
  duration: number,
) {
  const context = aiContext.getStore();
  if (!context?.businessId) return;
  try {
    if (!(await workspaceStorageReady())) return;
    await withTenant(context.businessId, async (c) => {
      await c.query(
        "INSERT INTO ai_calls(business_id,model,operation,input_tokens,output_tokens,cache_write_tokens,cache_read_tokens,duration_ms,success) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          context.businessId,
          model,
          context.operation,
          usage?.input_tokens ?? 0,
          usage?.output_tokens ?? 0,
          usage?.cache_creation_input_tokens ?? 0,
          usage?.cache_read_input_tokens ?? 0,
          duration,
          !!usage,
        ],
      );
    });
  } catch {
    console.warn("[usage] Call metering unavailable");
  }
}
