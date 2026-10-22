import type { Metadata } from "next";
import { VerifyEmailPage } from "@/components/EmailLinkPages";

export const metadata: Metadata = { title: "Confirm your email — Naxium", referrer: "no-referrer", robots: { index: false } };

export default function Page() {
  return <VerifyEmailPage />;
}
