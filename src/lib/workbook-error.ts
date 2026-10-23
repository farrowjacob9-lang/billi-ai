// Classify parser failures without returning or logging spreadsheet contents.
export function workbookFailureKind(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/password|encrypted/i.test(message)) return "encrypted";
  if (/supported javascript type|unsupported.*type|buffer|arraybuffer/i.test(message)) return "input-runtime";
  if (/not a constructor|not a function|cannot find module|module not found|is not defined/i.test(message)) return "parser-runtime";
  if (/end of central directory|corrupt|invalid signature|zip/i.test(message)) return "archive";
  if (/xml|unclosed|unexpected close tag|invalid character/i.test(message)) return "xml";
  return "reader";
}

export class WorkbookReadError extends Error {
  readonly kind: string;
  readonly reference: string;
  constructor(kind: string, reference: string) {
    super(kind === "encrypted"
      ? "This workbook is encrypted. Save an unprotected copy and upload it again."
      : kind === "archive"
        ? "The Excel archive appears damaged. Save a new .xlsx copy and upload it again."
        : `Our Excel reader couldn't open this workbook. You can use CSV while we investigate. Reference: ${reference}.`);
    this.kind = kind;
    this.reference = reference;
  }
}

// Error messages can contain XML/cell values. Keep only allowlisted runtime metadata.
export function workbookDiagnostic(error: unknown, stage: string) {
  const names = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError"];
  const name = error instanceof Error && names.includes(error.name) ? error.name : "unknown";
  const stack = error instanceof Error ? error.stack ?? "" : "";
  const frames = stack.split("\n").slice(1).flatMap(line => {
    const frame = line.match(/node_modules\/(exceljs|jszip|saxes|readable-stream|pako)\/([a-zA-Z0-9_./-]+:\d+:\d+)/);
    return frame ? [`${frame[1]}/${frame[2]}`] : [];
  }).slice(0, 5);
  return {stage, name, frames};
}
