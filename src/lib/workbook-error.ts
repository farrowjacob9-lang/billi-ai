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
