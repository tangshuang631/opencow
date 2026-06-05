import { ArrowUp, Paperclip, Shield, Square } from "lucide-react";
import { useState } from "react";
import type { WorkbenchState } from "../workbenchState";

type ComposerProps = {
  state: WorkbenchState;
  onSubmitTask: (message: string) => void;
  onCancelActiveTask: () => void;
};

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
        <span>{state.model.label}</span>
        <span>{state.model.activeModel}</span>
        <span aria-label="当前权限">
          <Shield aria-hidden="true" size={14} />
          {state.permission.label}
        </span>
        <span>{state.permission.summary}</span>
        <span>
          回退点 {state.rollback.activeLimit}/{state.rollback.maxLimit}
        </span>
      </div>
      <div className="composer">
        <button className="icon-button" type="button" aria-label="添加附件">
          <Paperclip aria-hidden="true" size={18} />
        </button>
        <textarea
          aria-label="输入任务"
          placeholder="输入任务，默认使用本地 Ollama..."
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
          <button className="send-button" type="button" aria-label="停止任务" onClick={onCancelActiveTask}>
            <Square aria-hidden="true" size={18} />
          </button>
        ) : (
          <button className="send-button" type="button" aria-label="发送" onClick={submitTask}>
            <ArrowUp aria-hidden="true" size={18} />
          </button>
        )}
      </div>
    </footer>
  );
}
