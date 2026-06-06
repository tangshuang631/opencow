import { describe, expect, it } from "vitest";
import {
  appendRollbackEntry,
  applyRollback,
  createRollbackJournal,
  previewRollback
} from "./index.js";

describe("createRollbackJournal", () => {
  it("uses 10 rollback points by default and caps the maximum at 20", () => {
    const journal = createRollbackJournal({
      baselineEntry: {
        id: "startup-baseline",
        label: "启动基线",
        summary: "应用启动后的本地安全初始状态。",
        createdAt: "2026-06-06T02:00:00.000Z",
        scope: "session"
      }
    });

    expect(journal.defaultLimit).toBe(10);
    expect(journal.activeLimit).toBe(10);
    expect(journal.maxLimit).toBe(20);
    expect(journal.entries).toHaveLength(1);
  });

  it("clamps active limit when settings exceed the supported maximum", () => {
    const journal = createRollbackJournal({
      defaultLimit: 12,
      activeLimit: 24,
      maxLimit: 30
    });

    expect(journal.defaultLimit).toBe(12);
    expect(journal.activeLimit).toBe(20);
    expect(journal.maxLimit).toBe(20);
  });
});

describe("appendRollbackEntry", () => {
  it("keeps the newest entries within the active rollback limit", () => {
    let journal = createRollbackJournal({
      activeLimit: 3,
      baselineEntry: {
        id: "startup-baseline",
        label: "启动基线",
        summary: "应用启动后的本地安全初始状态。",
        createdAt: "2026-06-06T02:00:00.000Z",
        scope: "session"
      }
    });

    journal = appendRollbackEntry(journal, {
      id: "entry-1",
      label: "第 1 次操作",
      summary: "记录第 1 次可回退状态。",
      createdAt: "2026-06-06T02:01:00.000Z",
      scope: "tool"
    });
    journal = appendRollbackEntry(journal, {
      id: "entry-2",
      label: "第 2 次操作",
      summary: "记录第 2 次可回退状态。",
      createdAt: "2026-06-06T02:02:00.000Z",
      scope: "tool"
    });
    journal = appendRollbackEntry(journal, {
      id: "entry-3",
      label: "第 3 次操作",
      summary: "记录第 3 次可回退状态。",
      createdAt: "2026-06-06T02:03:00.000Z",
      scope: "tool"
    });

    expect(journal.entries.map((entry) => entry.id)).toEqual(["entry-3", "entry-2", "entry-1"]);
  });
});

describe("previewRollback", () => {
  it("shows which newer entries will be reverted before applying rollback", () => {
    let journal = createRollbackJournal({
      activeLimit: 4,
      baselineEntry: {
        id: "startup-baseline",
        label: "启动基线",
        summary: "应用启动后的本地安全初始状态。",
        createdAt: "2026-06-06T02:00:00.000Z",
        scope: "session"
      }
    });

    journal = appendRollbackEntry(journal, {
      id: "message-1",
      label: "用户消息 1",
      summary: "执行第 1 条消息前的状态。",
      createdAt: "2026-06-06T02:01:00.000Z",
      scope: "session"
    });
    journal = appendRollbackEntry(journal, {
      id: "message-2",
      label: "用户消息 2",
      summary: "执行第 2 条消息前的状态。",
      createdAt: "2026-06-06T02:02:00.000Z",
      scope: "session"
    });

    const preview = previewRollback(journal, "message-1");

    expect(preview).toMatchObject({
      targetEntryId: "message-1",
      willRevertCount: 1
    });
    expect(preview.affectedEntries.map((entry) => entry.id)).toEqual(["message-2"]);
  });
});

describe("applyRollback", () => {
  it("keeps the target rollback point and older history after restore", () => {
    let journal = createRollbackJournal({
      activeLimit: 5,
      baselineEntry: {
        id: "startup-baseline",
        label: "启动基线",
        summary: "应用启动后的本地安全初始状态。",
        createdAt: "2026-06-06T02:00:00.000Z",
        scope: "session"
      }
    });

    journal = appendRollbackEntry(journal, {
      id: "message-1",
      label: "用户消息 1",
      summary: "执行第 1 条消息前的状态。",
      createdAt: "2026-06-06T02:01:00.000Z",
      scope: "session"
    });
    journal = appendRollbackEntry(journal, {
      id: "message-2",
      label: "用户消息 2",
      summary: "执行第 2 条消息前的状态。",
      createdAt: "2026-06-06T02:02:00.000Z",
      scope: "session"
    });

    const restored = applyRollback(journal, "message-1");

    expect(restored.entries.map((entry) => entry.id)).toEqual(["message-1", "startup-baseline"]);
    expect(restored.lastRollback?.targetEntryId).toBe("message-1");
    expect(restored.lastRollback?.revertedEntryIds).toEqual(["message-2"]);
  });
});
