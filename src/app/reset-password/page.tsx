import type { Metadata } from "next";
import { ResetPasswordPage } from "@/components/EmailLinkPages";

export const metadata: Metadata = { title: "Reset your password — Billions", referrer: "no-referrer", robots: { index: false } };

export default function Page() {
  return <ResetPasswordPage />;
}
