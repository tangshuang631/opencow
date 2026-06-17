import { describe, expect, it } from "vitest";
import {
  deleteRecentConversationState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createNewConversationState,
  createTaskExecutionCancelledState,
  createTaskExecutionSucceededState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  requestRollbackPreviewState,
  requestPermissionModeChangeState
} from "./workbenchState";

describe("createNewConversationState", () => {
  it("starts a blank conversation without carrying over old permission or dangerous confirmations", () => {
    const pendingPermission = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    const pendingDangerousConfirmation = createHighRiskConfirmationState(pendingPermission, {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });

    const next = createNewConversationState(pendingDangerousConfirmation);

    expect(next.conversation.entries).toHaveLength(0);
    expect(next.permission.pendingModeChange).toBeNull();
    expect(next.confirmation.pending).toBeNull();
    expect(next.permission.mode).toBe("readonly");
    expect(next.audit.lastEvent.source).toBe("conversation_new");
    expect(next.audit.lastEvent.detail).toContain("cleared pending permission and confirmation gates");
    expect(next.audit.lastEvent.detail).toContain("No active local task queue was preserved.");
  });

  it("records that a new conversation clears pending rollback previews", () => {
    const pendingRollbackPreview = requestRollbackPreviewState(createInitialWorkbenchState(), "startup-baseline");

    const next = createNewConversationState(pendingRollbackPreview);

    expect(pendingRollbackPreview.rollback.pendingPreview).not.toBeNull();
    expect(next.rollback.pendingPreview).toBeNull();
    expect(next.audit.lastEvent.source).toBe("conversation_new");
    expect(next.audit.lastEvent.detail).toContain("cleared pending rollback preview");
  });

  it("records when a blank conversation has no active local task queue to preserve", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "generate an NPC config",
        executionKind: "npc-config-write",
        executionTitle: "Generate NPC config"
      })
    );
    const cancelled = createTaskExecutionCancelledState(running);

    const next = createNewConversationState(cancelled);

    expect(next.tasks.activeTaskId).toBeNull();
    expect(next.tasks.pendingCount).toBe(0);
    expect(next.tasks.items).toHaveLength(0);
    expect(next.audit.lastEvent.detail).toContain("No active local task queue was preserved.");
    expect(next.audit.lastEvent.detail).not.toContain("active local task queue were preserved");
  });

  it("records preserved queued and running task counts when a caller keeps them", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace"
    });
    const secondQueued = createUserTaskSubmittedState(queued, {
      message: "scan local skills"
    });
    const running = createTaskExecutionStartedState(secondQueued);

    const next = createNewConversationState(running);

    expect(next.tasks.activeTaskId).toBe(running.tasks.activeTaskId);
    expect(next.tasks.pendingCount).toBe(1);
    expect(next.tasks.items).toHaveLength(2);
    expect(next.audit.lastEvent.detail).toContain("Preserved active local task queue: queued=1, running=1.");
  });

  it("keeps the latest non-empty conversation in history when starting a blank new conversation", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "保留这段历史，供下次恢复"
    });

    const next = createNewConversationState(submitted);

    expect(next.conversation.entries).toHaveLength(0);
    expect(next.history.lastNonEmptyConversationEntries.some(
      (entry) => entry.summary === "保留这段历史，供下次恢复"
    )).toBe(true);
  });

  it("adds the latest non-empty conversation into recent conversation history when starting a blank new conversation", () => {
    const completed = createTaskExecutionSucceededState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "请把这段会话放进最近历史"
        })
      ),
      {
        resultTitle: "最近历史测试答复",
        resultSummary: "这段答复应该一起进入最近会话历史。"
      }
    );

    const next = createNewConversationState(completed);

    expect(next.history.recentConversations).toHaveLength(1);
    expect(next.history.recentConversations[0]?.title).toContain("请把这段会话放进最近历史");
    expect(next.history.recentConversations[0]?.summary).toContain("这段答复应该一起进入最近会话历史。");
    expect(next.history.recentConversations[0]?.entries.some(
      (entry) => entry.summary === "请把这段会话放进最近历史"
    )).toBe(true);
  });

  it("keeps the newest recent conversation at the top of the history list", () => {
    const initial = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [],
        recentConversations: [
          {
            id: "recent-conversation-old",
            title: "更早的最近会话",
            summary: "这条应该被新会话顶到后面。",
            entries: [
              {
                id: "old-entry",
                kind: "user" as const,
                title: "用户",
                summary: "更早的最近会话"
              }
            ]
          }
        ]
      }
    };

    const completed = createTaskExecutionSucceededState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(initial, {
          message: "新的最近会话应该排在最前面"
        })
      ),
      {
        resultTitle: "新的最近会话结果",
        resultSummary: "这条最近会话应该成为列表第一项。"
      }
    );

    const next = createNewConversationState(completed);

    expect(next.history.recentConversations[0]?.title).toContain("新的最近会话应该排在最前面");
    expect(next.history.recentConversations[1]?.title).toBe("更早的最近会话");
  });

  it("switches away from the current restored conversation when that recent conversation is deleted", () => {
    const currentEntries = [
      {
        id: "current-recent-entry",
        kind: "user" as const,
        title: "用户",
        summary: "当前查看的是最近会话 A"
      }
    ];
    const fallbackEntries = [
      {
        id: "fallback-entry",
        kind: "user" as const,
        title: "用户",
        summary: "删除 A 后应该切到这里"
      }
    ];
    const state = {
      ...createInitialWorkbenchState(),
      conversation: {
        entries: currentEntries
      },
      history: {
        lastNonEmptyConversationEntries: currentEntries,
        recentConversations: [
          {
            id: "recent-a",
            title: "会话 A",
            summary: "当前查看的是最近会话 A",
            entries: currentEntries
          },
          {
            id: "recent-b",
            title: "会话 B",
            summary: "删除 A 后应该切到这里",
            entries: fallbackEntries
          }
        ]
      }
    };

    const next = deleteRecentConversationState(state, "recent-a");

    expect(next.conversation.entries[0]?.summary).toBe("删除 A 后应该切到这里");
    expect(next.history.recentConversations.map((item) => item.id)).toEqual(["recent-b"]);
  });
});
