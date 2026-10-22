/**
 * Brand tokens for transactional email HTML, ported from naxium-web's
 * `lib/theme/tokens.ts` (light + brand subsets only — dark is for
 * naxium-web's operator-only internal alerts, which naxium-app has no
 * equivalent of yet).
 *
 * Deliberately NOT the same object as `app/globals.css`'s CSS custom
 * properties: email clients can't read `var(--x)`, so these are the literal
 * hex/rgba values inlined directly into each email's HTML.
 */

export const brand = {
  charcoal: "#1C1F20",
  platinum: "#828F91",
} as const;

export const light = {
  page: "#E8E7E3",
  panel: "#FFFFFF",
  panel2: "#F1F0EC",
  border: "rgba(28,31,32,0.13)",
  ink: "#1C1F20",
  inkDim: "rgba(28,31,32,0.62)",
  inkFaint: "rgba(28,31,32,0.42)",
  signal: "#1C1F20",
  signalInk: "#F4F3F0",
} as const;
