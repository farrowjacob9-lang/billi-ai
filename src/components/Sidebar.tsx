import { ChevronDown, History, LayoutGrid, MessageSquare, Plus, Settings2, Sparkles, Zap } from "lucide-react";
import { NavItem } from "@/components/ui";
import type { Report } from "@/lib/report";
import type { View } from "@/lib/types";

type Props = {
  view: View; open: boolean; runs: Report[]; routineCount: number;
  workspaceName: string; workspaceDetail: string; accountLabel: string; accountDetail: string;
  onNavigate: (view: View) => void; onNewConversation: () => void; onOpenRun: (run: Report) => void; onSettings: () => void; onClose: () => void;
};

export function Sidebar({ view, open, runs, routineCount, workspaceName, workspaceDetail, accountLabel, accountDetail, onNavigate, onNewConversation, onOpenRun, onSettings, onClose }: Props) {
  return <>
    {open && <button className="nav-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${open ? "mobile-open" : ""}`} aria-label="Main navigation">
      <a className="brand" href="/" aria-label="Billions home"><span className="brand-mark">b<span>.</span></span>billions<span className="brand-dot">®</span></a>
      <button className="workspace-picker" onClick={onSettings}><span className="workspace-avatar">{workspaceName.charAt(0).toUpperCase() || "B"}<span /></span><span>{workspaceName}<small>{workspaceDetail}</small></span><ChevronDown size={15} /></button>
      <button className="new-chat" onClick={onNewConversation}><Plus size={18} /> New conversation <span>↗</span></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <NavItem active={view === "workspace"} onClick={() => onNavigate("workspace")} icon={<LayoutGrid size={18} />} label="Overview" />
        <NavItem active={view === "routines"} onClick={() => onNavigate("routines")} icon={<Zap size={18} />} label="Routines" count={routineCount || undefined} />
        <NavItem active={view === "history"} onClick={() => onNavigate("history")} icon={<History size={18} />} label="Run history" count={runs.length || undefined} />
      </nav>
      <div className="nav-label recent-label">RECENT WORK <button aria-label="Start a new conversation" onClick={onNewConversation}><Plus size={15} /></button></div>
      <div className="recent-list">{runs.length ? runs.slice(0, 4).map(run => <button key={run.id} onClick={() => onOpenRun(run)}><MessageSquare size={15} /><span>{run.fileName}</span></button>) : <div className="recent-empty">A little quiet here.<br />Your reports will appear as you work.</div>}</div>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><div className="note-symbol"><Sparkles size={17} /></div><strong>A little less busywork.</strong><p>Make room for the work<br />only you can do.</p><span>That’s the idea behind Billions.</span></div>
        <button className="profile" onClick={onSettings}><span className="profile-avatar">{accountLabel.charAt(0).toUpperCase() || "Y"}</span><span>{accountLabel}<small>{accountDetail}</small></span><Settings2 size={17} /></button>
      </div>
    </aside>
  </>;
}
