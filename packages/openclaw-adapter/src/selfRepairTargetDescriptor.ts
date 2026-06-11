export type OpenclawSelfRepairTargetDescriptor = {
  label: "enabled skills registry" | "workspace project runtime registry" | null;
  path: string | null;
  continueRequest: string | null;
};

export function resolveOpencowSelfRepairTargetDescriptor(query: string): OpenclawSelfRepairTargetDescriptor {
  const normalized = query.toLowerCase();

  if (
    (normalized.includes("enabled") && normalized.includes("skill"))
  ) {
    return {
      label: "enabled skills registry",
      path: ".opencow/skills/enabled-skills.json",
      continueRequest: "diagnose opencow and continue repairing its enabled skills registry"
    };
  }

  if (
    (normalized.includes("runtime") && normalized.includes("registry"))
    || normalized.includes(".opencow/runtime/workspace-project-runs.json")
  ) {
    return {
      label: "workspace project runtime registry",
      path: ".opencow/runtime/workspace-project-runs.json",
      continueRequest: "diagnose opencow and continue repairing its workspace project runtime registry"
    };
  }

  return {
    label: null,
    path: null,
    continueRequest: null
  };
}
