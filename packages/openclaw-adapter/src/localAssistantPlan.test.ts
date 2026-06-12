import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner", () => {
  it("plans a readonly workspace overview for ordinary local assistant requests", () => {
    const plan = planLocalAssistantTask({
      message: "inspect the current workspace and summarize it",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "workspace-overview",
      title: "Workspace overview"
    });
  });

  it("plans a readonly workspace overview for a generic project summary request instead of default help copy", () => {
    const plan = planLocalAssistantTask({
      message: "summarize this project",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "workspace-overview",
      title: "Workspace overview"
    });
  });

  it("routes explicit capability questions through the local model instead of fixed help copy", () => {
    const plan = planLocalAssistantTask({
      message: "what can you do",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("plans ordinary conceptual questions as local model chat instead of assistant help", () => {
    const plan = planLocalAssistantTask({
      message: "软件体系设计的享元模式易懂的解释,以及它的内部状态和外部状态是什么",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("keeps ordinary git and commit knowledge questions on local model chat instead of readonly git status", () => {
    const plan = planLocalAssistantTask({
      message: "git 和 commit 是干嘛的，是开发项目的 git 还是 opencow 也要内置接入 git 功能呢",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("keeps ordinary latest knowledge questions on local model chat instead of network search guidance", () => {
    const plan = planLocalAssistantTask({
      message: "最新的开源协议有哪些，它们的区别是什么",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("keeps ordinary english latest knowledge questions on local model chat unless web search is explicit", () => {
    const plan = planLocalAssistantTask({
      message: "what are the latest open source licenses and how are they different",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it.each([
    "什么是 RAG，和普通搜索有什么区别",
    "skills 在这个项目里是干嘛的",
    "npc 是什么意思，和普通助手有什么不同",
    "mcp 是什么，为什么要接入它",
    "RAG 能力怎么样，适合帮我做什么",
    "Skills 能力现在能做到什么程度",
    "NPC 能力是不是已经像 OpenClaw 一样成熟",
    "MCP 能力对本地助手有什么帮助"
  ])("keeps ordinary capability concept questions on local model chat: %s", (message) => {
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it.each([
    "帮我配置一个本地 RAG 知识库",
    "帮我配置一个文档处理 skill",
    "帮我配置一个 mcp 插件工作流",
    "帮我检查 RAG 为什么没有检索出内容",
    "帮我检查 mcp 插件工作流为什么启动失败"
  ])("keeps configuration-style capability requests on local model chat unless a controlled config flow exists: %s", (message) => {
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it.each([
    "帮我检查 package.json 为什么启动脚本报错",
    "帮我配置 package.json scripts 让桌面端更稳定",
    "帮我检查 packages 里哪个模块容易导致启动卡住"
  ])("keeps troubleshooting-style workspace config requests on local model chat: %s", (message) => {
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it.each([
    "帮我检查 browser mcp plugin 为什么本地启动失败",
    "why did the browser mcp plugin fail to start locally",
    "帮我修一下 mcp 插件本地启动报错"
  ])("keeps MCP startup troubleshooting requests on local model chat instead of the real start chain: %s", (message) => {
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it.each([
    "why is the enabled skill match failing for shell automation",
    "why is local rag rules search failing",
    "帮我检查本地 RAG rules search 为什么失败"
  ])("keeps skills or RAG troubleshooting requests on local model chat instead of eager planner execution: %s", (message) => {
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it.each([
    "why did the desktop app fail to run locally",
    "帮我检查本地项目为什么启动失败",
    "why is npc collaboration screenshot capture failing for the cattle project",
    "帮我检查 npc 协作截图为什么失败"
  ])("keeps local project execution troubleshooting requests on local model chat instead of execution chains: %s", (message) => {
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("keeps ordinary package.json concept questions on local model chat instead of workspace config overview", () => {
    const plan = planLocalAssistantTask({
      message: "package.json 是干嘛的，为什么前端项目里经常会有它",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("keeps ordinary tsconfig concept questions on local model chat instead of workspace config overview", () => {
    const plan = planLocalAssistantTask({
      message: "tsconfig.json 是干嘛的，它和 TypeScript 编译有什么关系",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("keeps ordinary npm scripts concept questions on local model chat instead of packages overview", () => {
    const plan = planLocalAssistantTask({
      message: "npm scripts 是什么，为什么很多项目会在 package.json 里定义它们",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "本地模型对话"
    });
  });

  it("requests controlled full permission for destructive cleanup tasks", () => {
    const plan = planLocalAssistantTask({
      message: "delete temp-output and clean temporary files",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full",
      queuedMessage: "delete temp-output and clean temporary files"
    });
  });

  it("requires confirmation for destructive cleanup after permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "delete temp-output and clean temporary files",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      requiredMode: "controlled-full",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory"
    });
  });

  it("routes shell failure recovery advice to a readonly workspace root diagnostic", () => {
    const plan = planLocalAssistantTask({
      message: "verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-workspace-root",
      title: "Readonly shell diagnostics"
    });
    expect(plan.auditDetail).toMatch(/readonly shell diagnostics/i);
  });

  it("routes workspace-write recovery advice to a readonly shell diagnostic", () => {
    const plan = planLocalAssistantTask({
      message: "verify the permission approval, workspace root, command whitelist, and audit trail before retrying",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-workspace-root",
      title: "Readonly shell diagnostics"
    });
  });

  it("routes controlled-full recovery advice to a readonly shell diagnostic", () => {
    const plan = planLocalAssistantTask({
      message: "verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-workspace-root",
      title: "Readonly shell diagnostics"
    });
  });

  it("routes blocked destructive retry advice to a readonly shell diagnostic", () => {
    const plan = planLocalAssistantTask({
      message: "restore snapshot capability or run a readonly preview before retrying destructive execution",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-workspace-root",
      title: "Readonly shell diagnostics"
    });
  });

  it("routes short Chinese permission recovery advice to a readonly shell diagnostic", () => {
    const plan = planLocalAssistantTask({
      message: "检查权限批准和工作区根目录再重试",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-workspace-root",
      title: "Readonly shell diagnostics"
    });
  });

  it("routes short Chinese dangerous confirmation recovery advice to a readonly shell diagnostic", () => {
    const plan = planLocalAssistantTask({
      message: "检查危险确认和回退快照再重试",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-workspace-root",
      title: "Readonly shell diagnostics"
    });
  });
});
