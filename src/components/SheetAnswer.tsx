"use client";
import { useMemo } from "react";
import { evaluatePlan, type Plan, type Sheet } from "@/lib/sheet";

export function SheetAnswer({ sheet, plan, text, onSources }: { sheet: Sheet; plan: Plan; text: string; onSources: (rows: number[]) => void }) {
  const result = useMemo(() => { try { return evaluatePlan(sheet, plan); } catch { return null; } }, [sheet, plan]);
  if (!result) return <div>{text}</div>;
  const largest = Math.max(1, ...result.values.map(v => Math.abs(v.value)));
  return <div className="sheet-answer">
    <strong>{plan.operation === "distinct" ? "Distinct count" : plan.operation} {plan.column ? `of ${plan.column}` : "of rows"}{plan.groupBy ? ` by ${plan.groupBy}${plan.period ? ` (${plan.period})` : ""}` : ""}</strong>
    <div className="answer-text">{text}</div>
    {plan.groupBy && result.values.length > 1 && <figure aria-label="Result comparison" className="answer-chart">
      <figcaption>Comparison · source units</figcaption>
      {result.values.map(v => <div key={v.label}><span>{v.label}</span><meter min={-largest} max={largest} value={v.value} aria-label={v.label} /><span>{v.value.toLocaleString(undefined, { maximumFractionDigits: 10 })}</span></div>)}
    </figure>}
    <details><summary>Calculation and filters</summary><p>Sheet: {sheet.name}. {result.matched} matched; {result.total - result.matched} excluded.</p><p>{plan.filters?.length ? plan.filters.map(f => `${f.column} ${f.operator} ${f.value}`).join(" AND ") : "All source rows included."}</p><p>{plan.operation === "distinct" ? "Distinct counts compare stored cell values, including blank values; a number and numeric text remain distinct. " : ""}Computed from this workspace’s current data. Currency and units are those of your source; no exchange conversion is applied.</p></details>
    <button className="secondary-button" onClick={() => onSources(result.sourceRows)}>Inspect {result.matched} source rows</button>
  </div>;
}
