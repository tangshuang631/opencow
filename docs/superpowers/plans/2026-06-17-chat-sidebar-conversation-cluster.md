# Chat Sidebar Conversation Cluster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把会话区改成左侧顶部统一会话分组，默认展示 3 条、展开展示 6 条，并把搜索与新建入口并入会话总卡片右侧。

**Architecture:** 复用现有 `recentConversations` 持久化结构，不重写会话存储协议；主要重构 `Sidebar` 的会话 UI、`Workbench` 的入口编排，以及 `deleteRecentConversationState` 在删除当前已恢复会话时的切换行为。`MainConversation` 去掉空白态下的最近会话主入口，避免左中两处重复。

**Tech Stack:** React, TypeScript, Vitest, Testing Library, shared workbench state helpers, global CSS

---

### Task 1: 写清状态层删除当前会话的预期

**Files:**
- Modify: `apps/desktop/src/features/workbench/workbenchState.conversation.test.ts`
- Modify: `apps/desktop/src/features/workbench/workbenchState.conversation.ts`

- [ ] **Step 1: 写删除当前已恢复会话时会自动切走的失败测试**

在 `apps/desktop/src/features/workbench/workbenchState.conversation.test.ts` 增加一条最小行为测试：

```ts
it("switches away from the current restored conversation when that recent conversation is deleted", () => {
  const state = {
    ...createInitialWorkbenchState(),
    conversation: {
      entries: [
        {
          id: "current-recent-entry",
          kind: "user" as const,
          title: "用户",
          summary: "当前查看的是最近会话 A"
        }
      ]
    },
    history: {
      lastNonEmptyConversationEntries: [
        {
          id: "current-recent-entry",
          kind: "user" as const,
          title: "用户",
          summary: "当前查看的是最近会话 A"
        }
      ],
      recentConversations: [
        {
          id: "recent-a",
          title: "会话 A",
          summary: "当前查看的是最近会话 A",
          entries: [
            {
              id: "current-recent-entry",
              kind: "user" as const,
              title: "用户",
              summary: "当前查看的是最近会话 A"
            }
          ]
        },
        {
          id: "recent-b",
          title: "会话 B",
          summary: "删除 A 后应该切到这里",
          entries: [
            {
              id: "fallback-entry",
              kind: "user" as const,
              title: "用户",
              summary: "删除 A 后应该切到这里"
            }
          ]
        }
      ]
    }
  };

  const next = deleteRecentConversationState(state, "recent-a");

  expect(next.conversation.entries[0]?.summary).toBe("删除 A 后应该切到这里");
  expect(next.history.recentConversations.map((item) => item.id)).toEqual(["recent-b"]);
});
```

- [ ] **Step 2: 运行单测并确认失败**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/workbenchState.conversation.test.ts
```

Expected:
`FAIL`，因为当前删除逻辑只移除最近会话记录，不会切换当前展示的 conversation。

- [ ] **Step 3: 写最小实现**

在 `apps/desktop/src/features/workbench/workbenchState.conversation.ts` 里让 `deleteRecentConversationState`：

- 先算出删掉后的剩余最近会话
- 如果当前 `conversation.entries === record.entries`
  - 切到剩余第一条最近会话的 `entries`
  - 若无剩余则切到空数组
- 同步更新 `lastNonEmptyConversationEntries`

- [ ] **Step 4: 重跑单测确认通过**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/workbenchState.conversation.test.ts
```

Expected:
`PASS`

### Task 2: 先写 Workbench 级失败测试锁定新侧边栏结构

**Files:**
- Modify: `apps/desktop/src/features/workbench/Workbench.test.tsx`
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify: `apps/desktop/src/features/workbench/components/Sidebar.tsx`

- [ ] **Step 1: 写会话分组默认展示 3 条、展开展示 6 条、且不再有独立新对话/最近会话按钮的失败测试**

在 `apps/desktop/src/features/workbench/Workbench.test.tsx` 新增一条集中测试，构造 7 条 `recentConversations`：

```ts
it("replaces separate new-conversation and recent-history buttons with a collapsible conversation cluster", () => {
  const state = {
    ...createInitialWorkbenchState(),
    history: {
      lastNonEmptyConversationEntries: [],
      recentConversations: Array.from({ length: 7 }, (_, index) => ({
        id: `recent-${index + 1}`,
        title: `最近会话 ${index + 1}`,
        summary: `摘要 ${index + 1}`,
        entries: [
          {
            id: `entry-${index + 1}`,
            kind: "user" as const,
            title: "用户",
            summary: `最近会话 ${index + 1}`
          }
        ]
      }))
    }
  };

  render(<Workbench {...createWorkbenchProps(state)} />);

  expect(screen.queryByRole("button", { name: "新对话" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "最近会话" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "搜索历史会话" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "创建新会话" })).toBeInTheDocument();
  expect(screen.getAllByText(/最近会话 [1-7]/).length).toBe(3);

  fireEvent.click(screen.getByRole("button", { name: "展开最近会话" }));

  expect(screen.getAllByText(/最近会话 [1-7]/).length).toBe(6);
});
```

- [ ] **Step 2: 跑这条测试并确认失败**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/Workbench.test.tsx -t "replaces separate new-conversation and recent-history buttons with a collapsible conversation cluster"
```

Expected:
`FAIL`，因为当前仍然存在独立 `新对话` / `最近会话` 按钮，也没有会话分组动作图标。

- [ ] **Step 3: 写最小结构实现**

实现方向：

- `Sidebar` 新增 props：
  - `recentConversations`
  - `onRestoreRecentConversation`
  - `onDeleteRecentConversation`
  - `conversationSearchQuery`
  - `onConversationSearchQueryChange`
  - `isConversationClusterExpanded`
  - `onToggleConversationCluster`
- `Sidebar` 头部改为会话总卡片
- 去掉独立 `新对话` 和 `最近会话`
- 历史导航项 `history` 从左侧功能导航移除
- `Workbench` 增加本地 UI state 并把 handler 传入 `Sidebar`

- [ ] **Step 4: 重跑测试确认通过**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/Workbench.test.tsx -t "replaces separate new-conversation and recent-history buttons with a collapsible conversation cluster"
```

Expected:
`PASS`

### Task 3: 补恢复、删除、搜索、新建的交互测试

**Files:**
- Modify: `apps/desktop/src/features/workbench/Workbench.test.tsx`
- Modify: `apps/desktop/src/features/workbench/components/Sidebar.tsx`
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`

- [ ] **Step 1: 写点击会话卡片恢复历史的失败测试**

```ts
it("restores a recent conversation when its conversation card is clicked", () => {
  const onRestoreRecentConversation = vi.fn();
  const state = {
    ...createInitialWorkbenchState(),
    history: {
      lastNonEmptyConversationEntries: [],
      recentConversations: [
        {
          id: "recent-restore",
          title: "恢复目标会话",
          summary: "点击卡片主体应恢复",
          entries: [
            {
              id: "restore-entry",
              kind: "user" as const,
              title: "用户",
              summary: "恢复目标会话"
            }
          ]
        }
      ]
    }
  };

  render(<Workbench {...createWorkbenchProps(state, { onRestoreRecentConversation })} />);

  fireEvent.click(screen.getByRole("button", { name: "打开会话：恢复目标会话" }));

  expect(onRestoreRecentConversation).toHaveBeenCalledWith("recent-restore");
});
```

- [ ] **Step 2: 写点击减号删除会话的失败测试**

```ts
it("deletes a recent conversation from the conversation cluster", () => {
  const onDeleteRecentConversation = vi.fn();
  const state = {
    ...createInitialWorkbenchState(),
    history: {
      lastNonEmptyConversationEntries: [],
      recentConversations: [
        {
          id: "recent-delete",
          title: "删除目标会话",
          summary: "点击减号应删除",
          entries: []
        }
      ]
    }
  };

  render(<Workbench {...createWorkbenchProps(state, { onDeleteRecentConversation })} />);

  fireEvent.click(screen.getByRole("button", { name: "删除会话：删除目标会话" }));

  expect(onDeleteRecentConversation).toHaveBeenCalledWith("recent-delete");
});
```

- [ ] **Step 3: 写放大镜展开搜索框与加号创建新会话的失败测试**

```ts
it("opens conversation search and creates a new conversation from the conversation cluster header", () => {
  const onNewConversation = vi.fn();

  render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onNewConversation })} />);

  expect(screen.queryByRole("textbox", { name: "搜索历史会话" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "搜索历史会话" }));

  expect(screen.getByRole("textbox", { name: "搜索历史会话" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));

  expect(onNewConversation).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 4: 写搜索覆盖全部已保留最近会话而不只是 3/6 条的失败测试**

```ts
it("filters across all saved recent conversations from the cluster search box", () => {
  const state = {
    ...createInitialWorkbenchState(),
    history: {
      lastNonEmptyConversationEntries: [],
      recentConversations: Array.from({ length: 7 }, (_, index) => ({
        id: `recent-${index + 1}`,
        title: index === 6 ? "更早的目标会话" : `最近会话 ${index + 1}`,
        summary: index === 6 ? "需要通过搜索命中" : `摘要 ${index + 1}`,
        entries: []
      }))
    }
  };

  render(<Workbench {...createWorkbenchProps(state)} />);

  fireEvent.click(screen.getByRole("button", { name: "搜索历史会话" }));
  fireEvent.change(screen.getByRole("textbox", { name: "搜索历史会话" }), {
    target: { value: "目标会话" }
  });

  expect(screen.getByText("更早的目标会话")).toBeInTheDocument();
  expect(screen.queryByText("最近会话 1")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: 跑相关测试并确认失败**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/Workbench.test.tsx -t "restores a recent conversation when its conversation card is clicked|deletes a recent conversation from the conversation cluster|opens conversation search and creates a new conversation from the conversation cluster header|filters across all saved recent conversations from the cluster search box"
```

Expected:
`FAIL`

- [ ] **Step 6: 写最小交互实现**

在 `Sidebar.tsx` 中：

- 会话卡片主体渲染为 button，`aria-label="打开会话：<title>"`
- 删除按钮单独渲染为小按钮，`aria-label="删除会话：<title>"`
- 放大镜点击只切换搜索框显隐
- 搜索过滤基于完整 `recentConversations`
- 列表展示条数规则：
  - 无搜索词时：默认 3，展开后 6
  - 有搜索词时：展示所有匹配项

- [ ] **Step 7: 重跑相关测试确认通过**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/Workbench.test.tsx -t "restores a recent conversation when its conversation card is clicked|deletes a recent conversation from the conversation cluster|opens conversation search and creates a new conversation from the conversation cluster header|filters across all saved recent conversations from the cluster search box"
```

Expected:
`PASS`

### Task 4: 去掉 MainConversation 空白态里的重复最近会话面板

**Files:**
- Modify: `apps/desktop/src/features/workbench/components/MainConversation.test.tsx`
- Modify: `apps/desktop/src/features/workbench/components/MainConversation.tsx`

- [ ] **Step 1: 写空白态不再渲染最近会话面板的失败测试**

把当前依赖 `最近会话` 面板的空白态测试改为：

```ts
it("keeps a blank conversation free of duplicated recent-history panels", () => {
  const state = {
    ...createInitialWorkbenchState(),
    history: {
      lastNonEmptyConversationEntries: [],
      recentConversations: [
        {
          id: "recent-conversation-1",
          title: "帮我继续修网页端历史记录",
          summary: "最近一次会话保留了网页端历史记录修复上下文。",
          entries: []
        }
      ]
    }
  };

  render(<MainConversation state={state} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

  expect(screen.queryByText("最近会话")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "恢复这段会话" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 跑 MainConversation 相关测试并确认失败**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/components/MainConversation.test.tsx -t "blank conversation free of duplicated recent-history panels|shows recent conversation history actions on a blank conversation screen|calls restore when the user restores a recent conversation|calls delete when the user removes a recent conversation"
```

Expected:
`FAIL`

- [ ] **Step 3: 写最小实现**

在 `MainConversation.tsx` 里删除空白态 `conversation-history-panel` 这一整段渲染。

同时更新测试，保留主会话区对消息展示的职责，不再承担最近会话主入口职责。

- [ ] **Step 4: 重跑 MainConversation 测试确认通过**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/components/MainConversation.test.tsx
```

Expected:
`PASS`

### Task 5: 补样式并完成回归

**Files:**
- Modify: `apps/desktop/src/styles/global.css`
- Modify: `apps/desktop/src/features/workbench/Workbench.test.tsx`
- Modify: `apps/desktop/src/features/workbench/components/MainConversation.test.tsx`

- [ ] **Step 1: 写会话总卡片与会话列表样式**

在 `global.css` 中新增或调整：

- `sidebar-conversation-cluster`
- `sidebar-conversation-cluster-header`
- `sidebar-conversation-actions`
- `sidebar-icon-button`
- `sidebar-conversation-search`
- `sidebar-conversation-list`
- `sidebar-conversation-card`
- `sidebar-conversation-card-main`
- `sidebar-conversation-card-delete`
- `sidebar-conversation-toggle`

要求：

- 会话总卡片与现有毛玻璃侧边栏风格一致
- 动作图标靠右
- 小减号按钮不挤压标题摘要
- 列表高度在 3 条与 6 条之间稳定

- [ ] **Step 2: 跑桌面相关完整测试**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/desktop run test -- src/features/workbench/Workbench.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/workbenchState.conversation.test.ts
```

Expected:
`PASS`

- [ ] **Step 3: 跑网页端会话相关回归**

Run:
```bash
PATH=/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin:$PATH npm --workspace apps/web run test -- src/app/webApp.test.tsx src/app/webApp.failure.test.tsx
```

Expected:
`PASS`

- [ ] **Step 4: 检查测试进程是否退出**

Run:
```bash
pgrep -fal "vitest|vite" || true
```

Expected:
只剩用户自己的常驻 `vite`，没有残留 `vitest` 子进程。
