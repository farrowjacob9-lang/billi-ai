"use client";

import { useMemo, useState } from "react";
import type { Sheet } from "@/lib/sheet";
import { inspectSheet, matchingRowIndexes, suggestedQuestions } from "@/lib/sheet-inspection";

export function SheetExplorer({ sheet, disabled, onQuestion, sourceRows, onClearSources }: { sheet: Sheet; disabled: boolean; onQuestion: (question: string) => void; sourceRows?: number[] | null; onClearSources?: () => void }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "duplicates" | "blanks">("all");
  const [page, setPage] = useState(0);
  const profile = useMemo(() => inspectSheet(sheet), [sheet]);
  const matches = useMemo(() => { const indexes = matchingRowIndexes(sheet, query, mode, profile.duplicates); const included = sourceRows ? new Set(sourceRows) : null; return included ? indexes.filter(i => included.has(i + (sheet.headerRow ?? 1) + 1)) : indexes; }, [sheet, query, mode, profile, sourceRows]);
  const pages = Math.max(1, Math.ceil(matches.length / 25));
  const current = Math.min(page, pages - 1);
  const visible = matches.slice(current * 25, (current + 1) * 25);
  const blanks = profile.columns.reduce((n, c) => n + c.blanks, 0);
  return <>
    <p>Ask about the selected sheet. Search and review filters below only change the preview; questions still use all rows unless you specify filters.</p>
    {sourceRows && <p role="status">Inspecting answer source rows. <button className="secondary-button" onClick={onClearSources}>Show all source rows</button></p>}
    <div className="sheet-suggestions" aria-label="Suggested questions">
      {suggestedQuestions(sheet).map(q => <button key={q} className="secondary-button" disabled={disabled} onClick={() => onQuestion(q)}>{q}</button>)}
    </div>
    <details className="sheet-checks">
      <summary>Data checks · {blanks} blank cells · {profile.duplicates.length} repeated rows</summary>
      <p>Repeated rows are exact copies of earlier rows, including every column. They may be legitimate transactions. Nothing is removed or changed.</p>
      <ul>{profile.columns.map(c => <li key={c.name}><strong>{c.name}</strong>: {c.blanks} blank; {c.numeric} numeric of {c.populated} populated cells{c.numeric > 0 && c.numeric < c.populated ? ". Mixed numeric and non-numeric values — review before summing." : ""}</li>)}</ul>
    </details>
    <div className="sheet-explorer-controls">
      <label>Search rows<input type="search" value={query} placeholder="Find a transaction or value" onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
      <label>Review rows<select value={mode} onChange={e => { setMode(e.target.value as typeof mode); setPage(0); }}><option value="all">All rows</option><option value="duplicates">Repeated rows</option><option value="blanks">Rows with blank cells</option></select></label>
    </div>
    <p role="status">{matches.length} of {sheet.rows.length} rows in preview · Page {current + 1} of {pages}</p>
    <div className="sheet-scroll"><table><thead><tr><th scope="col">Row</th>{sheet.columns.map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{visible.map(index => <tr key={index}><th scope="row">{index + (sheet.headerRow ?? 1) + 1}</th>{sheet.rows[index].map((cell, j) => <td key={j}>{String(cell ?? "")}</td>)}</tr>)}</tbody></table>{!matches.length && <p>No matching rows. Try another search or review filter.</p>}</div>
    <div className="sheet-pagination"><button className="secondary-button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous rows</button><button className="secondary-button" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next rows</button></div>
  </>;
}
