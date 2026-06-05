import type { ControlledPermissionMode } from "@opencow/openclaw-adapter/browser";
import type { ShellCommandPlan } from "@opencow/shell-runtime";

export interface PermissionEscalationRequest {
  readonly targetMode: ControlledPermissionMode;
  readonly reason: string;
  readonly riskSummary: string;
}

export interface PermissionPlanInput extends ShellCommandPlan {}
