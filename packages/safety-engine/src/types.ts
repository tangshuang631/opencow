import type { ShellCommandPlan } from "@opencow/shell-runtime";

export interface SafetyGuardOptions {
  readonly snapshotAvailable: boolean;
}

export interface SafetyGuardResult {
  readonly status: "ready" | "requires-snapshot" | "blocked";
  readonly requiresSnapshot: boolean;
  readonly requiresPreview: boolean;
  readonly reason: "none" | "snapshot-unavailable";
}

export interface SafetyPlanInput extends ShellCommandPlan {}
