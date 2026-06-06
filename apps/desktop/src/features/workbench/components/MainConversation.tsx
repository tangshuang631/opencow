import { Bot, LoaderCircle, Sparkles, User } from "lucide-react";
import type { WorkbenchState } from "../workbenchState";
import { normalizeWorkbenchText } from "../workbenchText";

type MainConversationProps = {
  state: WorkbenchState;
  onPreviewRollback: (targetEntryId: string) => void;
};

const TEXT = {
  conversation: "会话",
  title: "本地助手工作台",
  subtitle: "优先使用本地 Ollama，对话主区保持轻量，任务和审计细节收进右侧面板。",
  modelStatus: "模型状态",
  currentModel: "当前模型",
  permission: "当前权限",
  previewRollback: "预览回退",
  emptyTitle: "准备开始",
  emptySummary: "直接输入问题或任务，普通对话会优先返回助手答复。",
  user: "你",
  system: "系统",
  thinkingTitle: "助手处理中",
  thinkingSummary: "正在规划当前请求并等待本地执行结果。",
  queuedLabel: "已进入本地任务队列",
  runningLabel: "正在本地执行链中处理",
  pendingLabel: "请稍候，界面保持响应中"
} as const;

export function MainConversation({ state, onPreviewRollback }: MainConversationProps) {
  const entries = state.conversation.entries.slice().reverse();
  const visibleEntries = entries.filter((entry) => entry.kind !== "system" || entry.id === "assistant-welcome");
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId) ?? null
    : null;
  const queuedTask = state.tasks.items.find((item) => item.status === "queued") ?? null;
  const pendingTask = activeTask ?? queuedTask;
  const hasPendingTask = pendingTask !== null;
  const pendingStatusLabel = activeTask ? TEXT.runningLabel : TEXT.queuedLabel;

  return (
    <section className="conversation" aria-label={TEXT.conversation}>
      <header className="conversation-header">
        <div className="conversation-hero">
          <p className="conversation-kicker">opencow desktop</p>
          <h1>{TEXT.title}</h1>
          <p className="conversation-subtitle">{TEXT.subtitle}</p>
        </div>
        <div className="conversation-status">
          <div className="status-chip">
            <Sparkles aria-hidden="true" size={14} />
            <span>{TEXT.modelStatus}</span>
            <strong>{normalizeWorkbenchText(state.model.status)}</strong>
          </div>
          <div className="status-chip">
            <span>{TEXT.currentModel}</span>
            <strong>{normalizeWorkbenchText(state.model.activeModel)}</strong>
          </div>
          <div className="status-chip">
            <span>{TEXT.permission}</span>
            <strong>{normalizeWorkbenchText(state.permission.label)}</strong>
          </div>
        </div>
      </header>

      <div className="conversation-scroll">
        {visibleEntries.length === 0 ? (
          <article className="message-card assistant-card">
            <div className="message-avatar assistant-avatar">
              <Bot aria-hidden="true" size={18} />
            </div>
            <div className="message-body">
              <p className="message-title">{TEXT.emptyTitle}</p>
              <p className="message-summary">{TEXT.emptySummary}</p>
            </div>
          </article>
        ) : null}

        {visibleEntries.map((entry) => {
          const isUser = entry.kind === "user";
          const isAssistant = entry.kind === "assistant";

          return (
            <article
              className={`message-card ${isUser ? "user-card" : "assistant-card"}`}
              key={entry.id}
            >
              <div className={`message-avatar ${isUser ? "user-avatar" : "assistant-avatar"}`}>
                {isUser ? <User aria-hidden="true" size={18} /> : <Bot aria-hidden="true" size={18} />}
              </div>
              <div className="message-body">
                <p className="message-title">
                  {normalizeWorkbenchText(isUser ? TEXT.user : isAssistant ? entry.title : TEXT.system)}
                </p>
                <p className="message-summary">{normalizeWorkbenchText(entry.summary)}</p>
                {entry.detailLines?.map((line) => (
                  <p className="message-detail" key={`${entry.id}-${line}`}>
                    {normalizeWorkbenchText(line)}
                  </p>
                ))}
                {entry.actionLabel && entry.rollbackTargetId ? (
                  <button
                    className="message-inline-action"
                    type="button"
                    onClick={() => onPreviewRollback(entry.rollbackTargetId as string)}
                  >
                    {TEXT.previewRollback}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        {hasPendingTask ? (
          <article
            aria-label="assistant-pending"
            aria-live="polite"
            className="message-card assistant-card thinking-card"
          >
            <div className="message-avatar assistant-avatar thinking-avatar">
              <LoaderCircle aria-hidden="true" className="thinking-spinner" size={18} />
            </div>
            <div className="message-body">
              <div className="thinking-header">
                <p className="message-title">{TEXT.thinkingTitle}</p>
                <span className="thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              <p className="message-summary">{TEXT.thinkingSummary}</p>
              <div className="task-inline-panel">
                <span className="task-inline-status">{pendingStatusLabel}</span>
                <p className="task-inline-summary">
                  {normalizeWorkbenchText(pendingTask.summary)}
                </p>
                <p className="task-inline-hint">{TEXT.pendingLabel}</p>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
