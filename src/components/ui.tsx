import type { ReactNode } from "react";
import { CircleCheck, X } from "lucide-react";

export function NavItem({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count?: number }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>{icon}<span>{label}</span>{count ? <small>{count}</small> : null}{active && <span className="active-dot" />}</button>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function Toast({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return <div className="toast" role="status"><CircleCheck size={18} /><span>{text}</span><button className="icon-button" aria-label="Dismiss notification" onClick={onDismiss}><X size={16} /></button></div>;
}
