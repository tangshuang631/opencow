export type OperatingSystem = "macos" | "windows" | "linux";
export type HardwareClass = "apple-silicon" | "discrete-gpu" | "integrated-gpu" | "cpu-only" | "unknown";
export type MemoryPressure = "low" | "medium" | "high" | "critical";
export type ResidencyState = "full" | "partial" | "cpu" | "unknown";
export type ProcessorPlacement = "accelerator" | "mixed" | "cpu" | "unknown";

export type TaskClass =
  | "direct-chat"
  | "one-shot-transform"
  | "retrieval-answer"
  | "typed-tool-task"
  | "advanced-agent-task";

export type OllamaRuntimeProfile = {
  endpoint: string;
  endpointClass: "loopback" | "local-ipc";
  ollamaVersion: string;
  compatibilityManifestId: string;
  operatingSystem: OperatingSystem;
  hardwareArch: string;
  hardwareClass: HardwareClass;
  physicalMemoryBytes: number;
  availableMemoryBytes: number;
  memoryPressure: MemoryPressure;
  cloudFeatures: "disabled" | "enabled" | "unknown";
  nativeApiCompatibility: {
    chat: boolean;
    streaming: boolean;
    show: boolean;
    ps: boolean;
    embed: boolean;
    cancellation: boolean;
  };
  profiledAt: string;
};

export type ModelCapabilityState = {
  state: "declared" | "probed-supported" | "probed-unsupported" | "unknown";
  evidence: string;
};

export type ModelPerformanceProfile = {
  scenario: "direct-chat" | "long-prompt" | "rag" | "structured-output" | "tool-loop" | "embedding";
  contextLength: number;
  thinkSetting: "off" | "on" | "low" | "medium" | "high" | "unsupported";
  keepAlive: string;
  prefixTokens?: number;
  sampleCount: number;
  coldTtftMs: number;
  warmTtftMs: number;
  loadDurationMs: number;
  promptTokensPerSecond: number;
  decodeTokensPerSecond: number;
  totalLatencyMs: number;
  residentModelBytes?: number;
  acceleratorResidentBytes?: number;
  acceleratorResidentRatio?: number;
  acceleratorResidency: ResidencyState;
  processorPlacement: ProcessorPlacement;
  cpuExecutionShare?: number;
  peakProcessMemoryBytes?: number;
  repeatedPrefixPromptEvalMs?: number;
  coldPrefixPromptEvalMs?: number;
  measuredAt: string;
};

export type ModelProfile = {
  modelId: string;
  modelDigest: string;
  provider: "ollama-native";
  ollamaVersion: string;
  format?: string;
  families: string[];
  architecture?: string;
  parameterCount?: number;
  parameterSizeLabel?: string;
  quantization?: string;
  maxContextWindow: number;
  allocatedContextWindow?: number;
  capabilities: {
    completion: ModelCapabilityState;
    streaming: ModelCapabilityState;
    tools: ModelCapabilityState;
    structuredOutput: ModelCapabilityState;
    thinking: ModelCapabilityState;
    vision: ModelCapabilityState;
    embedding: ModelCapabilityState;
  };
  embeddingDimensions?: number;
  executionEngine: "mlx" | "llama.cpp" | "other" | "unknown";
  executionEngineEvidence: string[];
  runtimeOptimizations: string[];
  preferredRoles: Array<"chat" | "tool" | "embedding" | "rerank">;
  performanceProfiles: ModelPerformanceProfile[];
  profileSchemaVersion: number;
  probeVersion: number;
  probedAt: string;
};

export type OllamaModelSummary = {
  name: string;
  model?: string;
  digest: string;
  size: number;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
    capabilities?: string[];
  };
};

export type OllamaTagsResponse = { models?: OllamaModelSummary[] };
export type OllamaShowResponse = {
  model?: string;
  digest?: string;
  details?: OllamaModelSummary["details"];
  capabilities?: string[];
  model_info?: Record<string, unknown>;
  modified_at?: string;
};
export type OllamaPsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
    digest?: string;
    size?: number;
    size_vram?: number;
    context_length?: number;
    expires_at?: string;
  }>;
};
export type OllamaRunningModel = NonNullable<OllamaPsResponse["models"]>[number];

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  thinking?: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
};

export type OllamaToolCall = {
  function: {
    name: string;
    arguments: unknown;
  };
};

export type OllamaToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type OllamaUsageMetrics = {
  totalDurationMs?: number;
  loadDurationMs?: number;
  promptEvalCount?: number;
  promptEvalDurationMs?: number;
  evalCount?: number;
  evalDurationMs?: number;
  promptTokensPerSecond?: number;
  decodeTokensPerSecond?: number;
  ttftMs?: number;
};

export type OllamaChatRequest = {
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaToolDefinition[];
  format?: "json" | Record<string, unknown>;
  think?: boolean | "low" | "medium" | "high";
  keepAlive?: string | number;
  options?: Record<string, unknown>;
  signal?: AbortSignal;
  onChunk?: (chunk: { thinking?: string; content?: string; toolCalls?: OllamaToolCall[] }) => void;
};

export type OllamaChatResult = {
  model: string;
  thinking: string;
  content: string;
  toolCalls: OllamaToolCall[];
  doneReason?: string;
  metrics: OllamaUsageMetrics;
};

export type OllamaEmbedRequest = {
  model: string;
  input: string[];
  keepAlive?: string | number;
  signal?: AbortSignal;
};

export type OllamaEmbedResult = {
  model?: string;
  embeddings: number[][];
  metrics: {
    totalDurationMs?: number;
    loadDurationMs?: number;
    promptEvalCount?: number;
    promptEvalDurationMs?: number;
  };
};

export type LocalityEnforcementState = {
  endpointPolicy: "loopback-only" | "local-ipc-only";
  redirectsAllowed: false;
  cloudPolicy: "disabled-confirmed" | "egress-blocked-confirmed" | "unverified";
  modelDigest: string;
  modelInstalledLocally: boolean;
  state: "enforced" | "blocked";
  evidence: string[];
};

export type ResidencyObservation = {
  source: "ollama-ps" | "runtime-metrics" | "os-metrics";
  unifiedMemory: boolean;
  modelSizeBytes?: number;
  acceleratorResidentBytes?: number;
  acceleratorResidentRatio?: number;
  processorPlacement: ProcessorPlacement;
  cpuExecutionShare?: number;
  contextLength?: number;
  observedAt: string;
};
