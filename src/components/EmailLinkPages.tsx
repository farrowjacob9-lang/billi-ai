"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { AuthCard } from "@/components/AuthScreen";
import { api, ApiError } from "@/lib/store";

// Emailed links carry the token in the fragment (#token=…), which never reaches the server or a
// Referer. Read it once, then drop it from the address bar and history.
function useLinkToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    setToken(value || null);
  }, []);
  return token;
}

const failure = (e: unknown) => e instanceof ApiError ? e.message : "We couldn’t reach Billions. Check your connection and try again.";

export function ResetPasswordPage() {
  const token = useLinkToken();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending || !token) return;
    if (password !== confirm) { setError("The two passwords don’t match."); return; }
    setPending(true); setError("");
    try {
      await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      window.location.replace("/");
    } catch (e) { setError(failure(e)); setPending(false); }
  }

  if (token === null) return <AuthCard title="This link is incomplete" lede="Open the link from your reset email again, or request a new one from the sign-in screen."><a className="primary-button auth-submit" href="/">Back to sign in <ArrowRight size={16} /></a></AuthCard>;
  return <AuthCard title="Choose a new password" lede="This signs you in here and signs out every other device.">
    <form onSubmit={submit}>
      <label htmlFor="new-password">New password</label><input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={10} maxLength={200} required autoComplete="new-password" autoFocus />
      <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={10} maxLength={200} required autoComplete="new-password" />
      <small className="auth-hint">At least 10 characters.</small>
      {error && <div className="error-card" role="alert"><div><p>{error}</p></div></div>}
      <button className="primary-button auth-submit" type="submit" disabled={pending || !token}>{pending ? "One moment…" : "Save and sign in"} <ArrowRight size={16} /></button>
    </form>
    <a className="auth-switch" href="/">Back to sign in</a>
  </AuthCard>;
}

export function VerifyEmailPage() {
  const token = useLinkToken();
  const [state, setState] = useState<"checking" | "done" | "failed">("checking");
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (token === undefined || started.current) return;
    started.current = true;
    if (token === null) { setError("This link is incomplete. Open it from your email again."); setState("failed"); return; }
    api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setState("done"))
      .catch(e => { setError(failure(e)); setState("failed"); });
  }, [token]);

  const title = state === "done" ? "Email confirmed" : state === "failed" ? "We couldn’t confirm that" : "Confirming your email";
  const lede = state === "done" ? "Thanks. The AI assistant is on for your workspace." : state === "failed" ? error : "One moment…";
  return <AuthCard title={title} lede={lede}>{state !== "checking" && <a className="primary-button auth-submit" href="/">Go to Billions <ArrowRight size={16} /></a>}</AuthCard>;
}
