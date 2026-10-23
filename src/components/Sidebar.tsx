import { ArrowUpRight, History, LayoutGrid, MessageSquare, Plus, Settings2, Sparkles, Zap } from "lucide-react";
import { NavItem } from "@/components/ui";
import type { Report } from "@/lib/report";
import type { WorkReference } from "@/lib/work-navigation";
import { useState } from "react";
import type { View } from "@/lib/types";

type Props = {
  onMemory:()=>void;view: View; workflowActive: boolean; open: boolean; runs: Report[]; routineCount: number;
  workspaceName: string; workspaceDetail: string; accountLabel: string; accountDetail: string;
  savedWork: WorkReference[]; activeWorkId:string; onOpenWork:(id:string)=>void;
  onWorkflows: () => void;
  onNavigate: (view: View) => void; onNewConversation: () => void; onOpenRun: (run: Report) => void; onSettings: () => void; onClose: () => void;
};

export function Sidebar({ onMemory, view, workflowActive, open, runs, routineCount, workspaceName, workspaceDetail, accountLabel, accountDetail, savedWork, activeWorkId, onOpenWork, onWorkflows, onNavigate, onNewConversation, onOpenRun, onSettings, onClose }: Props) {
  const [query,setQuery] = useState("");
  const items = [...savedWork.map(w=>({id:w.id,name:w.name,date:w.updated_at??"",kind:"work" as const})),...runs.map(r=>({id:r.id,name:r.fileName,date:r.createdAt,kind:"report" as const}))].filter(w=>w.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
  return <>
    {open && <button className="nav-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${open ? "mobile-open" : ""}`} aria-label="Main navigation">
      <a className="brand" href="/" aria-label="Naxium overview" onClick={e => { e.preventDefault(); onNavigate("workspace"); }}><img src="/naxium/logo_badge_pearl.svg" alt="" width="34" height="34" />naxium</a>
      <div className="workspace-picker" aria-label="Current business"><span className="workspace-avatar">{workspaceName.charAt(0).toUpperCase() || "B"}<span /></span><span>{workspaceName}<small>{workspaceDetail}</small></span></div>
      <button className="new-chat" onClick={onNewConversation}><Plus size={18} /> New conversation <span><ArrowUpRight size={16} /></span></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <NavItem active={view === "workspace"} onClick={() => onNavigate("workspace")} icon={<MessageSquare size={18}/>} label="Your work" />
        <NavItem active={view === "workflows"} onClick={onWorkflows} icon={<Zap size={18}/>} label="Workflows" />
        <NavItem active={false} onClick={()=>{onMemory();onClose();}} icon={<MessageSquare size={18}/>} label="Company memory" />
        <NavItem active={view === "history"} onClick={() => onNavigate("history")} icon={<History size={18}/>} label="Activity" />
      </nav>
      <div className="nav-label recent-label">YOUR WORK <button aria-label="Start a new conversation" onClick={onNewConversation}><Plus size={15}/></button></div>
      {(savedWork.length>0 || runs.length>0) && <input className="work-search" aria-label="Search your work" placeholder="Find saved work…" value={query} onChange={e=>setQuery(e.target.value)}/>}
      <nav aria-label="Saved workspaces" className="work-library-list">
        {items.map(w=><button key={`${w.kind}:${w.id}`} aria-label={w.name} aria-current={w.kind==="work" && w.id===activeWorkId?"page":undefined} onClick={()=>{if(w.kind==="work")onOpenWork(w.id);else onOpenRun(runs.find(r=>r.id===w.id)!);onClose();}}><MessageSquare size={14}/><span>{w.name}<small>{w.kind==="report"?"Saved report":"Saved work"}</small></span></button>)}
        {!items.length && <p className="recent-empty">{query?"No matching work.":"Saved work and reports will appear here."}</p>}
      </nav>
      <div className="sidebar-bottom">
        <button className="profile" onClick={onSettings}><span className="profile-avatar">{accountLabel.charAt(0).toUpperCase() || "Y"}</span><span>{accountLabel}<small>{accountDetail}</small></span><Settings2 size={17} /></button>
      </div>
    </aside>
  </>;
}
