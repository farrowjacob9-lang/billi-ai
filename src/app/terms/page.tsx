import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service — Naxium" };

export default function Terms() {
  return <LegalPage title="Terms of Service">
    <p>These terms apply to your use of Naxium, provided by {LEGAL.entity} (ABN {LEGAL.abn}). By creating a workspace or using Naxium you agree to them. If you use Naxium for a business, you confirm you are authorised to accept these terms for it.</p>

    <h2>What Naxium does</h2>
    <p>Naxium turns a weekly transaction CSV into a summary report and can answer questions about that report. A report is a summary of the transactions you provide. It is not a profit-and-loss statement, bank balance, tax position or audit, and nothing in Naxium is financial, tax, legal or investment advice. Check important figures against your own records and get professional advice before relying on them.</p>

    <h2>AI-written text</h2>
    <p>When the AI assistant is on, parts of a report and the assistant’s answers are written by an AI model. Naxium inserts every figure from its own calculations and discards AI text it can’t check, but AI text can still be incomplete or misleading. Review it before you rely on it.</p>

    <h2>Your account</h2>
    <p>Give a valid email address you control and keep your password secure. You’re responsible for activity in your account. Tell us at {LEGAL.contactEmail} if you think someone else has accessed it. You can delete your account at any time in Settings.</p>

    <h2>Your data</h2>
    <p>You keep ownership of the data you upload and the reports Naxium produces. You give us permission to process it only to provide Naxium to you, as described in our <a href="/privacy">Privacy Policy</a>. Only upload data you’re entitled to use.</p>

    <h2>Acceptable use</h2>
    <p>Don’t misuse Naxium: no attempts to access other businesses’ data, to get around usage limits, to overload or disrupt the service, to upload malicious content, or to use it for anything unlawful. We may suspend or close accounts that do.</p>

    <h2>Availability and changes</h2>
    <p>Naxium is in early release. We aim to keep it available and your data safe, but we don’t promise uninterrupted service, and features and limits (including daily AI limits) may change. We may update these terms; if a change is significant we’ll tell you before it takes effect, and continuing to use Naxium means you accept it.</p>

    <h2>Liability</h2>
    <p>Nothing in these terms excludes rights you have under the Australian Consumer Law that can’t be excluded. To the extent the law allows, we aren’t liable for indirect or consequential loss, or for decisions made using reports or AI text, and our total liability is limited to resupplying the service or the amount you paid us in the previous 12 months.</p>

    <h2>Ending these terms</h2>
    <p>You can stop using Naxium and delete your account at any time. We may end your access on notice, or immediately for a serious breach of these terms.</p>

    <h2>Governing law</h2>
    <p>These terms are governed by the laws of {LEGAL.jurisdiction}, Australia, and the courts there have jurisdiction.</p>

    <h2>Contact</h2>
    <p>Questions about these terms: {LEGAL.contactEmail}.</p>
  </LegalPage>;
}
