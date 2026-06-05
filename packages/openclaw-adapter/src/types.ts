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
