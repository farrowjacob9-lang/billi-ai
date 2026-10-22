import { validateSheet, validatePlan, type Sheet, type Plan } from "./sheet.ts";
export type Decision = {
  action: "approved" | "changed" | "excluded";
  note: string;
};
export type WorkspaceMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  kind?: "run";
  plan?: Plan;
  decision?: Decision;
};
export type Snapshot = {
  sheets: Sheet[];
  sheetIndex: number;
  messages: WorkspaceMessage[];
};
export function validateSnapshot(input: unknown): Snapshot {
  if (!input || typeof input !== "object")
    throw new Error("Choose a spreadsheet workspace.");
  const s = input as Snapshot;
  if (
    !Array.isArray(s.sheets) ||
    !s.sheets.length ||
    s.sheets.length > 20 ||
    !Number.isInteger(s.sheetIndex) ||
    s.sheetIndex < 0 ||
    s.sheetIndex >= s.sheets.length ||
    !Array.isArray(s.messages) ||
    s.messages.length > 100
  )
    throw new Error("Save up to 20 sheets and 100 conversation messages.");
  const sheets = s.sheets.map(validateSheet);
  const messages = s.messages.map((m) => {
    if (
      !m ||
      !Number.isFinite(m.id) ||
      !["user", "assistant"].includes(m.role) ||
      typeof m.text !== "string" ||
      m.text.length > 40000
    )
      throw new Error("Invalid conversation message.");
    if (
      m.decision &&
      (!["approved", "changed", "excluded"].includes(m.decision.action) ||
        typeof m.decision.note !== "string" ||
        m.decision.note.length > 2000)
    )
      throw new Error("Review notes must be up to 2,000 characters.");
    return {
      id: m.id,
      role: m.role,
      text: m.text,
      ...(m.kind === "run" ? { kind: "run" as const } : {}),
      ...(m.plan ? { plan: validatePlan(m.plan, sheets[s.sheetIndex]) } : {}),
      ...(m.decision ? { decision: m.decision } : {}),
    };
  });
  const result = { sheets, sheetIndex: s.sheetIndex, messages };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 2 * 1024 * 1024)
    throw new Error(
      "The saved workspace must be under 2 MB. Start a new conversation or use a smaller sheet.",
    );
  return result;
}
