"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/store";

type Mode = "signin" | "signup" | "forgot";

const COPY: Record<Mode, { title: string; lede: string; submit: string }> = {
  signin: { title: "Welcome back", lede: "Sign in to pick up your reports and routines.", submit: "Sign in" },
  signup: { title: "Set up your business workspace", lede: "Weekly reports with every number checked, saved to your business.", submit: "Create workspace" },
  forgot: { title: "Reset your password", lede: "Enter the email you signed up with. We’ll send a link to choose a new password.", submit: "Email me a link" },
};

// The frame shared by sign-in and the pages an emailed link opens.
export function AuthCard({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return <main className="auth-shell">
    <div className="auth-card">
      <a className="brand auth-brand" href="/" aria-label="Billions home"><span className="brand-mark">b<span>.</span></span>billions<span className="brand-dot">®</span></a>
      <h1>{title}<span>.</span></h1>
      <p className="auth-lede">{lede}</p>
      {children}
    </div>
  </main>;
}

export function AuthScreen({ notice, canEmail }: { notice?: string; canEmail: boolean }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const signup = mode === "signup", forgot = mode === "forgot";

  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    setPending(true); setError("");
    try {
      if (forgot) {
        await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
        setSent(true); setPending(false); return;
      }
      await api(signup ? "/api/auth/signup" : "/api/auth/login", { method: "POST", body: JSON.stringify(signup ? { email, password, businessName } : { email, password }) });
      window.location.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn’t reach Billions. Check your connection and try again.");
      setPending(false);
    }
  }

  function switchTo(next: Mode) { setMode(next); setError(""); setSent(false); }

  return <AuthCard title={COPY[mode].title} lede={COPY[mode].lede}>
    {notice && !error && !forgot && <div className="info-card" role="status">{notice}</div>}
    {forgot && sent ? <div className="info-card" role="status">If {email.trim()} has a Billions account, a reset link is on its way. It works once and expires in 30 minutes. Check your spam folder if it hasn’t arrived in a few minutes.</div>
      : <form onSubmit={submit} noValidate={false}>
        {signup && <><label htmlFor="business-name">Business name</label><input id="business-name" value={businessName} onChange={e => setBusinessName(e.target.value)} maxLength={80} required autoComplete="organization" /></>}
        <label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required autoComplete="email" />
        {!forgot && <><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={signup ? 10 : undefined} maxLength={200} required autoComplete={signup ? "new-password" : "current-password"} /></>}
        {signup && <small className="auth-hint">At least 10 characters.</small>}
        {mode === "signin" && canEmail && <button type="button" className="auth-switch auth-forgot" onClick={() => switchTo("forgot")}>Forgot password?</button>}
        {error && <div className="error-card" role="alert"><div><p>{error}</p></div></div>}
        <button className="primary-button auth-submit" type="submit" disabled={pending}>{pending ? "One moment…" : COPY[mode].submit} <ArrowRight size={16} /></button>
        {signup && <p className="auth-legal">By creating a workspace you agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>}
      </form>}
    <button className="auth-switch" onClick={() => switchTo(signup || forgot ? "signin" : "signup")}>{signup || forgot ? "Already have an account? Sign in" : "New to Billions? Create a workspace"}</button>
    <p className="auth-note"><ShieldCheck size={13} /> Your uploaded files are never stored. Each business only ever sees its own reports. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
  </AuthCard>;
}
