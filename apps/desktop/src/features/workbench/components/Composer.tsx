import { ArrowUp, Paperclip, Shield } from "lucide-react";
import type { WorkbenchState } from "../workbenchState";

type ComposerProps = {
  state: WorkbenchState;
};

export function Composer({ state }: ComposerProps) {
  return (
    <footer className="composer-shell">
      <div className="composer-meta">
        <span>{state.model.label}</span>
        <span aria-label="当前权限">
          <Shield aria-hidden="true" size={14} />
          {state.permission.label}
        </span>
        <span>回退点 {state.rollback.defaultLimit}/{state.rollback.maxLimit}</span>
      </div>
      <div className="composer">
        <button className="icon-button" type="button" aria-label="添加附件">
          <Paperclip aria-hidden="true" size={18} />
        </button>
        <textarea aria-label="输入任务" placeholder="输入任务，默认使用本地 Ollama..." />
        <button className="send-button" type="button" aria-label="发送">
          <ArrowUp aria-hidden="true" size={18} />
        </button>
      </div>
    </footer>
  );
}
