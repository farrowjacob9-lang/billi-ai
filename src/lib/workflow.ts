import { executePlan, validatePlan, type Plan, type Sheet } from "./sheet.ts";
export type WorkflowStep = { name: string; question: string; plan: Plan };
export type WorkflowDefinition = { version: 1; steps: WorkflowStep[] };
export function validateWorkflow(value: unknown, sheet: Sheet): WorkflowDefinition {
  if (!value || typeof value !== "object") throw new Error("Choose a workflow.");
  const v = value as WorkflowDefinition;
  if (v.version !== 1 || !Array.isArray(v.steps) || v.steps.length < 1 || v.steps.length > 12) throw new Error("A workflow needs 1–12 approved calculation steps.");
  const steps = v.steps.map(step => {
    if (!step || typeof step.name !== "string" || !step.name.trim() || step.name.length > 120 || typeof step.question !== "string" || step.question.length > 2000) throw new Error("Give every step a name and question.");
    return {name:step.name.trim(),question:step.question,plan:validatePlan(step.plan,sheet)};
  });
  return {version:1, steps};
}
export function workflowSteps(value: unknown, sheet: Sheet): WorkflowStep[] {
  if (value && typeof value === "object" && "version" in value) return validateWorkflow(value,sheet).steps;
  return [{name:"Saved calculation",question:"Saved calculation",plan:validatePlan(value,sheet)}];
}
export function runWorkflow(value: unknown, sheet: Sheet) {
  const steps = workflowSteps(value,sheet);
  // Validate and calculate every step before returning results: no partial success.
  return steps.map(step => ({...step, text:executePlan(sheet,step.plan)}));
}
export function requiredWorkflowColumns(value: unknown): string[] {
  const v = value as Partial<WorkflowDefinition> | null;
  const plans = v?.version === 1 && Array.isArray(v.steps) ? v.steps.map(s => s.plan) : [value as Plan];
  return [...new Set(plans.flatMap(p => [p?.column,p?.groupBy,...(p?.filters ?? []).map(f => f.column)]).filter((s):s is string=> typeof s === "string"))];
}
