/**
 * Shared HTML shell for automated Naxium client emails, ported from
 * naxium-web's `lib/theme/email-layout.ts` (the `lightEmailLayout` /
 * `emailButton` / `escapeEmailHtml` pieces only — that repo's
 * `darkEmailLayout` and `emailDataTable` are for its operator-only internal
 * alerts, which have no counterpart here).
 *
 * This is the one house style naxium-app should compose every client-facing
 * automated email from, rather than each call site hand-rolling its own
 * `<!DOCTYPE html>` shell.
 */

import { brand, light } from "./theme.ts";

const FONT_STACK = `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;

export function escapeEmailHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Naxium's badge mark, inlined — same paths as public/logo_badge_pearl.svg.
 * Decorative only: a client whose mail app drops inline SVG (a handful of
 * legacy Outlook builds) still sees the "naxium" wordmark text beside it.
 */
export const EMAIL_BADGE_SVG = `<svg width="30" height="30" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="naxp_n" x1="60" y1="20" x2="60" y2="104" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF"></stop><stop offset="0.55" stop-color="#EEF2F4"></stop><stop offset="1" stop-color="#CDD6D8"></stop>
    </linearGradient>
    <linearGradient id="naxp_ring" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF"></stop><stop offset="0.5" stop-color="#C7D0D2"></stop><stop offset="1" stop-color="#FFFFFF"></stop>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="88" height="88" rx="26" fill="#191C1D" stroke="url(#naxp_ring)" stroke-width="4.5"></rect>
  <line x1="44" y1="42" x2="44" y2="78" stroke="url(#naxp_n)" stroke-width="9" stroke-linecap="round"></line>
  <line x1="76" y1="42" x2="76" y2="78" stroke="url(#naxp_n)" stroke-width="9" stroke-linecap="round"></line>
  <line x1="44" y1="42" x2="76" y2="78" stroke="url(#naxp_n)" stroke-width="9" stroke-linecap="round"></line>
</svg>`;

/** A solid pill CTA button. */
export function emailButton(opts: { href: string; label: string }): string {
  // href is escaped here, not left to the caller — a query string can carry a
  // real `&` that must render as `&amp;` in the attribute.
  return `<table cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr>
                    <td style="background:${light.signal};border-radius:999px;">
                      <a href="${escapeEmailHtml(opts.href)}" style="display:inline-block;font-size:14px;font-weight:700;color:${light.signalInk};text-decoration:none;padding:14px 32px;">${escapeEmailHtml(opts.label)}</a>
                    </td>
                  </tr></table>`;
}

export interface LightEmailLayoutOptions {
  eyebrow: string;
  heading: string;
  /** Already-composed inner HTML — paragraphs, a button, meta lines. */
  bodyHtml: string;
}

/**
 * The client-facing house style: charcoal header band with the Naxium badge
 * + wordmark, white card, light footer band. Every automated email a client
 * receives should compose from this.
 */
export function lightEmailLayout(opts: LightEmailLayoutOptions): string {
  const { eyebrow, heading, bodyHtml } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${light.page};font-family:${FONT_STACK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${light.page};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td style="border:1px solid ${light.border};border-bottom:none;border-radius:16px 16px 0 0;background:${light.panel};overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:${brand.charcoal};padding:28px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td valign="middle" style="padding-right:10px;">${EMAIL_BADGE_SVG}</td>
                    <td valign="middle">
                      <span style="font-size:20px;font-weight:300;letter-spacing:-0.01em;color:${light.signalInk};">naxium</span>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:40px 44px 36px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${brand.platinum};">${escapeEmailHtml(eyebrow)}</p>
                  <h1 style="margin:14px 0 0;font-size:26px;font-weight:700;letter-spacing:-0.01em;color:${light.ink};line-height:1.25;">${escapeEmailHtml(heading)}</h1>
                  ${bodyHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="background:${light.panel2};border-radius:0 0 16px 16px;padding:22px 20px;">
            <p style="margin:0;font-size:11px;line-height:1.7;color:${light.inkFaint};">
              &copy; ${new Date().getUTCFullYear()} Naxium. All rights reserved.<br>
              <a href="https://naxium.app" style="font-size:11px;color:${light.inkDim};text-decoration:underline;">naxium.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
