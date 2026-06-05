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
      </section>
      <section>
        <h2>
          <ListChecks aria-hidden="true" size={16} />
          工具
        </h2>
        <p className="muted">等待任务</p>
      </section>
      <section>
        <h2>
          <ScrollText aria-hidden="true" size={16} />
          日志
        </h2>
        <p className="muted">可追溯记录将在这里显示</p>
      </section>
    </aside>
  );
}
