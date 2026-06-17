import {
  Archive,
  Bot,
  ChevronDown,
  ChevronUp,
  Database,
  FileClock,
  Folder,
  Minus,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Wrench
} from "lucide-react";
import type { RecentConversationRecord } from "../workbenchState";

const SIDEBAR_CARD_TITLE_LIMIT = 20;
const SIDEBAR_CARD_SUMMARY_LIMIT = 28;

function createCompactSidebarText(text: string, limit: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit).trimEnd()}…`;
}

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
  | "history"
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
  onNewConversation: () => void;
  hasActiveConversationEntries: boolean;
  recentConversations: RecentConversationRecord[];
  onArchiveConversation: () => void;
  archiveConversationDisabled?: boolean;
  isConversationSearchOpen: boolean;
  conversationSearchQuery: string;
  onConversationSearchQueryChange: (query: string) => void;
  onToggleConversationSearch: () => void;
  isConversationDropdownOpen: boolean;
  onToggleConversationDropdown: () => void;
  onCloseConversationDropdown: () => void;
  onRestoreRecentConversation: (conversationId: string) => void;
  onDeleteRecentConversation: (conversationId: string) => void;
  isConversationClusterExpanded: boolean;
  onToggleConversationCluster: () => void;
};

export function Sidebar({
  activeView,
  onSelectView,
  onNewConversation,
  hasActiveConversationEntries,
  recentConversations,
  onArchiveConversation,
  archiveConversationDisabled = false,
  isConversationSearchOpen,
  conversationSearchQuery,
  onConversationSearchQueryChange,
  onToggleConversationSearch,
  isConversationDropdownOpen,
  onToggleConversationDropdown,
  onCloseConversationDropdown,
  onRestoreRecentConversation,
  onDeleteRecentConversation,
  isConversationClusterExpanded,
  onToggleConversationCluster
}: SidebarProps) {
  const safeRecentConversations = recentConversations ?? [];
  const normalizedSearchQuery = conversationSearchQuery.trim().toLowerCase();
  const shouldShowConversationDropdown = activeView === "chat" && (isConversationSearchOpen || isConversationDropdownOpen);
  const filteredRecentConversations = normalizedSearchQuery
    ? safeRecentConversations.filter((item) =>
      `${item.title} ${item.summary}`.toLowerCase().includes(normalizedSearchQuery)
    )
    : safeRecentConversations;
  const visibleRecentConversations = normalizedSearchQuery
    ? filteredRecentConversations
    : filteredRecentConversations.slice(0, isConversationClusterExpanded ? 6 : 3);
  const shouldShowToggle = !normalizedSearchQuery && safeRecentConversations.length > 3;
  const ToggleIcon = isConversationClusterExpanded ? ChevronUp : ChevronDown;
  void hasActiveConversationEntries;

  return (
    <aside className="sidebar glass-gradient-sidebar-left" aria-label="主导航">
      <section className="sidebar-conversation-cluster" aria-label="会话分组">
        <div className="sidebar-conversation-cluster-header">
          <div
            className={`sidebar-conversation-header-shell ${activeView === "chat" ? "sidebar-item-active" : ""}`}
          >
            <button
              aria-pressed={activeView === "chat"}
              className="sidebar-primary sidebar-conversation-home"
              type="button"
              onClick={() => {
                onSelectView("chat");
                onToggleConversationDropdown();
              }}
            >
              <MessageSquare aria-hidden="true" size={18} />
              会话
            </button>
            <div className="sidebar-conversation-actions">
              <button
                aria-label="搜索历史会话"
                className="sidebar-icon-button"
                type="button"
                onClick={() => {
                onSelectView("chat");
                onToggleConversationSearch();
              }}
              >
                <Search aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="创建新会话"
                className="sidebar-icon-button"
                type="button"
                onClick={() => {
                  onSelectView("chat");
                  onCloseConversationDropdown();
                  onNewConversation();
                }}
              >
                <Plus aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="归档当前会话"
                className="sidebar-icon-button"
                disabled={archiveConversationDisabled}
                type="button"
                onClick={() => {
                  onSelectView("chat");
                  onCloseConversationDropdown();
                  onArchiveConversation();
                }}
              >
                <Archive aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        </div>
        {shouldShowConversationDropdown ? (
          <div className="sidebar-conversation-dropdown">
            {isConversationSearchOpen ? (
              <label className="sidebar-conversation-search-shell">
                <Search aria-hidden="true" size={18} />
                <input
                  aria-label="搜索历史记录"
                  className="sidebar-conversation-search"
                  placeholder="搜索历史记录"
                  type="text"
                  value={conversationSearchQuery}
                  onChange={(event) => onConversationSearchQueryChange(event.target.value)}
                />
              </label>
            ) : null}
            <div className="sidebar-conversation-list">
              {visibleRecentConversations.map((item) => (
                <article className="sidebar-conversation-card" key={item.id}>
                  <button
                    aria-label={`打开会话：${item.title}`}
                    className="sidebar-conversation-card-main"
                    type="button"
                    onClick={() => {
                      onSelectView("chat");
                      onCloseConversationDropdown();
                      onRestoreRecentConversation(item.id);
                    }}
                  >
                    <span className="sidebar-conversation-card-text">
                      {createCompactSidebarText(item.title, SIDEBAR_CARD_TITLE_LIMIT)}
                      {" · "}
                      {createCompactSidebarText(item.summary, SIDEBAR_CARD_SUMMARY_LIMIT)}
                    </span>
                  </button>
                  <button
                    aria-label={`删除会话：${item.title}`}
                    className="sidebar-conversation-card-delete"
                    type="button"
                    onClick={() => onDeleteRecentConversation(item.id)}
                  >
                    <Minus aria-hidden="true" size={14} />
                  </button>
                </article>
              ))}
              {visibleRecentConversations.length === 0 ? (
                <p className="sidebar-conversation-empty">
                  {isConversationSearchOpen ? "没有匹配的历史会话。" : "还没有可显示的历史会话。"}
                </p>
              ) : null}
            </div>
            {shouldShowToggle ? (
              <button
                aria-expanded={isConversationClusterExpanded}
                aria-label={isConversationClusterExpanded ? "收起最近会话" : "展开最近会话"}
                className="sidebar-conversation-toggle"
                type="button"
                onClick={onToggleConversationCluster}
              >
                <ToggleIcon aria-hidden="true" size={14} />
                {isConversationClusterExpanded ? "收起" : "展开"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
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
