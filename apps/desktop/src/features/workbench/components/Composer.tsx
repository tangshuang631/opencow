import { ArrowUp, Paperclip, Shield, Square } from "lucide-react";
import { useState } from "react";
import type { WorkbenchState } from "../workbenchState";
import { normalizeWorkbenchText } from "../workbenchText";

type ComposerProps = {
  state: WorkbenchState;
  onSubmitTask: (message: string) => void;
  onCancelActiveTask: () => void;
};

const TEXT = {
  permission: "\u5f53\u524d\u6743\u9650",
  rollbackPoints: "\u56de\u9000\u70b9",
  addAttachment: "\u6dfb\u52a0\u9644\u4ef6",
  inputTask: "\u8f93\u5165\u4efb\u52a1",
  inputPlaceholder: "\u8f93\u5165\u4efb\u52a1\uff0c\u9ed8\u8ba4\u4f7f\u7528\u672c\u5730 Ollama...",
  stopTask: "\u505c\u6b62\u4efb\u52a1",
  send: "\u53d1\u9001"
} as const;

export function Composer({ state, onSubmitTask, onCancelActiveTask }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const hasActiveTask = state.tasks.activeTaskId !== null;

  function submitTask() {
    const message = draft.trim();

    if (!message || hasActiveTask) {
      return;
    }

    onSubmitTask(message);
    setDraft("");
  }

  return (
    <footer className="composer-shell">
      <div className="composer-meta">
        <span>{normalizeWorkbenchText(state.model.label)}</span>
        <span>{normalizeWorkbenchText(state.model.activeModel)}</span>
        <span aria-label={TEXT.permission}>
          <Shield aria-hidden="true" size={14} />
          {normalizeWorkbenchText(state.permission.label)}
        </span>
        <span>{normalizeWorkbenchText(state.permission.summary)}</span>
        <span>{TEXT.rollbackPoints} {state.rollback.activeLimit}/{state.rollback.maxLimit}</span>
      </div>
      <div className="composer">
        <button className="icon-button" type="button" aria-label={TEXT.addAttachment}>
          <Paperclip aria-hidden="true" size={18} />
        </button>
        <textarea
          aria-label={TEXT.inputTask}
          placeholder={TEXT.inputPlaceholder}
          value={draft}
          disabled={hasActiveTask}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitTask();
            }
          }}
        />
        {hasActiveTask ? (
          <button className="send-button" type="button" aria-label={TEXT.stopTask} onClick={onCancelActiveTask}>
            <Square aria-hidden="true" size={18} />
          </button>
        ) : (
          <button className="send-button" type="button" aria-label={TEXT.send} onClick={submitTask}>
            <ArrowUp aria-hidden="true" size={18} />
          </button>
        )}
      </div>
    </footer>
  );
}
