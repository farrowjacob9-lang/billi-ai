import type { Capabilities } from "@/lib/store";
import type { SettingsInfo } from "@/lib/types";

// Every promise the interface makes about data handling, in one place, so it can't drift from what the code does.
export function modeCopy(caps: Capabilities) {
  const cloud = caps.mode === "cloud" && caps.user;
  const business = caps.user?.businessName || "your business";
  const privacyNote = cloud
    ? `Files are checked on our server and never stored. Reports are saved to ${business} only.${caps.ai ? " Claude sees the calculated totals, not your transactions." : ""}`
    : caps.ai ? "Files are processed in your browser. Only the calculated totals are sent to Claude." : "Files are processed locally. No AI provider is connected yet.";
  const storageNote = cloud
    ? `History and routines are saved to ${business}. Uploaded source files are not saved.`
    : "History and routine settings are stored only in this browser. Uploaded source files are not saved.";
  const routinesBanner = `Routines save the report format and validation rules ${cloud ? `to ${business}` : "in this browser"}. Each run needs a new CSV. Scheduling and shared routines are part of a future release.`;
  const settings: SettingsInfo = {
    intro: cloud
      ? `You’re signed in to ${business}. CSV reports are checked and stored for this business only.`
      : `You’re exploring the first Billions prototype. CSV reporting works locally; ${caps.ai ? "Claude writes the report summary and answers questions from the calculated totals." : "the chat uses a limited set of report helpers."}`,
    rows: [
      ["Data processing", cloud ? "Checked on the server" : "In your browser"],
      ["Report narrative", caps.ai ? "Claude, figures verified" : "Deterministic template"],
      ["Currency", "AUD"],
      ["Accounts & cloud storage", cloud ? caps.user!.email : "Not connected"],
      ...(cloud && caps.email ? [["Email", caps.user!.emailVerified ? "Confirmed" : "Not confirmed yet"] as [string, string]] : []),
    ],
    footnote: cloud
      ? "Report summaries stay in your business workspace until you clear them. Your uploaded files are never kept."
      : "Use sample or non-sensitive data on shared devices. Report summaries in history persist in browser storage until cleared.",
    routineStorage: cloud ? `saved to ${business}` : "saved in this browser",
  };
  return {
    privacyNote, storageNote, routinesBanner, settings,
    modeLabel: caps.ai ? "Claude · report assistant" : "Report assistant",
    badge: cloud ? "Signed in" : "Interactive prototype",
    workspaceName: cloud ? business : "My workspace",
    workspaceDetail: cloud ? "Business workspace" : "Personal workspace",
    accountLabel: cloud ? caps.user!.email : "Your workspace",
    accountDetail: cloud ? "Signed in" : "Local prototype",
    routineSaved: cloud ? `Routine saved to ${business}. Run it again with a new weekly CSV.` : "Routine saved in this browser. Run it again with a new weekly CSV.",
    historyCleared: cloud ? `Run history cleared for ${business}.` : "Run history cleared from this browser.",
  };
}
