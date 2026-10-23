import { money, reportNarrative, type Report } from "@/lib/report";

// Deterministic answers used when no model is connected, or when a model reply fails verification.
export function localReply(text: string, report: Report | null, aiConnected = false): string {
  const lower = text.toLowerCase();
  if (report && /expense|spend|cost/.test(lower)) return report.categories.length ? `Your expenses total ${money(report.expenses, true)}. ${report.categories.map(c => `${c.name}: ${money(c.cents, true)}`).join("; ")}. These figures include every expense in your uploaded file.` : "There are no negative amounts in this file, so no expenses were recorded.";
  if (report && /income|revenue|net|summary|summari|report/.test(lower)) return reportNarrative(report);
  if (/format|column|template|csv|upload|spreadsheet/.test(lower)) return "Upload a CSV with date, description, category and amount columns. Use YYYY-MM-DD dates, positive amounts for income and negative amounts for expenses, all in AUD. Choose up to seven consecutive days and a file under 2 MB. You can download the sample below.";
  if (aiConnected) return report ? "I couldn’t answer that from this week’s checked totals, so I won’t guess. Ask about income, expenses, net movement or a category." : "I can explain a weekly report once you’ve prepared one. Upload a CSV or try the sample to begin.";
  return "This prototype can prepare a weekly transaction report and explain its income and expense totals. Upload a CSV or try the sample to begin. Open-ended AI chat isn’t connected yet.";
}
