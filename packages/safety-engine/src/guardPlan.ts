import type { SafetyGuardOptions, SafetyGuardResult, SafetyPlanInput } from "./types.js";

export function guardExecutionPlan(plan: SafetyPlanInput, options: SafetyGuardOptions): SafetyGuardResult {
  const destructive = /remove-item|rm\b|del\s+|rmdir/i.test(plan.command);

  if (!destructive) {
    return {
      status: "ready",
      requiresSnapshot: false,
      requiresPreview: false,
      reason: "none"
    };
  }

  if (!options.snapshotAvailable) {
    return {
      status: "blocked",
      requiresSnapshot: true,
      requiresPreview: true,
      reason: "snapshot-unavailable"
    };
  }

  return {
    status: "requires-snapshot",
    requiresSnapshot: true,
    requiresPreview: true,
    reason: "none"
  };
}
