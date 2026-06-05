import { CheckCircle2, CircleDashed } from "lucide-react";
import type { WorkbenchState } from "../workbenchState";
import { normalizeWorkbenchText } from "../workbenchText";

type MainConversationProps = {
  state: WorkbenchState;
  onPreviewRollback: (targetEntryId: string) => void;
};

const TEXT = {
  conversation: "\u4f1a\u8bdd",
  title: "\u672c\u5730\u52a9\u624b\u5de5\u4f5c\u53f0",
  ollamaStatus: "Ollama \u72b6\u6001",
  endpoint: "\u8fde\u63a5\u5730\u5740",
  currentModel: "\u5f53\u524d\u6a21\u578b",
  modelCount: "\u672c\u5730\u6a21\u578b\u6570",
  safety: "\u5b89\u5168\u63d0\u793a",
  dangerNeedsConfirm: "\u9ad8\u98ce\u9669\u64cd\u4f5c\u9700\u786e\u8ba4",
  shellGuard: "Shell \u53d7\u6743\u9650\u3001\u8d85\u65f6\u4e0e\u5de5\u4f5c\u76ee\u5f55\u9650\u5236",
  permissionPrefix: "\u5f53\u524d\u6743\u9650",
  permissionConfirm: "\u654f\u611f\u64cd\u4f5c\u9700\u5f39\u7a97\u786e\u8ba4",
  permissionNoConfirm: "\u5f53\u524d\u65e0\u9700\u989d\u5916\u786e\u8ba4",
  recentOps: "\u6700\u8fd1\u64cd\u4f5c",
  recentOpsTitle: "\u6700\u8fd1\u64cd\u4f5c\u4e0e\u53ef\u56de\u9000\u70b9",
  recentOpsHint: "\u70b9\u51fb\u6bcf\u6761\u64cd\u4f5c\u53f3\u4fa7\u6309\u94ae\uff0c\u53ef\u76f4\u63a5\u4ece\u4f1a\u8bdd\u533a\u53d1\u8d77\u56de\u9000\u9884\u89c8\u3002",
  previewFromConversation: "\u4ece\u4f1a\u8bdd\u533a",
  previewRollbackTo: "\u4ece\u4f1a\u8bdd\u533a\u9884\u89c8\u56de\u9000\u5230 "
} as const;

export function MainConversation({ state, onPreviewRollback }: MainConversationProps) {
  const modelCount = state.model.availableModels.length;
  const recentEntries = state.conversation.entries.slice(0, 4);

  return (
    <section className="conversation" aria-label={TEXT.conversation}>
      <header className="conversation-header">
        <div>
          <p className="eyebrow">opencow v1.0</p>
          <h1>{TEXT.title}</h1>
        </div>
        <div className="status-pill">
          <CircleDashed aria-hidden="true" size={16} />
          {normalizeWorkbenchText(state.model.status)}
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
              <p className="message-title">{normalizeWorkbenchText(entry.title)}</p>
              <p>{normalizeWorkbenchText(entry.summary)}</p>
              {entry.detailLines?.map((line) => (
                <p className="message-note" key={`${entry.id}-${line}`}>
                  {normalizeWorkbenchText(line)}
                </p>
              ))}
              {index === 0 ? (
                <>
                  <dl className="model-summary" aria-label={TEXT.ollamaStatus}>
                    <div>
                      <dt>{TEXT.endpoint}</dt>
                      <dd>{normalizeWorkbenchText(state.model.endpoint)}</dd>
                    </div>
                    <div>
                      <dt>{TEXT.currentModel}</dt>
                      <dd>{normalizeWorkbenchText(state.model.activeModel)}</dd>
                    </div>
                    <div>
                      <dt>{TEXT.modelCount}</dt>
                      <dd>{modelCount}</dd>
                    </div>
                  </dl>
                  <div className="safety-summary" aria-label={TEXT.safety}>
                    <p className="message-title">{TEXT.dangerNeedsConfirm}</p>
                    <p className="message-note">{TEXT.shellGuard}</p>
                    <p className="message-note">
                      {TEXT.permissionPrefix}: {normalizeWorkbenchText(state.permission.label)} ·{" "}
                      {state.permission.requiresConfirmation ? TEXT.permissionConfirm : TEXT.permissionNoConfirm}
                    </p>
                  </div>
                  {state.model.diagnostic ? (
                    <p className="message-note">{normalizeWorkbenchText(state.model.diagnostic)}</p>
                  ) : null}
                </>
              ) : null}
              {entry.actionLabel && entry.rollbackTargetId ? (
                <button
                  className="timeline-entry-action"
                  type="button"
                  onClick={() => onPreviewRollback(entry.rollbackTargetId as string)}
                >
                  {TEXT.previewFromConversation}{normalizeWorkbenchText(entry.actionLabel)}
                </button>
              ) : null}
            </div>
          </article>
        ))}

        {state.rollback.entries.length > 1 ? (
          <section className="conversation-timeline" aria-label={TEXT.recentOps}>
            <div className="conversation-timeline-header">
              <p className="message-title">{TEXT.recentOpsTitle}</p>
              <p className="message-note">{TEXT.recentOpsHint}</p>
            </div>
            {state.rollback.entries
              .filter((entry) => entry.id !== "startup-baseline")
              .slice(0, 3)
              .map((entry) => (
                <article className="timeline-entry" key={entry.id}>
                  <div className="timeline-entry-copy">
                    <p className="timeline-entry-title">{normalizeWorkbenchText(entry.label)}</p>
                    <p className="timeline-entry-summary">{normalizeWorkbenchText(entry.summary)}</p>
                  </div>
                  <button
                    className="timeline-entry-action"
                    type="button"
                    onClick={() => onPreviewRollback(entry.id)}
                  >
                    {TEXT.previewRollbackTo}{normalizeWorkbenchText(entry.label)}
                  </button>
                </article>
              ))}
          </section>
        ) : null}
      </div>
    </section>
  );
}
