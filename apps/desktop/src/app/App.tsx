import { startTransition, useEffect, useState } from "react";
import { loadOllamaOverview } from "../features/ollama/ollamaService";
import { Workbench } from "../features/workbench/Workbench";
import {
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  mergeOllamaOverview
} from "../features/workbench/workbenchState";

export function App() {
  const [state, setState] = useState(createInitialWorkbenchState);

  useEffect(() => {
    let cancelled = false;

    async function syncOllamaState() {
      try {
        const overview = await loadOllamaOverview();

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setState((current) => mergeOllamaOverview(current, overview));
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const detail = error instanceof Error ? error.message : "Unknown ollama load error";

        startTransition(() => {
          setState((current) => createOllamaLoadErrorState(current, detail));
        });
      }
    }

    void syncOllamaState();

    return () => {
      cancelled = true;
    };
  }, []);

  return <Workbench state={state} />;
}
