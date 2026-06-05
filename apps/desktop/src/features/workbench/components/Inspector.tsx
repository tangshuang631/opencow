import { FileText, Globe2, ListChecks, ScrollText } from "lucide-react";
import type { WorkbenchState } from "../workbenchState";

type InspectorProps = {
  state: WorkbenchState;
};

export function Inspector({ state }: InspectorProps) {
  return (
    <aside className="inspector" aria-label="右侧面板">
      <section>
        <h2>
          <FileText aria-hidden="true" size={16} />
          输出
        </h2>
        <p className="muted">暂无产物</p>
      </section>
      <section>
        <h2>
          <Globe2 aria-hidden="true" size={16} />
          来源
        </h2>
        <p className="muted">{state.search.enabled ? "联网搜索已开启" : "联网搜索默认关闭"}</p>
        <p className="muted">Ollama: {state.model.status}</p>
      </section>
      <section>
        <h2>
          <ListChecks aria-hidden="true" size={16} />
          工具
        </h2>
        <p className="muted">
          {state.model.availableModels.length > 0
            ? `已检测 ${state.model.availableModels.length} 个本地模型`
            : "等待本地模型"}
        </p>
      </section>
      <section>
        <h2>
          <ScrollText aria-hidden="true" size={16} />
          日志
        </h2>
        <p className="muted">{state.audit.summary}</p>
        <p className="muted">模块: {state.audit.lastEvent.module}</p>
        <p className="muted">来源: {state.audit.lastEvent.source}</p>
        <p className="muted">时间: {state.audit.lastEvent.timestamp}</p>
        <p className="muted">{state.audit.lastEvent.detail}</p>
      </section>
      <section>
        <h2>错误</h2>
        {state.error ? (
          <>
            <p className="muted">{state.error.summary}</p>
            <p className="muted">模块: {state.error.module}</p>
            <p className="muted">来源: {state.error.source}</p>
            <p className="muted">时间: {state.error.timestamp}</p>
            <p className="muted">{state.error.detail}</p>
            <p className="muted">建议: {state.error.actionLabel}</p>
          </>
        ) : (
          <p className="muted">当前没有活动错误</p>
        )}
      </section>
      <section>
        <h2>高级设置</h2>
        <p className="muted">远程 API 默认关闭</p>
        <p className="muted">
          {state.settings.remoteApi.collapsed
            ? "保留 baseUrl 和 API 接入入口，按需展开。"
            : "远程 API 设置已展开。"}
        </p>
      </section>
      <section>
        <h2>回退记录</h2>
        {state.rollback.entries.map((entry) => (
          <div key={entry.id}>
            <p className="muted">{entry.label}</p>
            <p className="muted">{entry.summary}</p>
          </div>
        ))}
      </section>
    </aside>
  );
}
