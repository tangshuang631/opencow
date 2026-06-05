import type { WorkbenchState } from "./workbenchState";
import { Composer } from "./components/Composer";
import { Inspector } from "./components/Inspector";
import { MainConversation } from "./components/MainConversation";
import { Sidebar } from "./components/Sidebar";

type WorkbenchProps = {
  state: WorkbenchState;
};

export function Workbench({ state }: WorkbenchProps) {
  return (
    <main className="workbench" aria-label="opencow 工作台">
      <Sidebar />
      <section className="workbench-main">
        <MainConversation state={state} />
        <Composer state={state} />
      </section>
      <Inspector state={state} />
    </main>
  );
}
