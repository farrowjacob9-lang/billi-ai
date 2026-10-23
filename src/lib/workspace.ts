import {validateMemoryReferences,type MemoryReference} from "./company-memory.ts";
import { validateSheet, validatePlan, type Sheet, type Plan } from "./sheet.ts";
import {validateEvidence,validateTask,validateMethodRef,type InputEvidence,type TaskContext,type MethodRef} from "./methods.ts";
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
  task?: TaskContext;
  evidence?: InputEvidence;
  methodRef?: MethodRef;
  accepted?: "once" | "matching";
  memoryReferences?: MemoryReference[];
  methodStorage?: "tab" | "browser" | "account";
};
export type Snapshot = {
  sheets: Sheet[];
  sheetIndex: number;
  messages: WorkspaceMessage[];
  sheetMessages?: Record<string, WorkspaceMessage[]>;
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
      ...(m.memoryReferences?{memoryReferences:validateMemoryReferences(m.memoryReferences)}:{}),
      id: m.id,
      role: m.role,
      text: m.text,
      ...(m.kind === "run" ? { kind: "run" as const } : {}),
      ...(m.plan ? { plan: validatePlan(m.plan, sheets[s.sheetIndex]) } : {}),
      ...(m.decision ? { decision: m.decision } : {}),
      ...(m.task ? {task:validateTask(m.task)} : {}),
      ...(m.evidence ? {evidence:validateEvidence(m.evidence)} : {}),
      ...(m.methodRef ? {methodRef:validateMethodRef(m.methodRef)} : {}),
      ...(m.accepted && ["once","matching"].includes(m.accepted) ? {accepted:m.accepted} : {}),
      ...(m.methodStorage && ["tab","browser","account"].includes(m.methodStorage) ? {methodStorage:m.methodStorage} : {}),
    };
  });
  let sheetMessages: Record<string, WorkspaceMessage[]> | undefined;
  if (s.sheetMessages !== undefined) {
    if (!s.sheetMessages || typeof s.sheetMessages !== "object" || Array.isArray(s.sheetMessages) || Object.keys(s.sheetMessages).length > sheets.length) throw new Error("Invalid sheet conversations.");
    sheetMessages = {};
    for (const [key, turns] of Object.entries(s.sheetMessages)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= sheets.length) throw new Error("Invalid sheet conversation index.");
      // Recursion validates only the selected turns, never nests history objects.
      sheetMessages[key] = validateSnapshot({sheets:[sheets[index]],sheetIndex:0,messages:turns}).messages;
    }
  }
  const result = { sheets, sheetIndex: s.sheetIndex, messages, ...(sheetMessages ? {sheetMessages} : {}) };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 2 * 1024 * 1024)
    throw new Error(
      "The saved workspace must be under 2 MB. Start a new conversation or use a smaller sheet.",
    );
  return result;
}
