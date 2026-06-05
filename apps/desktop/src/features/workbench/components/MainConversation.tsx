import { CheckCircle2, CircleDashed } from "lucide-react";
import type { WorkbenchState } from "../workbenchState";

type MainConversationProps = {
  state: WorkbenchState;
};

export function MainConversation({ state }: MainConversationProps) {
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
        <article className="assistant-message">
          <div className="message-icon">
            <CheckCircle2 aria-hidden="true" size={18} />
          </div>
          <div className="message-content">
            <p className="message-title">Ollama 本地优先</p>
            <p>
              当前界面先接入本地模型、权限状态、回退点和右侧结果面板。OpenClaw
              源码放入 vendor 后，将通过 adapter 接入后端能力。
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
