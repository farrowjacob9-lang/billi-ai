export type WorkReference = {id:string;name:string;updated_at?:string;expires_at?:string};
export type WorkLocation = {view:"workspace"|"workflows"|"history"|"routines";workId?:string;reportId?:string};
const idPattern=/^[a-zA-Z0-9_-]{1,100}$/;
export function workHash(location:WorkLocation):string {
  if(location.view==="workflows") return "#/workflows";
  if(location.view==="history") return "#/activity";
  if(location.view==="routines") return "#/report-workflows";
  if(location.workId && idPattern.test(location.workId)) return `#/work/${location.workId}`;
  if(location.reportId && idPattern.test(location.reportId)) return `#/reports/${location.reportId}`;
  return "#/work";
}
export function parseWorkHash(hash:string):WorkLocation {
  if(hash==="#/workflows") return {view:"workflows"};
  if(hash==="#/activity") return {view:"history"};
  if(hash==="#/report-workflows") return {view:"routines"};
  const match=hash.match(/^#\/(work|reports)\/([a-zA-Z0-9_-]{1,100})$/);
  return match ? {view:"workspace",...(match[1]==="work"?{workId:match[2]}:{reportId:match[2]})} : {view:"workspace"};
}
export function writeWorkLocation(location:WorkLocation,replace=false) {
  const hash=workHash(location);
  if(window.location.hash===hash)return;
  window.history[replace?"replaceState":"pushState"](null,"",hash);
}
