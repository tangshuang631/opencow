import { planLocalAssistantTask, resolveOpencowSelfRepairTargetDescriptor } from "@opencow/openclaw-adapter/browser";
import { createPermissionEscalationRequest } from "@opencow/permission-engine";
import { guardExecutionPlan } from "@opencow/safety-engine";
import { planControlledCommand } from "@opencow/shell-runtime";
import type { LocalTaskExecutionKind, PermissionMode } from "../workbench/workbenchState";
import { getShellDialogRecoveryNarrative } from "../workbench/shellCapability";
import {
  disableLocalSkill,
  installLocalSkill,
  enableLocalSkill,
  listEnabledLocalSkills,
  matchEnabledLocalSkills,
  loadOpenClawCapabilityOverview,
  scanLocalMcpPlugins,
  inspectLocalMcpPlugin,
  previewLocalMcpPluginStart,
  startLocalMcpPlugin,
  inspectLocalSkill,
  scanLocalSkills,
  searchLocalKnowledge,
  loadWorkspaceConfigOverview,
  loadWorkspaceOverview,
  loadWorkspacePackagesOverview,
  loadWorkspaceProjectRunPreview,
  getWorkspaceProjectStatus,
  runWorkspaceProject,
  captureNpcLocalProjectScreenshot,
  writeNpcLocalProjectShowcaseSite,
  loadNpcLocalProjectShowcasePublishPreview,
  loadNpcLocalProjectShowcaseGitConfirmationPreview,
  stopWorkspaceProject,
  runControlledFullShellCommand,
  runReadonlyShellCommand,
  runWorkspaceWriteShellCommand,
  repairOpencowEnabledSkillsRegistry,
  repairOpencowWorkspaceProjectRuntimeRegistry
} from "./localAssistantService";

type ReadonlyAssistantTaskPlan =
  | {
      kind: "local-model-chat";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "workspace-overview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "packages-overview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "workspace-config-overview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "opencow-self-repair-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "opencow-self-repair-target-guidance";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "opencow-self-repair-enabled-skills-registry";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "opencow-self-repair-workspace-project-runtime-registry";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "capability-rag-overview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "capability-skills-overview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-scan";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-inspect";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-install";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enable";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-disable";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-list";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-match";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-shell-create-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-shell-remove-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-enabled-shell-create-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-enabled-shell-remove-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-enabled-rag-shell-create-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-enabled-rag-shell-remove-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-rag-doc-search";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "rag-local-shell-handoff-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-rag-shell-handoff-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-enabled-rag-shell-handoff-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-rag-shell-create-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "skills-local-enabled-rag-shell-remove-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "rag-local-shell-create-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "rag-local-shell-remove-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-collaboration-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-project-showcase-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-project-run";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-project-screenshot-capture";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-project-showcase-site-write";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-project-showcase-publish-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-project-showcase-git-confirmation-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-local-shell-plan-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "npc-config-write";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "capability-npc-overview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "capability-mcp-overview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "mcp-local-plugin-scan";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "mcp-local-plugin-inspect";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "mcp-local-plugin-start-preview";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "mcp-local-plugin-start";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "rag-local-doc-search";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "network-search-guidance";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "readonly-shell-git-status";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "readonly-shell-workspace-root";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "readonly-shell-packages-dir";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "workspace-write-create-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "workspace-project-run";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "workspace-project-status";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "workspace-project-stop";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  | {
      kind: "controlled-full-remove-temp-output";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    };

export type AssistantTaskPlanResult =
  | ReadonlyAssistantTaskPlan
  | {
      kind: "permission-request";
      targetMode: PermissionMode;
      reason: string;
      riskSummary: string;
      auditSummary: string;
      auditDetail: string;
      queuedExecutionKind?: LocalTaskExecutionKind;
      queuedExecutionTitle?: string;
      queuedExecutionAuditSummary?: string;
      queuedExecutionAuditDetail?: string;
      queuedMessage?: string;
    }
  | {
      kind: "confirmation";
      title: string;
      summary: string;
      commandPreview: string;
      impact: string;
      requiredMode: PermissionMode;
      safetySummary: string;
      auditSummary: string;
      auditDetail: string;
      queuedExecutionKind?: LocalTaskExecutionKind;
      queuedExecutionTitle?: string;
      queuedExecutionAuditSummary?: string;
      queuedExecutionAuditDetail?: string;
      queuedMessage?: string;
    };

export type AssistantTaskExecutionResult = {
  resultTitle: string;
  resultSummary: string;
  auditDetailLines?: string[];
  auditOnlyDetailLines?: string[];
};

export type AssistantTaskExecutionContext = {
  snapshotAvailable?: boolean;
  signal?: AbortSignal;
};

function throwIfExecutionAborted(context: AssistantTaskExecutionContext): void {
  if (context.signal?.aborted) {
    throw new Error("Assistant task execution aborted.");
  }
}

async function awaitAbortable<T>(
  promise: Promise<T>,
  context: AssistantTaskExecutionContext
): Promise<T> {
  throwIfExecutionAborted(context);

  if (!context.signal) {
    return promise;
  }

  const signal = context.signal;

  return new Promise<T>((resolve, reject) => {
    const abortHandler = () => {
      signal.removeEventListener("abort", abortHandler);
      reject(new Error("Assistant task execution aborted."));
    };

    signal.addEventListener("abort", abortHandler, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener("abort", abortHandler);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abortHandler);
        reject(error);
      }
    );
  });
}

export function planAssistantTask(message: string, permissionMode: PermissionMode): AssistantTaskPlanResult {
  return planLocalAssistantTask({
    message,
    permissionMode
  });
}

export async function executeAssistantTask(
  plan: AssistantTaskPlanResult,
  context: AssistantTaskExecutionContext = {}
): Promise<AssistantTaskExecutionResult> {
  throwIfExecutionAborted(context);

  if (plan.kind === "workspace-overview") {
    const overview = await awaitAbortable(loadWorkspaceOverview(), context);
    const highlightedPackages = overview.package_names.slice(0, 5).join(", ");
    const packageLine =
      overview.package_count > 0
        ? ` Detected ${overview.package_count} local packages, including ${highlightedPackages}.`
        : " No local packages were detected.";

    return {
      resultTitle: "Workspace overview",
      resultSummary: `${overview.summary}${packageLine}`
    };
  }

  if (plan.kind === "packages-overview") {
    const overview = await awaitAbortable(loadWorkspacePackagesOverview(), context);
    const highlightedPackages = overview.package_names.slice(0, 5).join(", ");
    const highlightedScriptPackages = overview.packages_with_scripts.slice(0, 5).join(", ");
    const scriptCoverageLine =
      overview.packages_with_scripts.length > 0
        ? ` Script coverage includes ${highlightedScriptPackages}.`
        : " No workspace package scripts were detected.";

    return {
      resultTitle: "Workspace packages overview",
      resultSummary: `${overview.summary} Key packages: ${highlightedPackages}.${scriptCoverageLine}`
    };
  }

  if (plan.kind === "workspace-config-overview") {
    const overview = await awaitAbortable(loadWorkspaceConfigOverview(), context);
    const highlightedConfigs = overview.config_files.slice(0, 5).join(", ");
    const highlightedScripts = overview.root_script_names.slice(0, 5).join(", ");

    return {
      resultTitle: "Workspace config overview",
      resultSummary: `${overview.summary} Key config files: ${highlightedConfigs}. Root scripts: ${highlightedScripts}.`
    };
  }

  if (plan.kind === "opencow-self-repair-preview") {
    return executeOpencowSelfRepairPreviewPlan(plan.title, deriveTaskQuery(plan), context);
  }

  if (plan.kind === "opencow-self-repair-target-guidance") {
    return executeOpencowSelfRepairTargetGuidancePlan(plan.title, context);
  }

  if (plan.kind === "opencow-self-repair-enabled-skills-registry") {
    return executeOpencowEnabledSkillsRegistryRepairPlan(plan.title, deriveTaskQuery(plan), context);
  }

  if (plan.kind === "opencow-self-repair-workspace-project-runtime-registry") {
    return executeOpencowWorkspaceProjectRuntimeRegistryRepairPlan(plan.title, deriveTaskQuery(plan), context);
  }

  if (plan.kind === "capability-rag-overview") {
    return executeCapabilityOverviewPlan("rag", context);
  }

  if (plan.kind === "capability-skills-overview") {
    return executeCapabilityOverviewPlan("skills", context);
  }

  if (plan.kind === "skills-local-scan") {
    return executeLocalSkillsScanPlan(plan.title, context);
  }

  if (plan.kind === "skills-local-inspect") {
    return executeLocalSkillInspectPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-install") {
    return executeLocalSkillInstallPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enable") {
    return executeLocalSkillEnablePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-disable") {
    return executeLocalSkillDisablePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enabled-list") {
    return executeEnabledLocalSkillsListPlan(plan.title, context);
  }

  if (plan.kind === "skills-local-enabled-match") {
    return executeEnabledLocalSkillsMatchPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enabled-shell-create-temp-output") {
    return executeSkillAssistedWorkspaceWritePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enabled-shell-remove-temp-output") {
    return executeSkillAssistedControlledFullPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-enabled-shell-create-temp-output") {
    return executeNpcAssistedWorkspaceWritePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-enabled-shell-remove-temp-output") {
    return executeNpcAssistedControlledFullPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-enabled-rag-shell-create-temp-output") {
    return executeNpcAssistedRagShellCreatePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-enabled-rag-shell-remove-temp-output") {
    return executeNpcAssistedRagShellRemovePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enabled-rag-doc-search") {
    return executeSkillAssistedLocalRagSearchPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "rag-local-shell-handoff-preview") {
    return executeLocalRagShellHandoffPreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enabled-rag-shell-handoff-preview") {
    return executeSkillAssistedRagShellHandoffPreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-enabled-rag-shell-handoff-preview") {
    return executeNpcAssistedRagShellHandoffPreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "rag-local-shell-create-temp-output") {
    return executeLocalRagShellCreatePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "rag-local-shell-remove-temp-output") {
    return executeLocalRagShellRemovePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enabled-rag-shell-create-temp-output") {
    return executeSkillAssistedRagShellCreatePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "skills-local-enabled-rag-shell-remove-temp-output") {
    return executeSkillAssistedRagShellRemovePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-collaboration-preview") {
    return executeNpcCollaborationPreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-project-showcase-preview") {
    return executeNpcProjectShowcasePreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-project-run") {
    return executeNpcLocalProjectRunPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-project-screenshot-capture") {
    return executeNpcLocalProjectScreenshotCapturePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-project-showcase-site-write") {
    return executeNpcLocalProjectShowcaseSiteWritePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-project-showcase-publish-preview") {
    return executeNpcLocalProjectShowcasePublishPreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-project-showcase-git-confirmation-preview") {
    return executeNpcLocalProjectShowcaseGitConfirmationPreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "npc-local-shell-plan-preview") {
    return executeNpcShellPlanPreview(plan.title, plan.summary, context);
  }

  if (plan.kind === "capability-npc-overview") {
    return executeCapabilityOverviewPlan("npc", context);
  }

  if (plan.kind === "capability-mcp-overview") {
    return executeCapabilityOverviewPlan("mcp", context);
  }

  if (plan.kind === "mcp-local-plugin-scan") {
    return executeLocalMcpPluginScanPlan(plan.title, context);
  }

  if (plan.kind === "mcp-local-plugin-inspect") {
    return executeLocalMcpPluginInspectPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "mcp-local-plugin-start-preview") {
    return executeLocalMcpPluginStartPreviewPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "mcp-local-plugin-start") {
    return executeLocalMcpPluginStartPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "rag-local-doc-search") {
    return executeLocalRagSearchPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "network-search-guidance") {
    return executeNetworkSearchGuidancePlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "readonly-shell-git-status") {
    return executeReadonlyShellPlan(plan.title, "git-status", context);
  }

  if (plan.kind === "readonly-shell-workspace-root") {
    return executeReadonlyShellPlan(plan.title, "workspace-root-list", context);
  }

  if (plan.kind === "readonly-shell-packages-dir") {
    return executeReadonlyShellPlan(plan.title, "packages-dir-list", context);
  }

  if (plan.kind === "workspace-write-create-temp-output") {
    return executeWorkspaceWriteShellPlan(plan.title, "create-temp-output-dir", context);
  }

  if (plan.kind === "workspace-project-run") {
    return executeWorkspaceProjectRunPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "workspace-project-status") {
    return executeWorkspaceProjectStatusPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "workspace-project-stop") {
    return executeWorkspaceProjectStopPlan(plan.title, plan.summary, context);
  }

  if (plan.kind === "controlled-full-remove-temp-output") {
    return executeControlledFullShellPlan(plan.title, "remove-temp-output-dir", context);
  }

  throw new Error(`Unsupported assistant task execution plan: ${plan.kind}`);
}

async function executeNetworkSearchGuidancePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  throwIfExecutionAborted(context);
  return {
    resultTitle,
    resultSummary:
      `No external network search was run for "${query}". ` +
      "Provider status: not configured. Network call skipped. " +
      "Network-assisted retrieval is recognized as a controlled assistant capability, but this readonly slice only records the request and explains the safe next step. " +
      "Next repair step: configure a search provider in advanced settings, approve network search capability, then retry the request; use local RAG when the answer should come from workspace documents."
  };
}

async function executeReadonlyShellPlan(
  resultTitle: string,
  commandId: "git-status" | "workspace-root-list" | "packages-dir-list",
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await runReadonlyShellCommandWithDiagnostics(commandId, context);
  const resultSummary = resultTitle.toLowerCase().includes("diagnostics")
    ? createReadonlyShellSelfCheckReport(result)
    : `${result.summary} Command: ${result.command_label}. Preview: ${result.stdout_preview}`;

  return {
    resultTitle,
    resultSummary
  };
}

function createReadonlyShellSelfCheckReport(result: Awaited<ReturnType<typeof runReadonlyShellCommand>>): string {
  return [
    "Self-check report:",
    "shell bridge reachable",
    "workspace root accessible",
    `command whitelist accepted ${result.command_id}`,
    "audit trail retained readonly shell diagnostics",
    `${result.summary} Command: ${result.command_label}. Preview: ${result.stdout_preview}`
  ].join(" ");
}

async function executeCapabilityOverviewPlan(
  capabilityId: "rag" | "skills" | "npc" | "mcp",
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const overview = await awaitAbortable(loadOpenClawCapabilityOverview(capabilityId), context);
  const availableLine = overview.available_packages.join(", ");
  const missingLine =
    overview.missing_packages.length > 0 ? ` Missing: ${overview.missing_packages.join(", ")}.` : " Missing: none.";

  return {
    resultTitle: overview.title,
    resultSummary: `${overview.summary} Status: ${overview.status}. Available: ${availableLine}.${missingLine}`
  };
}

async function executeOpencowSelfRepairPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [workspaceOverview, configOverview, ragResult] = await awaitAbortable(
    Promise.all([
      loadWorkspaceOverview(),
      loadWorkspaceConfigOverview(),
      searchLocalKnowledgeWithDiagnostics(query, context)
    ]),
    context
  );
  const topPaths = ragResult.items.slice(0, 3).map((item) => item.title).join(", ") || "none";
  const topConfigs = configOverview.config_files.slice(0, 3).join(", ") || "none";
  const topScripts = configOverview.root_script_names.slice(0, 3).join(", ") || "none";
  const repairTargetPreview = resolveSelfRepairTargetPreview(query);

  return {
    resultTitle,
    resultSummary:
      `Readonly self-repair preview for ${workspaceOverview.root_name}. Key config files: ${topConfigs}. ` +
      `Root scripts: ${topScripts}. Relevant local docs: ${topPaths}. ${repairTargetPreview.summary} ` +
      `Next recommended flow: inspect failure -> preview repair -> request permission for any mutation -> verify -> keep audit and rollback visibility.`
  };
}

async function executeOpencowSelfRepairTargetGuidancePlan(
  resultTitle: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  throwIfExecutionAborted(context);
  return {
    resultTitle,
    resultSummary:
      "Opencow self-repair stopped before continuing because no specific repair target was confirmed. " +
      "Ask to continue repairing either the enabled skills registry at .opencow/skills/enabled-skills.json " +
      "or the workspace project runtime registry at .opencow/runtime/workspace-project-runs.json. " +
      "Example next requests: `diagnose opencow and continue repairing its enabled skills registry` or " +
      "`diagnose opencow and continue repairing its workspace project runtime registry`. " +
      "This keeps the repair chain explicit, permission-scoped, and helps avoid retry loops."
  };
}

function resolveSelfRepairTargetPreview(query: string): {
  summary: string;
} {
  const descriptor = resolveOpencowSelfRepairTargetDescriptor(query);

  if (descriptor.label && descriptor.path && descriptor.continueRequest) {
    return {
      summary:
        `Likely target: ${descriptor.label} at ${descriptor.path}. ` +
        `Check ${descriptor.path} first. ` +
        "Workspace write permission would be required before opencow can continue that controlled repair. " +
        `Suggested next request: \`${descriptor.continueRequest}\`.`
    };
  }

  return {
    summary:
      "No specific controlled repair target has been confirmed yet. If a mutation is needed, workspace write permission would still be required before opencow can continue. " +
      "Suggested next requests: `diagnose opencow and preview repairing its enabled skills registry` or " +
      "`diagnose opencow and preview repairing its workspace project runtime registry`."
  };
}

async function executeOpencowEnabledSkillsRegistryRepairPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await repairOpencowEnabledSkillsRegistryWithDiagnostics(query, context);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Repaired path: ${result.repaired_path}. Preserved entries: ${result.preserved_entry_count}. ` +
      `Verified schema version: ${result.verified_version}. Verified enabled entries: ${result.verified_entry_count}. ` +
      "Verification completed inside the controlled self-repair chain, and the result remains audit-visible and rollback-visible."
  };
}

async function repairOpencowEnabledSkillsRegistryWithDiagnostics(
  query: string,
  context: AssistantTaskExecutionContext
) {
  try {
    return await awaitAbortable(repairOpencowEnabledSkillsRegistry(query), context);
  } catch (error: unknown) {
    throw createOpencowSelfRepairDiagnosticError({
      target: "enabled skills registry",
      targetPath: ".opencow/skills/enabled-skills.json",
      requiredPermission: "workspace-write",
      recoveryStep:
        "inspect .opencow/skills/enabled-skills.json, narrow the repair request, or fix the file manually before retrying with explicit workspace-write approval",
      error
    });
  }
}

async function executeOpencowWorkspaceProjectRuntimeRegistryRepairPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await repairOpencowWorkspaceProjectRuntimeRegistryWithDiagnostics(query, context);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Repaired path: ${result.repaired_path}. Preserved runs: ${result.preserved_entry_count}. ` +
      `Verified schema version: ${result.verified_version}. Verified runtime runs: ${result.verified_run_count}. ` +
      "Verification completed inside the controlled self-repair chain, and the result remains audit-visible and rollback-visible."
  };
}

async function repairOpencowWorkspaceProjectRuntimeRegistryWithDiagnostics(
  query: string,
  context: AssistantTaskExecutionContext
) {
  try {
    return await awaitAbortable(repairOpencowWorkspaceProjectRuntimeRegistry(query), context);
  } catch (error: unknown) {
    throw createOpencowSelfRepairDiagnosticError({
      target: "workspace project runtime registry",
      targetPath: ".opencow/runtime/workspace-project-runs.json",
      requiredPermission: "workspace-write",
      recoveryStep:
        "inspect .opencow/runtime/workspace-project-runs.json, narrow the repair request, or fix the file manually before retrying with explicit workspace-write approval",
      error
    });
  }
}

async function executeLocalRagSearchPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await searchLocalKnowledgeWithDiagnostics(query, context);
  const topPaths = result.items.slice(0, 2).map((item) => item.title).join(", ");

  return {
    resultTitle,
    resultSummary: `${result.summary} Top matches: ${topPaths}. Query: ${result.query}. Indexed documents: ${result.indexed_document_count}`
  };
}

async function executeLocalSkillsScanPlan(
  resultTitle: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(scanLocalSkills(), context);
  const topSkills = result.items.slice(0, 3).map((item) => item.name).join(", ");
  const enabledSkills = result.items.filter((item) => item.enabled).map((item) => item.name).slice(0, 3).join(", ");
  const enabledLine = enabledSkills.length > 0 ? ` Enabled: ${enabledSkills}.` : " Enabled: none.";

  return {
    resultTitle,
    resultSummary: `${result.summary} Sample skills: ${topSkills}. Scanned roots: ${result.scanned_root_count}.${enabledLine}`
  };
}

async function executeLocalMcpPluginScanPlan(
  resultTitle: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(scanLocalMcpPlugins(), context);
  const topPlugins = result.items.slice(0, 3).map((item) => item.id).join(", ");
  const pluginLine = topPlugins.length > 0 ? topPlugins : "none";

  return {
    resultTitle,
    resultSummary: `${result.summary} Sample plugins: ${pluginLine}. Scanned roots: ${result.scanned_root_count}.`
  };
}

async function executeLocalMcpPluginInspectPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(inspectLocalMcpPlugin(query), context);
  const topMatch = result.items[0];

  if (!topMatch) {
    return {
      resultTitle,
      resultSummary: `${result.summary} Query: ${result.query}.`
    };
  }

  const toolsLine = topMatch.tool_names.length > 0 ? topMatch.tool_names.join(", ") : "none";
  const skillsLine = topMatch.skill_paths.length > 0 ? topMatch.skill_paths.join(", ") : "none";

  return {
    resultTitle,
    resultSummary: `${result.summary} Match: ${topMatch.id}. Activation: ${topMatch.activation}. Tools: ${toolsLine}. Skills: ${skillsLine}. Description: ${topMatch.description}`
  };
}

async function executeLocalMcpPluginStartPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(previewLocalMcpPluginStart(query), context);
  const topMatch = result.items[0];

  if (!topMatch) {
    return {
      resultTitle,
      resultSummary: `${result.summary} Query: ${result.query}.`
    };
  }

  return {
    resultTitle,
    resultSummary: `${result.summary} Match: ${topMatch.id}. Activation: ${topMatch.activation}. Startup allowed: ${topMatch.startup_allowed ? "yes" : "no"}. Working directory: ${topMatch.working_directory}. Command preview: ${topMatch.command_preview}. Config: ${topMatch.config_hint}. ${topMatch.risk_summary}`
  };
}

async function executeLocalMcpPluginStartPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(startLocalMcpPlugin(query), context);

  return {
    resultTitle,
    resultSummary: `${result.summary} Plugin: ${result.plugin_id}. Command: ${result.command_label}. Working directory: ${result.working_directory}. Preview: ${result.stdout_preview}`
  };
}

async function executeLocalSkillInspectPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(inspectLocalSkill(query), context);
  const topMatch = result.items[0];

  if (!topMatch) {
    return {
      resultTitle,
      resultSummary: `${result.summary} Query: ${result.query}.`
    };
  }

  return {
    resultTitle,
    resultSummary: `${result.summary} Match: ${topMatch.name}. Enabled: ${topMatch.enabled ? "yes" : "no"}. Description: ${topMatch.description}. Preview: ${topMatch.content_preview}`
  };
}

async function executeLocalSkillEnablePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(enableLocalSkill(query), context);

  return {
    resultTitle,
      resultSummary: `${result.summary} Skill: ${result.enabled_skill_name}. Registry: ${result.registry_path}. Status: ${result.status}.`
  };
}

async function executeLocalSkillInstallPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(installLocalSkill(query), context);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Skill: ${result.installed_skill_name}. Installed path: ${result.installed_skill_path}. ` +
      `Source: ${result.source_skill_path}. Status: ${result.status}.`
  };
}

async function executeLocalSkillDisablePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(disableLocalSkill(query), context);

  return {
    resultTitle,
    resultSummary: `${result.summary} Skill: ${result.disabled_skill_name}. Registry: ${result.registry_path}. Status: ${result.status}.`
  };
}

function deriveTaskQuery(
  plan: { summary: string; auditDetail: string }
): string {
  const requestMatch = plan.auditDetail.match(/\brequest=(.+)$/i);

  if (requestMatch?.[1]) {
    return requestMatch[1].trim();
  }

  const previewMatch = plan.auditDetail.match(/task:\s*(.+)$/i);

  if (previewMatch?.[1]) {
    return previewMatch[1].trim();
  }

  return plan.summary;
}

type EnabledLocalSkillMatchDiagnostics = Awaited<ReturnType<typeof matchEnabledLocalSkills>>;
type LocalRagSearchDiagnostics = Awaited<ReturnType<typeof searchLocalKnowledge>>;

function createNoEnabledLocalSkillMatchError(
  capability: string,
  skillMatch: EnabledLocalSkillMatchDiagnostics
): Error {
  return new Error(
    `No enabled local skill matched in assistantTaskService. Capability: ${capability}. ` +
      `Registry: ${skillMatch.registry_path}. Query: ${skillMatch.query}. ` +
      `Match count: ${skillMatch.match_count} of ${skillMatch.enabled_skill_count} enabled skills. ` +
      `Next step: inspect ${skillMatch.registry_path}, enable a matching skill, or rewrite the request before retrying.`
  );
}

async function searchLocalKnowledgeWithDiagnostics(
  query: string,
  context: AssistantTaskExecutionContext
): Promise<LocalRagSearchDiagnostics> {
  try {
    return await awaitAbortable(searchLocalKnowledge(query), context);
  } catch (error: unknown) {
    const detail = (error instanceof Error ? error.message : String(error)).replace(/[.。]\s*$/, "");

    throw new Error(
      `Local RAG search failed in assistantTaskService. Query: ${query}. ` +
        `Underlying error: ${detail}. ` +
        "Next step: verify the local RAG index, document parsers for pptx/docx/md, workspace root discovery, and retry with a narrower document query before continuing."
    );
  }
}

async function executeEnabledLocalSkillsListPlan(
  resultTitle: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(listEnabledLocalSkills(), context);
  const topSkills = result.items.slice(0, 3).map((item) => item.name).join(", ");
  const listedSkills = topSkills.length > 0 ? topSkills : "none";

  return {
    resultTitle,
    resultSummary: `${result.summary} Registry: ${result.registry_path}. Enabled skills: ${listedSkills}.`
  };
}

async function executeEnabledLocalSkillsMatchPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(matchEnabledLocalSkills(query), context);
  const topMatch = result.items[0];

  if (!topMatch) {
    return {
      resultTitle,
      resultSummary: `${result.summary} Registry: ${result.registry_path}. Query: ${result.query}.`
    };
  }

  return {
    resultTitle,
    resultSummary: `${result.summary} Recommended: ${topMatch.name}. Registry: ${result.registry_path}. Description: ${topMatch.description}. Preview: ${topMatch.content_preview}`
  };
}

async function executeSkillAssistedWorkspaceWritePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const skillMatch = await awaitAbortable(matchEnabledLocalSkills(query), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("skill-assisted shell request", skillMatch);
  }

  const shellResult = await runWorkspaceWriteShellCommandWithDiagnostics("create-temp-output-dir", context);

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `Command: ${shellResult.command_label}. Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeSkillAssistedControlledFullPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const skillMatch = await matchEnabledLocalSkills(query);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("skill-assisted destructive shell request", skillMatch);
  }

  const shellResult = await runControlledFullShellCommandWithDiagnostics("remove-temp-output-dir", context);

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `Command: ${shellResult.command_label}. Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeNpcAssistedWorkspaceWritePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const skillMatch = await awaitAbortable(matchEnabledLocalSkills(query), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("NPC-assisted shell request", skillMatch);
  }

  const shellResult = await runWorkspaceWriteShellCommandWithDiagnostics("create-temp-output-dir", context);

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `Command: ${shellResult.command_label}. Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeNpcAssistedControlledFullPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const skillMatch = await matchEnabledLocalSkills(query);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("NPC-assisted destructive shell request", skillMatch);
  }

  const shellResult = await runControlledFullShellCommandWithDiagnostics("remove-temp-output-dir", context);

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `Command: ${shellResult.command_label}. Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeSkillAssistedLocalRagSearchPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const skillMatch = await awaitAbortable(matchEnabledLocalSkills(query), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("skill-assisted local RAG request", skillMatch);
  }

  const ragResult = await searchSkillAssistedLocalKnowledgeWithDiagnostics(query, skillMatch, topMatch.name, context);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ");

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `${ragResult.summary} Top matches: ${topPaths}. Query: ${ragResult.query}. Indexed documents: ${ragResult.indexed_document_count}`
  };
}

async function searchSkillAssistedLocalKnowledgeWithDiagnostics(
  query: string,
  skillMatch: EnabledLocalSkillMatchDiagnostics,
  recommendedSkillName: string,
  context: AssistantTaskExecutionContext
): Promise<LocalRagSearchDiagnostics> {
  try {
    return await searchLocalKnowledgeWithDiagnostics(query, context);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Skill-assisted local RAG search failed in assistantTaskService. Recommended skill: ${recommendedSkillName}. ` +
        `Registry: ${skillMatch.registry_path}. Underlying RAG failure: ${detail} ` +
        "Next step: verify the matched skill, local RAG index, document parsers, workspace root discovery, and retry with a narrower document query before continuing."
    );
  }
}

async function executeLocalRagShellHandoffPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [ragResult, workspaceOverview] = await awaitAbortable(Promise.all([
    searchLocalKnowledgeWithDiagnostics(query, context),
    loadWorkspaceOverview()
  ]), context);
  const shellPreview = createReadonlyShellNextStepPreview(query, workspaceOverview.root_path);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${ragResult.summary} Top matches: ${topPaths}. Command preview: ${shellPreview.command}. ` +
      `Workspace root: ${shellPreview.workspaceRoot}. ` +
      `Next step: ${shellPreview.nextStep}. Required permission: ${shellPreview.requiredPermission}. Safety: ${shellPreview.safetyStatus}.`
  };
}

async function executeSkillAssistedRagShellHandoffPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [skillMatch, ragResult] = await awaitAbortable(Promise.all([
    matchEnabledLocalSkills(query),
    searchLocalKnowledgeWithDiagnostics(query, context)
  ]), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("skill-assisted RAG shell handoff preview request", skillMatch);
  }

  const workspaceOverview = await awaitAbortable(loadWorkspaceOverview(), context);
  const shellPreview = createReadonlyShellNextStepPreview(query, workspaceOverview.root_path);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `${ragResult.summary} Top matches: ${topPaths}. Command preview: ${shellPreview.command}. ` +
      `Workspace root: ${shellPreview.workspaceRoot}. ` +
      `Next step: ${shellPreview.nextStep}. Required permission: ${shellPreview.requiredPermission}. Safety: ${shellPreview.safetyStatus}.`
  };
}

async function executeNpcAssistedRagShellHandoffPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [npcOverview, skillMatch, ragResult] = await awaitAbortable(Promise.all([
    loadOpenClawCapabilityOverview("npc"),
    matchEnabledLocalSkills(query),
    searchLocalKnowledgeWithDiagnostics(query, context)
  ]), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("NPC-assisted RAG shell handoff preview request", skillMatch);
  }

  const workspaceOverview = await awaitAbortable(loadWorkspaceOverview(), context);
  const shellPreview = createReadonlyShellNextStepPreview(query, workspaceOverview.root_path);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${npcOverview.summary} Status: ${npcOverview.status}. Recommended skill: ${topMatch.name}. ` +
      `Registry: ${skillMatch.registry_path}. ${ragResult.summary} Top matches: ${topPaths}. ` +
      `Command preview: ${shellPreview.command}. Workspace root: ${shellPreview.workspaceRoot}. Next step: ${shellPreview.nextStep}. ` +
      `Required permission: ${shellPreview.requiredPermission}. Safety: ${shellPreview.safetyStatus}.`
  };
}

async function executeLocalRagShellCreatePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const ragResult = await searchLocalKnowledgeWithDiagnostics(query, context);
  const shellResult = await runWorkspaceWriteShellCommandWithDiagnostics("create-temp-output-dir", context);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${ragResult.summary} Top matches: ${topPaths}. Command: ${shellResult.command_label}. ` +
      `Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeLocalRagShellRemovePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const ragResult = await searchLocalKnowledgeWithDiagnostics(query, context);
  const shellResult = await runControlledFullShellCommandWithDiagnostics("remove-temp-output-dir", context);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${ragResult.summary} Top matches: ${topPaths}. Command: ${shellResult.command_label}. ` +
      `Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeSkillAssistedRagShellCreatePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [skillMatch, ragResult] = await awaitAbortable(Promise.all([
    matchEnabledLocalSkills(query),
    searchLocalKnowledgeWithDiagnostics(query, context)
  ]), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("skill-assisted RAG handoff shell creation request", skillMatch);
  }

  const shellResult = await runWorkspaceWriteShellCommandWithDiagnostics("create-temp-output-dir", context);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `${ragResult.summary} Top matches: ${topPaths}. Command: ${shellResult.command_label}. ` +
      `Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeSkillAssistedRagShellRemovePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [skillMatch, ragResult] = await awaitAbortable(Promise.all([
    matchEnabledLocalSkills(query),
    searchLocalKnowledgeWithDiagnostics(query, context)
  ]), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("skill-assisted RAG handoff shell removal request", skillMatch);
  }

  const shellResult = await runControlledFullShellCommandWithDiagnostics("remove-temp-output-dir", context);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `${ragResult.summary} Top matches: ${topPaths}. Command: ${shellResult.command_label}. ` +
      `Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeNpcAssistedRagShellCreatePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [skillMatch, ragResult] = await awaitAbortable(Promise.all([
    matchEnabledLocalSkills(query),
    searchLocalKnowledgeWithDiagnostics(query, context)
  ]), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("NPC-assisted RAG handoff shell creation request", skillMatch);
  }

  const shellResult = await runWorkspaceWriteShellCommandWithDiagnostics("create-temp-output-dir", context);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `${ragResult.summary} Top matches: ${topPaths}. Command: ${shellResult.command_label}. ` +
      `Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeNpcAssistedRagShellRemovePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [skillMatch, ragResult] = await awaitAbortable(Promise.all([
    matchEnabledLocalSkills(query),
    searchLocalKnowledgeWithDiagnostics(query, context)
  ]), context);
  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("NPC-assisted RAG handoff shell removal request", skillMatch);
  }

  const shellResult = await runControlledFullShellCommandWithDiagnostics("remove-temp-output-dir", context);
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${skillMatch.summary} Recommended skill: ${topMatch.name}. Registry: ${skillMatch.registry_path}. ` +
      `${ragResult.summary} Top matches: ${topPaths}. Command: ${shellResult.command_label}. ` +
      `Preview: ${shellResult.stdout_preview}. ${shellResult.summary}`
  };
}

async function executeNpcCollaborationPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [npcOverview, enabledSkills, ragResult] = await awaitAbortable(Promise.all([
    loadOpenClawCapabilityOverview("npc"),
    listEnabledLocalSkills(),
    searchLocalKnowledgeWithDiagnostics(query, context)
  ]), context);

  const skillNames = enabledSkills.items.slice(0, 3).map((item) => item.name).join(", ") || "none";
  const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join(", ") || "none";

  return {
    resultTitle,
    resultSummary:
      `${npcOverview.summary} Status: ${npcOverview.status}. Enabled skills: ${skillNames}. ` +
      `Registry: ${enabledSkills.registry_path}. Local context: ${topPaths}. Indexed documents: ${ragResult.indexed_document_count}.`
  };
}

async function executeNpcProjectShowcasePreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [npcOverview, enabledSkills, workspaceOverview, runPreview] = await awaitAbortable(Promise.all([
    loadOpenClawCapabilityOverview("npc"),
    listEnabledLocalSkills(),
    loadWorkspaceOverview(),
    loadWorkspaceProjectRunPreview(query)
  ]), context);

  const skillNames = enabledSkills.items.slice(0, 3).map((item) => item.name).join(", ") || "none";
  const likelyProject = /\bcattle\b/i.test(query) ? "cattle" : "target local project";
  const packageNames = workspaceOverview.package_names.slice(0, 4).join(", ") || "none detected";
  const matchedProject = runPreview.matched_project_name ?? likelyProject;
  const preferredCommand = runPreview.preferred_command ?? "not detected";
  const expectedUrl = runPreview.expected_url ?? "not inferred";

  return {
    resultTitle,
    resultSummary:
      `${npcOverview.summary} Status: ${npcOverview.status}. Enabled skills: ${skillNames}. ` +
      `Workspace root: ${workspaceOverview.root_name}. Visible packages: ${packageNames}. ` +
      `Run preview matched ${matchedProject} at ${runPreview.matched_project_path ?? "unknown path"} from ${runPreview.matched_project_source ?? "unknown source"}. ` +
      `Preferred launch command: ${preferredCommand}. Expected URL: ${expectedUrl}. ` +
      `Next required permission for actual launch: ${runPreview.next_required_permission}. ${runPreview.risk_summary} ` +
      `Planned stages for ${likelyProject}: project inspection -> run preview -> permission-backed local launch -> ` +
      `permission-backed screenshot capture -> permission-backed showcase site generation -> changed-files preview -> separately confirmable git push. ` +
      `This preview stays readonly and keeps every privileged step explicit before execution.`
  };
}

async function executeNpcLocalProjectRunPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(runWorkspaceProject(query), context);
  const executionLabel = result.preview_only
    ? "This browser preview stayed readonly and did not launch a real local process."
    : "This is the first executed stage inside the NPC showcase chain.";
  const pidLabel = result.preview_only ? "not executed in browser preview" : String(result.pid);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Command: ${result.command_label}. Working directory: ${result.working_directory}. ` +
      `Expected URL: ${result.expected_url ?? "not inferred"}. PID: ${pidLabel}. ` +
      `Preview: ${result.stdout_preview}. ${executionLabel}`
  };
}

async function executeNpcLocalProjectScreenshotCapturePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(captureNpcLocalProjectScreenshot(query), context);
  const executionLabel = result.preview_only
    ? "This browser preview stayed readonly and did not capture a real screenshot artifact."
    : "This is the screenshot stage inside the NPC showcase chain.";

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Capture target: ${result.capture_target}. Expected URL: ${result.expected_url ?? "not inferred"}. ` +
      `Artifact path: ${result.artifact_path}. Artifact directory: ${result.artifact_directory}. ` +
      `${executionLabel}`
  };
}

async function executeNpcLocalProjectShowcaseSiteWritePlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(writeNpcLocalProjectShowcaseSite(query), context);
  const executionLabel = result.preview_only
    ? "This browser preview stayed readonly and did not write real showcase files."
    : "This is the showcase-site write stage inside the NPC showcase chain.";

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Site root: ${result.site_root}. Entry file: ${result.entry_file}. ` +
      `Changed paths: ${result.changed_paths.join(", ")}. Source screenshot: ${result.source_screenshot_path}. ` +
      `${executionLabel}`
  };
}

async function executeNpcLocalProjectShowcasePublishPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(loadNpcLocalProjectShowcasePublishPreview(query), context);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Site root: ${result.site_root}. Entry file: ${result.entry_file}. ` +
      `Changed paths: ${result.changed_paths.join(", ")}. Source screenshot: ${result.source_screenshot_path}. ` +
      `Next git step: ${result.next_git_step} This is the readonly publish-preview stage inside the NPC showcase chain.`
  };
}

async function executeNpcLocalProjectShowcaseGitConfirmationPreviewPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(loadNpcLocalProjectShowcaseGitConfirmationPreview(query), context);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Site root: ${result.site_root}. Entry file: ${result.entry_file}. ` +
      `Changed paths: ${result.changed_paths.join(", ")}. Source screenshot: ${result.source_screenshot_path}. ` +
      `Recommended git action: ${result.recommended_git_action}. ` +
      `${result.required_confirmation_stage} This is the readonly git-confirmation-preview stage inside the NPC showcase chain.`
  };
}

async function executeNpcShellPlanPreview(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const [npcOverview, skillMatch, workspaceOverview] = await awaitAbortable(Promise.all([
    loadOpenClawCapabilityOverview("npc"),
    matchEnabledLocalSkills(query),
    loadWorkspaceOverview()
  ]), context);

  const topMatch = skillMatch.items[0];

  if (!topMatch) {
    throw createNoEnabledLocalSkillMatchError("NPC shell preview request", skillMatch);
  }

  const shellPreview = createReadonlyShellNextStepPreview(query, workspaceOverview.root_path);

  return {
    resultTitle,
    resultSummary:
      `${npcOverview.summary} Status: ${npcOverview.status}. Recommended skill: ${topMatch.name}. ` +
      `Registry: ${skillMatch.registry_path}. Command preview: ${shellPreview.command}. Next step: ${shellPreview.nextStep}. ` +
      `Workspace root: ${shellPreview.workspaceRoot}. ` +
      `Required permission: ${shellPreview.requiredPermission}. Safety: ${shellPreview.safetyStatus}.`
  };
}

function createReadonlyShellNextStepPreview(query: string, workspaceRoot: string): {
  command: string;
  workspaceRoot: string;
  nextStep: string;
  requiredPermission: string;
  safetyStatus: string;
} {
  const command = /delete|remove|clean up/i.test(query)
    ? "Remove-Item -LiteralPath temp-output -Recurse -Force"
    : "New-Item -ItemType Directory -Force temp-output";

  const plan = planControlledCommand({
    command,
    cwd: workspaceRoot,
    allowedRoots: [workspaceRoot],
    permissionMode: "readonly",
    timeoutMs: 20_000
  });
  const escalation = createPermissionEscalationRequest(plan);
  const safety = guardExecutionPlan(plan, { snapshotAvailable: true });
  const nextStep = escalation
    ? escalation.targetMode
    : plan.status === "needs-confirmation"
      ? "confirmation"
      : "ready";

  return {
    command,
    workspaceRoot,
    nextStep,
    requiredPermission: plan.requiredPermission,
    safetyStatus: safety.status
  };
}

async function executeWorkspaceWriteShellPlan(
  resultTitle: string,
  commandId: "create-temp-output-dir",
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await runWorkspaceWriteShellCommandWithDiagnostics(commandId, context);

  return {
    resultTitle,
    resultSummary: `${result.summary} Command: ${result.command_label}. Preview: ${result.stdout_preview}`
  };
}

async function executeWorkspaceProjectRunPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(runWorkspaceProject(query), context);
  const pidLabel = result.preview_only ? "not executed in browser preview" : String(result.pid);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Command: ${result.command_label}. Working directory: ${result.working_directory}. ` +
      `Expected URL: ${result.expected_url ?? "not inferred"}. PID: ${pidLabel}. Preview: ${result.stdout_preview}`
  };
}

async function executeWorkspaceProjectStatusPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(getWorkspaceProjectStatus(query), context);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Command: ${result.command_label}. Working directory: ${result.working_directory}. ` +
      `Expected URL: ${result.expected_url ?? "not inferred"}. PID: ${result.pid ?? "none"}. ` +
      `Status: ${result.status}. Preview: ${result.stdout_preview}`
  };
}

async function executeWorkspaceProjectStopPlan(
  resultTitle: string,
  query: string,
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await awaitAbortable(stopWorkspaceProject(query), context);
  const pidLabel = result.preview_only ? "not executed in browser preview" : String(result.pid);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Command: ${result.command_label}. Working directory: ${result.working_directory}. ` +
      `PID: ${pidLabel}. Status: ${result.status}. Preview: ${result.stdout_preview}`
  };
}

async function executeControlledFullShellPlan(
  resultTitle: string,
  commandId: "remove-temp-output-dir",
  context: AssistantTaskExecutionContext
): Promise<AssistantTaskExecutionResult> {
  const result = await runControlledFullShellCommandWithDiagnostics(commandId, context);

  return {
    resultTitle,
    resultSummary: `${result.summary} Command: ${result.command_label}. Preview: ${result.stdout_preview}`
  };
}

async function runReadonlyShellCommandWithDiagnostics(
  commandId: "git-status" | "workspace-root-list" | "packages-dir-list",
  context: AssistantTaskExecutionContext
) {
  try {
    return await awaitAbortable(runReadonlyShellCommand(commandId), context);
  } catch (error: unknown) {
    throw createShellExecutionDiagnosticError({
      commandId,
      requiredPermission: "readonly",
      recoveryStep: "verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying",
      error
    });
  }
}

async function runWorkspaceWriteShellCommandWithDiagnostics(
  commandId: "create-temp-output-dir",
  context: AssistantTaskExecutionContext
) {
  try {
    return await awaitAbortable(runWorkspaceWriteShellCommand(commandId), context);
  } catch (error: unknown) {
    throw createShellExecutionDiagnosticError({
      commandId,
      requiredPermission: "workspace-write",
      recoveryStep: "verify the permission approval, workspace root, command whitelist, and audit trail before retrying",
      error
    });
  }
}

async function runControlledFullShellCommandWithDiagnostics(
  commandId: "remove-temp-output-dir",
  context: AssistantTaskExecutionContext
) {
  assertControlledFullCommandSafety(commandId, context);

  try {
    return await runControlledFullShellCommand(commandId);
  } catch (error: unknown) {
    throw createShellExecutionDiagnosticError({
      commandId,
      requiredPermission: "controlled-full",
      recoveryStep:
        "verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying",
      error
    });
  }
}

function assertControlledFullCommandSafety(
  commandId: "remove-temp-output-dir",
  context: AssistantTaskExecutionContext
) {
  if (context.snapshotAvailable === false) {
    throw new Error(
      `Shell execution blocked in assistantTaskService. Command id: ${commandId}. ` +
        "Required permission: controlled-full. Reason: rollback snapshot unavailable. " +
        "Next step: restore snapshot capability or run a readonly preview before retrying destructive execution."
    );
  }
}

function createShellExecutionDiagnosticError(payload: {
  commandId: string;
  requiredPermission: PermissionMode;
  recoveryStep: string;
  error: unknown;
}): Error {
  const detail = (payload.error instanceof Error ? payload.error.message : String(payload.error)).replace(/[.。]\s*$/, "");
  const recoveryNarrative = getShellDialogRecoveryNarrative();

  return new Error(
    `Shell execution failed in assistantTaskService. Command id: ${payload.commandId}. ` +
      `Required permission: ${payload.requiredPermission}. Underlying error: ${detail}. ` +
      `Next step: ${payload.recoveryStep}. ${recoveryNarrative}`
  );
}

function createOpencowSelfRepairDiagnosticError(payload: {
  target: string;
  targetPath: string;
  requiredPermission: PermissionMode;
  recoveryStep: string;
  error: unknown;
}): Error {
  const detail = (payload.error instanceof Error ? payload.error.message : String(payload.error)).replace(/[.。]\s*$/, "");
  const recoveryNarrative = getShellDialogRecoveryNarrative();

  return new Error(
    `Opencow self-repair failed in assistantTaskService. Target: ${payload.target}. ` +
      `Target path: ${payload.targetPath}. Required permission: ${payload.requiredPermission}. ` +
      `Underlying error: ${detail}. Next step: ${payload.recoveryStep}. ${recoveryNarrative}`
  );
}
