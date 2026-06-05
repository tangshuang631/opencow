export type PermissionMode = "readonly" | "workspace-write" | "controlled-full";

export type WorkbenchState = {
  model: {
    label: string;
    status: string;
    remoteApiEnabled: boolean;
  };
  permission: {
    mode: PermissionMode;
    label: string;
  };
  rollback: {
    defaultLimit: number;
    maxLimit: number;
  };
  search: {
    enabled: boolean;
  };
};

export function createInitialWorkbenchState(): WorkbenchState {
  return {
    model: {
      label: "Ollama 本地优先",
      status: "等待检测",
      remoteApiEnabled: false
    },
    permission: {
      mode: "readonly",
      label: "只读"
    },
    rollback: {
      defaultLimit: 10,
      maxLimit: 20
    },
    search: {
      enabled: false
    }
  };
}
