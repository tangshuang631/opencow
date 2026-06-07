import type { LocalAssistantTaskPlan, LocalAssistantTaskRequest } from "./types.js";

const destructivePatterns = [/remove-item/i, /\brm\b/i, /\bdel\b/i, /\bdelete\b/i, /\bclean up\b/i];

const gitStatusPatterns = [/\bgit status\b/i, /\bgit\b/i, /\bworkspace status\b/i, /\bmodified files\b/i];
const workspaceRootPatterns = [/\blist files\b/i, /\broot files\b/i, /\bworkspace files\b/i, /\btop level\b/i];
const packagesDirectoryPatterns = [/\bpackage folders\b/i, /\blist packages\b/i, /\bpackages directory\b/i];
const createTempOutputVerbPatterns = [/\bcreate\b/i, /\bmake\b/i];
const createTempOutputNamePatterns = [/temp-output/i];
const createTempOutputContainerPatterns = [/\bfolder\b/i, /\bdirectory\b/i];
const enabledSkillPatterns = [/\benabled\b/i, /\bactive\b/i];
const skillMediationPatterns = [/\bskill\b/i, /\bautomation\b/i];
const shellAutomationPatterns = [/\bshell\b/i, /\bautomation\b/i];
const workspaceOverviewPatterns = [/\bworkspace\b/i, /\brepo\b/i, /\brepository\b/i, /\bproject\b/i, /工作区/, /项目/];
const workspaceOverviewIntentPatterns = [/\binspect\b/i, /\boverview\b/i, /\bsummar/i, /\bstructure\b/i, /\blayout\b/i];
const configOverviewPatterns = [
  /config/i,
  /configs/i,
  /package\.json/i,
  /cargo\.toml/i,
  /root scripts?/i,
  /workspace config/i
];
const opencowSelfRepairPatterns = [/\bopencow\b/i, /自修复/, /修复自己/, /fix yourself/i, /repair yourself/i];
const diagnosticPreviewPatterns = [/\bdiagnos/i, /\binspect\b/i, /\bpreview\b/i, /\brepair\b/i, /\bfix\b/i, /报错/, /错误/];
const repairContinuationPatterns = [/\bcontinue\b/i, /\bproceed\b/i, /\bexecute\b/i, /继续/];
const enabledSkillsRegistryPatterns = [/\benabled\b/i, /\bskills?\b/i, /\bregistry\b/i, /enabled-skills/i];
const packagesOverviewPatterns = [/package/i, /packages/i, /script/i, /scripts/i, /workspace package/i];
const ragCapabilityPatterns = [/\brag\b/i, /retrieval/i, /knowledge base/i, /embedding/i];
const skillsCapabilityPatterns = [/\bskills?\b/i, /skill ecosystem/i];
const localSkillsScanPatterns = [/\bscan\b/i, /\blist\b/i, /\binventory\b/i];
const localEnabledSkillsPatterns = [/\benabled\b/i, /\bactive\b/i, /\bactivated\b/i];
const localEnabledSkillMatchPatterns = [/\bmatch\b/i, /\brecommend\b/i, /\bshould\b/i, /\bwhich\b/i, /\bbest\b/i];
const localSkillInspectPatterns = [/\bshow\b/i, /\bdetail/i, /\bdetails\b/i, /\bread\b/i, /\binspect\b/i, /\bopen\b/i];
const localSkillInstallPatterns = [/\binstall\b/i, /\badd\b/i, /安装/];
const localSkillEnablePatterns = [/\benable\b/i, /\bactivate\b/i, /\bturn on\b/i];
const localSkillDisablePatterns = [/\bdisable\b/i, /\bdeactivate\b/i, /\bturn off\b/i];
const npcCapabilityPatterns = [/\bnpc\b/i, /agent team/i, /collaboration/i];
const npcPreviewPatterns = [/\bpreview\b/i, /\bplan\b/i, /\bworkflow\b/i];
const npcShowcaseProjectPatterns = [/\bcattle\b/i, /\bproject\b/i, /项目/];
const npcShowcaseOutputPatterns = [/\bshowcase\b/i, /\bportfolio\b/i, /\bresume\b/i, /简历/];
const npcShowcaseActionPatterns = [/\brun\b/i, /运行/, /\bscreenshot/i, /截图/, /\bwebsite\b/i, /网站/, /\bgit repo\b/i, /仓库/];
const continuationPatterns = [/\bcontinue\b/i, /\bproceed\b/i, /\bexecute\b/i, /\brun\b/i];
const npcShowcaseScreenshotPatterns = [/\bscreenshot\b/i, /\bcapture\b/i, /截图/, /截屏/];
const npcShowcaseSiteWritePatterns = [/\bshowcase\b/i, /\bwebsite\b/i, /\bsite\b/i, /\bpage\b/i];
const mcpCapabilityPatterns = [/\bmcp\b/i, /model context protocol/i];
const mcpLocalPluginInspectPatterns = [/\bshow\b/i, /\bdetail\b/i, /\bdetails\b/i, /\bread\b/i, /\binspect\b/i, /\bopen\b/i];
const mcpLocalPluginStartPreviewPatterns = [/\bpreview\b/i, /\bstart\b/i, /\blaunch\b/i, /\brun\b/i];
const mcpLocalPluginScanPatterns = [/\bscan\b/i, /\blist\b/i, /\binventory\b/i, /\bplugins?\b/i, /\bservers?\b/i];
const localRagSearchPatterns = [/\bsearch\b/i, /\bfind\b/i, /\blookup\b/i, /knowledge/i, /docs?/i, /rules?/i];

export function planLocalAssistantTask(request: LocalAssistantTaskRequest): LocalAssistantTaskPlan {
  const message = request.message.trim();
  const normalizedLowerMessage = message.toLowerCase();

  if (
    opencowSelfRepairPatterns.some((pattern) => pattern.test(message))
    && repairContinuationPatterns.some((pattern) => pattern.test(message))
    && enabledSkillsRegistryPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before opencow can repair its workspace-local enabled skills registry.",
        riskSummary: "This repair rewrites only .opencow/skills/enabled-skills.json through a narrow self-repair path and must remain audit-visible and rollback-visible.",
        auditSummary: "Local assistant task requires workspace-write permission for opencow self-repair.",
        auditDetail: `Opencow self-repair is waiting for workspace-write permission: ${message}`,
        queuedExecutionKind: "opencow-self-repair-enabled-skills-registry",
        queuedExecutionTitle: "Repair opencow enabled skills registry",
        queuedExecutionAuditSummary: "Local assistant planned an opencow enabled skills registry self-repair.",
        queuedExecutionAuditDetail: `Opencow self-repair task: enabled skills registry | request=${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "opencow-self-repair-enabled-skills-registry",
      title: "Repair opencow enabled skills registry",
      summary: "Repair the workspace-local enabled skills registry through the controlled self-repair chain.",
      auditSummary: "Local assistant planned an opencow enabled skills registry self-repair.",
      auditDetail: `Opencow self-repair task: enabled skills registry | request=${message}`
    };
  }

  if (
    opencowSelfRepairPatterns.some((pattern) => pattern.test(message))
    && diagnosticPreviewPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview",
      summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
      auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      auditDetail: `Readonly opencow self-repair preview task: ${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
    && npcShowcaseOutputPatterns.some((pattern) => pattern.test(message))
    && npcShowcaseActionPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "npc-local-project-showcase-preview",
      title: "NPC local project showcase preview",
      summary: "Preview a readonly NPC-assisted local project showcase workflow before any run, screenshot, website generation, repository write, or git push action is approved.",
      auditSummary: "Local assistant planned a readonly NPC local project showcase preview.",
      auditDetail: `Readonly NPC local project showcase preview task: ${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
    && (/\brun\b/i.test(message) || /\bstart\b/i.test(message) || /\blaunch\b/i.test(message))
    && !npcShowcaseOutputPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before NPC collaboration can launch the matched local project.",
        riskSummary:
          "This task launches only the matched local workspace project through the existing project-run path, keeps execution inside the approved workspace, and must remain audit-visible.",
        auditSummary: "Local assistant task requires workspace-write permission for an NPC local project run.",
        auditDetail: `NPC local project run task is waiting for permission: ${message}`,
        queuedExecutionKind: "npc-local-project-run",
        queuedExecutionTitle: "NPC local project run",
        queuedExecutionAuditSummary: "Local assistant planned an NPC local project run.",
        queuedExecutionAuditDetail: `NPC local project run task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "npc-local-project-run",
      title: "NPC local project run",
      summary: message,
      auditSummary: "Local assistant planned an NPC local project run.",
      auditDetail: `NPC local project run task: ${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
    && npcShowcaseScreenshotPatterns.some((pattern) => pattern.test(message))
    && (/\bnow\b/i.test(message) || /\bcapture\b/i.test(message) || /\btake\b/i.test(message))
    && !npcShowcaseOutputPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before NPC collaboration can capture a screenshot from the matched local project.",
        riskSummary:
          "This task captures only a task-scoped screenshot artifact for the matched running local workspace project, writes it inside the approved workspace, and must remain audit-visible.",
        auditSummary: "Local assistant task requires workspace-write permission for NPC local project screenshot capture.",
        auditDetail: `NPC local project screenshot capture task is waiting for permission: ${message}`,
        queuedExecutionKind: "npc-local-project-screenshot-capture",
        queuedExecutionTitle: "NPC local project screenshot capture",
        queuedExecutionAuditSummary: "Local assistant planned NPC local project screenshot capture.",
        queuedExecutionAuditDetail: `NPC local project screenshot capture task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "npc-local-project-screenshot-capture",
      title: "NPC local project screenshot capture",
      summary: message,
      auditSummary: "Local assistant planned NPC local project screenshot capture.",
      auditDetail: `NPC local project screenshot capture task: ${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
    && npcShowcaseSiteWritePatterns.some((pattern) => pattern.test(message))
    && (/\bgenerate\b/i.test(message) || /\bwrite\b/i.test(message) || /\bcreate\b/i.test(message))
    && /\bnow\b/i.test(message)
    && !/\bgit\s+(status|commit|push)\b/i.test(message)
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before NPC collaboration can generate the showcase site for the matched local project.",
        riskSummary:
          "This task writes only a deterministic local showcase-site output under the approved workspace and must keep changed-file paths audit-visible.",
        auditSummary: "Local assistant task requires workspace-write permission for NPC local project showcase-site write.",
        auditDetail: `NPC local project showcase-site write task is waiting for permission: ${message}`,
        queuedExecutionKind: "npc-local-project-showcase-site-write",
        queuedExecutionTitle: "NPC local project showcase-site write",
        queuedExecutionAuditSummary: "Local assistant planned NPC local project showcase-site write.",
        queuedExecutionAuditDetail: `NPC local project showcase-site write task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "npc-local-project-showcase-site-write",
      title: "NPC local project showcase-site write",
      summary: message,
      auditSummary: "Local assistant planned NPC local project showcase-site write.",
      auditDetail: `NPC local project showcase-site write task: ${message}`
    };
  }

  if (
    workspaceOverviewPatterns.some((pattern) => pattern.test(message))
    && workspaceOverviewIntentPatterns.some((pattern) => pattern.test(message))
    && !configOverviewPatterns.some((pattern) => pattern.test(message))
    && !packagesOverviewPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace structure before deeper local assistant execution.",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: `Readonly workspace overview task: ${message}`
    };
  }

  if (
    /你能(帮我)?做什么/.test(message)
    || /你会做什么/.test(message)
    || /能干什么/.test(message)
    || /what can you do/.test(normalizedLowerMessage)
    || /help me with/.test(normalizedLowerMessage)
    || /how can you help/.test(normalizedLowerMessage)
  ) {
    return {
      kind: "assistant-help-overview",
      title: "Assistant help overview",
      summary: "Summarize the local desktop assistant's current core conversation, Ollama, shell safety, RAG, Skills, NPC, and MCP capabilities in user-facing language.",
      auditSummary: "Local assistant planned a user-facing help overview.",
      auditDetail: `User-facing assistant help overview task: ${message}`
    };
  }

  if (
    !/\bnpc\b/i.test(message)
    && !enabledSkillPatterns.some((pattern) => pattern.test(message))
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && continuationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && destructivePatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode !== "controlled-full") {
      return {
        kind: "permission-request",
        targetMode: "controlled-full",
        reason: "Controlled full permission is required before a local RAG handoff destructive shell cleanup task can continue.",
        riskSummary: "This task reviews local shell rules and then continues into a destructive shell slice that must still keep permission escalation, confirmation, audit logging, timeout, and rollback protections.",
        auditSummary: "Local assistant task requires a permission upgrade for local RAG handoff destructive shell execution.",
        auditDetail: `Local RAG handoff destructive shell task is waiting for permission: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "confirmation",
      title: "Confirm local RAG handoff destructive cleanup",
      summary: "The assistant identified a local RAG handoff destructive cleanup request and requires explicit confirmation before execution.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "This will delete temporary workspace output after reviewing local shell rules, and must keep audit and rollback protections.",
      requiredMode: "controlled-full",
      safetySummary: "A snapshot preview must be available before local RAG handoff destructive execution continues.",
      auditSummary: "Local assistant task is waiting for local RAG handoff destructive confirmation.",
      auditDetail: `Local RAG handoff high-risk assistant task is waiting for confirmation: ${message}`,
      queuedExecutionKind: "rag-local-shell-remove-temp-output",
      queuedExecutionTitle: "Local RAG handoff temp-output removal",
      queuedExecutionAuditSummary: "Local assistant planned a local RAG handoff controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: `Local RAG handoff controlled-full shell command task: remove temp-output directory | request=${message}`,
      queuedMessage: message
    };
  }

  if (
    !/\bnpc\b/i.test(message)
    && !enabledSkillPatterns.some((pattern) => pattern.test(message))
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && continuationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && createTempOutputVerbPatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
    && createTempOutputContainerPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before a local RAG handoff temp-output creation task can modify the workspace.",
        riskSummary: "This task reviews local shell rules and then writes only inside the approved workspace through the controlled shell runner.",
        auditSummary: "Local assistant task requires workspace-write permission for local RAG handoff shell execution.",
        auditDetail: `Local RAG handoff workspace-write shell task is waiting for permission: ${message}`,
        queuedExecutionKind: "rag-local-shell-create-temp-output",
        queuedExecutionTitle: "Local RAG handoff temp-output creation",
        queuedExecutionAuditSummary: "Local assistant planned a local RAG handoff workspace-write temp-output creation task.",
        queuedExecutionAuditDetail: `Local RAG handoff workspace-write shell command task: create temp-output directory | request=${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "rag-local-shell-create-temp-output",
      title: "Local RAG handoff temp-output creation",
      summary: message,
      auditSummary: "Local assistant planned a local RAG handoff workspace-write temp-output creation task.",
      auditDetail: `Local RAG handoff workspace-write shell command task: create temp-output directory | request=${message}`
    };
  }

  if (
    !/\bnpc\b/i.test(message)
    && !enabledSkillPatterns.some((pattern) => pattern.test(message))
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
    && npcPreviewPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "rag-local-shell-handoff-preview",
      title: "Local RAG shell handoff preview",
      summary: "Preview a readonly local docs-to-shell handoff by combining local rules retrieval and the next shell safety step.",
      auditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      auditDetail: `Readonly local RAG shell handoff preview task: ${message}`
    };
  }

  if (
    /\bstatus\b/i.test(message)
    && /\blocal(ly)?\b/i.test(message)
    && (/\bdesktop\b/i.test(message) || /\bapp\b/i.test(message) || /\bproject\b/i.test(message) || /\brun\b/i.test(message))
  ) {
    return {
      kind: "workspace-project-status",
      title: "Matched local project status",
      summary: message,
      auditSummary: "Local assistant planned a readonly workspace-backed local project status lookup.",
      auditDetail: `Readonly workspace-backed local project status task: ${message}`
    };
  }

  if (
    /\b(stop|terminate|kill)\b/i.test(message)
    && /\blocal(ly)?\b/i.test(message)
    && (/\bdesktop\b/i.test(message) || /\bapp\b/i.test(message) || /\bproject\b/i.test(message) || /\brun\b/i.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before stopping a matched local project from the desktop assistant.",
        riskSummary: "This task stops only a previously launched local workspace project through a fixed project-stop path, keeps execution inside the approved workspace, and must remain audit-visible.",
        auditSummary: "Local assistant task requires workspace-write permission for a matched local project stop.",
        auditDetail: `Workspace-backed local project stop task is waiting for permission: ${message}`,
        queuedExecutionKind: "workspace-project-stop",
        queuedExecutionTitle: "Stop matched local project",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-backed local project stop.",
        queuedExecutionAuditDetail: `Workspace-backed local project stop task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "workspace-project-stop",
      title: "Stop matched local project",
      summary: message,
      auditSummary: "Local assistant planned a workspace-backed local project stop.",
      auditDetail: `Workspace-backed local project stop task: ${message}`
    };
  }

  if (
    !/\bnpc\b/i.test(message)
    && /\brun\b/i.test(message)
    && /\blocal(ly)?\b/i.test(message)
    && (/\bdesktop\b/i.test(message) || /\bapp\b/i.test(message) || /\bproject\b/i.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before launching a matched local project from the desktop assistant.",
        riskSummary: "This task starts a local workspace project process through a fixed project-run path, keeps execution inside the approved workspace, and must remain audit-visible.",
        auditSummary: "Local assistant task requires workspace-write permission for a matched local project run.",
        auditDetail: `Workspace-backed local project run task is waiting for permission: ${message}`,
        queuedExecutionKind: "workspace-project-run",
        queuedExecutionTitle: "Run matched local project",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-backed local project run.",
        queuedExecutionAuditDetail: `Workspace-backed local project run task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "workspace-project-run",
      title: "Run matched local project",
      summary: message,
      auditSummary: "Local assistant planned a workspace-backed local project run.",
      auditDetail: `Workspace-backed local project run task: ${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && continuationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && destructivePatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode !== "controlled-full") {
      return {
        kind: "permission-request",
        targetMode: "controlled-full",
        reason: "Controlled full permission is required before an NPC-assisted RAG handoff destructive shell cleanup task can continue.",
        riskSummary: "This task uses NPC collaboration to review local shell rules and then continues into a destructive shell slice that must still keep permission escalation, confirmation, audit logging, timeout, and rollback protections.",
        auditSummary: "Local assistant task requires a permission upgrade for NPC-assisted RAG handoff destructive shell execution.",
        auditDetail: `NPC-assisted RAG handoff destructive shell task is waiting for permission: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "confirmation",
      title: "Confirm NPC-assisted RAG handoff destructive cleanup",
      summary: "The assistant identified an NPC-assisted RAG handoff destructive cleanup request and requires explicit confirmation before execution.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "This will delete temporary workspace output after NPC collaboration reviews local shell rules and routes into an enabled local shell-oriented skill, and must keep audit and rollback protections.",
      requiredMode: "controlled-full",
      safetySummary: "A snapshot preview must be available before NPC-assisted RAG handoff destructive execution continues.",
      auditSummary: "Local assistant task is waiting for NPC-assisted RAG handoff destructive confirmation.",
      auditDetail: `NPC-assisted RAG handoff high-risk assistant task is waiting for confirmation: ${message}`,
      queuedExecutionKind: "npc-local-enabled-rag-shell-remove-temp-output",
      queuedExecutionTitle: "NPC-assisted RAG handoff temp-output removal",
      queuedExecutionAuditSummary: "Local assistant planned an NPC-assisted RAG handoff controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: `NPC-assisted RAG handoff controlled-full shell command task: remove temp-output directory | request=${message}`,
      queuedMessage: message
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && continuationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && createTempOutputVerbPatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
    && createTempOutputContainerPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before an NPC-assisted RAG handoff temp-output creation task can modify the workspace.",
        riskSummary: "This task uses NPC collaboration to review local shell rules and then writes only inside the approved workspace through the controlled shell runner.",
        auditSummary: "Local assistant task requires workspace-write permission for NPC-assisted RAG handoff shell execution.",
        auditDetail: `NPC-assisted RAG handoff workspace-write shell task is waiting for permission: ${message}`,
        queuedExecutionKind: "npc-local-enabled-rag-shell-create-temp-output",
        queuedExecutionTitle: "NPC-assisted RAG handoff temp-output creation",
        queuedExecutionAuditSummary: "Local assistant planned an NPC-assisted RAG handoff workspace-write temp-output creation task.",
        queuedExecutionAuditDetail: `NPC-assisted RAG handoff workspace-write shell command task: create temp-output directory | request=${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "npc-local-enabled-rag-shell-create-temp-output",
      title: "NPC-assisted RAG handoff temp-output creation",
      summary: message,
      auditSummary: "Local assistant planned an NPC-assisted RAG handoff workspace-write temp-output creation task.",
      auditDetail: `NPC-assisted RAG handoff workspace-write shell command task: create temp-output directory | request=${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
    && npcPreviewPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "npc-local-enabled-rag-shell-handoff-preview",
      title: "NPC-assisted RAG shell handoff preview",
      summary: "Preview a readonly NPC docs-to-shell handoff by combining NPC readiness, enabled skill matching, local rules retrieval, and the next shell safety step.",
      auditSummary: "Local assistant planned a readonly NPC-assisted RAG shell handoff preview.",
      auditDetail: `NPC-assisted readonly RAG shell handoff preview task: ${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && !npcPreviewPatterns.some((pattern) => pattern.test(message))
    && destructivePatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode !== "controlled-full") {
      return {
        kind: "permission-request",
        targetMode: "controlled-full",
        reason: "Controlled full permission is required before an NPC-assisted destructive shell cleanup task can continue.",
        riskSummary: "This task uses NPC collaboration to route into an enabled local shell-oriented skill, but destructive cleanup must still keep permission escalation, confirmation, audit logging, timeout, and rollback protections.",
        auditSummary: "Local assistant task requires a permission upgrade for NPC-assisted destructive shell execution.",
        auditDetail: `NPC-assisted destructive shell task is waiting for permission: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "confirmation",
      title: "Confirm NPC-assisted destructive cleanup",
      summary: "The assistant identified an NPC-assisted destructive cleanup request and requires explicit confirmation before execution.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "This will delete temporary workspace output after NPC collaboration routes into an enabled local shell-oriented skill, and must keep audit and rollback protections.",
      requiredMode: "controlled-full",
      safetySummary: "A snapshot preview must be available before NPC-assisted destructive execution continues.",
        auditSummary: "Local assistant task is waiting for NPC-assisted destructive confirmation.",
        auditDetail: `NPC-assisted high-risk assistant task is waiting for confirmation: ${message}`,
        queuedExecutionKind: "npc-local-enabled-shell-remove-temp-output",
        queuedExecutionTitle: "NPC-assisted temp-output removal",
        queuedExecutionAuditSummary: "Local assistant planned an NPC-assisted controlled-full temp-output removal task.",
        queuedExecutionAuditDetail: `NPC-assisted controlled-full shell command task: remove temp-output directory | request=${message}`,
        queuedMessage: message
      };
    }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && !npcPreviewPatterns.some((pattern) => pattern.test(message))
    && createTempOutputVerbPatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
    && createTempOutputContainerPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before an NPC-assisted temp-output creation task can modify the workspace.",
        riskSummary: "This task uses NPC collaboration to route into an enabled local shell-oriented skill and then writes only inside the approved workspace through the controlled shell runner.",
        auditSummary: "Local assistant task requires workspace-write permission for NPC-assisted shell execution.",
        auditDetail: `NPC-assisted workspace-write shell task is waiting for permission: ${message}`,
        queuedExecutionKind: "npc-local-enabled-shell-create-temp-output",
        queuedExecutionTitle: "NPC-assisted temp-output creation",
        queuedExecutionAuditSummary: "Local assistant planned an NPC-assisted workspace-write temp-output creation task.",
        queuedExecutionAuditDetail: `NPC-assisted workspace-write shell command task: create temp-output directory | request=${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "npc-local-enabled-shell-create-temp-output",
      title: "NPC-assisted temp-output creation",
      summary: message,
      auditSummary: "Local assistant planned an NPC-assisted workspace-write temp-output creation task.",
      auditDetail: `NPC-assisted workspace-write shell command task: create temp-output directory | request=${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && /\bshell\b/i.test(message)
    && npcPreviewPatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
  ) {
    return {
      kind: "npc-local-shell-plan-preview",
      title: "NPC shell plan preview",
      summary: "Preview a readonly NPC collaboration shell plan by combining NPC readiness, enabled skill routing, and the current shell safety chain.",
      auditSummary: "Local assistant planned a readonly NPC shell plan preview.",
      auditDetail: `Readonly NPC shell plan preview task: ${message}`
    };
  }

  if (
    /\bnpc\b/i.test(message)
    && /collaboration/i.test(message)
    && npcPreviewPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "npc-local-collaboration-preview",
      title: "NPC collaboration preview",
      summary: "Preview a readonly local NPC collaboration plan by combining NPC readiness, enabled skills, and local rules or docs context.",
      auditSummary: "Local assistant planned a readonly NPC collaboration preview.",
      auditDetail: `Readonly NPC collaboration preview task: ${message}`
    };
  }

  if (
    enabledSkillPatterns.some((pattern) => pattern.test(message))
    && skillMediationPatterns.some((pattern) => pattern.test(message))
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && continuationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && destructivePatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode !== "controlled-full") {
      return {
        kind: "permission-request",
        targetMode: "controlled-full",
        reason: "Controlled full permission is required before a skill-assisted RAG handoff destructive shell cleanup task can continue.",
        riskSummary: "This task first matches an enabled local skill, reviews local shell rules, and then continues into a destructive shell slice that must still keep permission escalation, confirmation, audit logging, timeout, and rollback protections.",
        auditSummary: "Local assistant task requires a permission upgrade for skill-assisted RAG handoff destructive shell execution.",
        auditDetail: `Skill-assisted RAG handoff destructive shell task is waiting for permission: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "confirmation",
      title: "Confirm skill-assisted RAG handoff destructive cleanup",
      summary: "The assistant identified a skill-assisted RAG handoff destructive cleanup request and requires explicit confirmation before execution.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "This will delete temporary workspace output after matching an enabled local skill and reviewing local shell rules, and must keep audit and rollback protections.",
      requiredMode: "controlled-full",
      safetySummary: "A snapshot preview must be available before skill-assisted RAG handoff destructive execution continues.",
      auditSummary: "Local assistant task is waiting for skill-assisted RAG handoff destructive confirmation.",
      auditDetail: `Skill-assisted RAG handoff high-risk assistant task is waiting for confirmation: ${message}`,
      queuedExecutionKind: "skills-local-enabled-rag-shell-remove-temp-output",
      queuedExecutionTitle: "Skill-assisted RAG handoff temp-output removal",
      queuedExecutionAuditSummary: "Local assistant planned a skill-assisted RAG handoff controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: `Skill-assisted RAG handoff controlled-full shell command task: remove temp-output directory | request=${message}`,
      queuedMessage: message
    };
  }

  if (
    enabledSkillPatterns.some((pattern) => pattern.test(message))
    && skillMediationPatterns.some((pattern) => pattern.test(message))
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && continuationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && createTempOutputVerbPatterns.some((pattern) => pattern.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
    && createTempOutputContainerPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before a skill-assisted RAG handoff temp-output creation task can modify the workspace.",
        riskSummary: "This task first matches an enabled local skill, reviews local shell rules, and then writes only inside the approved workspace through the controlled shell runner.",
        auditSummary: "Local assistant task requires workspace-write permission for skill-assisted RAG handoff shell execution.",
        auditDetail: `Skill-assisted RAG handoff workspace-write shell task is waiting for permission: ${message}`,
        queuedExecutionKind: "skills-local-enabled-rag-shell-create-temp-output",
        queuedExecutionTitle: "Skill-assisted RAG handoff temp-output creation",
        queuedExecutionAuditSummary: "Local assistant planned a skill-assisted RAG handoff workspace-write temp-output creation task.",
        queuedExecutionAuditDetail: `Skill-assisted RAG handoff workspace-write shell command task: create temp-output directory | request=${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "skills-local-enabled-rag-shell-create-temp-output",
      title: "Skill-assisted RAG handoff temp-output creation",
      summary: message,
      auditSummary: "Local assistant planned a skill-assisted RAG handoff workspace-write temp-output creation task.",
      auditDetail: `Skill-assisted RAG handoff workspace-write shell command task: create temp-output directory | request=${message}`
    };
  }

  if (
    enabledSkillPatterns.some((pattern) => pattern.test(message))
    && skillMediationPatterns.some((pattern) => pattern.test(message))
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && shellAutomationPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
    && createTempOutputNamePatterns.every((pattern) => pattern.test(message))
    && npcPreviewPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "skills-local-enabled-rag-shell-handoff-preview",
      title: "Skill-assisted RAG shell handoff preview",
      summary: "Preview a readonly docs-to-shell handoff by combining enabled skill matching, local rules retrieval, and the next shell safety step.",
      auditSummary: "Local assistant planned a skill-assisted readonly RAG shell handoff preview.",
      auditDetail: `Skill-assisted readonly RAG shell handoff preview task: ${message}`
    };
  }

  if (
    enabledSkillPatterns.some((pattern) => pattern.test(message))
    && skillMediationPatterns.some((pattern) => pattern.test(message))
    && localRagSearchPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
  ) {
    return {
      kind: "skills-local-enabled-rag-doc-search",
      title: "Skill-assisted local RAG document search",
      summary: "Match an enabled local skill first, then search local documentation and rule files through the readonly RAG fallback chain.",
      auditSummary: "Local assistant planned a skill-assisted readonly local RAG document search.",
      auditDetail: `Skill-assisted readonly local RAG search task: ${message}`
    };
  }

  if (
    localRagSearchPatterns.some((pattern) => pattern.test(message))
    && (/knowledge/i.test(message) || /docs?/i.test(message) || /rules?/i.test(message))
  ) {
    return {
      kind: "rag-local-doc-search",
      title: "Local RAG document search",
      summary: "Search local documentation and rule files through the readonly RAG fallback chain.",
      auditSummary: "Local assistant planned a local RAG document search.",
      auditDetail: `Readonly local RAG search task: ${message}`
    };
  }

  if (
    enabledSkillPatterns.some((pattern) => pattern.test(message)) &&
    skillMediationPatterns.some((pattern) => pattern.test(message)) &&
    shellAutomationPatterns.some((pattern) => pattern.test(message)) &&
    destructivePatterns.some((pattern) => pattern.test(message)) &&
    createTempOutputNamePatterns.every((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode !== "controlled-full") {
      return {
        kind: "permission-request",
        targetMode: "controlled-full",
        reason: "Controlled full permission is required before a skill-assisted destructive shell cleanup task can continue.",
        riskSummary: "This task first matches an enabled local shell-oriented skill, but destructive cleanup must still keep permission escalation, confirmation, audit logging, timeout, and rollback protections.",
        auditSummary: "Local assistant task requires a permission upgrade for skill-assisted destructive shell execution.",
        auditDetail: `Skill-assisted destructive shell task is waiting for permission: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "confirmation",
      title: "Confirm skill-assisted destructive cleanup",
      summary: "The assistant identified a skill-assisted destructive cleanup request and requires explicit confirmation before execution.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "This will delete temporary workspace output after matching an enabled local shell-oriented skill, and must keep audit and rollback protections.",
      requiredMode: "controlled-full",
      safetySummary: "A snapshot preview must be available before skill-assisted destructive execution continues.",
      auditSummary: "Local assistant task is waiting for skill-assisted destructive confirmation.",
      auditDetail: `Skill-assisted high-risk assistant task is waiting for confirmation: ${message}`,
      queuedExecutionKind: "skills-local-enabled-shell-remove-temp-output",
      queuedExecutionTitle: "Skill-assisted temp-output removal",
      queuedExecutionAuditSummary: "Local assistant planned a skill-assisted controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: `Skill-assisted controlled-full shell command task: remove temp-output directory | request=${message}`,
      queuedMessage: message
    };
  }

  if (
    enabledSkillPatterns.some((pattern) => pattern.test(message)) &&
    skillMediationPatterns.some((pattern) => pattern.test(message)) &&
    shellAutomationPatterns.some((pattern) => pattern.test(message)) &&
    createTempOutputVerbPatterns.some((pattern) => pattern.test(message)) &&
    createTempOutputNamePatterns.every((pattern) => pattern.test(message)) &&
    createTempOutputContainerPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before a skill-assisted temp-output creation task can modify the workspace.",
        riskSummary: "This task first matches an enabled local shell-oriented skill and then writes only inside the approved workspace through the controlled shell runner.",
        auditSummary: "Local assistant task requires workspace-write permission for skill-assisted shell execution.",
        auditDetail: `Skill-assisted workspace-write shell task is waiting for permission: ${message}`,
        queuedExecutionKind: "skills-local-enabled-shell-create-temp-output",
        queuedExecutionTitle: "Skill-assisted temp-output creation",
        queuedExecutionAuditSummary: "Local assistant planned a skill-assisted workspace-write temp-output creation task.",
        queuedExecutionAuditDetail: `Skill-assisted workspace-write shell command task: create temp-output directory | request=${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "skills-local-enabled-shell-create-temp-output",
      title: "Skill-assisted temp-output creation",
      summary: message,
      auditSummary: "Local assistant planned a skill-assisted workspace-write temp-output creation task.",
      auditDetail: `Skill-assisted workspace-write shell command task: create temp-output directory | request=${message}`
    };
  }

  if (
    createTempOutputVerbPatterns.some((pattern) => pattern.test(message)) &&
    createTempOutputNamePatterns.every((pattern) => pattern.test(message)) &&
    createTempOutputContainerPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before creating the temp-output directory.",
        riskSummary: "This command writes only inside the approved workspace and remains blocked from destructive shell actions.",
        auditSummary: "Local assistant task requires workspace-write permission.",
        auditDetail: `Workspace write assistant task is waiting for permission: ${message}`,
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        queuedExecutionAuditDetail: `Workspace write shell command task: create temp-output directory | request=${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "workspace-write-create-temp-output",
      title: "Create temp-output directory",
      summary: "Create the temp-output workspace directory through the controlled shell runner.",
      auditSummary: "Local assistant planned a workspace-write temp-output creation command.",
      auditDetail: `Workspace write shell command task: create temp-output directory | request=${message}`
    };
  }

  if (destructivePatterns.some((pattern) => pattern.test(message))) {
    if (request.permissionMode !== "controlled-full") {
      return {
        kind: "permission-request",
        targetMode: "controlled-full",
        reason: "Controlled full permission is required before planning a destructive cleanup task.",
        riskSummary: "High-risk cleanup must keep permission escalation, confirmation, audit logging, timeout, and rollback protections.",
        auditSummary: "Local assistant task requires a permission upgrade.",
        auditDetail: `High-risk assistant task is waiting for permission: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "confirmation",
      title: "Confirm destructive cleanup",
      summary: "The assistant identified a destructive cleanup request and requires explicit confirmation before execution.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "This will delete temporary workspace output and must keep audit and rollback protections.",
      requiredMode: "controlled-full",
      safetySummary: "A snapshot preview must be available before destructive execution continues.",
      auditSummary: "Local assistant task is waiting for destructive confirmation.",
      auditDetail: `High-risk assistant task is waiting for confirmation: ${message}`,
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal command.",
      queuedExecutionAuditDetail: `Controlled full shell command task: remove temp-output directory | request=${message}`,
      queuedMessage: message
    };
  }

  if (gitStatusPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "readonly-shell-git-status",
      title: "Workspace git status",
      summary: "Run a readonly git status diagnostic before deeper assistant execution.",
      auditSummary: "Local assistant planned a readonly git status command.",
      auditDetail: `Readonly shell command task: git status --short | request=${message}`
    };
  }

  if (workspaceRootPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "readonly-shell-workspace-root",
      title: "Workspace root files",
      summary: "List top-level workspace files through the controlled readonly shell runner.",
      auditSummary: "Local assistant planned a readonly workspace root listing.",
      auditDetail: `Readonly shell command task: workspace root listing | request=${message}`
    };
  }

  if (packagesDirectoryPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "readonly-shell-packages-dir",
      title: "Workspace packages directory",
      summary: "List package folders through the controlled readonly shell runner.",
      auditSummary: "Local assistant planned a readonly packages directory listing.",
      auditDetail: `Readonly shell command task: packages directory listing | request=${message}`
    };
  }

  if (ragCapabilityPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "capability-rag-overview",
      title: "OpenClaw RAG capability overview",
      summary: "Inspect local OpenClaw RAG package foundations before deeper execution wiring.",
      auditSummary: "Local assistant planned an OpenClaw RAG capability overview.",
      auditDetail: `Readonly capability catalog task: rag | request=${message}`
    };
  }

  if (
    /\bskills?\b/i.test(message)
    && localEnabledSkillsPatterns.some((pattern) => pattern.test(message))
    && localEnabledSkillMatchPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "skills-local-enabled-match",
      title: "Match enabled local skills",
      summary: message,
      auditSummary: "Local assistant planned an enabled local skills match task.",
      auditDetail: `Readonly enabled local skills match task: ${message}`
    };
  }

  if (
    /\bskills?\b/i.test(message)
    && localEnabledSkillsPatterns.some((pattern) => pattern.test(message))
    && (/\bshow\b/i.test(message) || /\blist\b/i.test(message) || /\bwhat\b/i.test(message))
  ) {
    return {
      kind: "skills-local-enabled-list",
      title: "Enabled local skills",
      summary: "List the currently enabled local workspace skills from the controlled workspace registry.",
      auditSummary: "Local assistant planned an enabled local skills list task.",
      auditDetail: `Readonly enabled local skills list task: ${message}`
    };
  }

  if (
    /\bskills?\b/i.test(message)
    && localSkillsScanPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "skills-local-scan",
      title: "Local Skills scan",
      summary: "Scan local skill directories and summarize the currently discoverable skill entries.",
      auditSummary: "Local assistant planned a local skills scan.",
      auditDetail: `Readonly local skills scan task: ${message}`
    };
  }

  if (
    /\bskills?\b/i.test(message)
    && localSkillInspectPatterns.some((pattern) => pattern.test(message))
  ) {
    return {
      kind: "skills-local-inspect",
      title: "Local Skill detail",
      summary: message,
      auditSummary: "Local assistant planned a local skill detail lookup.",
      auditDetail: `Readonly local skill detail task: ${message}`
    };
  }

  if (
    /\bskills?\b/i.test(message)
    && localSkillInstallPatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before installing a local skill into the workspace skills directory.",
        riskSummary: "This task copies an approved local skill into the workspace-local skills directory so it can later be enabled, reviewed, or matched through the normal assistant chain.",
        auditSummary: "Local assistant task requires workspace-write permission for local skill installation.",
        auditDetail: `Workspace write local skill installation task is waiting for permission: ${message}`,
        queuedExecutionKind: "skills-local-install",
        queuedExecutionTitle: "Install local skill",
        queuedExecutionAuditSummary: "Local assistant planned a local skill installation task.",
        queuedExecutionAuditDetail: `Workspace write local skill installation task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "skills-local-install",
      title: "Install local skill",
      summary: message,
      auditSummary: "Local assistant planned a local skill installation task.",
      auditDetail: `Workspace write local skill installation task: ${message}`
    };
  }

  if (
    /\bskills?\b/i.test(message)
    && localSkillDisablePatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before disabling a local skill in the workspace registry.",
        riskSummary: "This task removes only a controlled local skill registry entry inside the approved workspace and does not execute the skill.",
        auditSummary: "Local assistant task requires workspace-write permission for skill disablement.",
        auditDetail: `Workspace write local skill disable task is waiting for permission: ${message}`,
        queuedExecutionKind: "skills-local-disable",
        queuedExecutionTitle: "Disable local skill",
        queuedExecutionAuditSummary: "Local assistant planned a local skill disable task.",
        queuedExecutionAuditDetail: `Workspace write local skill disable task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "skills-local-disable",
      title: "Disable local skill",
      summary: message,
      auditSummary: "Local assistant planned a local skill disable task.",
      auditDetail: `Workspace write local skill disable task: ${message}`
    };
  }

  if (
    /\bskills?\b/i.test(message)
    && localSkillEnablePatterns.some((pattern) => pattern.test(message))
  ) {
    if (request.permissionMode === "readonly") {
      return {
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before enabling a local skill in the workspace registry.",
        riskSummary: "This task writes only a controlled local skill registry entry inside the approved workspace and does not execute the skill.",
        auditSummary: "Local assistant task requires workspace-write permission for skill enablement.",
        auditDetail: `Workspace write local skill enable task is waiting for permission: ${message}`,
        queuedExecutionKind: "skills-local-enable",
        queuedExecutionTitle: "Enable local skill",
        queuedExecutionAuditSummary: "Local assistant planned a local skill enable task.",
        queuedExecutionAuditDetail: `Workspace write local skill enable task: ${message}`,
        queuedMessage: message
      };
    }

    return {
      kind: "skills-local-enable",
      title: "Enable local skill",
      summary: message,
      auditSummary: "Local assistant planned a local skill enable task.",
      auditDetail: `Workspace write local skill enable task: ${message}`
    };
  }

  if (skillsCapabilityPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "capability-skills-overview",
      title: "OpenClaw Skills capability overview",
      summary: "Inspect local OpenClaw Skills package foundations before enablement and audit wiring expand.",
      auditSummary: "Local assistant planned an OpenClaw Skills capability overview.",
      auditDetail: `Readonly capability catalog task: skills | request=${message}`
    };
  }

  if (npcCapabilityPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "capability-npc-overview",
      title: "OpenClaw NPC capability overview",
      summary: "Inspect local OpenClaw NPC package foundations before persona and collaboration execution wiring expand.",
      auditSummary: "Local assistant planned an OpenClaw NPC capability overview.",
      auditDetail: `Readonly capability catalog task: npc | request=${message}`
    };
  }

  if (mcpCapabilityPatterns.some((pattern) => pattern.test(message))) {
    if (
      /\bplugins?\b/i.test(message)
      && /\bstart\b/i.test(message)
      && /\b(local|locally)\b/i.test(message)
      && !/\bpreview\b/i.test(message)
    ) {
      if (request.permissionMode !== "controlled-full") {
        return {
          kind: "permission-request",
          targetMode: "controlled-full",
          reason: "Controlled full permission is required before starting a local MCP plugin process.",
          riskSummary: "This task starts a local MCP-adjacent plugin process and must keep permission escalation, dangerous confirmation, audit logging, timeout, and rollback-visible protections.",
          auditSummary: "Local assistant task requires a permission upgrade for local MCP plugin start.",
          auditDetail: `Local MCP plugin start task is waiting for permission: ${message}`,
          queuedExecutionKind: "mcp-local-plugin-start",
          queuedExecutionTitle: "Local MCP plugin start",
          queuedExecutionAuditSummary: "Local assistant planned a controlled local MCP plugin start task.",
          queuedExecutionAuditDetail: `Controlled local MCP plugin start task: ${message}`,
          queuedMessage: message
        };
      }

      return {
        kind: "confirmation",
        title: "Confirm local MCP plugin start",
        summary: "The assistant identified a real local MCP plugin start request and requires explicit confirmation before execution.",
        commandPreview: "npx openclaw-extension-browser",
        impact: "This will start a local MCP-adjacent plugin process through a tightly scoped desktop runner.",
        requiredMode: "controlled-full",
        safetySummary: "A preview and audit record must remain available before local MCP plugin execution continues.",
        auditSummary: "Local assistant task is waiting for local MCP plugin start confirmation.",
        auditDetail: `Local MCP plugin start task is waiting for confirmation: ${message}`,
        queuedExecutionKind: "mcp-local-plugin-start",
        queuedExecutionTitle: "Local MCP plugin start",
        queuedExecutionAuditSummary: "Local assistant planned a controlled local MCP plugin start task.",
        queuedExecutionAuditDetail: `Controlled local MCP plugin start task: ${message}`,
        queuedMessage: message
      };
    }

    if (
      /\bplugins?\b/i.test(message)
      && mcpLocalPluginStartPreviewPatterns.some((pattern) => pattern.test(message))
      && /\b(local|locally)\b/i.test(message)
    ) {
      return {
        kind: "mcp-local-plugin-start-preview",
        title: "Local MCP plugin start preview",
        summary: message,
        auditSummary: "Local assistant planned a readonly local MCP plugin start preview.",
        auditDetail: `Readonly local MCP plugin start preview task: ${message}`
      };
    }

    if (
      /\bplugins?\b/i.test(message)
      && mcpLocalPluginInspectPatterns.some((pattern) => pattern.test(message))
    ) {
      return {
        kind: "mcp-local-plugin-inspect",
        title: "Local MCP plugin detail",
        summary: message,
        auditSummary: "Local assistant planned a readonly local MCP plugin detail lookup.",
        auditDetail: `Readonly local MCP plugin detail task: ${message}`
      };
    }

    if (mcpLocalPluginScanPatterns.some((pattern) => pattern.test(message))) {
      return {
        kind: "mcp-local-plugin-scan",
        title: "Local MCP plugin scan",
        summary: "Scan approved local OpenClaw plugin manifests and summarize MCP-adjacent plugin entries.",
        auditSummary: "Local assistant planned a readonly local MCP plugin scan.",
        auditDetail: `Readonly local MCP plugin scan task: ${message}`
      };
    }

    return {
      kind: "capability-mcp-overview",
      title: "OpenClaw MCP capability overview",
      summary: "Inspect local OpenClaw MCP package foundations before external tool server wiring expands.",
      auditSummary: "Local assistant planned an OpenClaw MCP capability overview.",
      auditDetail: `Readonly capability catalog task: mcp | request=${message}`
    };
  }

  if (configOverviewPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "workspace-config-overview",
      title: "Workspace config overview",
      summary: "Inspect workspace config files and root scripts before controlled execution.",
      auditSummary: "Local assistant planned a workspace config overview task.",
      auditDetail: `Readonly workspace config overview task: ${message}`
    };
  }

  if (packagesOverviewPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "packages-overview",
      title: "Workspace packages overview",
      summary: "Inspect local workspace packages and script coverage before deeper tool wiring.",
      auditSummary: "Local assistant planned a packages overview task.",
      auditDetail: `Readonly workspace packages overview task: ${message}`
    };
  }

  return {
    kind: "assistant-help-overview",
    title: "Assistant help overview",
    summary: "Summarize the local desktop assistant's current core capabilities and the safest next-step suggestions for the user.",
    auditSummary: "Local assistant planned a default user-facing help overview.",
    auditDetail: `Default user-facing assistant help overview task: ${message}`
  };
}
