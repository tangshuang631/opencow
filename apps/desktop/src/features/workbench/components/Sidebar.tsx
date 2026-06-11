import {
  Bot,
  Database,
  FileClock,
  Folder,
  MessageSquarePlus,
  Search,
  Settings,
  ShieldCheck,
  Wrench
} from "lucide-react";

const navItems = [
  { id: "search", label: "搜索", icon: Search },
  { id: "knowledge", label: "知识库", icon: Database },
  { id: "skills", label: "Skills", icon: Wrench },
  { id: "npc", label: "NPC", icon: Bot },
  { id: "mcp", label: "MCP", icon: Folder },
  { id: "audit", label: "审计", icon: FileClock },
  { id: "safety", label: "安全", icon: ShieldCheck }
];

export type WorkbenchViewId =
  | "chat"
  | "search"
  | "knowledge"
  | "skills"
  | "npc"
  | "mcp"
  | "audit"
  | "safety"
  | "settings";

type SidebarProps = {
  activeView: WorkbenchViewId;
  onSelectView: (viewId: WorkbenchViewId) => void;
};

export function Sidebar({ activeView, onSelectView }: SidebarProps) {
  return (
    <aside className="sidebar glass-gradient-sidebar-left" aria-label="主导航">
      <button
        aria-pressed={activeView === "chat"}
        className={`sidebar-primary ${activeView === "chat" ? "sidebar-item-active" : ""}`}
        type="button"
        onClick={() => onSelectView("chat")}
      >
        <MessageSquarePlus aria-hidden="true" size={18} />
        新对话
      </button>
      <nav className="sidebar-nav" aria-label="功能导航">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              aria-pressed={activeView === item.id}
              className={`sidebar-nav-item ${activeView === item.id ? "sidebar-item-active" : ""}`}
              key={item.label}
              type="button"
              onClick={() => onSelectView(item.id as WorkbenchViewId)}
            >
              <Icon aria-hidden="true" size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <button
        aria-pressed={activeView === "settings"}
        className={`sidebar-settings ${activeView === "settings" ? "sidebar-item-active" : ""}`}
        type="button"
        onClick={() => onSelectView("settings")}
      >
        <Settings aria-hidden="true" size={17} />
        设置
      </button>
    </aside>
  );
}
