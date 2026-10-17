"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/store";

export function AuthScreen({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const signup = mode === "signup";

  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    setPending(true); setError("");
    try {
      await api(signup ? "/api/auth/signup" : "/api/auth/login", { method: "POST", body: JSON.stringify(signup ? { email, password, businessName } : { email, password }) });
      window.location.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn’t reach Billions. Check your connection and try again.");
      setPending(false);
    }
  }

  function switchMode() { setMode(signup ? "signin" : "signup"); setError(""); }

  return <main className="auth-shell">
    <div className="auth-card">
      <a className="brand auth-brand" href="/" aria-label="Billions home"><span className="brand-mark">b<span>.</span></span>billions<span className="brand-dot">®</span></a>
      <h1>{signup ? "Set up your business workspace" : "Welcome back"}<span>.</span></h1>
      <p className="auth-lede">{signup ? "Weekly reports with every number checked, saved to your business." : "Sign in to pick up your reports and routines."}</p>
      {notice && !error && <div className="info-card" role="status">{notice}</div>}
      <form onSubmit={submit} noValidate={false}>
        {signup && <><label htmlFor="business-name">Business name</label><input id="business-name" value={businessName} onChange={e => setBusinessName(e.target.value)} maxLength={80} required autoComplete="organization" /></>}
        <label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required autoComplete="email" />
        <label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={signup ? 10 : undefined} maxLength={200} required autoComplete={signup ? "new-password" : "current-password"} />
        {signup && <small className="auth-hint">At least 10 characters.</small>}
        {error && <div className="error-card" role="alert"><div><p>{error}</p></div></div>}
        <button className="primary-button auth-submit" type="submit" disabled={pending}>{pending ? "One moment…" : signup ? "Create workspace" : "Sign in"} <ArrowRight size={16} /></button>
      </form>
      <button className="auth-switch" onClick={switchMode}>{signup ? "Already have an account? Sign in" : "New to Billions? Create a workspace"}</button>
      <p className="auth-note"><ShieldCheck size={13} /> Your uploaded files are never stored. Each business only ever sees its own reports.</p>
    </div>
  </main>;
}
