import { classifyIntent, type IntentDecision } from "@opencow/cowcore";

/** Compatibility view; the actual route is owned by CowCore. */
export type SearchIntentKind = "weather" | "news" | "finance" | "general";

export type SearchIntent = {
  kind: SearchIntentKind;
  location: string | null;
  requiresFreshness: boolean;
};

export function classifySearchIntent(query: string): SearchIntent {
  const decision = classifyIntent({ message: query });
  const kind: SearchIntentKind = decision.domain === "weather"
    ? "weather"
    : decision.domain === "finance"
      ? "finance"
      : decision.domain === "news"
        ? "news"
        : "general";

  return {
    kind,
    location: kind === "weather" ? decision.entities.location ?? null : null,
    requiresFreshness: decision.requiresFreshData
  };
}

export function isFreshnessSearchIntent(intent: SearchIntent): boolean {
  return intent.requiresFreshness;
}

export function classifyAssistantIntent(query: string): IntentDecision {
  return classifyIntent({ message: query });
}
