import {type Sheet} from "./sheet.ts";
import type {WorkflowDefinition} from "./workflow.ts";
export function dailySalesReview(sheet:Sheet, scope:"due"|"overdue" = "due"): WorkflowDefinition {
  const heading=(name:string)=>sheet.columns.find(c=>c.toLowerCase()===name.toLowerCase());
  const date=heading("Next follow-up"),stage=heading("Stage"),value=heading("Deal value");
  if(!date || !stage || !value) throw new Error("A daily sales review needs Next follow-up, Stage and Deal value columns. Use those headings and try again.");
  const open=[{column:stage,operator:"not_equals" as const,value:"Closed Won"},{column:stage,operator:"not_equals" as const,value:"Closed Lost"}];
  const blanks=[...open,{column:date,operator:"not_equals" as const,value:"(blank)"}];
  return {version:1,steps:[
    {name:"Overdue follow-ups",question:"Open deals with a follow-up before today",plan:{operation:"rows",column:date,direction:"asc",limit:50,dateAnchor:"today",filters:[...blanks,{column:date,operator:"before",value:"$today"}]}},
    ...(scope === "due" ? [{name:"Follow-ups due today",question:"Open deals with a follow-up today",plan:{operation:"rows" as const,column:date,direction:"asc" as const,limit:50,dateAnchor:"today" as const,filters:[...open,{column:date,operator:"equals" as const,value:"$today"}]}}] : []),
    {name:"Missing follow-up dates",question:"Open deals without a follow-up date",plan:{operation:"rows",limit:50,filters:[...open,{column:date,operator:"equals",value:"(blank)"}]}}
  ]};
}
