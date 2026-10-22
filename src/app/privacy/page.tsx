import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy — Naxium" };

// Every statement here must stay true of the code. If data handling changes, change this page with it.
export default function Privacy() {
  return <LegalPage title="Privacy Policy">
    <p>Naxium is operated by {LEGAL.entity} (“we”, “us”). This policy explains what personal information we handle when you use Naxium, why, and the choices you have. We handle it in line with the Australian Privacy Principles in the Privacy Act 1988 (Cth).</p>

    <h2>What we collect</h2>
    <ul>
      <li><strong>Account details:</strong> your email address, your business name, and your password, which we store only as a one-way scrypt hash.</li>
      <li><strong>Reports you create:</strong> the calculated report for each weekly CSV you run (file name, dates, transaction count, totals by day and by category, and the written takeaway). We do <em>not</em> store the CSV file or its individual transactions; the server reads the file, calculates the report and discards it. Separately, choosing Save workspace stores the parsed worksheet cells, file/sheet names, conversation and review decisions for your business.</li>
      <li><strong>Routines:</strong> the name and report format you save, or a saved spreadsheet query and its frequency. Background jobs receive workspace identifiers rather than spreadsheet contents.</li>
      <li><strong>Security and usage records:</strong> a sign-in cookie, records of account actions (for example “report deleted”), sign-in attempts against your email address, the number of AI requests per day, and your IP address in short-lived rate-limit counters.</li>
      <li><strong>Questions you ask the assistant</strong>, which are sent to our AI provider to answer them (see below). Conversations are stored only when you explicitly save a workspace.</li>
    </ul>

    <h2>Why we use it</h2>
    <p>To create your account and keep it secure, to produce and keep your reports, to send emails you need (confirming your address and resetting your password), to limit abuse and spending, and to comply with the law. We don’t sell your information, use it for advertising, or use it to train AI models.</p>

    <h2>Who we share it with</h2>
    <p>We use these service providers to run Naxium. Each handles information only to provide its service to us:</p>
    <ul>
      <li><strong>Vercel</strong> hosts the application. Requests may be processed outside Australia, including in the United States.</li>
      <li><strong>Neon</strong> hosts our database in Sydney, Australia (AWS ap-southeast-2).</li>
      <li><strong>Anthropic</strong> provides the Claude AI model. When the assistant is on, it receives the calculated totals of a report (including your category names) and your questions. For spreadsheet questions it receives column headings and user questions, not spreadsheet rows. Text you quote in your questions is also sent. Anthropic processes this in the United States.</li>
      <li><strong>Inngest</strong> runs configured background routines, receiving job and business identifiers, not the worksheet cells.</li>
      <li><strong>Resend</strong> sends our account emails and receives your email address to do so. It processes this in the United States.</li>
    </ul>
    <p>Because some providers are overseas, your information may be disclosed outside Australia, mainly to the United States. We choose providers with security commitments suited to the information involved. We may also disclose information where the law requires it.</p>

    <h2>How long we keep it</h2>
    <p>Reports and routines stay until you delete them (one at a time, or all at once from Run history) or delete your account. Sign-in attempts are kept for one day and rate-limit counters for two. Emailed links expire after 30 minutes (password reset) or 24 hours (email confirmation). When you delete your account from Settings, we delete your user record, your business workspace and its reports, routines, activity records and AI usage, straight away. Copies may remain in our providers’ encrypted backups for a limited period until they are overwritten.</p>

    <p>Saved spreadsheet workspaces expire 30 days after saving. Expired workspaces are inaccessible and removed by the configured cleanup worker or when saved work is listed. Deleting a workspace also deletes its routines and jobs. AI call activity includes model, operation, token counts, duration and outcome; it contains no prompt or row content.</p>

    <h2>Cookies</h2>
    <p>We use one essential cookie to keep you signed in. We don’t use advertising or analytics cookies. Without an account, the browser-only version keeps your history in your browser’s local storage, on your device. Explicitly saved spreadsheet workspaces use IndexedDB in browser-only mode and are removed on expiry when saved work is loaded.</p>

    <h2>Security</h2>
    <p>Traffic is encrypted in transit. Each business’s data is separated in the database by row-level security as well as in our code. Passwords are hashed, and session and email-link tokens are stored only as hashes. No system is perfectly secure; if a data breach is likely to cause you serious harm, we will notify you and the Office of the Australian Information Commissioner as the law requires.</p>

    <h2>Your choices</h2>
    <p>You can see and delete your reports in the app, change your password, and delete your account in Settings. To ask for access to or correction of your information, or to make a complaint, email {LEGAL.contactEmail}. We’ll respond within 30 days. If you’re not satisfied with our response, you can contact the Office of the Australian Information Commissioner at oaic.gov.au.</p>

    <h2>Changes</h2>
    <p>We’ll update this page when our practices change and show the date above. For significant changes we’ll let you know by email or in the app.</p>
  </LegalPage>;
}
