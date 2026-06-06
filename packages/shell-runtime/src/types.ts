import type {
  ControlledCommandAnalysis,
  ControlledPermissionMode
} from "@opencow/openclaw-adapter/browser";
import type { AuditEvent } from "@opencow/audit-core";

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
  readonly auditEvent: AuditEvent;
}
