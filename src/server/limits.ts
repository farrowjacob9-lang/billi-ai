import { query } from "./db.ts";
import { takeAiCall } from "./repo.ts";

// Atomically counts one event in the current fixed window. False once the window is full.
export async function takeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { rowCount } = await query(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / $3) * $3), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1 WHERE rate_limits.count < $2
     RETURNING count`, [key, limit, windowSeconds]);
  return rowCount === 1;
}

export const LIMITS = {
  signupsPerIpPerHour: () => Number(process.env.BILLIONS_SIGNUPS_PER_IP_PER_HOUR) || 5,
  signInsPerIpPer15Minutes: 30,
  // Emailed links: per IP, and per address so one inbox can't be flooded.
  resetRequestsPerIpPerHour: 10,
  resetEmailsPerAddressPerHour: 3,
  verifyEmailsPerUserPerHour: 3,
  // Token redemptions; guessing a 256-bit token is hopeless, this bounds password hashing work.
  linkRedemptionsPerIpPer15Minutes: 20,
  aiCallsPerBusinessPerDay: () => Number(process.env.BILLIONS_AI_DAILY_LIMIT) || 100,
  // Bounds total spend however many businesses sign up.
  aiCallsPerDayGlobal: () => Number(process.env.BILLIONS_AI_GLOBAL_DAILY_LIMIT) || 2000,
};

export type AiAllowance = "ok" | "business_limit" | "global_limit";

export async function takeAiAllowance(businessId: string): Promise<AiAllowance> {
  if (!await takeAiCall(businessId, LIMITS.aiCallsPerBusinessPerDay())) return "business_limit";
  if (!await takeRateLimit("ai:global", LIMITS.aiCallsPerDayGlobal(), 86400)) return "global_limit";
  return "ok";
}

export async function pruneRateLimits() {
  await query("DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'");
}
