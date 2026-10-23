import Link from "next/link";
import { LIMITS } from "@/server/limits";
export const dynamic = "force-dynamic";
export default function Plans() {
  return <main className="plans-page"><Link href="/">← Back to Naxium</Link><h1>Your workspace plan</h1><p>Naxium is in private testing. Paid subscriptions and checkout are not enabled.</p><section><h2>Private beta</h2><p>Explore spreadsheets, review answers and build approved workflows.</p><ul><li>Up to {LIMITS.aiCallsPerBusinessPerDay()} AI calls per business per day, subject to deployment-wide availability.</li><li>Files under 2 MB; up to 10,000 rows, 60 columns and 100,000 cells per sheet.</li><li>Up to 30 saved cloud workspaces and 30 saved workflows/routines per business.</li><li>Saved workspace data expires 30 days after its last save. Linked workflows are deleted with the workspace.</li><li>Scheduled workflows require a connected worker. Each run uses its saved source data.</li></ul><p>No payment details are collected here. Pricing, longer retention and team plans will be published when available.</p></section><p><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p></main>;
}
