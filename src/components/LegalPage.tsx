import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="legal-shell">
    <article className="legal">
      <a className="brand auth-brand" href="/" aria-label="Billions home"><span className="brand-mark">b<span>.</span></span>billions<span className="brand-dot">®</span></a>
      {LEGAL.draft && <p className="legal-draft" role="note">Draft for review. This page is not yet final and has not been reviewed by a lawyer.</p>}
      <h1>{title}<span>.</span></h1>
      <p className="legal-meta">{LEGAL.entity} (ABN {LEGAL.abn}) · Last updated {LEGAL.updated}</p>
      {children}
      <p className="legal-meta"><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/">Back to Billions</a></p>
    </article>
  </main>;
}
