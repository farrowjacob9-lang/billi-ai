import { ok, requireSession, route } from "@/server/http";
import { withTenant } from "@/server/db";
import { workspaceStorageReady } from "@/server/workspaces";
import { LIMITS } from "@/server/limits";
export const GET = route(async () => {
  const s = await requireSession();
  const ready = await workspaceStorageReady();
  return withTenant(s.businessId, async (c) => {
    const used =
      (
        await c.query(
          "SELECT calls FROM ai_usage WHERE business_id=$1 AND day=(now() AT TIME ZONE 'utc')::date",
          [s.businessId],
        )
      ).rows[0]?.calls ?? 0;
    const calls = ready
      ? (
          await c.query(
            "SELECT model,operation,count(*)::int AS calls,sum(input_tokens)::bigint AS input_tokens,sum(output_tokens)::bigint AS output_tokens,sum(cache_write_tokens)::bigint AS cache_write_tokens,sum(cache_read_tokens)::bigint AS cache_read_tokens,count(*) FILTER(WHERE NOT success)::int AS failures FROM ai_calls WHERE business_id=$1 AND created_at>now()-interval '30 days' GROUP BY model,operation",
            [s.businessId],
          )
        ).rows
      : [];
    return ok({
      used,
      limit: LIMITS.aiCallsPerBusinessPerDay(),
      calls,
      metering: ready,
    });
  });
});
