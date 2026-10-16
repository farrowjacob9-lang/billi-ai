import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type pg from "pg";
import { getPool, query, transaction } from "./db.ts";

export type Session = { userId: string; businessId: string; email: string; businessName: string };
export class AuthError extends Error {
  readonly code: "invalid_input" | "email_taken" | "invalid_credentials" | "rate_limited";
  constructor(code: AuthError["code"], message: string) { super(message); this.code = code; }
}

export const SESSION_COOKIE = "billions_session";
export const SESSION_DAYS = 30;
const FAILED_LOGIN_LIMIT = 5, FAILED_LOGIN_WINDOW_MINUTES = 15;
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const derive = (password: string, salt: Buffer, options: ScryptOptions) => new Promise<Buffer>((resolve, reject) =>
  scrypt(password.normalize("NFKC"), salt, 32, options, (error, key) => error ? reject(error) : resolve(key)));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Compared against when the email is unknown, so a miss costs the same time as a wrong password.
let dummyHash: Promise<string> | null = null;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const normalizeEmail = (email: unknown) => typeof email === "string" ? email.trim().toLowerCase() : "";

export function validateSignup(input: { email: unknown; password: unknown; businessName: unknown }) {
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  const businessName = typeof input.businessName === "string" ? input.businessName.trim().replace(/\s+/g, " ") : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AuthError("invalid_input", "Enter a valid email address.");
  if (password.length < 10) throw new AuthError("invalid_input", "Use a password of at least 10 characters.");
  if (password.length > 200) throw new AuthError("invalid_input", "Use a password of at most 200 characters.");
  if (!businessName || businessName.length > 80) throw new AuthError("invalid_input", "Enter your business name (up to 80 characters).");
  return { email, password, businessName };
}

async function startSession(userId: string, businessId: string, client?: pg.PoolClient) {
  const token = randomBytes(32).toString("base64url");
  await (client ?? getPool()).query("INSERT INTO sessions (token_hash, user_id, business_id, expires_at) VALUES ($1, $2, $3, now() + make_interval(days => $4))", [hashToken(token), userId, businessId, SESSION_DAYS]);
  return token;
}

export async function signUp(input: { email: unknown; password: unknown; businessName: unknown }) {
  const { email, password, businessName } = validateSignup(input);
  const passwordHash = await hashPassword(password);
  try {
    return await transaction(async client => {
      const user = (await client.query<{ id: string }>("INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id", [email, passwordHash])).rows[0];
      const business = (await client.query<{ id: string }>("INSERT INTO businesses (name) VALUES ($1) RETURNING id", [businessName])).rows[0];
      await client.query("INSERT INTO memberships (user_id, business_id, role) VALUES ($1, $2, 'owner')", [user.id, business.id]);
      await client.query("SELECT set_config('app.business_id', $1, true)", [business.id]);
      await client.query("INSERT INTO audit_events (business_id, user_id, action) VALUES ($1, $2, 'account.created')", [business.id, user.id]);
      return { token: await startSession(user.id, business.id, client), session: { userId: user.id, businessId: business.id, email, businessName } satisfies Session };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AuthError("email_taken", "An account with this email already exists. Sign in instead.");
    throw e;
  }
}

export async function logIn(input: { email: unknown; password: unknown }) {
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password.slice(0, 200) : "";
  if (!email || !password) throw new AuthError("invalid_input", "Enter your email and password.");
  const failures = (await query<{ n: number }>(`SELECT count(*)::int AS n FROM login_attempts WHERE email = $1 AND NOT succeeded AND attempted_at > now() - make_interval(mins => $2)`, [email, FAILED_LOGIN_WINDOW_MINUTES])).rows[0].n;
  if (failures >= FAILED_LOGIN_LIMIT) throw new AuthError("rate_limited", "Too many attempts. Wait 15 minutes, then try again.");

  // A user's first business is their workspace until business switching exists.
  const row = (await query<{ id: string; password_hash: string; business_id: string; business_name: string }>(
    `SELECT u.id, u.password_hash, b.id AS business_id, b.name AS business_name FROM users u
     JOIN memberships m ON m.user_id = u.id JOIN businesses b ON b.id = m.business_id
     WHERE u.email = $1 ORDER BY m.created_at LIMIT 1`, [email])).rows[0];
  const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, await (dummyHash ??= hashPassword("not-a-real-password")));
  await query("INSERT INTO login_attempts (email, succeeded) VALUES ($1, $2)", [email, ok && !!row]);
  if (!ok || !row) throw new AuthError("invalid_credentials", "That email and password don’t match an account.");
  return { token: await startSession(row.id, row.business_id), session: { userId: row.id, businessId: row.business_id, email, businessName: row.business_name } satisfies Session };
}

export async function sessionFromToken(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 100) return null;
  const row = (await query<{ user_id: string; business_id: string; email: string; name: string }>(
    `SELECT s.user_id, s.business_id, u.email, b.name FROM sessions s
     JOIN users u ON u.id = s.user_id JOIN businesses b ON b.id = s.business_id
     JOIN memberships m ON m.user_id = s.user_id AND m.business_id = s.business_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [hashToken(token)])).rows[0];
  return row ? { userId: row.user_id, businessId: row.business_id, email: row.email, businessName: row.name } : null;
}

export async function endSession(token: string | undefined) {
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

// Housekeeping; safe to call often. Old login attempts only matter inside the throttle window.
export async function pruneAuthTables() {
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await query("DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 day'");
}
