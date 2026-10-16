import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Billions — Make room for your best work",
  description: "A calmer workspace for useful conversations, verified reports and repeatable work.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body>{children}</body></html>;
}
