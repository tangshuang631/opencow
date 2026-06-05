import { startTransition, useEffect, useState } from "react";
import { loadOllamaOverview } from "../features/ollama/ollamaService";
import { Workbench } from "../features/workbench/Workbench";
import { createInitialWorkbenchState, mergeOllamaOverview } from "../features/workbench/workbenchState";

export function App() {
  const [state, setState] = useState(createInitialWorkbenchState);

  useEffect(() => {
    let cancelled = false;

    async function syncOllamaState() {
      const overview = await loadOllamaOverview();

      if (cancelled) {
        return;
      }

      startTransition(() => {
        setState((current) => mergeOllamaOverview(current, overview));
      });
    }

    void syncOllamaState();

    return () => {
      cancelled = true;
    };
  }, []);

  return <Workbench state={state} />;
}
