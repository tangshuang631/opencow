import type {
  ControlledCommandAnalysis,
  ControlledPermissionMode
} from "@opencow/openclaw-adapter/browser";

export interface ShellAuditEvent {
  readonly module: "shell-runtime";
  readonly source: "command_policy";
  readonly summary: string;
  readonly detail: string;
}

export interface ShellCommandPlanRequest {
  readonly command: string;
  readonly cwd: string;
  readonly allowedRoots: readonly string[];
  readonly permissionMode: ControlledPermissionMode;
  readonly timeoutMs: number;
}

export interface ShellCommandPlan {
  readonly status: ControlledCommandAnalysis["status"];
  readonly requiresConfirmation: boolean;
  readonly requiredPermission: ControlledPermissionMode;
  readonly timeoutMs: number;
  readonly command: string;
  readonly cwd: string;
  readonly auditEvent: ShellAuditEvent;
}
