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
  { label: "技能", icon: Wrench },
  { label: "NPC", icon: Bot },
  { label: "MCP", icon: Folder },
  { label: "审计", icon: FileClock },
  { label: "安全", icon: ShieldCheck }
];

type SidebarProps = {
  onDemoDangerousAction: () => void;
  onDemoPermissionRequest: () => void;
  onDemoSearch: () => void;
  onDemoTaskFailure: () => void;
  onDemoToolResult: () => void;
  onDemoToolError: () => void;
};

export function Sidebar({
  onDemoDangerousAction,
  onDemoPermissionRequest,
  onDemoSearch,
  onDemoTaskFailure,
  onDemoToolResult,
  onDemoToolError
}: SidebarProps) {
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
      <section className="sidebar-demo" aria-label="桌面演练入口">
        <p className="sidebar-demo-title">桌面安全演练</p>
        <button className="sidebar-demo-button" type="button" onClick={onDemoDangerousAction}>
          模拟高风险操作
        </button>
        <button className="sidebar-demo-button" type="button" onClick={onDemoPermissionRequest}>
          模拟提权请求
        </button>
        <button className="sidebar-demo-button" type="button" onClick={onDemoSearch}>
          模拟联网搜索
        </button>
        <button className="sidebar-demo-button" type="button" onClick={onDemoTaskFailure}>
          模拟本地任务失败
        </button>
        <button className="sidebar-demo-button" type="button" onClick={onDemoToolResult}>
          模拟工具结果
        </button>
        <button className="sidebar-demo-button" type="button" onClick={onDemoToolError}>
          模拟工具失败
        </button>
      </section>
      <button className="sidebar-settings" type="button">
        <Settings aria-hidden="true" size={17} />
        设置
      </button>
    </aside>
  );
}
