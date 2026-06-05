import { describe, expect, it } from "vitest";
import {
  approvePendingConfirmationState,
  cancelPendingConfirmationState,
  createInitialWorkbenchState,
  createHighRiskConfirmationState,
  createOllamaLoadErrorState
} from "./workbenchState";

describe("createInitialWorkbenchState", () => {
  it("uses local Ollama, read-only permission, and 10 rollback points by default", () => {
    const state = createInitialWorkbenchState();

    expect(state.model.label).toBe("Ollama 本地优先");
    expect(state.model.remoteApiEnabled).toBe(false);
    expect(state.settings.remoteApi.baseUrl).toBe("");
    expect(state.settings.remoteApi.collapsed).toBe(true);
    expect(state.permission.mode).toBe("readonly");
    expect(state.permission.summary).toBe("仅允许读取已授权目录与附件。");
    expect(state.permission.requiresConfirmation).toBe(true);
    expect(state.rollback.defaultLimit).toBe(10);
    expect(state.rollback.maxLimit).toBe(20);
    expect(state.rollback.entries).toHaveLength(1);
    expect(state.rollback.entries[0]?.label).toBe("启动基线");
  });

  it("keeps a safe rollback record when ollama loading throws", () => {
    const state = createInitialWorkbenchState();

    const updated = createOllamaLoadErrorState(state, "connect ECONNREFUSED 127.0.0.1:11434");

    expect(updated.error?.summary).toBe("无法连接本地 Ollama");
    expect(updated.audit.summary).toBe("Ollama 状态读取失败，工作台保持可用");
    expect(updated.rollback.entries).toHaveLength(2);
    expect(updated.rollback.entries[1]?.label).toBe("异常保护");
  });

  it("tracks a pending high-risk confirmation before dangerous actions run", () => {
    const state = createInitialWorkbenchState();

    const updated = createHighRiskConfirmationState(state, {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    expect(updated.confirmation.pending).toMatchObject({
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });
    expect(updated.audit.summary).toBe("等待用户确认高风险操作");
    expect(updated.audit.lastEvent.source).toBe("permission_confirmation");
  });

  it("records an approved high-risk confirmation and clears the pending request", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    const updated = approvePendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.audit.summary).toBe("用户已批准高风险操作");
    expect(updated.audit.lastEvent.source).toBe("permission_confirmation_approved");
    expect(updated.rollback.entries[1]?.label).toBe("已批准操作");
  });

  it("records a cancelled high-risk confirmation and keeps the app safe", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    const updated = cancelPendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.audit.summary).toBe("用户已取消高风险操作");
    expect(updated.audit.lastEvent.source).toBe("permission_confirmation_cancelled");
    expect(updated.rollback.entries[1]?.label).toBe("已取消操作");
  });
});
