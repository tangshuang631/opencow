import { classifyIntent, resolveIntentTaskClass } from "./intentRouter.js";
import type { TaskClass } from "./types.js";

export function routeTask(input: {
  message: string;
  selectedFiles?: string[];
  knowledgeEnabled?: boolean;
  explicitCapabilityId?: string;
  viewAction?: string;
  advancedMode?: boolean;
}): TaskClass {
  const intent = classifyIntent(input);
  return resolveIntentTaskClass(intent, input);
}
