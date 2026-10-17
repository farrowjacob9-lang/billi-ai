import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type pg from "pg";
import { getPool, query, transaction } from "./db.ts";

export type Session = { userId: string; businessId: string; email: string; businessName: string; emailVerified: boolean };
export class AuthError extends Error {
  readonly code: "invalid_input" | "email_taken" | "invalid_credentials" | "wrong_password" | "invalid_token" | "rate_limited";
  constructor(code: AuthError["code"], message: string) { super(message); this.code = code; }
}

export const SESSION_COOKIE = "billions_session";
export const SESSION_DAYS = 30;
const FAILED_LOGIN_LIMIT = 5, FAILED_LOGIN_WINDOW_MINUTES = 15;
const RESET_MINUTES = 30, VERIFY_MINUTES = 24 * 60;
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// scrypt runs on libuv's small thread pool, shared with DNS and file access. Cap how many run at
// once and how many may wait, so a burst of sign-ins can't stall every other request.
const HASH_CONCURRENCY = 2, HASH_QUEUE_LIMIT = 32;
let hashing = 0;
const waiting: (() => void)[] = [];

async function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  if (hashing >= HASH_CONCURRENCY) {
    if (waiting.length >= HASH_QUEUE_LIMIT) throw new AuthError("rate_limited", "Billions is busy right now. Try again in a moment.");
    await new Promise<void>(resolve => waiting.push(resolve));
  }
  hashing++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(password.normalize("NFKC"), salt, 32, options, (error, key) => error ? reject(error) : resolve(key)));
  } finally {
    hashing--;
    waiting.shift()?.();
  }
}

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
// A bare address only: no display names, brackets or quoting that could make two stored
// "emails" deliver to the same inbox.
const isEmail = (email: string) => /^[^\s@<>"(),;:\\[\]\x00-\x1f]+@[^\s@<>"(),;:\\[\]\x00-\x1f]+\.[^\s@<>"(),;:\\[\]\x00-\x1f]+$/.test(email) && email.length <= 254;

export function validatePassword(input: unknown): string {
  const password = typeof input === "string" ? input : "";
  if (password.length < 10) throw new AuthError("invalid_input", "Use a password of at least 10 characters.");
  if (password.length > 200) throw new AuthError("invalid_input", "Use a password of at most 200 characters.");
  return password;
}

export function validateSignup(input: { email: unknown; password: unknown; businessName: unknown }) {
  const email = normalizeEmail(input.email);
  const businessName = typeof input.businessName === "string" ? input.businessName.trim().replace(/\s+/g, " ") : "";
  if (!isEmail(email)) throw new AuthError("invalid_input", "Enter a valid email address.");
  const password = validatePassword(input.password);
  if (!businessName || businessName.length > 80) throw new AuthError("invalid_input", "Enter your business name (up to 80 characters).");
  return { email, password, businessName };
}

async function startSession(userId: string, businessId: string, client?: pg.PoolClient) {
  const token = randomBytes(32).toString("base64url");
  await (client ?? getPool()).query("INSERT INTO sessions (token_hash, user_id, business_id, expires_at) VALUES ($1, $2, $3, now() + make_interval(days => $4))", [hashToken(token), userId, businessId, SESSION_DAYS]);
  return token;
}

// What an emailed link needs: the raw token goes in the link, only its hash is stored.
export type EmailLink = { email: string; token: string };
type Purpose = "verify_email" | "reset_password";

// A new verification link replaces the earlier one. Reset links don't: otherwise anyone who
// knows an address could keep cancelling its owner's link by asking for another. Every reset
// link is cleared once one is used, and the rate limits bound how many can exist.
async function issueEmailToken(client: pg.PoolClient, userId: string, email: string, purpose: Purpose, minutes: number): Promise<EmailLink> {
  const token = randomBytes(32).toString("base64url");
  if (purpose === "verify_email") await client.query("DELETE FROM email_tokens WHERE user_id = $1 AND purpose = $2", [userId, purpose]);
  await client.query("INSERT INTO email_tokens (token_hash, user_id, purpose, email, expires_at) VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))",
    [hashToken(token), userId, purpose, email, minutes]);
  return { email, token };
}

// Deleting the row is what makes a link single-use: two parallel requests can't both claim it.
async function claimEmailToken(client: pg.PoolClient, token: unknown, purpose: Purpose) {
  if (typeof token !== "string" || !token || token.length > 100) return null;
  return (await client.query<{ user_id: string; email: string }>(
    "DELETE FROM email_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > now() RETURNING user_id, email", [hashToken(token), purpose])).rows[0] ?? null;
}

// A user's first business is their workspace until business switching exists.
type Account = { id: string; email: string; password_hash: string; verified: boolean; business_id: string; business_name: string };
const ACCOUNT_SQL = `SELECT u.id, u.email, u.password_hash, u.email_verified_at IS NOT NULL AS verified, b.id AS business_id, b.name AS business_name
  FROM users u JOIN memberships m ON m.user_id = u.id JOIN businesses b ON b.id = m.business_id`;
const toSession = (a: Account): Session => ({ userId: a.id, businessId: a.business_id, email: a.email, businessName: a.business_name, emailVerified: a.verified });

async function audit(client: pg.PoolClient, businessId: string, userId: string, action: string) {
  await client.query("SELECT set_config('app.business_id', $1, true)", [businessId]);
  await client.query("INSERT INTO audit_events (business_id, user_id, action) VALUES ($1, $2, $3)", [businessId, userId, action]);
}

export async function signUp(input: { email: unknown; password: unknown; businessName: unknown }) {
  const { email, password, businessName } = validateSignup(input);
  const passwordHash = await hashPassword(password);
  try {
    return await transaction(async client => {
      const user = (await client.query<{ id: string }>("INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id", [email, passwordHash])).rows[0];
      const business = (await client.query<{ id: string }>("INSERT INTO businesses (name) VALUES ($1) RETURNING id", [businessName])).rows[0];
      await client.query("INSERT INTO memberships (user_id, business_id, role) VALUES ($1, $2, 'owner')", [user.id, business.id]);
      await audit(client, business.id, user.id, "account.created");
      const verification = await issueEmailToken(client, user.id, email, "verify_email", VERIFY_MINUTES);
      return { token: await startSession(user.id, business.id, client), verification, session: { userId: user.id, businessId: business.id, email, businessName, emailVerified: false } satisfies Session };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AuthError("email_taken", "An account with this email already exists. Sign in instead.");
    throw e;
  }
}

// Count → verify → record as one step under a per-email lock, so parallel guesses can't all read
// a count under the limit. Sign-in and every action that asks for the password again go through here.
async function checkPassword(email: string, password: string): Promise<Account | null> {
  const unknownEmailHash = dummyHash ??= hashPassword("not-a-real-password");
  const result = await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`login:${email}`]);
    const failures = (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM login_attempts WHERE email = $1 AND NOT succeeded AND attempted_at > now() - make_interval(mins => $2)`, [email, FAILED_LOGIN_WINDOW_MINUTES])).rows[0].n;
    if (failures >= FAILED_LOGIN_LIMIT) return { limited: true as const };
    const row = (await client.query<Account>(`${ACCOUNT_SQL} WHERE u.email = $1 ORDER BY m.created_at LIMIT 1`, [email])).rows[0];
    const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, await unknownEmailHash);
    await client.query("INSERT INTO login_attempts (email, succeeded) VALUES ($1, $2)", [email, ok && !!row]);
    return { limited: false as const, row: ok ? row : undefined };
  });
  if (result.limited) throw new AuthError("rate_limited", "Too many attempts. Wait 15 minutes, or reset your password from the link we email you.");
  return result.row ?? null;
}

export async function logIn(input: { email: unknown; password: unknown }) {
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password.slice(0, 200) : "";
  if (!email || !password) throw new AuthError("invalid_input", "Enter your email and password.");
  const account = await checkPassword(email, password);
  if (!account) throw new AuthError("invalid_credentials", "That email and password don’t match an account.");
  return { token: await startSession(account.id, account.business_id), session: toSession(account) };
}

export async function sessionFromToken(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 100) return null;
  const row = (await query<{ user_id: string; business_id: string; email: string; name: string; verified: boolean }>(
    `SELECT s.user_id, s.business_id, u.email, b.name, u.email_verified_at IS NOT NULL AS verified FROM sessions s
     JOIN users u ON u.id = s.user_id JOIN businesses b ON b.id = s.business_id
     JOIN memberships m ON m.user_id = s.user_id AND m.business_id = s.business_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [hashToken(token)])).rows[0];
  return row ? { userId: row.user_id, businessId: row.business_id, email: row.email, businessName: row.name, emailVerified: row.verified } : null;
}

export async function endSession(token: string | undefined) {
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

// --- Email verification -------------------------------------------------------------------

// Null when the address is already verified, so there is nothing to send.
export async function startEmailVerification(userId: string): Promise<EmailLink | null> {
  return transaction(async client => {
    const user = (await client.query<{ email: string; verified: boolean }>("SELECT email, email_verified_at IS NOT NULL AS verified FROM users WHERE id = $1 FOR UPDATE", [userId])).rows[0];
    if (!user || user.verified) return null;
    return issueEmailToken(client, userId, user.email, "verify_email", VERIFY_MINUTES);
  });
}

// The link proves control of the address it was sent to, not of whichever address the account has now.
export async function verifyEmail(token: unknown): Promise<{ email: string }> {
  const email = await transaction(async client => {
    const claimed = await claimEmailToken(client, token, "verify_email");
    if (!claimed) return null;
    const { rowCount } = await client.query("UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1 AND email = $2", [claimed.user_id, claimed.email]);
    return rowCount ? claimed.email : null;
  });
  if (!email) throw new AuthError("invalid_token", "This link has expired or was already used. Sign in and send a new one from the banner.");
  return { email };
}

// --- Password reset -----------------------------------------------------------------------

// Null for an unknown email. The caller answers the same either way, so the response can't
// be used to find out who has an account.
export async function requestPasswordReset(input: unknown): Promise<EmailLink | null> {
  const email = normalizeEmail(input);
  if (!isEmail(email)) return null;
  return transaction(async client => {
    const user = (await client.query<{ id: string }>("SELECT id FROM users WHERE email = $1 FOR UPDATE", [email])).rows[0];
    return user ? issueEmailToken(client, user.id, email, "reset_password", RESET_MINUTES) : null;
  });
}

// Following the emailed link is the way back in after a lockout: it clears the failed sign-ins,
// verifies the address (the link proved it), ends every other session and signs this one in.
const invalidReset = () => new AuthError("invalid_token", "This reset link has expired or was already used. Request a new one.");

export async function resetPassword(input: { token: unknown; password: unknown }) {
  const password = validatePassword(input.password);
  // Look before hashing, so junk tokens can't make the server do scrypt work.
  const live = typeof input.token === "string" && input.token.length <= 100
    && (await query("SELECT 1 FROM email_tokens WHERE token_hash = $1 AND purpose = 'reset_password' AND expires_at > now()", [hashToken(input.token)])).rowCount;
  if (!live) throw invalidReset();
  const passwordHash = await hashPassword(password);
  const result = await transaction(async client => {
    const claimed = await claimEmailToken(client, input.token, "reset_password");
    if (!claimed) return null;
    const { rowCount } = await client.query("UPDATE users SET password_hash = $3, email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1 AND email = $2",
      [claimed.user_id, claimed.email, passwordHash]);
    if (!rowCount) return null;
    await client.query("DELETE FROM email_tokens WHERE user_id = $1 AND purpose = 'reset_password'", [claimed.user_id]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [claimed.user_id]);
    await client.query("DELETE FROM login_attempts WHERE email = $1", [claimed.email]);
    const account = (await client.query<Account>(`${ACCOUNT_SQL} WHERE u.id = $1 ORDER BY m.created_at LIMIT 1`, [claimed.user_id])).rows[0];
    if (!account) return null;
    await audit(client, account.business_id, account.id, "password.reset");
    return { token: await startSession(account.id, account.business_id, client), session: toSession(account) };
  });
  if (!result) throw invalidReset();
  return result;
}

// --- Signed-in account changes ------------------------------------------------------------

// Returns the password hash that was checked, so the change can be made conditional on it.
async function confirmPassword(session: Session, password: unknown): Promise<string> {
  const typed = typeof password === "string" ? password.slice(0, 200) : "";
  if (!typed) throw new AuthError("invalid_input", "Enter your current password.");
  const account = await checkPassword(session.email, typed);
  if (!account || account.id !== session.userId) throw new AuthError("wrong_password", "That password isn’t right.");
  return account.password_hash;
}

// The checks above ran outside the change's transaction. If a reset or another change landed
// in between (ending this session or replacing the password), the change must not go ahead.
async function assertStillCurrent(client: pg.PoolClient, session: Session, token: string, checkedHash: string) {
  const live = (await client.query("SELECT 1 FROM sessions WHERE token_hash = $1 AND user_id = $2 FOR UPDATE", [hashToken(token), session.userId])).rowCount;
  const same = (await client.query("SELECT 1 FROM users WHERE id = $1 AND password_hash = $2 FOR UPDATE", [session.userId, checkedHash])).rowCount;
  if (!live || !same) throw new AuthError("wrong_password", "Your password was just changed elsewhere. Sign in again and retry.");
}

// Keeps the session that made the change and signs out every other device.
export async function changePassword(session: Session, currentToken: string, input: { currentPassword: unknown; newPassword: unknown }) {
  const next = validatePassword(input.newPassword);
  const checkedHash = await confirmPassword(session, input.currentPassword);
  const passwordHash = await hashPassword(next);
  await transaction(async client => {
    await assertStillCurrent(client, session, currentToken, checkedHash);
    await client.query("UPDATE users SET password_hash = $2 WHERE id = $1", [session.userId, passwordHash]);
    await client.query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [session.userId, hashToken(currentToken)]);
    await client.query("DELETE FROM email_tokens WHERE user_id = $1 AND purpose = 'reset_password'", [session.userId]);
    await audit(client, session.businessId, session.userId, "password.changed");
  });
}

// Deletes the user and every business they alone belong to, with its runs, routines, audit
// events and AI usage. Businesses shared with other members (not possible yet) are kept.
export async function deleteAccount(session: Session, currentToken: string, password: unknown) {
  const checkedHash = await confirmPassword(session, password);
  await transaction(async client => {
    await assertStillCurrent(client, session, currentToken, checkedHash);
    const owned = (await client.query<{ business_id: string }>(
      `SELECT m.business_id FROM memberships m WHERE m.user_id = $1
       AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.business_id = m.business_id AND o.user_id <> $1)`, [session.userId])).rows;
    // Foreign-key cascades run as the table owner, so row-level security doesn't block them.
    for (const { business_id } of owned) await client.query("DELETE FROM businesses WHERE id = $1", [business_id]);
    await client.query("DELETE FROM users WHERE id = $1", [session.userId]);
    await client.query("DELETE FROM login_attempts WHERE email = $1", [session.email]);
  });
}

// Housekeeping; safe to call often. Old login attempts only matter inside the throttle window.
export async function pruneAuthTables() {
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await query("DELETE FROM email_tokens WHERE expires_at < now()");
  await query("DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 day'");
}
