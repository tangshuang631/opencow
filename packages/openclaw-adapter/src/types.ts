export interface OpenClawMetadata {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly repositoryUrl: string;
}

export interface OpenClawCapability {
  readonly available: boolean;
  readonly packageName: string;
  readonly packagePath: string;
}

export interface OpenClawCapabilities {
  readonly llmCore: OpenClawCapability;
  readonly llmRuntime: OpenClawCapability;
  readonly modelCatalog: OpenClawCapability;
  readonly pluginSdk: OpenClawCapability;
  readonly terminalCore: OpenClawCapability;
  readonly toolCallRepair: OpenClawCapability;
}

export interface OpenClawWorkspacePackage {
  readonly directoryName: string;
  readonly packageName: string;
  readonly version: string;
  readonly private: boolean;
  readonly packagePath: string;
}

export interface LocalAssistantTaskRequest {
  readonly message: string;
  readonly permissionMode: ControlledPermissionMode;
}

export type LocalAssistantTaskPlan =
  | {
      readonly kind: "assistant-help-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "workspace-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "packages-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "workspace-config-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "opencow-self-repair-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "opencow-self-repair-enabled-skills-registry";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "capability-rag-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "capability-skills-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-scan";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-inspect";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-install";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enable";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-disable";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-list";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-match";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-shell-create-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-shell-remove-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-enabled-shell-create-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-enabled-shell-remove-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-enabled-rag-shell-create-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-enabled-rag-shell-remove-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-rag-doc-search";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "rag-local-shell-handoff-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-rag-shell-handoff-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-enabled-rag-shell-handoff-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-rag-shell-create-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "skills-local-enabled-rag-shell-remove-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "rag-local-shell-create-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "rag-local-shell-remove-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-collaboration-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-project-showcase-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "npc-local-shell-plan-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "capability-npc-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "capability-mcp-overview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "mcp-local-plugin-scan";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "mcp-local-plugin-inspect";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "mcp-local-plugin-start-preview";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "mcp-local-plugin-start";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "rag-local-doc-search";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "readonly-shell-git-status";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "readonly-shell-workspace-root";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "readonly-shell-packages-dir";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "workspace-write-create-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "workspace-project-run";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "workspace-project-status";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "workspace-project-stop";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "controlled-full-remove-temp-output";
      readonly title: string;
      readonly summary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
    }
  | {
      readonly kind: "permission-request";
      readonly targetMode: ControlledPermissionMode;
      readonly reason: string;
      readonly riskSummary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
      readonly queuedExecutionKind?: Extract<
        LocalAssistantTaskPlan["kind"],
        | "assistant-help-overview"
        | "workspace-overview"
        | "packages-overview"
        | "workspace-config-overview"
        | "opencow-self-repair-preview"
        | "opencow-self-repair-enabled-skills-registry"
        | "capability-rag-overview"
        | "capability-skills-overview"
        | "skills-local-scan"
        | "skills-local-inspect"
        | "skills-local-install"
        | "skills-local-enable"
        | "skills-local-disable"
        | "skills-local-enabled-list"
        | "skills-local-enabled-match"
        | "skills-local-enabled-shell-create-temp-output"
        | "skills-local-enabled-shell-remove-temp-output"
        | "npc-local-enabled-shell-create-temp-output"
        | "npc-local-enabled-shell-remove-temp-output"
        | "npc-local-enabled-rag-shell-create-temp-output"
        | "npc-local-enabled-rag-shell-remove-temp-output"
        | "skills-local-enabled-rag-doc-search"
        | "rag-local-shell-handoff-preview"
        | "skills-local-enabled-rag-shell-handoff-preview"
        | "npc-local-enabled-rag-shell-handoff-preview"
        | "rag-local-shell-create-temp-output"
        | "rag-local-shell-remove-temp-output"
        | "skills-local-enabled-rag-shell-create-temp-output"
        | "skills-local-enabled-rag-shell-remove-temp-output"
        | "npc-local-collaboration-preview"
        | "npc-local-project-showcase-preview"
        | "npc-local-shell-plan-preview"
        | "capability-npc-overview"
        | "capability-mcp-overview"
        | "mcp-local-plugin-scan"
        | "mcp-local-plugin-inspect"
        | "mcp-local-plugin-start-preview"
        | "mcp-local-plugin-start"
        | "rag-local-doc-search"
        | "readonly-shell-git-status"
        | "readonly-shell-workspace-root"
        | "readonly-shell-packages-dir"
        | "workspace-write-create-temp-output"
        | "workspace-project-run"
        | "workspace-project-status"
        | "workspace-project-stop"
        | "controlled-full-remove-temp-output"
        | "mcp-local-plugin-start"
      >;
      readonly queuedExecutionTitle?: string;
      readonly queuedExecutionAuditSummary?: string;
      readonly queuedExecutionAuditDetail?: string;
      readonly queuedMessage?: string;
    }
  | {
      readonly kind: "confirmation";
      readonly title: string;
      readonly summary: string;
      readonly commandPreview: string;
      readonly impact: string;
      readonly requiredMode: ControlledPermissionMode;
      readonly safetySummary: string;
      readonly auditSummary: string;
      readonly auditDetail: string;
      readonly queuedExecutionKind?: Extract<
        LocalAssistantTaskPlan["kind"],
        | "controlled-full-remove-temp-output"
        | "rag-local-shell-remove-temp-output"
        | "skills-local-enabled-shell-remove-temp-output"
        | "npc-local-enabled-rag-shell-remove-temp-output"
        | "skills-local-enabled-rag-shell-remove-temp-output"
        | "npc-local-enabled-shell-remove-temp-output"
        | "mcp-local-plugin-start"
      >;
      readonly queuedExecutionTitle?: string;
      readonly queuedExecutionAuditSummary?: string;
      readonly queuedExecutionAuditDetail?: string;
      readonly queuedMessage?: string;
    };

export type ControlledPermissionMode = "readonly" | "workspace-write" | "controlled-full";

export type ControlledCommandStatus = "blocked" | "needs-confirmation" | "ready";
export type ControlledCommandRiskLevel = "low" | "medium" | "high";
export type ControlledCommandReasonCode =
  | "allowed"
  | "permission_denied"
  | "permission_upgrade_required"
  | "cwd_outside_allowed_roots"
  | "high_risk_confirmation_required";

export interface ControlledCommandRequest {
  readonly command: string;
  readonly cwd: string;
  readonly allowedRoots: readonly string[];
  readonly permissionMode: ControlledPermissionMode;
}

export interface ControlledCommandAnalysis {
  readonly status: ControlledCommandStatus;
  readonly riskLevel: ControlledCommandRiskLevel;
  readonly reasonCode: ControlledCommandReasonCode;
  readonly requiresConfirmation: boolean;
  readonly requiredPermission: ControlledPermissionMode;
  readonly auditSummary: string;
  readonly auditDetail: string;
}
