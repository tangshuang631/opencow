import { Workbench } from "../features/workbench/Workbench";
import { createInitialWorkbenchState } from "../features/workbench/workbenchState";

export function App() {
  const state = createInitialWorkbenchState();

  return <Workbench state={state} />;
}
