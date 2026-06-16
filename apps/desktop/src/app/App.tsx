import { startTransition, useEffect, useRef, useState } from "react";
import { executeAssistantTask, planAssistantTask } from "../features/assistant/assistantTaskService";
import {
  createLocalModelFailureDiagnostics,
  createLocalModelLengthRecoveryHint,
  createLocalModelTimeoutRecoveryHint
} from "../features/assistant/localRecoveryStrategy";
import { cancelOllamaChat, chatWithOllamaModel, loadOllamaOverview } from "../features/ollama/ollamaService";
import type { OllamaOverview } from "../features/ollama/ollamaService";
import { resolveOpencowSelfRepairTargetDescriptor } from "@opencow/openclaw-adapter/browser";
import { Workbench } from "../features/workbench/Workbench";
import { getShellDialogRecoveryNarrative } from "../features/workbench/shellCapability";
import { writeNpcConfig } from "../features/assistant/localAssistantService";
import {
  applyPendingRollbackState,
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingConfirmationState,
  cancelPendingRollbackState,
  cancelPermissionModeChangeState,
  createAssistantPlanningFailedState,
  createCapabilityToggleRequestState,
  createCommandPolicyBlockedState,
  createDuplicatePlanningFailureSkippedState,
  createDuplicatePendingApprovalSkippedState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createNewConversationState,
  createModelSelectedState,
  createOllamaLoadErrorState,
  createRemoteApiConfigState,
  createRemoteApiToggleState,
  createRollbackLimitUpdatedState,
  createSearchProviderConfigState,
  createSearchToggleState,
  createStaleActiveTaskSlotRecoveredState,
  createStorageCleanupState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskMissingExecutionKindFailedState,
  createTaskExecutionProgressState,
  createTaskExecutionRetriedState,
  createTaskExecutionStartedState,
  createTaskExecutionStreamingChunkState,
  createTaskExecutionSucceededState,
  createToolExecutionRecoveredState,
  createUserTaskSubmittedState,
  mergeOllamaOverview,
  requestPermissionModeChangeState,
  requestRollbackPreviewState
} from "../features/workbench/workbenchState";
import {
  clearPersistedWorkbenchState,
  loadPersistedWorkbenchStateFromBrowserStorage,
  readPersistedWorkbenchState,
  persistWorkbenchState
} from "../features/workbench/workbenchState.persistence";
import type { PermissionMode, WorkbenchState } from "../features/workbench/workbenchState";
import type { AssistantTaskExecutionResult, AssistantTaskPlanResult } from "../features/assistant/assistantTaskService";
import { getNpcConfigReadonlyDraftRetryMessage } from "./npcTimeoutRecovery";

const CONTINUATION_PREVIEW_KINDS = new Set([
  "opencow-self-repair-preview",
  "rag-local-shell-handoff-preview",
  "skills-local-enabled-rag-shell-handoff-preview",
  "npc-local-enabled-rag-shell-handoff-preview"
]);
const CONTINUATION_CANCELLED_SOURCES = new Set([
  "permission_confirmation_cancelled",
  "permission_mode_change_cancelled",
  "capability_toggle_cancelled",
  "permission_escalation_loop_guard",
  "dangerous_confirmation_loop_guard",
  "controlled_full_confirmation_required_guard"
]);
const MAX_LOCAL_TASK_ATTEMPTS = 3;
const LOCAL_TASK_TIMEOUT_MS = 45_000;
const LOCAL_MODEL_CHAT_TIMEOUT_MS = 480_000;
const LONG_LOCAL_MODEL_CHAT_TIMEOUT_MS = 480_000;
const READONLY_EXPLANATION_TIMEOUT_MS = 10_000;
const LOCAL_MODEL_LENGTH_LIMIT_RECOVERY_HINT = createLocalModelLengthRecoveryHint();
const LOCAL_MODEL_CONTINUATION_TAIL_LIMIT = 1200;
const LOCAL_MODEL_PROGRESS_INTERVAL_MS = 15_000;
const MAX_CHAT_SEARCH_CONTEXT_ITEMS = 3;
const MAX_CHAT_SEARCH_FIELD_LENGTH = 240;
const PREFERRED_DEFAULT_CHAT_MODELS = ["gemma:26b", "gemma4:26b"];
const TAURI_INTERNALS_KEY = "__TAURI_INTERNALS__";
const PERMISSION_MODE_RANK: Record<PermissionMode, number> = {
  readonly: 0,
  "workspace-write": 1,
  "controlled-full": 2
};
const SUPPORTED_ASSISTANT_PLAN_KINDS = new Set<string>([
  "local-model-chat",
  "workspace-overview",
  "packages-overview",
  "workspace-config-overview",
  "opencow-self-repair-preview",
  "opencow-self-repair-target-guidance",
  "opencow-self-repair-enabled-skills-registry",
  "opencow-self-repair-workspace-project-runtime-registry",
  "capability-rag-overview",
  "capability-skills-overview",
  "skills-local-scan",
  "skills-local-inspect",
  "skills-local-install",
  "skills-local-enable",
  "skills-local-disable",
  "skills-local-enabled-list",
  "skills-local-enabled-match",
  "skills-local-enabled-shell-create-temp-output",
  "skills-local-enabled-shell-remove-temp-output",
  "npc-local-enabled-shell-create-temp-output",
  "npc-local-enabled-shell-remove-temp-output",
  "npc-local-enabled-rag-shell-create-temp-output",
  "npc-local-enabled-rag-shell-remove-temp-output",
  "skills-local-enabled-rag-doc-search",
  "rag-local-shell-handoff-preview",
  "skills-local-enabled-rag-shell-handoff-preview",
  "npc-local-enabled-rag-shell-handoff-preview",
  "rag-local-shell-create-temp-output",
  "rag-local-shell-remove-temp-output",
  "skills-local-enabled-rag-shell-create-temp-output",
  "skills-local-enabled-rag-shell-remove-temp-output",
  "npc-local-collaboration-preview",
  "npc-local-project-showcase-preview",
  "npc-local-project-run",
  "npc-local-project-screenshot-capture",
  "npc-local-project-showcase-site-write",
  "npc-local-project-showcase-publish-preview",
  "npc-local-project-showcase-git-confirmation-preview",
  "npc-local-shell-plan-preview",
  "npc-config-write",
  "capability-npc-overview",
  "capability-mcp-overview",
  "mcp-local-plugin-scan",
  "mcp-local-plugin-inspect",
  "mcp-local-plugin-start-preview",
  "mcp-local-plugin-start",
  "rag-local-doc-search",
  "network-search-guidance",
  "readonly-shell-git-status",
  "readonly-shell-workspace-root",
  "readonly-shell-packages-dir",
  "workspace-write-create-temp-output",
  "workspace-project-run",
  "workspace-project-status",
  "workspace-project-stop",
  "controlled-full-remove-temp-output",
  "permission-request",
  "confirmation"
]);

function isRepeatedApprovedPermissionRequest(requestedMode: PermissionMode, approvedMode: PermissionMode): boolean {
  return PERMISSION_MODE_RANK[requestedMode] <= PERMISSION_MODE_RANK[approvedMode];
}

function inferPermissionModeForExecutionKind(executionKind: string | undefined): PermissionMode {
  if (!executionKind) {
    return "readonly";
  }

  if (executionKind.includes("controlled-full")) {
    return "controlled-full";
  }

  if (executionKind.includes("remove-temp-output")) {
    return "controlled-full";
  }

  if (
    executionKind.includes("workspace-write")
    || executionKind.includes("site-write")
    || executionKind.includes("install")
    || executionKind.includes("enable")
    || executionKind.includes("disable")
    || executionKind.includes("repair")
    || executionKind.includes("project-run")
    || executionKind.includes("project-stop")
    || executionKind.includes("screenshot-capture")
  ) {
    return "workspace-write";
  }

  return "readonly";
}

function isExecutionKindAllowedForPermission(
  executionKind: string | undefined,
  approvedMode: PermissionMode
): boolean {
  return PERMISSION_MODE_RANK[inferPermissionModeForExecutionKind(executionKind)] <= PERMISSION_MODE_RANK[approvedMode];
}

function isRepeatedApprovedDangerousConfirmation(
  pending: NonNullable<WorkbenchState["confirmation"]["pending"]>,
  next: Extract<AssistantTaskPlanResult, { kind: "confirmation" }>
): boolean {
  return pending.title === next.title
    && pending.summary === next.summary
    && pending.commandPreview === next.commandPreview
    && pending.impact === next.impact
    && pending.requiredMode === next.requiredMode
    && pending.safetySummary === next.safetySummary
    && pending.queuedMessage === next.queuedMessage;
}

function isOpencowSelfRepairExecutionKind(kind: string | undefined): boolean {
  return typeof kind === "string" && kind.startsWith("opencow-self-repair-");
}

function createOpencowSelfRepairFailureActionLabel(
  executionKind: string | undefined,
  auditDetail: string | undefined
): string {
  const descriptor = resolveOpencowSelfRepairTargetDescriptor(auditDetail ?? "");

  if (
    (executionKind === "opencow-self-repair-preview"
      || executionKind === "opencow-self-repair-enabled-skills-registry"
      || executionKind === "opencow-self-repair-workspace-project-runtime-registry")
    && descriptor.path
    && descriptor.continueRequest
  ) {
    return `Automatic self-repair was stopped to avoid retry loops. Check ${descriptor.path} first. If you want opencow to try again after you review it, say: ${descriptor.continueRequest}.`;
  }

  if (executionKind === "opencow-self-repair-preview") {
    return (
      "Automatic self-repair was stopped to avoid retry loops. No specific repair target was confirmed yet. " +
      "Choose a narrower next target and ask opencow to continue with either the enabled skills registry " +
      "or the workspace project runtime registry. Example next requests: " +
      "`diagnose opencow and continue repairing its enabled skills registry` or " +
      "`diagnose opencow and continue repairing its workspace project runtime registry`."
    );
  }

  return "Automatic self-repair was stopped to avoid retry loops. Review the failure detail and help opencow by fixing the target file, narrowing the request, or granting the next required permission only if it matches your intent.";
}

function createLocalTaskFailureActionLabel(detail: string, executionKind: string | undefined): string {
  if (executionKind === "npc-config-write") {
    return createNpcConfigWriteFailureActionLabel(detail);
  }

  if (executionKind === "local-model-chat") {
    return createLocalModelChatFailureActionLabel(detail);
  }

  const shellNextStep = detail.match(/Next(?: repair)? step:\s*(.+?)(?:\s*$)/i)?.[1]?.trim();

  if (shellNextStep) {
    return shellNextStep;
  }

  const shellRecoveryStep = createShellFailureRecoveryStep(detail, executionKind);

  if (shellRecoveryStep) {
    return shellRecoveryStep;
  }

  return `inspect assistantTaskService result mapping for ${executionKind ?? "unknown-task"} before retrying.`;
}

function createNpcConfigWriteFailureActionLabel(detail: string): string {
  const normalizedDetail = detail.toLowerCase();

  if (normalizedDetail.includes("streamphase=waiting-first-chunk")) {
    return "NPC 配置生成卡在首轮输出前：配置尚未写入。请先把 NPC 职责缩小成一两句话，或改问“先给我课程助手 NPC 的只读草案”，确认方向后再保存；也可以切换更快的本地模型后重试。";
  }

  if (normalizedDetail.includes("streamphase=streaming")) {
    return "NPC 配置生成中途超时：配置尚未写入。请先要求本地模型分阶段生成更短的 NPC JSON，确认角色、能力和权限边界后再保存。";
  }

  if (normalizedDetail.includes("maximum execution time") || normalizedDetail.includes("timed out")) {
    return "本地模型生成 NPC 配置超时：请先缩短这次 NPC 需求描述，或改成只读草案确认方向后再保存；如果经常卡在首轮输出前，请优先检查 Ollama 是否仍在稳定返回首块内容。";
  }

  if (
    normalizedDetail.includes("connection refused")
    || normalizedDetail.includes("actively refused")
    || normalizedDetail.includes("fetch failed")
    || normalizedDetail.includes("error sending request")
  ) {
    return "无法连接本地 Ollama，NPC 配置还没有生成：请确认 Ollama 已启动且 http://127.0.0.1:11434 可访问，然后重试。";
  }

  if (
    normalizedDetail.includes("context length")
    || normalizedDetail.includes("context window")
    || normalizedDetail.includes("prompt too long")
    || normalizedDetail.includes("input too long")
  ) {
    return "NPC 配置需求过长：请先缩小角色说明、工具权限或工作流范围，再让本地模型重新生成。";
  }

  if (normalizedDetail.includes("no usable local ollama model") || normalizedDetail.includes("未选择模型")) {
    return "当前没有可用的本地模型来生成 NPC 配置：请先拉取或选择一个 Ollama 模型，然后重试。";
  }

  return "NPC 配置生成没有完成：请先检查 Ollama 是否稳定运行，再补充更聚焦的角色说明后重试。";
}

function createShellFailureRecoveryStep(detail: string, executionKind: string | undefined): string | null {
  const normalizedRoute = `${executionKind ?? ""}\n${detail}`.toLowerCase();
  const shellRecoveryNarrative = getShellDialogRecoveryNarrative();

  if (normalizedRoute.includes("readonly-shell") || normalizedRoute.includes("required permission: readonly")) {
    return [
      "verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying.",
      shellRecoveryNarrative
    ].join("\n");
  }

  if (
    normalizedRoute.includes("workspace-write")
    || normalizedRoute.includes("workspace_write")
    || normalizedRoute.includes("required permission: workspace-write")
  ) {
    return [
      "verify the permission approval, workspace root, command whitelist, and audit trail before retrying.",
      shellRecoveryNarrative
    ].join("\n");
  }

  if (
    normalizedRoute.includes("controlled-full")
    || normalizedRoute.includes("controlled_full")
    || normalizedRoute.includes("required permission: controlled-full")
  ) {
    return [
      "verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying.",
      shellRecoveryNarrative
    ].join("\n");
  }

  return null;
}

function getShellSelfCheckRetryMessage(task: WorkbenchState["tasks"]["items"][number] | undefined): string | null {
  const recoveryHint = task?.lastFailureActionLabel?.trim();

  if (!recoveryHint || !task?.lastFailureDetail) {
    return null;
  }

  if (
    !/\bshell\b/i.test(task.executionKind ?? "")
    && !/\bshell execution (?:failed|blocked)/i.test(task.lastFailureDetail)
  ) {
    return null;
  }

  const shouldRunReadonlyShellSelfCheck =
    /^verify .+ before retrying\.?$/i.test(recoveryHint)
    || /\brun a readonly preview before retrying destructive execution\b/i.test(recoveryHint);

  return shouldRunReadonlyShellSelfCheck
    ? recoveryHint.endsWith(".")
      ? recoveryHint
      : `${recoveryHint}.`
    : null;
}

function getRagSelfCheckRetryMessage(task: WorkbenchState["tasks"]["items"][number] | undefined): string | null {
  if (!task?.lastFailureDetail) {
    return null;
  }

  const normalizedRoute = `${task.executionKind ?? ""}\n${task.lastFailureDetail}`.toLowerCase();
  const isLocalRagExecutionKind =
    task.executionKind === "rag-local-doc-search"
    || task.executionKind === "skills-local-enabled-rag-doc-search";

  if (
    !isLocalRagExecutionKind
    && !normalizedRoute.includes("local rag search failed in assistanttaskservice")
    && !normalizedRoute.includes("skill-assisted local rag search failed in assistanttaskservice")
    && !normalizedRoute.includes("local knowledge index")
    && !normalizedRoute.includes("document parsers for pptx/docx/md")
  ) {
    return null;
  }

  return (
    "inspect local OpenClaw RAG capability wiring, local knowledge index availability, " +
    "document parsers for pptx/docx/md, workspace root discovery, and audit trail before retrying."
  );
}

function isLocalModelContextOverflowFailure(
  task: WorkbenchState["tasks"]["items"][number] | undefined
): task is WorkbenchState["tasks"]["items"][number] {
  if (task?.executionKind !== "local-model-chat" || !task.lastFailureDetail) {
    return false;
  }

  const normalizedDetail = task.lastFailureDetail.toLowerCase();

  return normalizedDetail.includes("context length")
    || normalizedDetail.includes("context window")
    || normalizedDetail.includes("prompt too long")
    || normalizedDetail.includes("input too long");
}

function createLocalModelContextOverflowRagRetryState(
  state: WorkbenchState,
  failedTask: WorkbenchState["tasks"]["items"][number]
): WorkbenchState {
  const retryMessage = [
    "用本地 RAG/摘要分段处理这条过长输入。",
    failedTask.summary
  ].join(" ");

  return createUserTaskSubmittedState(state, {
    message: retryMessage,
    executionKind: "rag-local-doc-search",
    executionTitle: "Local RAG document search",
    executionAuditSummary: "Local assistant routed a context-length local model retry into readonly local RAG.",
    executionAuditDetail: [
      "Readonly local RAG retry after local model context-length failure.",
      `Original task: ${failedTask.summary}`,
      failedTask.lastFailureDetail ? `Previous failure: ${failedTask.lastFailureDetail}` : null
    ].filter((line): line is string => line !== null).join(" ")
  });
}

function createNpcReadonlyDraftRecoveryState(
  state: WorkbenchState,
  taskId: string | undefined,
  npcReadonlyDraftRetryMessage: string
): WorkbenchState {
  const failedTask = state.tasks.items.find((item) =>
    taskId ? item.id === taskId && item.status === "failed" : item.status === "failed"
  );
  const assistantPlan = assertValidAssistantTaskPlanResult(
    planAssistantTask(npcReadonlyDraftRetryMessage, "readonly")
  );

  if (assistantPlan.kind !== "npc-local-collaboration-preview") {
    return createAssistantPlanningFailedState(state, {
      message: npcReadonlyDraftRetryMessage,
      detail:
        `NPC timeout recovery must return npc-local-collaboration-preview. Planner returned ${assistantPlan.kind}, so the failed NPC request was not retried as a write.`,
      actionLabel: "请先修复 NPC 只读草案恢复路由，再重试生成或保存配置。",
      source: "local_task_retry_npc_config_recovery_planner"
    });
  }

  return createUserTaskSubmittedState(state, {
    message: npcReadonlyDraftRetryMessage,
    executionKind: assistantPlan.kind,
    executionTitle: assistantPlan.title,
    executionAuditSummary: assistantPlan.auditSummary,
    executionAuditDetail: [
      assistantPlan.auditDetail,
      "Recovered from an NPC local-model timeout by switching to a readonly NPC draft preview before any config write retry.",
      failedTask?.lastFailureDetail ? `Previous failure: ${failedTask.lastFailureDetail}` : null
    ].filter((line): line is string => line !== null).join(" ")
  });
}

function isReadonlyShellDiagnosticPlan(plan: AssistantTaskPlanResult): boolean {
  return plan.kind.startsWith("readonly-shell-");
}

function isReadonlyRagSelfCheckPlan(plan: AssistantTaskPlanResult): boolean {
  return plan.kind === "capability-rag-overview";
}

function shouldSkipReadonlyExplanationForRecoveryTask(task: WorkbenchState["tasks"]["items"][number]): boolean {
  return task.executionKind === "rag-local-doc-search"
    && Boolean(
      task.executionAuditSummary?.includes("context-length local model retry")
      || task.executionAuditDetail?.includes("context-length failure")
    );
}

function getTaskExecutionMessage(task: WorkbenchState["tasks"]["items"][number]): string {
  return task.executionMessage?.trim() || task.summary;
}

function createLocalModelChatFailureActionLabel(detail: string): string {
  const normalizedDetail = detail.toLowerCase();

  if (
    normalizedDetail.includes("connection refused")
    || normalizedDetail.includes("actively refused")
    || normalizedDetail.includes("fetch failed")
    || normalizedDetail.includes("error sending request")
  ) {
    return "无法连接本地 Ollama 服务：请启动 Ollama，确认 http://127.0.0.1:11434 可访问，然后点击重新检测 Ollama 或重试本地任务。";
  }

  if (normalizedDetail.includes("empty assistant message") || normalizedDetail.includes("empty")) {
    return "Ollama 返回了空内容：请确认当前模型已完整拉取且可正常生成；如果连续出现，请切换模型或重启 Ollama 后重试。";
  }

  if (
    normalizedDetail.includes("context length")
    || normalizedDetail.includes("context window")
    || normalizedDetail.includes("prompt too long")
    || normalizedDetail.includes("input too long")
  ) {
    return "输入或上下文过长：请缩小单次输入范围、拆成长文档分段处理，或先让 OpenCow 用 RAG/摘要方式提取关键内容后再继续。";
  }

  if (normalizedDetail.includes("no usable local ollama model") || normalizedDetail.includes("未选择模型")) {
    return "当前没有可用的本地 Ollama 模型：请拉取或选择一个模型，然后重新检测 Ollama 后重试。";
  }

  if (normalizedDetail.includes("streamphase=waiting-first-chunk")) {
    if (normalizedDetail.includes("maximum execution time") || normalizedDetail.includes("timed out")) {
      return "本地模型响应超时（首轮输出超时）：模型连接可用但没有吐出第一段内容；长回答保护已启用，OpenCow 会优先使用自动分段、缺题补写和显式重试。请先缩短本轮问题、切换更快模型，或让 OpenCow 分段处理；重试前会重新检测 Ollama，避免卡在同一个失效请求上。";
    }

    return "本地模型首轮输出超时：模型连接可用但没有吐出第一段内容。请先缩短本轮问题、切换更快模型，或让 OpenCow 分段处理；重试前会重新检测 Ollama，避免卡在同一个失效请求上。";
  }

  if (normalizedDetail.includes("streamphase=streaming")) {
    return "本地模型生成中途超时：模型已经开始输出但没有完整结束。请让它分段继续、减少单次输出范围，或切换更快模型后重试。";
  }

  if (normalizedDetail.includes("maximum execution time") || normalizedDetail.includes("timed out")) {
    return "本地模型响应超时：长回答保护已启用，OpenCow 会优先使用自动分段、缺题补写和显式重试；如果模型仍超时，请确认 Ollama 进程仍在运行，切换更快模型，或减少单次输入长度后重试。";
  }

  return "请检查 Ollama 是否正在运行、本地模型是否已拉取并已选中；如果仍失败，请重新检测 Ollama 或切换模型后重试。";
}

function hasUsableOllamaOverviewForRetry(overview: OllamaOverview): boolean {
  const selectedModel = resolveUsableOllamaChatModel(overview.selectedModel, overview.models);

  return overview.reachable
    && selectedModel.length > 0
    && overview.models.some((model) => model.name === selectedModel);
}

export function resolveUsableOllamaChatModel(
  model: string,
  availableModels: WorkbenchState["model"]["availableModels"]
): string {
  const selectedModel = model.trim();

  if (selectedModel && availableModels.some((item) => item.name === selectedModel)) {
    return selectedModel;
  }

  if (availableModels.length > 0) {
    return availableModels.find((item) => PREFERRED_DEFAULT_CHAT_MODELS.includes(item.name))?.name?.trim()
      || availableModels[0]?.name?.trim()
      || "";
  }

  return "";
}

function createLocalModelChatFailureDetail(payload: {
  detail: string;
  model: string;
  message: string;
  executionKind: string | undefined;
  timeoutMs: number;
  elapsedMs: number;
  hasReceivedFirstChunk: boolean;
  firstChunkAfterMs: number | null;
}): string {
  const normalizedDetail = normalizeLocalModelTimeoutDetail(payload.detail, payload.timeoutMs);
  const streamPhase = payload.hasReceivedFirstChunk ? "streaming" : "waiting-first-chunk";
  const firstChunkAfterMs = payload.firstChunkAfterMs === null ? "none" : String(payload.firstChunkAfterMs);

  return [
    normalizedDetail,
    `Local model chat diagnostics: executionKind=${payload.executionKind ?? "unknown"}; model=${payload.model.trim() || "unselected"}; timeout=${formatTimeoutSeconds(payload.timeoutMs)}s; inputLength=${payload.message.trim().length}; streamPhase=${streamPhase}; elapsedMs=${payload.elapsedMs}; firstChunkAfterMs=${firstChunkAfterMs}; longAnswerProtection=enabled.`
  ].join(" ");
}

function normalizeLocalModelTimeoutDetail(detail: string, timeoutMs: number): string {
  return detail.replace(
    /maximum execution time of \d+ seconds/gi,
    `maximum execution time of ${formatTimeoutSeconds(timeoutMs)} seconds`
  );
}

function assertValidAssistantTaskExecutionResult(
  result: unknown,
  executionKind: string | undefined
): AssistantTaskExecutionResult {
  if (
    typeof result === "object"
    && result !== null
    && typeof (result as AssistantTaskExecutionResult).resultTitle === "string"
    && typeof (result as AssistantTaskExecutionResult).resultSummary === "string"
  ) {
    return result as AssistantTaskExecutionResult;
  }

  throw new Error(
    "Invalid local assistant execution result: expected resultTitle and resultSummary strings. " +
      `Next step: inspect assistantTaskService result mapping for ${executionKind ?? "unknown-task"} before retrying.`
  );
}

function createAssistantPlanningFailedStateFromError(
  state: WorkbenchState,
  message: string,
  error: unknown,
  source?: string
): WorkbenchState {
  const detail = normalizeUnknownAssistantError(error, "Unknown local assistant planner error");

  return createAssistantPlanningFailedState(state, {
    message,
    detail,
    source
  });
}

function normalizeUnknownAssistantError(error: unknown, fallback: string, depth = 0): string {
  if (depth > 3) {
    return fallback;
  }

  if (error instanceof Error) {
    const message = error.message.trim() || fallback;
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeDetail = cause === undefined ? "" : normalizeAssistantErrorValue(cause, fallback, depth + 1);

    return causeDetail ? `${message}; cause: ${causeDetail}` : message;
  }

  return normalizeAssistantErrorValue(error, fallback, depth);
}

function normalizeAssistantErrorValue(error: unknown, fallback: string, depth = 0): string {
  if (depth > 3) {
    return fallback;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const fieldDetails = [
      "code",
      "message",
      "summary",
      "detail",
      "route",
      "source",
      "stdout",
      "stderr",
      "statusCode",
      "responseSummary"
    ]
      .map((field) => {
        const value = record[field];
        return value === undefined || value === null ? null : `${field}: ${String(value).trim()}`;
      })
      .filter((value): value is string => Boolean(value));
    const causeDetail =
      record.cause === undefined || record.cause === null
        ? null
        : `cause: ${normalizeUnknownAssistantError(record.cause, fallback, depth + 1)}`;
    const details = [...fieldDetails, causeDetail].filter((value): value is string => Boolean(value));

    if (details.length > 0) {
      return details.join("; ");
    }
  }

  return String(error ?? "").trim() || fallback;
}

function assertValidAssistantTaskPlanResult(result: unknown): AssistantTaskPlanResult {
  if (
    typeof result === "object"
    && result !== null
    && typeof (result as AssistantTaskPlanResult).kind === "string"
  ) {
    const kind = (result as AssistantTaskPlanResult).kind;

    if (!SUPPORTED_ASSISTANT_PLAN_KINDS.has(kind)) {
      throw new Error(`Unsupported local assistant plan kind: ${kind}.`);
    }

    return result as AssistantTaskPlanResult;
  }

  throw new Error("Invalid local assistant plan result: expected an object with a string kind before branching.");
}

function truncateChatSearchField(value: string, maxLength = MAX_CHAT_SEARCH_FIELD_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function createLocalModelChatMessage(payload: {
  message: string;
  searchEnabled: boolean;
  searchProviderLabel: string;
  sources: WorkbenchState["sources"]["items"];
}): string {
  const normalizedMessage = payload.message.trim();
  const visibleSources = payload.searchEnabled
    ? payload.sources.slice(0, MAX_CHAT_SEARCH_CONTEXT_ITEMS)
    : [];

  if (visibleSources.length === 0) {
    if (payload.searchEnabled) {
      return [
        "联网搜索已开启，但本轮没有可用外部来源。",
        `当前搜索 provider：${payload.searchProviderLabel.trim() || "未配置"}`,
        "不要声称已经完成实时联网检索；如果回答需要最新资料，请说明缺少可用联网来源，并基于已有知识谨慎回答。",
        "",
        `用户问题：${normalizedMessage}`
      ].join("\n");
    }

    return normalizedMessage;
  }

  const sourceLines = visibleSources.map((source, index) => {
    const title = truncateChatSearchField(source.title || "未命名来源");
    const provider = truncateChatSearchField(source.provider || "未知 provider", 80);
    const query = truncateChatSearchField(source.query || "未记录查询", 160);
    const url = truncateChatSearchField(source.url || "未记录地址", 180);
    const summary = truncateChatSearchField(source.summary || "未记录摘要");

    return `${index + 1}. ${title} | provider=${provider} | query=${query} | url=${url} | summary=${summary}`;
  });

  return [
    "联网搜索参考（只作为参考，不要盲信；请自行判断来源可靠性、时效性和与问题的相关性，综合后用中文回答。）",
    ...sourceLines,
    "",
    `用户问题：${normalizedMessage}`
  ].join("\n");
}

export function getLocalModelChatTimeoutMs(message: string): number {
  const normalized = message.trim();
  const questionMarkers = [
    ...(normalized.match(/(?:^|\n|\s)\d{1,2}\s*[.、．]/g) ?? []),
    ...(normalized.match(/第\s*\d{1,2}\s*题/g) ?? [])
  ].length;
  const looksLikeLongQuiz =
    /单选题|多选题|共\s*\d+\s*(?:小题|题)|每题|答案|解析/.test(normalized)
    && (normalized.length > 600 || questionMarkers >= 8);

  return looksLikeLongQuiz || normalized.length > 1800
    ? LONG_LOCAL_MODEL_CHAT_TIMEOUT_MS
    : LOCAL_MODEL_CHAT_TIMEOUT_MS;
}

function formatTimeoutSeconds(timeoutMs: number): number {
  return Math.floor(timeoutMs / 1000);
}

function formatLocalModelProgressSummary(elapsedMs: number, hasReceivedFirstChunk: boolean): string {
  const elapsedSeconds = Math.max(1, Math.floor(elapsedMs / 1000));

  if (!hasReceivedFirstChunk) {
    return `Ollama 已连接，正在等待首轮输出，已等待约 ${elapsedSeconds} 秒。`;
  }

  return `Ollama 仍在生成，已等待约 ${elapsedSeconds} 秒。`;
}

function assertLocalModelTaskNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Local model task was aborted before applying side effects.");
  }
}

async function executeLocalModelChatTask(payload: {
  model: string;
  availableModels: WorkbenchState["model"]["availableModels"];
  message: string;
  searchEnabled: boolean;
  searchProviderLabel: string;
  sources: WorkbenchState["sources"]["items"];
  requestId?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}): Promise<AssistantTaskExecutionResult> {
  const selectedModel = resolveUsableOllamaChatModel(payload.model, payload.availableModels);

  if (!selectedModel) {
    throw new Error(
      "No usable local Ollama model is selected. Start Ollama, pull a local model, and select it before retrying."
    );
  }

  const visibleSources = payload.searchEnabled
    ? payload.sources.slice(0, MAX_CHAT_SEARCH_CONTEXT_ITEMS)
    : [];
  const searchProviders = Array.from(
    new Set([
      ...visibleSources.map((source) => source.provider.trim()).filter(Boolean),
      ...(payload.searchEnabled && visibleSources.length === 0 && payload.searchProviderLabel.trim()
        ? [payload.searchProviderLabel.trim()]
        : [])
    ])
  );
  const searchContextStatus = payload.searchEnabled
    ? visibleSources.length > 0
      ? "enabled-with-sources"
      : "enabled-no-sources"
    : "disabled";
  const result = await chatWithOllamaModel({
    model: selectedModel,
    message: createLocalModelChatMessage(payload),
    requestId: payload.requestId,
    signal: payload.signal,
    onChunk: payload.onChunk
  });
  const lengthLimitRecoveryLines = result.doneReason === "length"
    ? [
        "",
        LOCAL_MODEL_LENGTH_LIMIT_RECOVERY_HINT
      ]
    : [];

  return {
    resultTitle: "本地模型答复",
    resultSummary: [result.message, ...lengthLimitRecoveryLines].join("\n"),
    auditDetailLines: [
      `Ollama model: ${result.model || selectedModel}`,
      `Ollama done reason: ${result.doneReason || "complete"}`,
      `Search context items: ${visibleSources.length}/${MAX_CHAT_SEARCH_CONTEXT_ITEMS}`,
      `Search context status: ${searchContextStatus}`,
      `Search provider: ${searchProviders.join(", ") || "none"}`
    ]
  };
}

async function executeNpcConfigWriteTask(payload: {
  model: string;
  availableModels: WorkbenchState["model"]["availableModels"];
  message: string;
  requestId?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}): Promise<AssistantTaskExecutionResult> {
  const selectedModel = resolveUsableOllamaChatModel(payload.model, payload.availableModels);

  if (!selectedModel) {
    throw new Error(
      "No usable local Ollama model is selected. Start Ollama, pull a local model, and select it before retrying."
    );
  }

  const prompt = createNpcConfigGenerationPrompt(payload.message);
  const result = await chatWithOllamaModel({
    model: selectedModel,
    message: prompt,
    requestId: payload.requestId,
    signal: payload.signal,
    onChunk: payload.onChunk
  });
  assertLocalModelTaskNotAborted(payload.signal);
  const configResult = extractNpcConfigFromModelOutput(result.message);
  assertLocalModelTaskNotAborted(payload.signal);
  const writeResult = await writeNpcConfig({
    query: payload.message,
    modelOutput: result.message,
    config: configResult.config
  });
  const parseStatusLines = configResult.status === "wrapped"
    ? [
        "注意：本地模型没有输出可直接解析的 JSON，opencow 已保存一个带原文的安全包装配置。",
        "请继续补充资料或让模型重新生成，我会再次经过本地大模型更新，而不是套固定模板。"
      ]
    : ["你可以继续补充资料、约束、工具权限或工作流，我会再次经过大模型更新配置，而不是套固定模板。"];

  return {
    resultTitle: "NPC 配置已保存",
    resultSummary: [
      `已由本地模型 ${result.model || selectedModel} 生成 NPC 配置，并保存到 ${writeResult.config_path}。`,
      `NPC 名称：${writeResult.npc_name}。`,
      ...parseStatusLines,
      "",
      "模型生成摘要：",
      result.message
    ].join("\n"),
    auditDetailLines: [
      `Ollama model: ${result.model || selectedModel}`,
      `Ollama done reason: ${result.doneReason || "complete"}`,
      `NPC config path: ${writeResult.config_path}`,
      `NPC config status: ${writeResult.status}`,
      `NPC config parse status: ${configResult.status}`
    ]
  };
}

type ExplainableReadonlyResultKind =
  | "workspace-overview"
  | "packages-overview"
  | "workspace-config-overview"
  | "opencow-self-repair-preview"
  | "opencow-self-repair-target-guidance"
  | "opencow-self-repair-enabled-skills-registry"
  | "opencow-self-repair-workspace-project-runtime-registry"
  | "skills-local-install"
  | "skills-local-enable"
  | "skills-local-disable"
  | "workspace-write-create-temp-output"
  | "workspace-project-run"
  | "workspace-project-stop"
  | "controlled-full-remove-temp-output"
  | "capability-rag-overview"
  | "capability-skills-overview"
  | "capability-npc-overview"
  | "capability-mcp-overview"
  | "npc-local-collaboration-preview"
  | "npc-local-project-showcase-preview"
  | "npc-local-project-showcase-publish-preview"
  | "npc-local-project-showcase-git-confirmation-preview"
  | "npc-local-shell-plan-preview"
  | "workspace-project-status"
  | "mcp-local-plugin-scan"
  | "mcp-local-plugin-inspect"
  | "mcp-local-plugin-start-preview"
  | "skills-local-scan"
  | "skills-local-inspect"
  | "skills-local-enabled-list"
  | "skills-local-enabled-match"
  | "skills-local-enabled-shell-create-temp-output"
  | "skills-local-enabled-shell-remove-temp-output"
  | "npc-local-enabled-shell-create-temp-output"
  | "npc-local-enabled-shell-remove-temp-output"
  | "rag-local-doc-search"
  | "skills-local-enabled-rag-doc-search"
  | "rag-local-shell-handoff-preview"
  | "skills-local-enabled-rag-shell-handoff-preview"
  | "npc-local-enabled-rag-shell-handoff-preview"
  | "rag-local-shell-create-temp-output"
  | "readonly-shell-git-status"
  | "readonly-shell-workspace-root"
  | "readonly-shell-packages-dir"
  | "network-search-guidance";

function isExplainableReadonlyResultKind(kind: string | undefined): kind is ExplainableReadonlyResultKind {
  return kind === "workspace-overview"
    || kind === "packages-overview"
    || kind === "workspace-config-overview"
    || kind === "opencow-self-repair-preview"
    || kind === "opencow-self-repair-target-guidance"
    || kind === "opencow-self-repair-enabled-skills-registry"
    || kind === "opencow-self-repair-workspace-project-runtime-registry"
    || kind === "skills-local-install"
    || kind === "skills-local-enable"
    || kind === "skills-local-disable"
    || kind === "workspace-write-create-temp-output"
    || kind === "workspace-project-run"
    || kind === "workspace-project-stop"
    || kind === "controlled-full-remove-temp-output"
    || kind === "capability-rag-overview"
    || kind === "capability-skills-overview"
    || kind === "capability-npc-overview"
    || kind === "capability-mcp-overview"
    || kind === "npc-local-collaboration-preview"
    || kind === "npc-local-project-showcase-preview"
    || kind === "npc-local-project-showcase-publish-preview"
    || kind === "npc-local-project-showcase-git-confirmation-preview"
    || kind === "npc-local-shell-plan-preview"
    || kind === "workspace-project-status"
    || kind === "mcp-local-plugin-scan"
    || kind === "mcp-local-plugin-inspect"
    || kind === "mcp-local-plugin-start-preview"
    || kind === "skills-local-scan"
    || kind === "skills-local-inspect"
    || kind === "skills-local-enabled-list"
    || kind === "skills-local-enabled-match"
    || kind === "skills-local-enabled-shell-create-temp-output"
    || kind === "skills-local-enabled-shell-remove-temp-output"
    || kind === "npc-local-enabled-shell-create-temp-output"
    || kind === "npc-local-enabled-shell-remove-temp-output"
    || kind === "rag-local-doc-search"
    || kind === "skills-local-enabled-rag-doc-search"
    || kind === "rag-local-shell-handoff-preview"
    || kind === "skills-local-enabled-rag-shell-handoff-preview"
    || kind === "npc-local-enabled-rag-shell-handoff-preview"
    || kind === "rag-local-shell-create-temp-output"
    || kind === "readonly-shell-git-status"
    || kind === "readonly-shell-workspace-root"
    || kind === "readonly-shell-packages-dir"
    || kind === "network-search-guidance";
}

function isSelfRepairMutationResultKind(kind: ExplainableReadonlyResultKind): boolean {
  return kind === "opencow-self-repair-enabled-skills-registry"
    || kind === "opencow-self-repair-workspace-project-runtime-registry";
}

function isPostApprovalMutationResultKind(kind: ExplainableReadonlyResultKind): boolean {
  return isSelfRepairMutationResultKind(kind)
    || kind === "skills-local-install"
    || kind === "skills-local-enable"
    || kind === "skills-local-disable"
    || kind === "workspace-write-create-temp-output"
    || kind === "workspace-project-run"
    || kind === "workspace-project-stop"
    || kind === "controlled-full-remove-temp-output"
    || kind === "skills-local-enabled-shell-create-temp-output"
    || kind === "skills-local-enabled-shell-remove-temp-output"
    || kind === "npc-local-enabled-shell-create-temp-output"
    || kind === "npc-local-enabled-shell-remove-temp-output"
    || kind === "rag-local-shell-create-temp-output";
}

async function explainReadonlyOverviewResultWithLocalModel(payload: {
  executionKind: ExplainableReadonlyResultKind;
  model: string;
  availableModels: WorkbenchState["model"]["availableModels"];
  requestMessage: string;
  readonlyTitle: string;
  readonlySummary: string;
  requestId?: string;
  signal?: AbortSignal;
}): Promise<AssistantTaskExecutionResult> {
  const selectedModel = resolveUsableOllamaChatModel(payload.model, payload.availableModels);

  if (!selectedModel || typeof chatWithOllamaModel !== "function") {
    return {
      resultTitle: payload.readonlyTitle,
      resultSummary: payload.readonlySummary,
      auditDetailLines: [
        selectedModel
          ? "Assistant task result explanation skipped: local model bridge was unavailable in this runtime."
          : "Assistant task result explanation skipped: no usable local Ollama model was selected."
      ]
    };
  }

  if (payload.signal?.aborted) {
    throw new Error("Assistant task result explanation was aborted before it started.");
  }

  const explanationAbortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const abortExplanation = () => {
    if (!explanationAbortController.signal.aborted) {
      explanationAbortController.abort();
    }

    if (payload.requestId) {
      void Promise.resolve(cancelOllamaChat(payload.requestId)).catch(() => undefined);
    }
  };
  const handleParentAbort = () => abortExplanation();
  payload.signal?.addEventListener("abort", handleParentAbort, { once: true });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortExplanation();
      reject(
        new Error(
          `Assistant task result explanation exceeded ${Math.floor(READONLY_EXPLANATION_TIMEOUT_MS / 1000)} seconds.`
        )
      );
    }, READONLY_EXPLANATION_TIMEOUT_MS);
  });

  let result: Awaited<ReturnType<typeof chatWithOllamaModel>>;

  try {
    result = await Promise.race([
      chatWithOllamaModel({
        model: selectedModel,
        message: createReadonlyOverviewExplanationPrompt({
          executionKind: payload.executionKind,
          userRequest: payload.requestMessage,
          readonlySummary: payload.readonlySummary
        }),
        requestId: payload.requestId,
        signal: explanationAbortController.signal
      }),
      timeoutPromise
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    payload.signal?.removeEventListener("abort", handleParentAbort);
  }

  return {
    resultTitle: getReadonlyOverviewExplanationTitle(payload.executionKind),
    resultSummary: result.message,
    auditDetailLines: [
      `Ollama model: ${result.model || selectedModel}`,
      `Ollama done reason: ${result.doneReason || "complete"}`,
      isPostApprovalMutationResultKind(payload.executionKind)
        ? `Assistant task result explanation: local model generated for ${payload.executionKind} after approved mutation completed.`
        : `Readonly overview explanation: local model generated for ${payload.executionKind} from readonly facts.`
    ],
    auditOnlyDetailLines: [
      isPostApprovalMutationResultKind(payload.executionKind)
        ? `Original approved mutation result facts: ${payload.readonlySummary}`
        : `Readonly workspace facts: ${payload.readonlySummary}`
    ]
  };
}

function getReadonlyOverviewExplanationTitle(
  executionKind: ExplainableReadonlyResultKind
): string {
  if (executionKind === "packages-overview") {
    return "包与脚本说明";
  }

  if (executionKind === "workspace-config-overview") {
    return "配置说明";
  }

  if (executionKind === "opencow-self-repair-preview") {
    return "OpenCow 自修复预览说明";
  }

  if (executionKind === "opencow-self-repair-target-guidance") {
    return "OpenCow 自修复目标说明";
  }

  if (executionKind === "opencow-self-repair-enabled-skills-registry") {
    return "OpenCow Skills 注册表修复说明";
  }

  if (executionKind === "opencow-self-repair-workspace-project-runtime-registry") {
    return "OpenCow 项目运行注册表修复说明";
  }

  if (executionKind === "skills-local-install") {
    return "Skill 安装结果说明";
  }

  if (executionKind === "skills-local-enable") {
    return "Skill 启用结果说明";
  }

  if (executionKind === "skills-local-disable") {
    return "Skill 停用结果说明";
  }

  if (executionKind === "workspace-write-create-temp-output") {
    return "temp-output 创建结果说明";
  }

  if (executionKind === "workspace-project-run") {
    return "本地项目启动结果说明";
  }

  if (executionKind === "workspace-project-stop") {
    return "本地项目停止结果说明";
  }

  if (executionKind === "controlled-full-remove-temp-output") {
    return "temp-output 删除结果说明";
  }

  if (executionKind === "skills-local-enabled-shell-create-temp-output") {
    return "Skill 辅助创建结果说明";
  }

  if (executionKind === "skills-local-enabled-shell-remove-temp-output") {
    return "Skill 辅助清理结果说明";
  }

  if (executionKind === "npc-local-enabled-shell-create-temp-output") {
    return "NPC 辅助创建结果说明";
  }

  if (executionKind === "npc-local-enabled-shell-remove-temp-output") {
    return "NPC 辅助清理结果说明";
  }

  if (executionKind === "rag-local-shell-create-temp-output") {
    return "RAG 交接创建结果说明";
  }

  if (executionKind === "capability-rag-overview") {
    return "RAG 能力说明";
  }

  if (executionKind === "capability-skills-overview") {
    return "Skills 能力说明";
  }

  if (executionKind === "capability-npc-overview") {
    return "NPC 能力说明";
  }

  if (executionKind === "capability-mcp-overview") {
    return "MCP 能力说明";
  }

  if (executionKind === "npc-local-project-showcase-git-confirmation-preview") {
    return "NPC Git 确认预览说明";
  }

  if (executionKind === "npc-local-project-showcase-publish-preview") {
    return "NPC 展示发布预览说明";
  }

  if (executionKind === "npc-local-project-showcase-preview") {
    return "NPC 项目展示预览说明";
  }

  if (executionKind === "npc-local-shell-plan-preview") {
    return "NPC Shell 计划预览说明";
  }

  if (executionKind === "npc-local-collaboration-preview") {
    return "NPC 协作预览说明";
  }

  if (executionKind === "workspace-project-status") {
    return "本地项目状态说明";
  }

  if (executionKind === "mcp-local-plugin-start-preview") {
    return "MCP 插件启动预览说明";
  }

  if (executionKind === "mcp-local-plugin-inspect") {
    return "MCP 插件详情说明";
  }

  if (executionKind === "mcp-local-plugin-scan") {
    return "本地 MCP 插件扫描说明";
  }

  if (executionKind === "network-search-guidance") {
    return "联网搜索说明";
  }

  if (executionKind === "skills-local-enabled-rag-doc-search") {
    return "Skill 辅助 RAG 说明";
  }

  if (executionKind === "npc-local-enabled-rag-shell-handoff-preview") {
    return "NPC RAG Shell 交接预览说明";
  }

  if (executionKind === "skills-local-enabled-rag-shell-handoff-preview") {
    return "Skill RAG Shell 交接预览说明";
  }

  if (executionKind === "rag-local-shell-handoff-preview") {
    return "RAG Shell 交接预览说明";
  }

  if (executionKind === "skills-local-inspect") {
    return "Skill 详情说明";
  }

  if (executionKind === "skills-local-scan") {
    return "本地 Skills 扫描说明";
  }

  if (executionKind === "skills-local-enabled-match") {
    return "已启用 Skill 推荐";
  }

  if (executionKind === "skills-local-enabled-list") {
    return "已启用 Skills 说明";
  }

  if (executionKind === "rag-local-doc-search") {
    return "本地 RAG 说明";
  }

  if (executionKind === "readonly-shell-git-status") {
    return "Git 状态诊断说明";
  }

  if (executionKind === "readonly-shell-workspace-root") {
    return "工作区根目录诊断说明";
  }

  if (executionKind === "readonly-shell-packages-dir") {
    return "包目录诊断说明";
  }

  return "工作区说明";
}

function createReadonlyOverviewExplanationPrompt(payload: {
  executionKind: ExplainableReadonlyResultKind;
  userRequest: string;
  readonlySummary: string;
}): string {
  const focusLine = payload.executionKind === "packages-overview"
      ? "重点解释包结构、脚本数量、可运行入口和下一步开发排查重点。"
    : payload.executionKind === "workspace-config-overview"
      ? "重点解释配置文件、根脚本、包管理线索和启动/验证链路重点。"
      : payload.executionKind === "opencow-self-repair-preview"
        ? "重点解释当前只是 OpenCow 自修复只读预览、命中的配置/脚本/RAG 依据、可能的修复目标、为什么没有写文件，以及继续前必须经过 workspace-write 提权和审计/回退保护。"
        : payload.executionKind === "opencow-self-repair-target-guidance"
          ? "重点解释为什么本轮不能继续泛化自修复、必须先选择 enabled skills registry 或 workspace project runtime registry 之一；明确本轮没有提权、没有写文件，下一步应让用户明确目标。"
          : payload.executionKind === "opencow-self-repair-enabled-skills-registry"
            ? "重点解释 enabled skills registry 已在用户批准 workspace-write 后完成受控修复、修复路径、保留条目、验证结果、审计/回退可见性，以及下一步如何继续安全使用 Skills。不要说这是只读预览。"
            : payload.executionKind === "opencow-self-repair-workspace-project-runtime-registry"
              ? "重点解释 workspace project runtime registry 已在用户批准 workspace-write 后完成受控修复、修复路径、保留运行记录、验证结果、审计/回退可见性，以及下一步如何安全检查或启动项目。不要说这是只读预览。"
              : payload.executionKind === "skills-local-install"
                ? "重点解释这个 Skill 已在用户批准 workspace-write 后复制到本地 workspace skills 目录、安装路径、来源路径、安装状态、下一步如何启用或检查；明确这不是只读预览，也不要暗示已经执行了 Skill。"
                : payload.executionKind === "skills-local-enable"
                  ? "重点解释这个 Skill 已在用户批准 workspace-write 后写入本地 enabled skills 注册表、注册表路径、启用状态、下一步如何使用；明确这不是只读预览，也不要暗示已经执行了 Skill。"
                  : payload.executionKind === "skills-local-disable"
                    ? "重点解释这个 Skill 已在用户批准 workspace-write 后从本地 enabled skills 注册表停用、注册表路径、停用状态、下一步如何安全恢复或替代；明确这不是只读预览，也不要暗示删除了 Skill 文件。"
                    : payload.executionKind === "workspace-write-create-temp-output"
                      ? "重点解释 temp-output 已在用户批准 workspace-write 后通过受控 shell runner 创建、实际命令、工作区边界、输出预览、审计/回退可见性，以及下一步如何安全使用；明确这不是任意 shell 权限，也不要暗示执行了其他写入。"
                      : payload.executionKind === "workspace-project-run"
                        ? "重点解释本地项目已在用户批准 workspace-write 后通过受控项目运行链路启动、匹配项目、命令、工作目录、预期 URL、PID/预览输出、审计/回退可见性，以及下一步如何安全检查状态或停止；明确这不是任意 shell 权限，也不要暗示启动了其他项目。"
                        : payload.executionKind === "workspace-project-stop"
                          ? "重点解释本地项目已在用户批准 workspace-write 后通过受控项目停止链路停止、匹配项目、命令、工作目录、PID、状态、预览输出、审计/回退可见性，以及下一步如何安全确认状态；明确这不是任意 shell 权限，也不要暗示删除了项目文件。"
                          : payload.executionKind === "controlled-full-remove-temp-output"
                            ? "重点解释 temp-output 已在用户授予 controlled-full 并确认高风险操作后通过受控 shell runner 删除、实际命令、工作区边界、输出预览、审计/回退快照可见性，以及下一步如何安全确认；明确这不是任意 shell 权限，也不要暗示删除了其他路径。"
                            : payload.executionKind === "skills-local-enabled-shell-create-temp-output"
                              ? "重点解释已启用 Skill 只是用于匹配合适的本地能力，temp-output 创建仍是在用户批准 workspace-write 后通过受控 shell runner 执行；说明匹配 Skill、注册表、实际命令、工作区边界、输出预览、审计/回退可见性和下一步安全使用方式。不要暗示 Skill 或模型获得了任意 shell 权限。"
                              : payload.executionKind === "skills-local-enabled-shell-remove-temp-output"
                                ? "重点解释已启用 Skill 只是用于匹配合适的本地能力，temp-output 删除仍是在用户授予 controlled-full 并确认高风险操作后通过受控 shell runner 执行；说明匹配 Skill、注册表、实际命令、工作区边界、输出预览、审计/回退快照可见性和下一步安全确认方式。不要暗示 Skill 或模型获得了任意删除权限，也不要暗示删除了其他路径。"
                                : payload.executionKind === "npc-local-enabled-shell-create-temp-output"
                                  ? "重点解释 NPC 协作只是用于组织本地能力和匹配已启用 Skill，temp-output 创建仍是在用户批准 workspace-write 后通过受控 shell runner 执行；说明匹配 Skill、注册表、实际命令、工作区边界、输出预览、审计/回退可见性和下一步安全使用方式。不要暗示 NPC、Skill 或模型获得了任意 shell 权限。"
                                  : payload.executionKind === "npc-local-enabled-shell-remove-temp-output"
                                    ? "重点解释 NPC 协作只是用于组织本地能力和匹配已启用 Skill，temp-output 删除仍是在用户授予 controlled-full 并确认高风险操作后通过受控 shell runner 执行；说明匹配 Skill、注册表、实际命令、工作区边界、输出预览、审计/回退快照可见性和下一步安全确认方式。不要暗示 NPC、Skill 或模型获得了任意删除权限，也不要暗示删除了其他路径。"
                                    : payload.executionKind === "rag-local-shell-create-temp-output"
                                      ? "重点解释本地 RAG 只提供规则依据和交接计划，temp-output 创建仍是在用户批准 workspace-write 后通过受控 shell runner 执行；说明命中文档依据、实际命令、工作区边界、输出预览、审计/回退可见性和下一步安全使用方式。不要暗示 RAG 或模型获得了任意 shell 权限。"
                    : payload.executionKind === "capability-rag-overview"
                ? "重点解释 RAG 能力当前可用基础、缺失项、适合解决什么问题，以及下一步如何安全验证。"
                : payload.executionKind === "capability-skills-overview"
              ? "重点解释 Skills 能力当前可用基础、安装/启用边界、缺失项，以及下一步如何安全验证。"
              : payload.executionKind === "capability-npc-overview"
                ? "重点解释 NPC 协作能力当前可用基础、适合的本地工作流、缺失项，以及下一步如何安全验证。"
                : payload.executionKind === "capability-mcp-overview"
                  ? "重点解释 MCP 能力当前可用基础、插件/工具边界、缺失项，以及下一步如何安全验证。"
                  : payload.executionKind === "npc-local-project-showcase-git-confirmation-preview"
                    ? "重点解释当前只是 Git 确认预览、变更范围、推荐动作、为什么还没有执行 commit/push，以及继续前必须显式确认什么。"
                    : payload.executionKind === "npc-local-project-showcase-publish-preview"
                      ? "重点解释展示站点发布预览、已有产物和变更路径、下一步 Git 边界，以及为什么本轮没有进入提交或推送。"
                      : payload.executionKind === "npc-local-project-showcase-preview"
                        ? "重点解释 NPC 项目展示工作流预览、匹配项目、运行入口、截图/站点/Git 阶段，以及哪些步骤还必须经过权限审批。"
                        : payload.executionKind === "npc-local-shell-plan-preview"
                          ? "重点解释 NPC Shell 计划预览、匹配 Skill、命令意图、权限等级、回退/审计边界，以及为什么本轮没有执行命令。"
                          : payload.executionKind === "npc-local-collaboration-preview"
                            ? "重点解释 NPC 协作预览当前可用能力、已启用 Skills、本地文档依据、适合的下一步，以及哪些动作仍需要审批。"
                            : payload.executionKind === "workspace-project-status"
                              ? "重点解释匹配到的本地项目、运行命令、PID/状态、预览输出含义、下一步如何安全处理；不要暗示已经启动或停止进程。"
                              : payload.executionKind === "mcp-local-plugin-start-preview"
                                ? "重点解释这个 MCP 插件启动预览说明了什么、为什么只是预览、缺少什么启动器或配置、继续启动前必须经过哪些权限边界。"
                                : payload.executionKind === "mcp-local-plugin-inspect"
                                  ? "重点解释匹配到的 MCP 插件用途、激活方式、工具/Skill 暴露情况、配置边界和下一步安全验证建议。"
                                  : payload.executionKind === "mcp-local-plugin-scan"
                                    ? "重点解释扫描到的本地 MCP 插件生态、插件入口、激活方式线索、可用工具边界和下一步安全验证建议。"
                                    : payload.executionKind === "network-search-guidance"
                                      ? "重点解释本轮没有执行外部联网搜索、搜索 provider 未配置、需要用户批准后才能联网，以及可以先用本地 RAG 的安全替代路径。"
                                      : payload.executionKind === "skills-local-enabled-rag-doc-search"
                                        ? "重点根据已匹配 Skill 和本地 RAG 命中文档解释答案、引用依据、边界和下一步可执行建议。"
                                        : payload.executionKind === "npc-local-enabled-rag-shell-handoff-preview"
                                          ? "重点解释 NPC、已启用 Skill、本地 RAG 依据和 Shell 交接计划；明确这只是只读预览，没有执行命令，继续时仍必须经过权限审批和必要的高风险确认。"
                                          : payload.executionKind === "skills-local-enabled-rag-shell-handoff-preview"
                                            ? "重点解释已启用 Skill、本地 RAG 依据和 Shell 交接计划；明确这只是只读预览，没有执行命令，继续时仍必须经过权限审批和必要的高风险确认。"
                                            : payload.executionKind === "rag-local-shell-handoff-preview"
                                              ? "重点解释本地 RAG 依据、Shell 交接计划、建议命令和权限等级；明确这只是只读预览，没有执行命令，继续时仍必须经过权限审批和必要的高风险确认。"
                                              : payload.executionKind === "skills-local-inspect"
                                                ? "重点解释这个 Skill 的用途、启用状态、适合任务、内容预览和后续使用边界。"
                                                : payload.executionKind === "skills-local-scan"
                                                  ? "重点解释当前扫描到的本地 Skills 生态、已启用项、可用入口和下一步安全使用建议。"
                                                  : payload.executionKind === "skills-local-enabled-match"
                                                    ? "重点解释推荐哪个已启用 Skill、为什么匹配、可做什么、不能越过哪些权限边界。"
                                                    : payload.executionKind === "skills-local-enabled-list"
                                                      ? "重点解释当前已启用 Skills 的用途、注册表位置、适合的下一步，以及哪些动作仍需要审批。"
                                                      : payload.executionKind === "rag-local-doc-search"
                                                        ? "重点根据本地 RAG 命中文档解释答案、引用依据、边界和下一步可执行建议。"
                                                        : payload.executionKind === "readonly-shell-git-status"
                                                          ? "重点解释 git 状态只读诊断结果、当前变更风险、为什么本轮没有执行写入，以及下一步如何安全处理。"
                                                          : payload.executionKind === "readonly-shell-workspace-root"
                                                            ? "重点解释工作区根目录只读诊断结果、关键入口是否可见、为什么本轮没有执行写入，以及下一步如何安全排查。"
                                                            : payload.executionKind === "readonly-shell-packages-dir"
                                                              ? "重点解释 packages 目录只读诊断结果、包结构线索、为什么本轮没有执行写入，以及下一步如何安全排查。"
                                                        : "重点解释这个项目是什么、结构重点在哪里、接下来最值得关注什么。";

  return [
    "你是 OpenCow 的本地项目说明助手。",
    `请根据下面给出的任务结果事实，用中文直接解释用户关心的问题。${focusLine}`,
    "不要编造不存在的目录、包或功能，不要输出模板化套话，不要说你已经做了联网搜索。",
    "保持回答像真正看过项目后的自然总结，简洁但有判断。",
    "",
    `用户请求：${payload.userRequest.trim()}`,
    "",
    isPostApprovalMutationResultKind(payload.executionKind) ? "已批准任务结果事实：" : "只读工作区事实：",
    payload.readonlySummary
  ].join("\n");
}

function createNpcConfigGenerationPrompt(userRequest: string): string {
  return [
    "你是 opencow 的本地 NPC 配置生成器。请真正理解用户想创建的 NPC，而不是复述固定模板。",
    "只输出一个 JSON 对象，不要使用 Markdown 代码块，不要添加 JSON 之外的解释。",
    "JSON 必须包含这些字段：",
    "name: 简短中文名称；",
    "purpose: 这个 NPC 要解决的问题；",
    "persona: 语气、人设和交互方式；",
    "capabilities: 字符串数组，说明可做的事；",
    "workflow: 字符串数组，说明默认工作流；",
    "required_inputs: 字符串数组，说明还需要用户提供哪些资料；",
    "permissions: 对象，包含 readonly、workspace_write、network 三个字段，说明权限边界；",
    "first_message: NPC 配好后第一句应该如何主动追问用户。",
    "请用中文生成，内容要贴合用户请求。",
    "",
    `用户请求：${userRequest.trim()}`
  ].join("\n");
}

function extractNpcConfigFromModelOutput(modelOutput: string): {
  readonly status: "parsed" | "wrapped";
  readonly config: Record<string, unknown>;
} {
  const trimmed = modelOutput.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? extractFirstJsonObject(trimmed);

  try {
    const parsed = JSON.parse(candidate);

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return {
        status: "parsed",
        config: parsed as Record<string, unknown>
      };
    }
  } catch {
    // Fall through to a safe wrapper so model prose is still auditable instead of being lost.
  }

  return {
    status: "wrapped",
    config: {
      name: inferNpcNameFromText(modelOutput),
      purpose: "根据用户请求生成的 NPC 配置需要人工复核。",
      persona: "中文、谨慎、先询问缺失信息再执行。",
      capabilities: ["理解用户提供的任务背景", "整理下一步需要的资料", "在获得权限后更新本地配置"],
      workflow: ["读取用户补充信息", "完善 NPC 配置", "需要写入或联网前先确认"],
      required_inputs: ["请补充这个 NPC 的具体使用场景、资料来源和权限边界"],
      permissions: {
        readonly: "可以规划、追问和总结",
        workspace_write: "只有用户批准后才写入或更新本地配置",
        network: "只有用户单独开启联网搜索后才查询外部资料"
      },
      first_message: "我已经有一个初始配置，请补充这个 NPC 要处理的资料范围和默认工作流。",
      unparsed_model_output: modelOutput
    },
  };
}

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf("{");

  if (start < 0) {
    return text;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return text.slice(start);
}

function inferNpcNameFromText(text: string): string {
  const nameMatch = text.match(/["“]?name["”]?\s*[:：]\s*["“]?([^",，\n”}]+)/i);
  return nameMatch?.[1]?.trim() || "自定义 NPC";
}

function isCurrentTaskAttempt(state: WorkbenchState, taskId: string, attemptCount: number): boolean {
  if (state.tasks.activeTaskId !== taskId) {
    return false;
  }

  const activeTask = state.tasks.items.find((item) => item.id === taskId);

  return activeTask?.status === "running" && activeTask.attemptCount === attemptCount;
}

export function shouldScheduleLocalTaskStart(state: WorkbenchState): boolean {
  const hasQueuedTask = state.tasks.items.some((item) => item.status === "queued");

  if (!hasQueuedTask) {
    return false;
  }

  if (!state.tasks.activeTaskId) {
    return true;
  }

  const activeTask = state.tasks.items.find((item) => item.id === state.tasks.activeTaskId);

  return activeTask?.status !== "running";
}

export function shouldRecoverStaleActiveTaskSlot(state: WorkbenchState): boolean {
  if (!state.tasks.activeTaskId || state.tasks.items.some((item) => item.status === "queued")) {
    return false;
  }

  const activeTask = state.tasks.items.find((item) => item.id === state.tasks.activeTaskId);

  return activeTask?.status !== "running";
}

export function createContinuationMessageFromPreview(kind: string, message: string): string {
  if (!CONTINUATION_PREVIEW_KINDS.has(kind)) {
    return message.trim();
  }

  const normalized = message
    .replace(/\bpreview\b/gi, "continue")
    .replace(/\bplan\b/gi, "continue")
    .replace(/\bworkflow\b/gi, "continue")
    .replace(/\band continue the next safe shell step to\b/gi, "and continue to")
    .replace(/\band continue the next shell step to\b/gi, "and continue to");

  if (/continue to .* with shell automation/i.test(normalized)) {
    return normalized.trim();
  }

  if (/continue to /i.test(normalized)) {
    return `${normalized.trim()} with shell automation`;
  }

  return normalized.trim();
}

function getTailText(text: string, limit: number): string {
  const normalizedText = text.trim();

  if (normalizedText.length <= limit) {
    return normalizedText;
  }

  return normalizedText.slice(normalizedText.length - limit).trim();
}

function createLocalModelLengthLimitContinuationMessage(state: WorkbenchState): string | null {
  const latestAssistantEntry = state.conversation.entries.find((entry) => entry.kind === "assistant");

  if (!latestAssistantEntry?.summary.includes(LOCAL_MODEL_LENGTH_LIMIT_RECOVERY_HINT)) {
    return null;
  }

  const latestLocalModelTask = state.tasks.items.find(
    (item) => item.executionKind === "local-model-chat" && item.status === "completed"
  );

  if (!latestLocalModelTask) {
    return null;
  }

  const priorAnswer = latestAssistantEntry.summary.replace(LOCAL_MODEL_LENGTH_LIMIT_RECOVERY_HINT, "").trim();
  const answerTail = getTailText(priorAnswer, LOCAL_MODEL_CONTINUATION_TAIL_LIMIT);

  if (!answerTail) {
    return null;
  }

  return [
    "上一轮本地模型回答因为输出长度限制仍可能未完整。",
    "请从上一轮回答末尾继续，不要重写已经完成的内容。",
    "保持同样格式，补完整体回答。",
    "",
    "原始用户请求：",
    getOriginalLocalModelRequest(latestLocalModelTask),
    "",
    "上一轮回答末尾：",
    answerTail
  ].join("\n");
}

function getOriginalLocalModelRequest(task: WorkbenchState["tasks"]["items"][number]): string {
  const executionMessage = task.executionMessage?.trim();
  const originalRequestMatch = executionMessage?.match(
    /原始用户请求：\s*([\s\S]*?)(?:\n\s*\n上一轮回答末尾：|$)/
  );
  const originalRequest = originalRequestMatch?.[1]?.trim();

  return originalRequest || task.summary.trim();
}

export function resolveContinuationMessage(message: string, state: WorkbenchState): string {
  const normalizedMessage = message.trim();
  const isContinuationCommand = normalizedMessage.toLowerCase() === "continue" || normalizedMessage === "继续";

  if (!isContinuationCommand) {
    return message;
  }

  if (CONTINUATION_CANCELLED_SOURCES.has(state.audit.lastEvent.source)) {
    return message;
  }

  const localModelContinuationMessage = createLocalModelLengthLimitContinuationMessage(state);

  if (localModelContinuationMessage) {
    return localModelContinuationMessage;
  }

  const latestTask = state.tasks.items[0];
  const latestPreviewTask =
    latestTask?.executionKind && CONTINUATION_PREVIEW_KINDS.has(latestTask.executionKind)
      ? latestTask
      : null;

  if (!latestPreviewTask?.executionKind) {
    return message;
  }

  if (latestPreviewTask.status === "failed" || latestPreviewTask.status === "cancelled") {
    return message;
  }

  if (latestPreviewTask.continuationMessage) {
    return latestPreviewTask.continuationMessage;
  }

  return createContinuationMessageFromPreview(latestPreviewTask.executionKind, latestPreviewTask.summary);
}

function isShortContinuationCommand(message: string): boolean {
  const normalizedMessage = message.trim();

  return normalizedMessage.toLowerCase() === "continue" || normalizedMessage === "继续";
}

function shouldStopTerminalPreviewContinuation(message: string, state: WorkbenchState): boolean {
  if (!isShortContinuationCommand(message)) {
    return false;
  }

  const latestTask = state.tasks.items[0];

  return Boolean(
    latestTask?.executionKind
      && CONTINUATION_PREVIEW_KINDS.has(latestTask.executionKind)
      && (latestTask.status === "failed" || latestTask.status === "cancelled")
  );
}

function createStoppedTerminalPreviewContinuationState(state: WorkbenchState): WorkbenchState {
  return createCommandPolicyBlockedState(state, {
    summary: "Preview continuation was stopped",
    detail:
      "The latest preview task already failed or was cancelled. Review its failure detail, fix the blocking condition, or ask for a narrower explicit repair target before continuing.",
    actionLabel:
      "Short continue requests are blocked for terminal preview tasks so opencow does not re-plan hidden repair loops.",
    source: "preview_continuation_stopped_after_terminal_task"
  });
}

function getPlanningFailureInputSummary(state: WorkbenchState): string | null {
  if (state.error?.source !== "local_assistant_planner") {
    return null;
  }

  return state.error.detail.match(/Input summary:\s*(.*?)(?:\s+Planner failure detail:)/)?.[1]?.trim() ?? null;
}

function isDuplicatePlanningFailureMessage(message: string, state: WorkbenchState): boolean {
  const previousInputSummary = getPlanningFailureInputSummary(state);

  return Boolean(
    previousInputSummary
      && previousInputSummary.toLowerCase() === message.trim().toLowerCase()
  );
}

function isDuplicatePendingPermissionMessage(message: string, state: WorkbenchState): boolean {
  const queuedMessage = state.permission.pendingModeChange?.queuedMessage;

  return Boolean(queuedMessage && queuedMessage.trim().toLowerCase() === message.trim().toLowerCase());
}

function isDuplicatePendingConfirmationMessage(message: string, state: WorkbenchState): boolean {
  const queuedMessage = state.confirmation.pending?.queuedMessage;

  return Boolean(queuedMessage && queuedMessage.trim().toLowerCase() === message.trim().toLowerCase());
}

function isTauriDesktopRuntime() {
  return typeof window !== "undefined" && TAURI_INTERNALS_KEY in window;
}

export function App() {
  const shouldHydrateNativeState = isTauriDesktopRuntime();
  const [state, setState] = useState(() =>
    shouldHydrateNativeState
      ? createInitialWorkbenchState()
      : loadPersistedWorkbenchStateFromBrowserStorage(createInitialWorkbenchState)
  );
  const [hasHydratedPersistedState, setHasHydratedPersistedState] = useState(!shouldHydrateNativeState);
  const stateRef = useRef(state);
  const hasLoadedOllamaOverviewRef = useRef(false);
  const pendingPersistedStateRef = useRef<WorkbenchState | null>(null);
  const lastExecutedTaskAttemptRef = useRef<string | null>(null);
  const activeLocalModelAbortControllerRef = useRef<AbortController | null>(null);
  const activeLocalModelRequestIdRef = useRef<string | null>(null);
  const activeTaskExecutionDependency = state.tasks.activeTaskId
    ? state.tasks.items
        .filter((item) => item.id === state.tasks.activeTaskId)
        .map((item) => `${item.id}:${item.status}:${item.attemptCount}:${item.executionKind ?? ""}`)
        .at(0) ?? state.tasks.activeTaskId
    : null;

  stateRef.current = state;

  function cancelActiveLocalModelRequest() {
    const requestId = activeLocalModelRequestIdRef.current;

    activeLocalModelAbortControllerRef.current?.abort();
    activeLocalModelAbortControllerRef.current = null;
    activeLocalModelRequestIdRef.current = null;

    if (requestId) {
      void Promise.resolve(cancelOllamaChat(requestId)).catch(() => undefined);
    }
  }

  useEffect(() => {
    if (!shouldHydrateNativeState) {
      return;
    }

    let cancelled = false;

    void readPersistedWorkbenchState()
      .then((persistedState) => {
        if (cancelled) {
          return;
        }

        if (persistedState) {
          pendingPersistedStateRef.current = persistedState;
          setState(persistedState);
          return;
        }

        setHasHydratedPersistedState(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHasHydratedPersistedState(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldHydrateNativeState]);

  useEffect(() => {
    const pendingPersistedState = pendingPersistedStateRef.current;

    if (!pendingPersistedState || state !== pendingPersistedState) {
      return;
    }

    pendingPersistedStateRef.current = null;
    setHasHydratedPersistedState(true);
  }, [state]);

  useEffect(() => {
    if (!hasHydratedPersistedState) {
      return;
    }

    const idle = state.tasks.activeTaskId === null && state.tasks.pendingCount === 0;

    if (!idle || hasLoadedOllamaOverviewRef.current) {
      return;
    }

    hasLoadedOllamaOverviewRef.current = true;
    void loadOllamaOverview()
      .then((overview) => {
        startTransition(() => {
          setState((current) => mergeOllamaOverview(current, overview));
        });
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown ollama load error";

        startTransition(() => {
          setState((current) => createOllamaLoadErrorState(current, detail));
        });
      });
  }, [hasHydratedPersistedState, state.tasks.activeTaskId, state.tasks.pendingCount]);

  useEffect(() => {
    if (!hasHydratedPersistedState) {
      return;
    }

    void persistWorkbenchState(state);
  }, [hasHydratedPersistedState, state]);

  useEffect(() => () => {
    cancelActiveLocalModelRequest();
  }, []);

  useEffect(() => {
    if (!shouldScheduleLocalTaskStart(state) && !shouldRecoverStaleActiveTaskSlot(state)) {
      return;
    }

    const startTimer = window.setTimeout(() => {
      startTransition(() => {
        setState((current) =>
          shouldScheduleLocalTaskStart(current)
            ? createTaskExecutionStartedState(current)
            : createStaleActiveTaskSlotRecoveredState(current)
        );
      });
    }, 80);

    return () => {
      window.clearTimeout(startTimer);
    };
  }, [state.tasks.activeTaskId, state.tasks.items]);

  useEffect(() => {
    if (!state.tasks.activeTaskId) {
      lastExecutedTaskAttemptRef.current = null;
      return;
    }

    const activeTask = state.tasks.items.find((item) => item.id === state.tasks.activeTaskId);

    if (!activeTask) {
      lastExecutedTaskAttemptRef.current = null;
      return;
    }

    if (activeTask.attemptCount > MAX_LOCAL_TASK_ATTEMPTS) {
      lastExecutedTaskAttemptRef.current = `${activeTask.id}:${activeTask.attemptCount}`;
      startTransition(() => {
        setState((current) =>
          createTaskExecutionFailedState(current, {
            summary: "本地任务已中断",
            detail: `Task exceeded the maximum retry limit of ${MAX_LOCAL_TASK_ATTEMPTS} attempts.`,
            actionLabel: "请调整任务描述、权限范围或稍后再试",
            source: "local_task_attempt_guard"
          })
        );
      });
      return;
    }

    const executionAttemptKey = `${activeTask.id}:${activeTask.attemptCount}`;

    if (lastExecutedTaskAttemptRef.current === executionAttemptKey) {
      return;
    }

    lastExecutedTaskAttemptRef.current = executionAttemptKey;
    const executingTaskId = activeTask.id;
    const executingAttemptCount = activeTask.attemptCount;
    let executionTimeoutId: number | null = null;
    let progressIntervalId: number | null = null;
    let assistantTaskAbortController: AbortController | null = null;
    const clearExecutionTimeout = () => {
      if (executionTimeoutId !== null) {
        window.clearTimeout(executionTimeoutId);
        executionTimeoutId = null;
      }
    };
    const clearProgressInterval = () => {
      if (progressIntervalId !== null) {
        window.clearInterval(progressIntervalId);
        progressIntervalId = null;
      }
    };

    const finishTimer = window.setTimeout(() => {
      if (!activeTask.executionKind) {
        if (lastExecutedTaskAttemptRef.current !== executionAttemptKey) {
          return;
        }

        startTransition(() => {
          setState((current) => createTaskMissingExecutionKindFailedState(current));
        });
        return;
      }

      if (
        activeTask.executionKind === "local-model-chat"
        || activeTask.executionKind === "npc-config-write"
      ) {
        const localModelMessage = getTaskExecutionMessage(activeTask);
        const localModelChatTimeoutMs = getLocalModelChatTimeoutMs(localModelMessage);
        let localModelDiagnosticModel = stateRef.current.model.activeModel;
        cancelActiveLocalModelRequest();
        const localModelAbortController = new AbortController();
        const localModelRequestId = `local-model-chat-${activeTask.id}-${activeTask.attemptCount}`;
        activeLocalModelAbortControllerRef.current = localModelAbortController;
        activeLocalModelRequestIdRef.current = localModelRequestId;
        const progressStartedAt = Date.now();
        let hasReceivedFirstChunk = false;
        let firstChunkAfterMs: number | null = null;
        progressIntervalId = window.setInterval(() => {
          startTransition(() => {
            setState((current) => {
              if (!isCurrentTaskAttempt(current, executingTaskId, executingAttemptCount)) {
                return current;
              }

              return createTaskExecutionProgressState(current, {
                taskId: executingTaskId,
                progressSummary: formatLocalModelProgressSummary(Date.now() - progressStartedAt, hasReceivedFirstChunk)
              });
            });
          });
        }, LOCAL_MODEL_PROGRESS_INTERVAL_MS);
        const abortLocalModelRequest = () => {
          if (activeLocalModelAbortControllerRef.current === localModelAbortController) {
            activeLocalModelAbortControllerRef.current = null;
          }
          if (activeLocalModelRequestIdRef.current === localModelRequestId) {
            activeLocalModelRequestIdRef.current = null;
          }

          localModelAbortController.abort();
          void Promise.resolve(cancelOllamaChat(localModelRequestId)).catch(() => undefined);
        };
        const timeoutPromise = new Promise<never>((_, reject) => {
          executionTimeoutId = window.setTimeout(() => {
            abortLocalModelRequest();
            reject(
              new Error(
                `Local task exceeded the maximum execution time of ${formatTimeoutSeconds(localModelChatTimeoutMs)} seconds.`
              )
            );
          }, localModelChatTimeoutMs);
        });

        const executeLocalModelChatWithPreflight = async () => {
          let activeModel = stateRef.current.model.activeModel;
          let availableModels = stateRef.current.model.availableModels;

          if (!resolveUsableOllamaChatModel(activeModel, availableModels)) {
            const overview = await loadOllamaOverview();
            activeModel = overview.selectedModel;
            availableModels = overview.models;
            localModelDiagnosticModel = resolveUsableOllamaChatModel(activeModel, availableModels) || activeModel;

            startTransition(() => {
              setState((current) =>
                isCurrentTaskAttempt(current, executingTaskId, executingAttemptCount)
                  ? mergeOllamaOverview(current, overview)
                  : current
              );
            });
          } else {
            localModelDiagnosticModel = resolveUsableOllamaChatModel(activeModel, availableModels) || activeModel;
          }

          const commonPayload = {
              model: activeModel,
              availableModels,
              message: localModelMessage,
              searchEnabled: stateRef.current.search.enabled,
              searchProviderLabel: stateRef.current.search.providerLabel,
              sources: stateRef.current.sources.items,
              requestId: localModelRequestId,
              signal: localModelAbortController.signal,
              onChunk: (chunk: string) => {
                if (chunk.trim() && !hasReceivedFirstChunk) {
                  hasReceivedFirstChunk = true;
                  firstChunkAfterMs = Date.now() - progressStartedAt;
                }

                startTransition(() => {
                  setState((current) => {
                    if (!isCurrentTaskAttempt(current, executingTaskId, executingAttemptCount)) {
                      return current;
                    }

                    return createTaskExecutionStreamingChunkState(current, {
                      taskId: executingTaskId,
                      chunk
                    });
                  });
                });
              }
            };

          if (activeTask.executionKind === "npc-config-write") {
            return executeNpcConfigWriteTask(commonPayload);
          }

          return executeLocalModelChatTask(commonPayload);
        };

        void Promise.race([
          executeLocalModelChatWithPreflight(),
          timeoutPromise
        ])
          .then((result) => {
            clearExecutionTimeout();
            clearProgressInterval();
            if (activeLocalModelAbortControllerRef.current === localModelAbortController) {
              activeLocalModelAbortControllerRef.current = null;
            }
            if (activeLocalModelRequestIdRef.current === localModelRequestId) {
              activeLocalModelRequestIdRef.current = null;
            }
            const validResult = assertValidAssistantTaskExecutionResult(result, activeTask.executionKind);
            startTransition(() => {
              setState((current) => {
                if (!isCurrentTaskAttempt(current, executingTaskId, executingAttemptCount)) {
                  return current;
                }

                return createTaskExecutionSucceededState(current, validResult);
              });
            });
          })
          .catch((error: unknown) => {
            clearExecutionTimeout();
            clearProgressInterval();
            if (activeLocalModelAbortControllerRef.current === localModelAbortController) {
              activeLocalModelAbortControllerRef.current = null;
            }
            if (activeLocalModelRequestIdRef.current === localModelRequestId) {
              activeLocalModelRequestIdRef.current = null;
            }
            const detail = normalizeUnknownAssistantError(error, "Unknown local model chat error");
            const diagnosticDetail = createLocalModelChatFailureDetail({
              detail,
              model: localModelDiagnosticModel,
              message: localModelMessage,
              executionKind: activeTask.executionKind,
              timeoutMs: localModelChatTimeoutMs,
              elapsedMs: Date.now() - progressStartedAt,
              hasReceivedFirstChunk,
              firstChunkAfterMs
            });
            startTransition(() => {
              setState((current) => {
                if (!isCurrentTaskAttempt(current, executingTaskId, executingAttemptCount)) {
                  return current;
                }

                return createTaskExecutionFailedState(current, {
                  summary: activeTask.executionKind === "npc-config-write" ? "NPC 配置生成失败" : "本地模型对话失败",
                  detail: diagnosticDetail,
                  actionLabel: createLocalTaskFailureActionLabel(diagnosticDetail, activeTask.executionKind),
                  source: "local_model_chat_runner"
                });
              });
            });
          });
        return;
      }

      const executionPlan = {
        kind: activeTask.executionKind,
        title: activeTask.executionTitle ?? "本地助手任务",
        summary: activeTask.summary,
        auditSummary: activeTask.executionAuditSummary ?? "Local assistant planned a task.",
        auditDetail: activeTask.executionAuditDetail ?? activeTask.summary
      } as AssistantTaskPlanResult;
      assistantTaskAbortController = new AbortController();
      const currentAssistantTaskAbortController = assistantTaskAbortController;

      const timeoutPromise = new Promise<never>((_, reject) => {
        executionTimeoutId = window.setTimeout(() => {
          currentAssistantTaskAbortController.abort();
          reject(
            new Error(
              `Local task exceeded the maximum execution time of ${Math.floor(LOCAL_TASK_TIMEOUT_MS / 1000)} seconds.`
            )
          );
        }, LOCAL_TASK_TIMEOUT_MS);
      });

      const executeAssistantTaskWithOptionalExplanation = async () => {
        const result = await executeAssistantTask(executionPlan, {
          snapshotAvailable: stateRef.current.storage.snapshotCount > 0,
          signal: currentAssistantTaskAbortController.signal
        });
        const validResult = assertValidAssistantTaskExecutionResult(result, activeTask.executionKind);

        if (
          !isExplainableReadonlyResultKind(activeTask.executionKind)
          || shouldSkipReadonlyExplanationForRecoveryTask(activeTask)
        ) {
          return validResult;
        }

        try {
          return await explainReadonlyOverviewResultWithLocalModel({
            executionKind: activeTask.executionKind,
            model: stateRef.current.model.activeModel,
            availableModels: stateRef.current.model.availableModels,
            requestMessage: getTaskExecutionMessage(activeTask),
            readonlyTitle: validResult.resultTitle,
            readonlySummary: validResult.resultSummary,
            requestId: `${activeTask.executionKind}-explanation-${activeTask.id}-${activeTask.attemptCount}`,
            signal: currentAssistantTaskAbortController.signal
          });
        } catch (error: unknown) {
          return {
            ...validResult,
            auditDetailLines: [
              ...(validResult.auditDetailLines ?? []),
              `Assistant task result explanation skipped after local model failure: ${normalizeUnknownAssistantError(
                error,
                "Unknown local model explanation error"
              )}`
            ],
            auditOnlyDetailLines: validResult.auditOnlyDetailLines
          };
        }
      };

      void Promise.race([
        executeAssistantTaskWithOptionalExplanation(),
        timeoutPromise
      ])
        .then((result) => {
          clearExecutionTimeout();
          const validResult = assertValidAssistantTaskExecutionResult(result, activeTask.executionKind);
          startTransition(() => {
            setState((current) => {
              if (!isCurrentTaskAttempt(current, executingTaskId, executingAttemptCount)) {
                return current;
              }

              return createTaskExecutionSucceededState(current, validResult);
            });
          });
        })
        .catch((error: unknown) => {
          clearExecutionTimeout();
          const detail = normalizeUnknownAssistantError(error, "Unknown local assistant execution error");
          const isTimeout = detail.includes("maximum execution time");
          const isSelfRepairFailure = isOpencowSelfRepairExecutionKind(activeTask.executionKind) && !isTimeout;
          const failureSummary = isTimeout
            ? "Local task execution timed out"
            : isSelfRepairFailure
              ? "Opencow self-repair stopped after failure analysis"
              : "Local task execution failed";
          const failureActionLabel = isTimeout
            ? "Execution was stopped after the timeout limit. Try a smaller task or retry later."
            : isSelfRepairFailure
              ? createOpencowSelfRepairFailureActionLabel(
                activeTask.executionKind,
                activeTask.executionAuditDetail ?? activeTask.summary
              )
              : createLocalTaskFailureActionLabel(detail, activeTask.executionKind);
          startTransition(() => {
            setState((current) => {
              if (!isCurrentTaskAttempt(current, executingTaskId, executingAttemptCount)) {
                return current;
              }

              return createTaskExecutionFailedState(current, {
                summary: failureSummary,
                detail,
                actionLabel: failureActionLabel,
                source: isTimeout
                  ? "local_task_timeout"
                  : isSelfRepairFailure
                    ? "opencow_self_repair_failure_analysis"
                    : "local_task_runner"
              });
            });
          });
        });
    }, 120);

    return () => {
      window.clearTimeout(finishTimer);
      clearExecutionTimeout();
      clearProgressInterval();
      assistantTaskAbortController?.abort();
    };
  }, [activeTaskExecutionDependency]);

  function parseCapabilityToggleIntent(message: string, currentState: WorkbenchState) {
    const normalized = message.trim();
    const wantsNaturalNetworkSearch =
      /\u8054\u7f51\u641c\u7d22.*(\u4e00\u4e0b|\u6700\u65b0|\u8d44\u6599|\u67e5|\u641c)/.test(normalized)
      || /\u7f51\u4e0a\u641c/.test(normalized)
      || /\u641c\u4e00\u4e0b\u6700\u65b0/.test(normalized)
      || /\u6700\u65b0\u8d44\u6599/.test(normalized)
      || /\bweb search\b/i.test(normalized)
      || /\binternet search\b/i.test(normalized)
      || /\bsearch (the )?web\b/i.test(normalized)
      || (/\blatest\b/i.test(normalized) && /\b(search|find|lookup)\b/i.test(normalized));

    if (!currentState.search.enabled && wantsNaturalNetworkSearch) {
      return {
        feature: "search" as const,
        enabled: true,
        source: "conversation_request",
        reason: "\u7528\u6237\u8bf7\u6c42\u8054\u7f51\u641c\u7d22\u6700\u65b0\u8d44\u6599\uff0c\u9700\u8981\u5148\u786e\u8ba4\u542f\u7528\u8054\u7f51\u641c\u7d22\u3002",
        providerLabel: currentState.search.providerLabel,
        queuedMessage: normalized
      };
    }

    if (normalized.includes("开启联网搜索") || normalized.includes("打开联网搜索")) {
      return {
        feature: "search" as const,
        enabled: true,
        source: "conversation_request",
        reason: "用户请求开启联网搜索以补充最新来源。",
        providerLabel: currentState.search.providerLabel
      };
    }

    if (normalized.includes("关闭联网搜索")) {
      return {
        feature: "search" as const,
        enabled: false,
        source: "conversation_request",
        reason: "用户请求关闭联网搜索并保持本地优先。"
      };
    }

    if (normalized.includes("开启远程API") || normalized.includes("开启远程 API") || normalized.includes("打开远程 API")) {
      return {
        feature: "remote-api" as const,
        enabled: true,
        source: "conversation_request",
        reason: "用户请求开启远程 API 作为高级配置入口。"
      };
    }

    if (normalized.includes("关闭远程API") || normalized.includes("关闭远程 API")) {
      return {
        feature: "remote-api" as const,
        enabled: false,
        source: "conversation_request",
        reason: "用户请求关闭远程 API 并保持本地 Ollama 优先。"
      };
    }

    return null;
  }

  function handleApproveDangerousAction() {
    startTransition(() => {
      setState((current) => {
        const pendingConfirmation = current.confirmation.pending;
        const approvedState = approvePendingConfirmationState(current);

        if (!pendingConfirmation?.queuedMessage) {
          return approvedState;
        }

        if (approvedState.error?.source === "search_provider_config_missing") {
          return approvedState;
        }

        if (!pendingConfirmation.queuedExecutionKind) {
          let continuedPlan: AssistantTaskPlanResult;

          try {
            continuedPlan = assertValidAssistantTaskPlanResult(
              planAssistantTask(pendingConfirmation.queuedMessage, approvedState.permission.mode)
            );
          } catch (error: unknown) {
            return createAssistantPlanningFailedStateFromError(approvedState, pendingConfirmation.queuedMessage, error);
          }

          if (continuedPlan.kind === "permission-request") {
            return requestPermissionModeChangeState(approvedState, {
              targetMode: continuedPlan.targetMode,
              reason: continuedPlan.reason,
              riskSummary: continuedPlan.riskSummary,
              queuedExecutionKind: continuedPlan.queuedExecutionKind,
              queuedExecutionTitle: continuedPlan.queuedExecutionTitle,
              queuedExecutionAuditSummary: continuedPlan.queuedExecutionAuditSummary,
              queuedExecutionAuditDetail: continuedPlan.queuedExecutionAuditDetail,
              queuedMessage: continuedPlan.queuedMessage
            });
          }

          if (continuedPlan.kind === "confirmation") {
            if (isRepeatedApprovedDangerousConfirmation(pendingConfirmation, continuedPlan)) {
              return createCommandPolicyBlockedState(approvedState, {
                summary: "Dangerous confirmation loop stopped",
                detail: `Dangerous confirmation chain stopped because the planner requested the same dangerous confirmation again after approval. Queued request: ${pendingConfirmation.queuedMessage}. Review planner routing, rewrite the request, or restart from a readonly preview before approving again.`,
                actionLabel: "Review the planner route, rewrite the request, or restart from a readonly preview before approving again.",
                source: "dangerous_confirmation_loop_guard"
              });
            }

            return createHighRiskConfirmationState(approvedState, {
              title: continuedPlan.title,
              summary: continuedPlan.summary,
              commandPreview: continuedPlan.commandPreview,
              impact: continuedPlan.impact,
              requiredMode: continuedPlan.requiredMode,
              safetySummary: continuedPlan.safetySummary,
              queuedExecutionKind: continuedPlan.queuedExecutionKind,
              queuedExecutionTitle: continuedPlan.queuedExecutionTitle,
              queuedExecutionAuditSummary: continuedPlan.queuedExecutionAuditSummary,
              queuedExecutionAuditDetail: continuedPlan.queuedExecutionAuditDetail,
              queuedMessage: continuedPlan.queuedMessage
            });
          }

          if (!isExecutionKindAllowedForPermission(continuedPlan.kind, pendingConfirmation.requiredMode)) {
            return createCommandPolicyBlockedState(approvedState, {
              summary: "Dangerous confirmation execution scope mismatch stopped",
              detail:
                `Dangerous confirmation chain stopped because the planner returned ${continuedPlan.kind} behind ${pendingConfirmation.requiredMode} confirmation. ` +
                `Queued request: ${pendingConfirmation.queuedMessage}. Restart from a readonly preview or ask again so opencow can request the correct permission and confirmation before execution.`,
              actionLabel:
                "Restart from a readonly preview or ask again so opencow can request the correct permission and confirmation before execution.",
              source: "dangerous_confirmation_execution_scope_guard"
            });
          }

          return createTaskExecutionStartedState(
            createUserTaskSubmittedState(approvedState, {
              message: pendingConfirmation.queuedMessage,
              executionKind: continuedPlan.kind,
              executionTitle: continuedPlan.title,
              executionAuditSummary: continuedPlan.auditSummary,
              executionAuditDetail: continuedPlan.auditDetail,
              allowResumeFromFailedTask: true,
              preserveExistingUserMessage: true
            })
          );
        }

        if (!isExecutionKindAllowedForPermission(pendingConfirmation.queuedExecutionKind, pendingConfirmation.requiredMode)) {
          return createCommandPolicyBlockedState(approvedState, {
            summary: "Dangerous confirmation execution scope mismatch stopped",
            detail:
              `Dangerous confirmation chain stopped because the planner queued ${pendingConfirmation.queuedExecutionKind} behind ${pendingConfirmation.requiredMode} confirmation. ` +
              `Queued request: ${pendingConfirmation.queuedMessage}. Restart from a readonly preview or ask again so opencow can request the correct permission and confirmation before execution.`,
            actionLabel:
              "Restart from a readonly preview or ask again so opencow can request the correct permission and confirmation before execution.",
            source: "dangerous_confirmation_execution_scope_guard"
          });
        }

        return createTaskExecutionStartedState(
          createUserTaskSubmittedState(approvedState, {
            message: pendingConfirmation.queuedMessage,
            executionKind: pendingConfirmation.queuedExecutionKind,
            executionTitle: pendingConfirmation.queuedExecutionTitle,
            executionAuditSummary: pendingConfirmation.queuedExecutionAuditSummary,
            executionAuditDetail: pendingConfirmation.queuedExecutionAuditDetail,
            allowResumeFromFailedTask: true,
            preserveExistingUserMessage: true
          })
        );
      });
    });
  }

  function handleCancelDangerousAction() {
    startTransition(() => {
      setState((current) => cancelPendingConfirmationState(current));
    });
  }

  function handleApprovePermissionRequest() {
    startTransition(() => {
      setState((current) => {
        const pendingModeChange = current.permission.pendingModeChange;
        const approvedState = approvePermissionModeChangeState(current);

        if (!pendingModeChange?.queuedMessage) {
          return approvedState;
        }

        if (pendingModeChange.queuedExecutionKind && pendingModeChange.targetMode !== "controlled-full") {
          if (!isExecutionKindAllowedForPermission(pendingModeChange.queuedExecutionKind, pendingModeChange.targetMode)) {
            return createCommandPolicyBlockedState(approvedState, {
              summary: "Permission execution scope mismatch stopped",
              detail:
                `Permission chain stopped because the planner queued ${pendingModeChange.queuedExecutionKind} after ${pendingModeChange.targetMode} approval. ` +
                `Queued request: ${pendingModeChange.queuedMessage}. Restart from a readonly preview or ask again so opencow can request the correct permission and confirmation before execution.`,
              actionLabel:
                "Restart from a readonly preview or ask again so opencow can request the correct permission and confirmation before execution.",
              source: "permission_execution_scope_guard"
            });
          }

          return createTaskExecutionStartedState(
            createUserTaskSubmittedState(approvedState, {
              message: pendingModeChange.queuedMessage,
              executionKind: pendingModeChange.queuedExecutionKind,
              executionTitle: pendingModeChange.queuedExecutionTitle,
              executionAuditSummary: pendingModeChange.queuedExecutionAuditSummary,
              executionAuditDetail: pendingModeChange.queuedExecutionAuditDetail,
              allowResumeFromFailedTask: true,
              preserveExistingUserMessage: true
            })
          );
        }

        let continuedPlan: AssistantTaskPlanResult;

        try {
          continuedPlan = assertValidAssistantTaskPlanResult(
            planAssistantTask(pendingModeChange.queuedMessage, approvedState.permission.mode)
          );
        } catch (error: unknown) {
          return createAssistantPlanningFailedStateFromError(approvedState, pendingModeChange.queuedMessage, error);
        }

        if (continuedPlan.kind === "permission-request") {
          if (isRepeatedApprovedPermissionRequest(continuedPlan.targetMode, approvedState.permission.mode)) {
            return createCommandPolicyBlockedState(approvedState, {
              summary: "Permission escalation loop stopped",
              detail: `Permission chain stopped because the planner requested ${continuedPlan.targetMode} again after ${approvedState.permission.mode} was already approved. Queued request: ${pendingModeChange.queuedMessage}. Review planner routing or rewrite the request before retrying.`,
              actionLabel: "Review the planner route, rewrite the request, or restart from a readonly preview before retrying.",
              source: "permission_escalation_loop_guard"
            });
          }

          return requestPermissionModeChangeState(approvedState, {
            targetMode: continuedPlan.targetMode,
            reason: continuedPlan.reason,
            riskSummary: continuedPlan.riskSummary,
            queuedExecutionKind: continuedPlan.queuedExecutionKind,
            queuedExecutionTitle: continuedPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: continuedPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: continuedPlan.queuedExecutionAuditDetail,
            queuedMessage: continuedPlan.queuedMessage
          });
        }

        if (continuedPlan.kind === "confirmation") {
          return createHighRiskConfirmationState(approvedState, {
            title: continuedPlan.title,
            summary: continuedPlan.summary,
            commandPreview: continuedPlan.commandPreview,
            impact: continuedPlan.impact,
            requiredMode: continuedPlan.requiredMode,
            safetySummary: continuedPlan.safetySummary,
            queuedExecutionKind: continuedPlan.queuedExecutionKind,
            queuedExecutionTitle: continuedPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: continuedPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: continuedPlan.queuedExecutionAuditDetail,
            queuedMessage: continuedPlan.queuedMessage
          });
        }

        if (pendingModeChange.targetMode === "controlled-full") {
          return createCommandPolicyBlockedState(approvedState, {
            summary: "Dangerous confirmation required after controlled-full approval",
            detail:
              `Controlled-full chain stopped because the planner returned ${continuedPlan.kind} instead of a dangerous confirmation after permission approval. ` +
              `Queued request: ${pendingModeChange.queuedMessage}. Restart from a readonly preview or ask again so opencow can show the dangerous confirmation before execution.`,
            actionLabel:
              "Restart from a readonly preview or ask again so opencow can show the dangerous confirmation before execution.",
            source: "controlled_full_confirmation_required_guard"
          });
        }

        return createTaskExecutionStartedState(
          createUserTaskSubmittedState(approvedState, {
            message: pendingModeChange.queuedMessage,
            executionKind: continuedPlan.kind,
            executionTitle: continuedPlan.title,
            executionAuditSummary: continuedPlan.auditSummary,
            executionAuditDetail: continuedPlan.auditDetail,
            allowResumeFromFailedTask: true,
            preserveExistingUserMessage: true
          })
        );
      });
    });
  }

  function handleCancelPermissionRequest() {
    startTransition(() => {
      setState((current) => cancelPermissionModeChangeState(current));
    });
  }

  function handleRetryOllamaCheck() {
    void loadOllamaOverview()
      .then((overview) => {
        startTransition(() => {
          setState((current) => mergeOllamaOverview(current, overview));
        });
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown ollama load error";

        startTransition(() => {
          setState((current) => createOllamaLoadErrorState(current, detail));
        });
      });
  }

  function handleRecoverToolError() {
    startTransition(() => {
      setState((current) => createToolExecutionRecoveredState(current));
    });
  }

  function handlePreviewRollback(targetEntryId: string) {
    startTransition(() => {
      setState((current) => requestRollbackPreviewState(current, targetEntryId));
    });
  }

  function handleApplyRollback() {
    startTransition(() => {
      setState((current) => applyPendingRollbackState(current));
    });
  }

  function handleCancelRollback() {
    startTransition(() => {
      setState((current) => cancelPendingRollbackState(current));
    });
  }

  function handleRetryLocalTask(taskId?: string) {
    const retryLocalTaskAfterOllamaSelfCheck = () => {
      void loadOllamaOverview()
        .then((overview) => {
          startTransition(() => {
            setState((current) => {
              const checkedState = mergeOllamaOverview(current, overview);

              return hasUsableOllamaOverviewForRetry(overview)
                ? createTaskExecutionRetriedState(checkedState, taskId)
                : checkedState;
            });
          });
        })
        .catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : "Unknown ollama load error";

          startTransition(() => {
            setState((current) => createOllamaLoadErrorState(current, detail));
          });
        });
    };
    const failedTaskSnapshot = state.tasks.items.find((item) =>
      taskId ? item.id === taskId && item.status === "failed" : item.status === "failed"
    );

    if (failedTaskSnapshot?.executionKind === "local-model-chat") {
      const npcReadonlyDraftRetryMessage = getNpcConfigReadonlyDraftRetryMessage(failedTaskSnapshot);

      if (npcReadonlyDraftRetryMessage) {
        startTransition(() => {
          setState((current) => createNpcReadonlyDraftRecoveryState(
            current,
            taskId,
            npcReadonlyDraftRetryMessage
          ));
        });
        return;
      }

      if (isLocalModelContextOverflowFailure(failedTaskSnapshot)) {
        startTransition(() => {
          setState((current) => {
            const failedTask = current.tasks.items.find((item) =>
              taskId ? item.id === taskId && item.status === "failed" : item.status === "failed"
            );

            return isLocalModelContextOverflowFailure(failedTask)
              ? createLocalModelContextOverflowRagRetryState(current, failedTask)
              : current;
          });
        });
        return;
      }

      retryLocalTaskAfterOllamaSelfCheck();
      return;
    }

    startTransition(() => {
      setState((current) => {
        const failedTask = current.tasks.items.find((item) =>
          taskId ? item.id === taskId && item.status === "failed" : item.status === "failed"
        );
        const ragSelfCheckMessage = getRagSelfCheckRetryMessage(failedTask);
        const selfCheckMessage = ragSelfCheckMessage ?? getShellSelfCheckRetryMessage(failedTask);

        if (!selfCheckMessage) {
          const npcReadonlyDraftRetryMessage = getNpcConfigReadonlyDraftRetryMessage(failedTask);

          if (npcReadonlyDraftRetryMessage) {
            return createNpcReadonlyDraftRecoveryState(current, taskId, npcReadonlyDraftRetryMessage);
          }

          return createTaskExecutionRetriedState(current, taskId);
        }

        try {
          const assistantPlan = assertValidAssistantTaskPlanResult(
            planAssistantTask(selfCheckMessage, "readonly")
          );

          if (assistantPlan.kind === "permission-request" || assistantPlan.kind === "confirmation") {
            return createAssistantPlanningFailedState(current, {
              message: selfCheckMessage,
              detail: ragSelfCheckMessage
                ? "RAG retry self-check must stay readonly. Planner returned a gated action instead of a readonly capability overview, so the original RAG query was not retried."
                : "Shell retry self-check must stay readonly. Planner returned a gated action instead of a readonly diagnostic task, so the original command was not retried.",
              actionLabel: ragSelfCheckMessage
                ? "Review RAG self-check routing before retrying the failed document query."
                : "Review shell self-check routing before retrying the failed write or destructive command.",
              source: "local_task_retry_self_check_planner"
            });
          }

          if (ragSelfCheckMessage && !isReadonlyRagSelfCheckPlan(assistantPlan)) {
            return createAssistantPlanningFailedState(current, {
              message: selfCheckMessage,
              detail:
                `RAG retry self-check must return capability-rag-overview. Planner returned ${assistantPlan.kind}, so the original RAG query was not retried.`,
              actionLabel: "Review RAG self-check routing before retrying the failed document query.",
              source: "local_task_retry_self_check_planner"
            });
          }

          if (ragSelfCheckMessage) {
            return createUserTaskSubmittedState(current, {
              message: selfCheckMessage,
              executionKind: assistantPlan.kind,
              executionTitle: assistantPlan.title,
              executionAuditSummary: assistantPlan.auditSummary,
              executionAuditDetail: assistantPlan.auditDetail
            });
          }

          if (!isReadonlyShellDiagnosticPlan(assistantPlan)) {
            return createAssistantPlanningFailedState(current, {
              message: selfCheckMessage,
              detail:
                `Shell retry self-check must return a readonly shell diagnostic task. Planner returned ${assistantPlan.kind}, so the original command was not retried.`,
              actionLabel:
                "Review shell self-check routing before retrying the failed write or destructive command.",
              source: "local_task_retry_self_check_planner"
            });
          }

          return createUserTaskSubmittedState(current, {
            message: selfCheckMessage,
            executionKind: assistantPlan.kind,
            executionTitle: assistantPlan.title,
            executionAuditSummary: assistantPlan.auditSummary,
            executionAuditDetail: assistantPlan.auditDetail
          });
        } catch (error: unknown) {
          return createAssistantPlanningFailedStateFromError(
            current,
            selfCheckMessage,
            error,
            "local_task_retry_self_check_planner"
          );
        }
      });
    });
  }

  function handleCancelActiveTask() {
    cancelActiveLocalModelRequest();
    startTransition(() => {
      setState((current) => createTaskExecutionCancelledState(current));
    });
  }

  function handleUpdateRollbackLimit(limit: number) {
    startTransition(() => {
      setState((current) => createRollbackLimitUpdatedState(current, limit));
    });
  }

  function handleCleanupStorage(target: "conversation" | "logs" | "cache" | "snapshots" | "knowledge") {
    startTransition(() => {
      setState((current) => {
        const nextState = createStorageCleanupState(current, target);

        if (target === "conversation") {
          void clearPersistedWorkbenchState();
        }

        return nextState;
      });
    });
  }

  function handleToggleRemoteApi(enabled: boolean) {
    startTransition(() => {
      setState((current) => createRemoteApiToggleState(current, enabled));
    });
  }

  function handleToggleSearch(enabled: boolean) {
    startTransition(() => {
      setState((current) =>
        createSearchToggleState(current, {
          enabled,
          providerLabel: current.search.providerLabel
        })
      );
    });
  }

  function handleSaveRemoteApiConfig(payload: { baseUrl: string; providerLabel: string; apiKey: string }) {
    startTransition(() => {
      setState((current) => createRemoteApiConfigState(current, payload));
    });
  }

  function handleSaveSearchProviderConfig(payload: { providerLabel: string }) {
    startTransition(() => {
      setState((current) => createSearchProviderConfigState(current, payload));
    });
  }

  function handleSelectModel(modelName: string) {
    startTransition(() => {
      setState((current) => createModelSelectedState(current, modelName));
    });
  }

  function handleNewConversation() {
    cancelActiveLocalModelRequest();
    startTransition(() => {
      setState((current) => {
        const nextState = createNewConversationState(createTaskExecutionCancelledState(current));

        return nextState;
      });
    });
  }

  function handleSubmitTask(message: string) {
    startTransition(() => {
      setState((current) => {
        if (shouldStopTerminalPreviewContinuation(message, current)) {
          return createStoppedTerminalPreviewContinuationState(current);
        }

        const resolvedMessage = resolveContinuationMessage(message, current);
        const capabilityIntent = parseCapabilityToggleIntent(resolvedMessage, current);

        if (isDuplicatePlanningFailureMessage(resolvedMessage, current)) {
          return createDuplicatePlanningFailureSkippedState(current, {
            message: resolvedMessage
          });
        }

        if (isDuplicatePendingPermissionMessage(resolvedMessage, current)) {
          return createDuplicatePendingApprovalSkippedState(current, {
            approvalType: "permission",
            message: resolvedMessage
          });
        }

        if (isDuplicatePendingConfirmationMessage(resolvedMessage, current)) {
          return createDuplicatePendingApprovalSkippedState(current, {
            approvalType: "dangerous-confirmation",
            message: resolvedMessage
          });
        }

        if (capabilityIntent) {
          const pendingConfirmation = current.confirmation.pending;

          if (
            pendingConfirmation?.requestedFeature === capabilityIntent.feature
            && pendingConfirmation.requestedEnabled === capabilityIntent.enabled
            && pendingConfirmation.summary === capabilityIntent.reason
            && pendingConfirmation.providerLabel === capabilityIntent.providerLabel
            && pendingConfirmation.queuedMessage === capabilityIntent.queuedMessage
          ) {
            return createDuplicatePendingApprovalSkippedState(current, {
              approvalType: "capability",
              message: resolvedMessage
            });
          }

          return createCapabilityToggleRequestState(current, capabilityIntent);
        }

        let assistantPlan: AssistantTaskPlanResult;

        try {
          assistantPlan = assertValidAssistantTaskPlanResult(
            planAssistantTask(resolvedMessage, current.permission.mode)
          );
        } catch (error: unknown) {
          return createAssistantPlanningFailedStateFromError(current, resolvedMessage, error);
        }

        if (assistantPlan.kind === "permission-request") {
          return requestPermissionModeChangeState(current, {
            targetMode: assistantPlan.targetMode,
            reason: assistantPlan.reason,
            riskSummary: assistantPlan.riskSummary,
            queuedExecutionKind: assistantPlan.queuedExecutionKind,
            queuedExecutionTitle: assistantPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: assistantPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: assistantPlan.queuedExecutionAuditDetail,
            queuedMessage: assistantPlan.queuedMessage
          });
        }

        if (assistantPlan.kind === "confirmation") {
          return createHighRiskConfirmationState(current, {
            title: assistantPlan.title,
            summary: assistantPlan.summary,
            commandPreview: assistantPlan.commandPreview,
            impact: assistantPlan.impact,
            requiredMode: assistantPlan.requiredMode,
            safetySummary: assistantPlan.safetySummary,
            queuedExecutionKind: assistantPlan.queuedExecutionKind,
            queuedExecutionTitle: assistantPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: assistantPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: assistantPlan.queuedExecutionAuditDetail,
            queuedMessage: assistantPlan.queuedMessage
          });
        }

        return createUserTaskSubmittedState(current, {
          message: message,
          executionMessage: resolvedMessage === message ? undefined : resolvedMessage,
          executionKind: assistantPlan.kind,
          executionTitle: assistantPlan.title,
          executionAuditSummary: assistantPlan.auditSummary,
          executionAuditDetail: assistantPlan.auditDetail,
          continuationMessage:
            assistantPlan.kind === "opencow-self-repair-preview"
              ? resolvedMessage.replace(/\bpreview(ing)?\b/gi, "continue").trim()
              : undefined
        });
      });
    });
  }

  return (
    <Workbench
      state={state}
      onApproveDangerousAction={handleApproveDangerousAction}
      onCancelDangerousAction={handleCancelDangerousAction}
      onApprovePermissionRequest={handleApprovePermissionRequest}
      onCancelPermissionRequest={handleCancelPermissionRequest}
      onRetryOllamaCheck={handleRetryOllamaCheck}
      onRecoverToolError={handleRecoverToolError}
      onPreviewRollback={handlePreviewRollback}
      onApplyRollback={handleApplyRollback}
      onCancelRollback={handleCancelRollback}
      onRetryLocalTask={handleRetryLocalTask}
      onCancelActiveTask={handleCancelActiveTask}
      onUpdateRollbackLimit={handleUpdateRollbackLimit}
      onCleanupStorage={handleCleanupStorage}
      onToggleRemoteApi={handleToggleRemoteApi}
      onToggleSearch={handleToggleSearch}
      onSaveRemoteApiConfig={handleSaveRemoteApiConfig}
      onSaveSearchProviderConfig={handleSaveSearchProviderConfig}
      onSelectModel={handleSelectModel}
      onNewConversation={handleNewConversation}
      onSubmitTask={handleSubmitTask}
    />
  );
}
