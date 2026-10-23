import { ArrowUpRight, History, LayoutGrid, MessageSquare, Plus, Settings2, Sparkles, Zap } from "lucide-react";
import { NavItem } from "@/components/ui";
import type { Report } from "@/lib/report";
import type { View } from "@/lib/types";

type Props = {
  view: View; workflowActive: boolean; open: boolean; runs: Report[]; routineCount: number;
  workspaceName: string; workspaceDetail: string; accountLabel: string; accountDetail: string;
  onWorkflows: () => void;
  onNavigate: (view: View) => void; onNewConversation: () => void; onOpenRun: (run: Report) => void; onSettings: () => void; onClose: () => void;
};

export function Sidebar({ view, workflowActive, open, runs, routineCount, workspaceName, workspaceDetail, accountLabel, accountDetail, onWorkflows, onNavigate, onNewConversation, onOpenRun, onSettings, onClose }: Props) {
  return <>
    {open && <button className="nav-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${open ? "mobile-open" : ""}`} aria-label="Main navigation">
      <a className="brand" href="/" aria-label="Naxium overview" onClick={e => { e.preventDefault(); onNavigate("workspace"); }}><img src="/naxium/logo_badge_pearl.svg" alt="" width="34" height="34" />naxium</a>
      <button className="workspace-picker" onClick={onSettings}><span className="workspace-avatar">{workspaceName.charAt(0).toUpperCase() || "B"}<span /></span><span>{workspaceName}<small>{workspaceDetail}</small></span></button>
      <button className="new-chat" onClick={onNewConversation}><Plus size={18} /> New conversation <span><ArrowUpRight size={16} /></span></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <NavItem active={workflowActive} onClick={onWorkflows} icon={<Zap size={18} />} label="Workflows" />
        <NavItem active={view === "workspace" && !workflowActive} onClick={() => onNavigate("workspace")} icon={<LayoutGrid size={18} />} label="Conversation" />
        <NavItem active={view === "routines"} onClick={() => onNavigate("routines")} icon={<Zap size={18} />} label="Report routines" count={routineCount || undefined} />
        <NavItem active={view === "history"} onClick={() => onNavigate("history")} icon={<History size={18} />} label="Run history" count={runs.length || undefined} />
      </nav>
      <div id="saved-work-library" />
      <div className="nav-label recent-label">RECENT WORK <button aria-label="Start a new conversation" onClick={onNewConversation}><Plus size={15} /></button></div>
      <div className="recent-list">{runs.length ? runs.slice(0, 4).map(run => <button key={run.id} onClick={() => onOpenRun(run)}><MessageSquare size={15} /><span>{run.fileName}</span></button>) : <div className="recent-empty">A little quiet here.<br />Your reports will appear as you work.</div>}</div>
      <div className="sidebar-bottom">
        <button className="profile" onClick={onSettings}><span className="profile-avatar">{accountLabel.charAt(0).toUpperCase() || "Y"}</span><span>{accountLabel}<small>{accountDetail}</small></span><Settings2 size={17} /></button>
      </div>
    </aside>
  </>;
}
