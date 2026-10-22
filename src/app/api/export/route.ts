import { createElement as h } from "react";
import { ok, readJson, requireSession, route, HttpError } from "@/server/http";
import { databaseConfigured } from "@/server/db";
import { validateSnapshot } from "@/lib/workspace";
export const runtime = "nodejs";
export const POST = route(async (req) => {
  if (databaseConfigured()) await requireSession();
  const b = await readJson(req, 2.5 * 1024 * 1024);
  let snapshot;
  try {
    snapshot = validateSnapshot(b.snapshot);
  } catch (e) {
    throw new HttpError(422, "invalid_workspace", (e as Error).message);
  }
  const sheet = snapshot.sheets[snapshot.sheetIndex];
  const answers = snapshot.messages.filter(
    (m) => m.role === "assistant" && m.kind !== "run",
  );
  if (b.format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook();
    book.creator = "Naxium";
    const ws = book.addWorksheet("Source data");
    ws.addRow(sheet.columns);
    ws.addRows(sheet.rows);
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rows.length + 1, column: sheet.columns.length },
    };
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 22));
    const qa = book.addWorksheet("Answers and review");
    qa.addRow([
      "Source sheet",
      "Original answer",
      "Review status",
      "Reviewer note",
      "Calculation",
    ]);
    for (const m of answers)
      qa.addRow([
        sheet.name,
        m.text,
        m.decision?.action ?? "unreviewed",
        m.decision?.note ?? "",
        m.plan ? JSON.stringify(m.plan) : "",
      ]);
    qa.columns.forEach((c) => (c.width = 45));
    qa.getRow(1).font = { bold: true };
    const conversation = book.addWorksheet("Conversation");
    conversation.addRow(["Role", "Text"]);
    for (const m of snapshot.messages) conversation.addRow([m.role, m.text]);
    conversation.columns = [{ width: 15 }, { width: 100 }];
    const bytes = await book.xlsx.writeBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="naxium-workspace.xlsx"',
        "cache-control": "no-store",
      },
    });
  }
  if (b.format === "pdf") {
    const { Document, Page, Text, View, renderToBuffer } = await import(
      "@react-pdf/renderer"
    );
    const document = h(
      Document,
      null,
      h(
        Page,
        {
          size: "A4",
          style: {
            padding: 36,
            fontFamily: "Helvetica",
            fontSize: 10,
            lineHeight: 1.5,
          },
        },
        h(
          Text,
          { style: { fontSize: 24, marginBottom: 8 } },
          "Naxium / Workspace report",
        ),
        h(
          Text,
          { style: { color: "#666", marginBottom: 20 } },
          `${sheet.name} · ${sheet.rows.length} source rows\nAll amounts retain their source units. Review statuses are user decisions, not automatic guarantees.`,
        ),
        ...snapshot.messages
          .filter((m) => m.kind !== "run")
          .map((m) =>
            h(
              View,
              { key: m.id, style: { marginBottom: 14 } },
              h(
                Text,
                { style: { fontFamily: "Helvetica-Bold" } },
                m.role === "user" ? "Question" : "Calculated answer",
              ),
              h(Text, null, m.text),
              ...(m.decision
                ? [
                    h(
                      Text,
                      { style: { color: "#666" } },
                      `Review: ${m.decision.action}. ${m.decision.note}`,
                    ),
                  ]
                : []),
            ),
          ),
      ),
    );
    const bytes = await renderToBuffer(document);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="naxium-report.pdf"',
        "cache-control": "no-store",
      },
    });
  }
  return ok({ error: "Choose Excel or PDF." }, 400);
});
