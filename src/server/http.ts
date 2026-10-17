import { cookies, headers } from "next/headers";
import { AuthError, SESSION_COOKIE, SESSION_DAYS, sessionFromToken, type Session } from "./auth.ts";
import { databaseConfigured } from "./db.ts";
import { emailConfigured } from "./email.ts";
import { ipBucket } from "./ip.ts";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
export const ok = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

const AUTH_STATUS: Record<AuthError["code"], number> = { signed_out: 401, invalid_input: 400, email_taken: 409, invalid_credentials: 401, wrong_password: 403, invalid_token: 400, rate_limited: 429 };

// Wraps a route so every failure leaves in the same { error: { code, message } } envelope.
export function route<A extends unknown[]>(handler: (request: Request, ...rest: A) => Promise<Response>) {
  return async (request: Request, ...rest: A) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") assertSameOrigin(request);
      return await handler(request, ...rest);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.code, e.message);
      if (e instanceof AuthError) return fail(AUTH_STATUS[e.code], e.code, e.message);
      console.error("[api] unhandled error", e);
      return fail(500, "internal", "Something went wrong on our side. Please try again.");
    }
  };
}

// Cookies are SameSite=Lax; this closes the remaining cross-site gap for state-changing requests.
export function assertSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new HttpError(403, "cross_site", "Cross-site requests are not allowed.");
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost = "";
  try { originHost = new URL(origin).host; } catch { /* "null" or malformed: rejected below */ }
  const hosts = [new URL(request.url).host, request.headers.get("x-forwarded-host"), request.headers.get("host")];
  if (!originHost || !hosts.includes(originHost)) throw new HttpError(403, "cross_site", "Cross-site requests are not allowed.");
}

// Reads the body as a stream and stops at maxBytes, so a chunked upload without a
// Content-Length can't be buffered whole before the size check.
export async function readJson<T extends Record<string, unknown>>(request: Request, maxBytes: number): Promise<Partial<T>> {
  const tooLarge = () => new HttpError(413, "too_large", "That request is too large.");
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw tooLarge();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel().catch(() => undefined); throw tooLarge(); }
      chunks.push(value);
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    const value: unknown = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Partial<T>;
  } catch { throw new HttpError(400, "invalid_json", "The request body must be a JSON object."); }
}

// Vercel sets x-real-ip and rewrites x-forwarded-for; on other hosts put a proxy in front that does.
// Used only for rate limits, so it returns the network bucket rather than the exact address.
export async function clientIp(): Promise<string> {
  const h = await headers();
  return ipBucket(h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0].trim() || "unknown");
}

export const sessionToken = async () => (await cookies()).get(SESSION_COOKIE)?.value;

export async function currentSession(): Promise<Session | null> {
  if (!databaseConfigured()) return null;
  return sessionFromToken(await sessionToken());
}

export function requireDatabase() {
  if (!databaseConfigured()) throw new HttpError(404, "accounts_disabled", "Accounts are not enabled on this deployment.");
}

export function requireEmail() {
  requireDatabase();
  if (!emailConfigured()) throw new HttpError(404, "email_disabled", "Email isn’t set up on this deployment yet. Contact support to recover your account.");
}

export async function requireSession(): Promise<Session> {
  requireDatabase();
  const session = await currentSession();
  if (!session) throw new HttpError(401, "signed_out", "Your session has ended. Sign in again.");
  return session;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
