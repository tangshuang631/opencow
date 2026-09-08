import type { TaskClass } from "./types.js";

/**
 * The router decides what kind of work is needed, not which side effect to
 * perform. Capabilities and grants remain the only place allowed to execute
 * effects.
 */
export type AssistantIntentKind =
  | "conversation"
  | "fresh-research"
  | "structured-fact"
  | "retrieval"
  | "transform"
  | "workspace-read"
  | "workspace-write"
  | "capability-inspect"
  | "memory"
  | "automation"
  | "unknown";

export type AssistantIntentDomain =
  | "weather"
  | "time"
  | "news"
  | "finance"
  | "knowledge"
  | "workspace"
  | "files"
  | "memory"
  | "automation"
  | "capability"
  | "general";

export type IntentSideEffect = "none" | "workspace-write" | "host-effect";

export type IntentEntities = {
  location?: string;
  files?: string[];
};

export type IntentDecision = {
  kind: AssistantIntentKind;
  domain: AssistantIntentDomain;
  confidence: number;
  requiresFreshData: boolean;
  needsLocalRetrieval: boolean;
  needsNetwork: boolean;
  sideEffect: IntentSideEffect;
  requiredCapabilities: string[];
  entities: IntentEntities;
  reasonCodes: string[];
};

export type IntentInput = {
  message: string;
  selectedFiles?: readonly string[];
  knowledgeEnabled?: boolean;
  explicitCapabilityId?: string;
  viewAction?: string;
  advancedMode?: boolean;
};

export type IntentProposal = Partial<IntentDecision> & {
  kind?: unknown;
  domain?: unknown;
  confidence?: unknown;
  requiresFreshData?: unknown;
  needsLocalRetrieval?: unknown;
  needsNetwork?: unknown;
  sideEffect?: unknown;
  requiredCapabilities?: unknown;
  entities?: unknown;
  reasonCodes?: unknown;
};

const WEATHER_PATTERN = /天气|气温|温度|降雨|下雨|降雪|台风|空气质量|湿度|紫外线|体感|\bweather\b|\bforecast\b|\btemperature\b|\brain\b/i;
const TIME_PATTERN = /几点|什么时间|现在时间|当前时间|几号|日期|\bwhat(?:'s| is)? the time\b|\bwhat time is it\b|today'?s date|\bclock\b/i;
const FINANCE_PATTERN = /股价|股票|行情|汇率|基金|黄金|比特币|\bstock\b|\bexchange rate\b|\bcrypto\b|\bfinance\b/i;
const NEWS_PATTERN = /新闻|动态|进展|发布|公告|版本|版本号|稳定版|发行|release|\bnews\b|\blatest\b|\bannouncement\b|\bupdate\b/i;
// ponytail: keep vague words such as “current/now” out of the generic freshness signal;
// they are common in workspace troubleshooting (for example “current local error”).
// Domain-specific weather/time/finance/news signals still provide freshness.
const FRESHNESS_PATTERN = /今天|今日|昨日|昨天|刚刚|实时|最新|最近|本周|本月|今年|明天|后天|\btoday\b|\byesterday\b|\breal[- ]?time\b|\btomorrow\b/i;
const EXPLICIT_NETWORK_PATTERN = /(?:上网|联网|网上|网页|网络)(?:搜索|查询)|(?:搜索|查询)(?:一下)?|\bweb search\b|\binternet search\b|\bsearch (?:the )?web\b|\bsearch online\b|\blook up online\b|\bbrowse online\b/i;
const RETRIEVAL_PATTERN = /知识库|本地资料|本地文档|文档中|资料中|根据(?:这|本|该|已有)些?资料|根据(?:这个|本)项目|项目(?:里|内|中的)(?:规则|规范|约定|实现|架构|文档)|工作区(?:里|内|中的)(?:规则|规范|文档)|引用来源|evidence|retrieval|knowledge base|\bdocs?\b|\brag\b/i;
const MEMORY_PATTERN = /记住|记忆|回忆|跨会话|上次对话|以前聊过|最近(?:会话|对话|记录|任务)|what did we discuss|remember|memory/i;
const CAPABILITY_PATTERN = /能力|capability|技能|skills?|mcp|插件|工具列表|可用工具|tool(?:ing)?/i;
const WORKSPACE_PATTERN = /工作区|项目|代码库|仓库|文件|目录|文件夹|命令|终端|shell|terminal|workspace|project|repo(?:sitory)?|file|folder|directory/i;
const WORKSPACE_READ_PATTERN = /查看|读取|列出|检查|概览|状态|结构|inspect|read|list|show|check|overview|status|structure/i;
const WORKSPACE_WRITE_PATTERN = /创建|新建|写入|修改|更新|删除|清理|运行|启动|停止|执行|安装|启用|禁用|create|write|edit|update|delete|remove|clean|run|start|stop|execute|install|enable|disable/i;
const TRANSFORM_PATTERN = /总结|摘要|改写|重写|翻译|提取|整理|格式化|归纳|summari[sz]e|rewrite|translate|extract|format|transform|convert/i;
const AUTOMATION_PATTERN = /多步|持续|循环|自动执行|自动化|规划并执行|agent loop|agent task|multi[- ]step|workflow|orchestrate|autonomous/i;

const ALLOWED_CAPABILITIES = new Set([
  "network.weather",
  "network.search",
  "system.clock",
  "knowledge.search",
  "model.transform",
  "workspace.inspect",
  "workspace.write",
  "sandbox.shell",
  "capability.inspect",
  "memory.search",
  "agent.loop"
]);

export function classifyIntent(input: IntentInput): IntentDecision {
  const message = input.message.trim();
  const files = (input.selectedFiles ?? []).map((file) => file.trim()).filter(Boolean);
  const workspaceContext = WORKSPACE_PATTERN.test(message) || files.length > 0;
  const explicitCapability = Boolean(input.explicitCapabilityId?.trim() || input.viewAction?.trim());
  const explicitNetwork = EXPLICIT_NETWORK_PATTERN.test(message);
  const weather = WEATHER_PATTERN.test(message);
  const time = TIME_PATTERN.test(message);
  const finance = FINANCE_PATTERN.test(message);
  const news = NEWS_PATTERN.test(message);
  const freshness = FRESHNESS_PATTERN.test(message);
  const retrieval = Boolean(input.knowledgeEnabled) || RETRIEVAL_PATTERN.test(message);
  const memory = MEMORY_PATTERN.test(message);
  const capability = CAPABILITY_PATTERN.test(message);
  const transform = files.length > 0 && TRANSFORM_PATTERN.test(message);
  const write = workspaceContext && WORKSPACE_WRITE_PATTERN.test(message);
  const read = workspaceContext && WORKSPACE_READ_PATTERN.test(message);
  const automation = AUTOMATION_PATTERN.test(message);

  if (!message) return unknownDecision();

  // Conflicting top-level domains should not silently pick a provider.
  const domainSignals = [weather, time, finance, news, retrieval, memory, workspaceContext && (read || write)]
    .filter(Boolean).length;
  const conflictingWithWeather = weather && (time || finance || news || retrieval || memory || Boolean(workspaceContext && (read || write)));
  if (!explicitCapability && (conflictingWithWeather || (!weather && domainSignals > 1))) {
    return unknownDecision(["ambiguous-signals"]);
  }

  if (explicitCapability) {
    return decision("capability-inspect", "capability", 0.99, {
      requiredCapabilities: ["capability.inspect"],
      reasonCodes: ["explicit-capability-or-view-action"]
    });
  }

  if (memory) {
    return decision("memory", "memory", 0.95, {
      needsLocalRetrieval: true,
      requiredCapabilities: ["memory.search"],
      reasonCodes: ["memory-reference"]
    });
  }

  if (transform) {
    return decision("transform", "files", 0.96, {
      entities: { files },
      requiredCapabilities: ["model.transform"],
      reasonCodes: ["selected-files-and-transform-verb"]
    });
  }

  if (weather) {
    return decision("structured-fact", "weather", 0.99, {
      requiresFreshData: true,
      needsNetwork: true,
      requiredCapabilities: ["network.weather"],
      entities: { location: extractLocation(message) },
      reasonCodes: ["structured-weather-fact", "fresh-provider-required"]
    });
  }

  if (time) {
    return decision("structured-fact", "time", 0.99, {
      requiresFreshData: true,
      requiredCapabilities: ["system.clock"],
      reasonCodes: ["local-clock-fact", "network-not-required"]
    });
  }

  if (workspaceContext && write) {
    return decision("workspace-write", "workspace", 0.93, {
      sideEffect: "workspace-write",
      requiredCapabilities: ["workspace.write"],
      entities: { files },
      reasonCodes: ["workspace-mutation-request", "typed-capability-required"]
    });
  }

  if (workspaceContext && read) {
    return decision("workspace-read", "workspace", 0.94, {
      requiredCapabilities: ["workspace.inspect"],
      entities: { files },
      reasonCodes: ["workspace-read-request", "typed-capability-required"]
    });
  }

  if (retrieval && !explicitNetwork) {
    return decision("retrieval", "knowledge", 0.94, {
      needsLocalRetrieval: true,
      requiredCapabilities: ["knowledge.search"],
      reasonCodes: ["local-knowledge-signal", "network-not-required"]
    });
  }

  if (automation && input.advancedMode === true) {
    return decision("automation", "automation", 0.9, {
      sideEffect: "workspace-write",
      requiredCapabilities: ["agent.loop"],
      reasonCodes: ["explicit-advanced-mode", "multi-step-loop-request"]
    });
  }

  if (explicitNetwork || finance || news || freshness) {
    return decision("fresh-research", finance ? "finance" : news ? "news" : "general", 0.93, {
      requiresFreshData: true,
      needsNetwork: true,
      needsLocalRetrieval: retrieval,
      requiredCapabilities: ["network.search", ...(retrieval ? ["knowledge.search"] : [])],
      reasonCodes: [
        explicitNetwork ? "explicit-network-request" : "freshness-signal",
        ...(retrieval ? ["local-knowledge-signal"] : [])
      ]
    });
  }

  if (automation) {
    return decision("conversation", "general", 0.72, {
      reasonCodes: ["advanced-mode-required", "safe-local-fallback"]
    });
  }

  if (capability) {
    return decision("conversation", "general", 0.7, {
      reasonCodes: ["capability-mentioned-without-action", "safe-local-fallback"]
    });
  }

  return decision("conversation", "general", 0.8, {
    reasonCodes: ["ordinary-conversation"]
  });
}

export function resolveIntentTaskClass(intent: IntentDecision, input: Pick<IntentInput, "advancedMode"> = {}): TaskClass {
  if (intent.kind === "automation" && input.advancedMode === true) return "advanced-agent-task";
  if (intent.kind === "transform") return "one-shot-transform";
  if (intent.kind === "retrieval") return "retrieval-answer";
  if (intent.kind === "workspace-read" || intent.kind === "workspace-write" || intent.kind === "capability-inspect") {
    return "typed-tool-task";
  }
  return "direct-chat";
}

export function validateIntentProposal(value: unknown): IntentDecision | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  const domain = value.domain;
  const confidence = value.confidence;
  const sideEffect = value.sideEffect;
  if (!isIntentKind(kind) || !isIntentDomain(domain) || !isSideEffect(sideEffect)) return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (!isBoolean(value.requiresFreshData) || !isBoolean(value.needsLocalRetrieval) || !isBoolean(value.needsNetwork)) return null;

  const requiredCapabilities = stringArray(value.requiredCapabilities);
  if (requiredCapabilities.some((capabilityName) => !ALLOWED_CAPABILITIES.has(capabilityName))) return null;
  if (sideEffect === "host-effect" || (sideEffect !== "none" && !["workspace-write", "automation"].includes(kind))) return null;

  const entities = isRecord(value.entities) ? {
    ...(typeof value.entities.location === "string" && value.entities.location.trim()
      ? { location: value.entities.location.trim().slice(0, 120) }
      : {}),
    ...(Array.isArray(value.entities.files)
      ? { files: value.entities.files.filter((file): file is string => typeof file === "string" && file.trim().length > 0).map((file) => file.trim().slice(0, 240)).slice(0, 32) }
      : {})
  } : {};

  return {
    kind,
    domain,
    confidence,
    requiresFreshData: value.requiresFreshData,
    needsLocalRetrieval: value.needsLocalRetrieval,
    needsNetwork: value.needsNetwork,
    sideEffect,
    requiredCapabilities,
    entities,
    reasonCodes: stringArray(value.reasonCodes).slice(0, 16)
  };
}

export function createIntentRoutingPrompt(): string {
  return [
    "Classify the user request into one intent kind and domain.",
    "Return JSON only: {kind, domain, confidence, requiresFreshData, needsLocalRetrieval, needsNetwork, sideEffect, requiredCapabilities, entities, reasonCodes}.",
    "Allowed kinds: conversation, fresh-research, structured-fact, retrieval, transform, workspace-read, workspace-write, capability-inspect, memory, automation, unknown.",
    "Never propose host-effect; arbitrary shell is not a capability. Unknown or ambiguous requests must use kind=unknown, sideEffect=none, and no executable capability."
  ].join("\n");
}

function decision(
  kind: AssistantIntentKind,
  domain: AssistantIntentDomain,
  confidence: number,
  overrides: Partial<Omit<IntentDecision, "kind" | "domain" | "confidence">> = {}
): IntentDecision {
  return {
    kind,
    domain,
    confidence,
    requiresFreshData: false,
    needsLocalRetrieval: false,
    needsNetwork: false,
    sideEffect: "none",
    requiredCapabilities: [],
    entities: {},
    reasonCodes: [],
    ...overrides
  };
}

function unknownDecision(reasonCodes: string[] = []): IntentDecision {
  return decision("unknown", "general", 0.25, {
    reasonCodes: [...reasonCodes, "safe-local-fallback"],
    sideEffect: "none"
  });
}

function extractLocation(query: string): string | undefined {
  const withoutDateWords = query
    .replace(/今天|今日|明天|后天|昨日|昨天|现在|当前|实时/g, " ")
    .replace(/我想知道|请问|帮我(?:查|看)(?:一下)?|查询|查一下/g, " ")
    .trim();
  const weatherIndex = withoutDateWords.search(/天气|气温|温度|降雨|下雨|空气质量|湿度/);
  if (weatherIndex >= 0) {
    const candidate = withoutDateWords.slice(0, weatherIndex)
      .match(/[\u4e00-\u9fff]{2,12}/g)?.at(-1)
      ?.replace(/[会要想知道查询查帮在的本地]+$/g, "")
      .trim();
    if (candidate) return candidate;
  }

  const englishMatch = query.match(/(?:weather|forecast|temperature|rain)\s+(?:in|for|at)\s+([A-Za-z][A-Za-z .'-]{1,48}?)(?:\s+(?:today|tomorrow|now|tonight))?(?:[?.!,;:]|$)/i);
  return englishMatch?.[1]?.trim().replace(/[?.!,;:]+$/, "") || undefined;
}

function isIntentKind(value: unknown): value is AssistantIntentKind {
  return ["conversation", "fresh-research", "structured-fact", "retrieval", "transform", "workspace-read", "workspace-write", "capability-inspect", "memory", "automation", "unknown"].includes(value as AssistantIntentKind);
}

function isIntentDomain(value: unknown): value is AssistantIntentDomain {
  return ["weather", "time", "news", "finance", "knowledge", "workspace", "files", "memory", "automation", "capability", "general"].includes(value as AssistantIntentDomain);
}

function isSideEffect(value: unknown): value is IntentSideEffect {
  return value === "none" || value === "workspace-write" || value === "host-effect";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
