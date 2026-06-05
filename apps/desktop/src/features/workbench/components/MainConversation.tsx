import { CheckCircle2, CircleDashed } from "lucide-react";
import type { WorkbenchState } from "../workbenchState";

type MainConversationProps = {
  state: WorkbenchState;
  onPreviewRollback: (targetEntryId: string) => void;
};

export function MainConversation({ state, onPreviewRollback }: MainConversationProps) {
  const modelCount = state.model.availableModels.length;
  const recentEntries = state.conversation.entries.slice(0, 4);

  return (
    <section className="conversation" aria-label="会话">
      <header className="conversation-header">
        <div>
          <p className="eyebrow">opencow v1.0</p>
          <h1>本地助手工作台</h1>
        </div>
        <div className="status-pill">
          <CircleDashed aria-hidden="true" size={16} />
          {state.model.status}
        </div>
      </header>

      <div className="conversation-body">
        {recentEntries.map((entry, index) => (
          <article
            className={entry.kind === "system" ? "timeline-message" : "assistant-message"}
            key={entry.id}
          >
            <div className={entry.kind === "system" ? "timeline-message-icon" : "message-icon"}>
              <CheckCircle2 aria-hidden="true" size={18} />
            </div>
            <div className="message-content">
              <p className="message-title">{entry.title}</p>
              <p>{entry.summary}</p>
              {entry.detailLines?.map((line) => (
                <p className="message-note" key={`${entry.id}-${line}`}>
                  {line}
                </p>
              ))}
              {index === 0 ? (
                <>
                  <dl className="model-summary" aria-label="Ollama 状态">
                    <div>
                      <dt>连接地址</dt>
                      <dd>{state.model.endpoint}</dd>
                    </div>
                    <div>
                      <dt>当前模型</dt>
                      <dd>{state.model.activeModel}</dd>
                    </div>
                    <div>
                      <dt>本地模型数</dt>
                      <dd>{modelCount}</dd>
                    </div>
                  </dl>
                  <div className="safety-summary" aria-label="安全提示">
                    <p className="message-title">高风险操作需确认</p>
                    <p className="message-note">Shell 受权限、超时与工作目录限制</p>
                    <p className="message-note">
                      当前权限: {state.permission.label} · {state.permission.requiresConfirmation ? "敏感操作需弹窗确认" : "当前无需额外确认"}
                    </p>
                  </div>
                  {state.model.diagnostic ? <p className="message-note">{state.model.diagnostic}</p> : null}
                </>
              ) : null}
              {entry.actionLabel && entry.rollbackTargetId ? (
                <button
                  className="timeline-entry-action"
                  type="button"
                  onClick={() => onPreviewRollback(entry.rollbackTargetId!)}
                >
                  从会话区{entry.actionLabel}
                </button>
              ) : null}
            </div>
          </article>
        ))}

        {state.rollback.entries.length > 1 ? (
          <section className="conversation-timeline" aria-label="最近操作">
            <div className="conversation-timeline-header">
              <p className="message-title">最近操作与可回退点</p>
              <p className="message-note">点击每条操作右侧按钮，可直接从会话区发起回退预览。</p>
            </div>
            {state.rollback.entries
              .filter((entry) => entry.id !== "startup-baseline")
              .slice(0, 3)
              .map((entry) => (
              <article className="timeline-entry" key={entry.id}>
                <div className="timeline-entry-copy">
                  <p className="timeline-entry-title">{entry.label}</p>
                  <p className="timeline-entry-summary">{entry.summary}</p>
                </div>
                <button
                  className="timeline-entry-action"
                  type="button"
                  onClick={() => onPreviewRollback(entry.id)}
                >
                  从会话区预览回退到 {entry.label}
                </button>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </section>
  );
}
