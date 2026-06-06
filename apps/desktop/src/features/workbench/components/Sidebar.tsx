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
  { label: "搜索", icon: Search },
  { label: "知识库", icon: Database },
  { label: "Skills", icon: Wrench },
  { label: "NPC", icon: Bot },
  { label: "MCP", icon: Folder },
  { label: "审计", icon: FileClock },
  { label: "安全", icon: ShieldCheck }
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="主导航">
      <button className="sidebar-primary" type="button">
        <MessageSquarePlus aria-hidden="true" size={18} />
        新对话
      </button>
      <nav className="sidebar-nav" aria-label="功能导航">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button className="sidebar-nav-item" key={item.label} type="button">
              <Icon aria-hidden="true" size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <button className="sidebar-settings" type="button">
        <Settings aria-hidden="true" size={17} />
        设置
      </button>
    </aside>
  );
}
