"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Decimal from "decimal.js";
import { evaluatePlan, type Plan, type Sheet } from "@/lib/sheet";

export function SheetAnswer({ sheet, plan, text, onSources }: { sheet: Sheet; plan: Plan; text: string; onSources: (rows: number[]) => void }) {
  const [showSources, setShowSources] = useState(false);
  const sources = useRef<HTMLElement>(null);
  useEffect(() => { if (showSources) { sources.current?.focus({preventScroll:true}); sources.current?.scrollIntoView({block:"nearest",behavior:"smooth"}); } }, [showSources]);
  const result = useMemo(() => { try { return evaluatePlan(sheet, plan); } catch { return null; } }, [sheet, plan]);
  if (!result || result.text !== text) return <div>{text}</div>;
  const main = text.split("\n\n")[0];
  const primary = plan.operation !== "rows" && result.matched > 0 ? main.split("\n").slice(1).join("\n") : main;
  const largest = Math.max(1, ...result.values.map(v => Math.abs(v.value)));
  return <div className="sheet-answer">
    <strong>{({sum:"Total",average:"Average",min:"Smallest",max:"Largest",count:"Count",distinct:"Unique count",rows:"Matching"} as const)[plan.operation]} {plan.column ?? "rows"}{plan.groupBy ? ` by ${plan.groupBy}${plan.period ? ` (${plan.period})` : ""}` : ""}</strong>
    <div className="answer-text">{primary}</div>
    <p className="source-badge">{result.matched} of {result.total} rows · {plan.filters?.length ? "Filtered" : "All source rows"} · Source units</p>
    {plan.groupBy && result.values.length > 1 && <figure aria-label="Result comparison" className="answer-chart">
      <figcaption>Comparison · source units</figcaption>
      {result.values.map(v => <div key={v.label}><span>{v.label}</span><meter min={-largest} max={largest} value={v.value} aria-label={v.label} /><span>{v.value.toLocaleString(undefined, { maximumFractionDigits: 10 })}</span></div>)}
    </figure>}
    <details className="answer-working"><summary>See working</summary>
      <p>{({sum:"I added",average:"I averaged",min:"I found the smallest of",max:"I found the largest of",count:"I counted",distinct:"I counted unique values in",rows:"I selected"} as const)[plan.operation]} {plan.column ? <strong>{plan.column}</strong> : "rows"}{plan.groupBy ? <> separately for each <strong>{plan.groupBy}</strong></> : ""}.</p>
      <div className="working-scope"><span><strong>{result.matched}</strong> rows included</span><span><strong>{result.total-result.matched}</strong> rows excluded</span></div>
      {plan.filters?.length ? <ul>{plan.filters.map((f,i)=><li key={i}>{f.column} {({equals:"is",not_equals:"is not",contains:"contains",gt:"is greater than",gte:"is at least",lt:"is less than",lte:"is at most",before:"is before",after:"is after"} as const)[f.operator]} <strong>{f.value==="$today" && plan.dateAnchor==="today" ? "today (Melbourne time)" : f.value}</strong></li>)}</ul> : <p>No filters — every row was included.</p>}
      {result.values.length>0 && <div className="working-equations" aria-label="Calculation breakdown">{result.values.map(v=>{
        const source = result.sourceRows.map(n=>sheet.rows[n-(sheet.headerRow??1)-1]).filter(row=>{
          if (!plan.groupBy) return true;
          const cell = row[sheet.columns.indexOf(plan.groupBy)];
          const label = cell===null || cell==="" ? "(blank)" : String(cell);
          return (plan.period ? label.slice(0,plan.period==="month"?7:4) : label)===v.label;
        });
        const expression = workingExpression(source, sheet, plan);
        return <div key={v.label}>{plan.groupBy && <small>{v.label}</small>}<span>{expression}</span><span> = </span><strong>{format(v.value)}</strong></div>;
      })}</div>}
      {plan.groupBy && <p>Showing up to {plan.limit??20} groups, ordered {plan.direction==="asc"?"smallest first":"largest first"}.{plan.period ? " Dates grouped by "+plan.period+"." : ""}</p>}
      {plan.operation==="distinct" && <p>Blank values count as a distinct value. Numbers and text are compared as stored.</p>}
      <small>From {sheet.name}. Values keep the spreadsheet’s units; no currency conversion. Results rounded to at most 10 decimal places.</small>
    </details>
    <button className="answer-source-toggle" aria-expanded={showSources} onClick={()=>setShowSources(!showSources)}>{showSources ? "Hide source rows" : `Inspect ${result.matched} source rows`}</button>
    {showSources && <section className="answer-source-rows" aria-label="Rows used in this answer" ref={sources} tabIndex={-1}>
      <strong>{result.matched} rows used in this answer</strong>
      <p>{result.total-result.matched} rows excluded{result.matched>50 ? ". Showing the first 50 included rows below." : "."}</p>
      <div className="sheet-scroll"><table><thead><tr><th scope="col">Row</th>{sheet.columns.map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{result.sourceRows.slice(0,50).map(n=><tr key={n}><th scope="row">{n}</th>{sheet.rows[n-(sheet.headerRow??1)-1].map((c,i)=><td key={i}>{String(c??"")}</td>)}</tr>)}</tbody></table></div>
      {result.matched>50 && <button className="secondary-button" onClick={()=>onSources(result.sourceRows)}>Browse all {result.matched} included rows</button>}
    </section>}
  </div>;
}

const format = (n: number) => n.toLocaleString("en-AU", {maximumFractionDigits:10});

function workingExpression(rows: Sheet["rows"], sheet: Sheet, plan: Plan): string {
  if (plan.operation==="count") return rows.length+" rows";
  if (plan.operation==="distinct") return "Unique "+plan.column+" values";
  const values = rows.map(r=>new Decimal(String(r[sheet.columns.indexOf(plan.column??"")]).replaceAll(",","")));
  const exact = (n: Decimal) => n.toFixed().replace(/^[^.]+/, whole=>whole.replace(/\B(?=(\d{3})+(?!\d))/g,","));
  const total = values.reduce((a,b)=>a.plus(b),new Decimal(0));
  if (plan.operation==="min" || plan.operation==="max") return (plan.operation==="min"?"Smallest":"Largest")+" of "+(values.length<=8 ? values.map(exact).join(", ") : values.length+" values");
  const terms = values.length<=8
    ? values.map((n,i)=>i===0?exact(n):n.isNegative()?" − "+exact(n.abs()):" + "+exact(n)).join("")
    : exact(total)+" (total of "+values.length+" values)";
  return plan.operation==="average" ? "("+terms+") ÷ "+values.length : terms;
}
