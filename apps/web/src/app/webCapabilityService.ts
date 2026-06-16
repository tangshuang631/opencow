import type { OpenClawCapabilityOverview } from "../../../desktop/src/features/assistant/localAssistantService";

export type WebCapabilityDetail = OpenClawCapabilityOverview & {
  sampleItems: string[];
  nextStep: string;
  contextLine: string;
};

const CAPABILITY_OVERVIEWS: Record<OpenClawCapabilityOverview["capability_id"], WebCapabilityDetail> = {
  rag: {
    capability_id: "rag",
    title: "RAG",
    status: "ready-foundation",
    required_package_count: 3,
    available_package_count: 3,
    available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/model-catalog-core"],
    missing_packages: [],
    summary: "网页端当前提供本地知识检索 MVP，后续继续接完整 RAG 执行链路。",
    sampleItems: ["web-history-mvp.md", "npc-notes.txt"],
    nextStep: "下一步优先补结果筛选、片段展开和更长文档解析。",
    contextLine: "本地上下文：网页端已支持 md/txt 导入、保留和检索。"
  },
  skills: {
    capability_id: "skills",
    title: "Skills",
    status: "partial-foundation",
    required_package_count: 2,
    available_package_count: 1,
    available_packages: ["@openclaw/plugin-sdk"],
    missing_packages: ["workspace skill runtime bridge"],
    summary: "网页端当前提供 Skills 只读入口，后续继续补启用、匹配和执行承接。",
    sampleItems: ["coding-agent", "docs-helper"],
    nextStep: "下一步优先补启用列表、匹配结果和安全确认前置展示。",
    contextLine: "当前聚焦：先把网页端 Skills 结果页做成可读、可追踪、可继续。"
  },
  npc: {
    capability_id: "npc",
    title: "NPC",
    status: "partial-foundation",
    required_package_count: 2,
    available_package_count: 1,
    available_packages: ["@openclaw/llm-runtime"],
    missing_packages: ["web npc execution bridge"],
    summary: "网页端当前提供 NPC 只读预览入口，后续继续补协作与执行链路。",
    sampleItems: ["课程助手 NPC", "文档处理 NPC"],
    nextStep: "下一步优先补只读草案、协作预览和执行前权限链路说明。",
    contextLine: "当前聚焦：网页端先给出 NPC 的状态、样例角色和协作入口。"
  },
  mcp: {
    capability_id: "mcp",
    title: "MCP",
    status: "partial-foundation",
    required_package_count: 2,
    available_package_count: 1,
    available_packages: ["@openclaw/plugin-sdk"],
    missing_packages: ["web plugin runtime bridge"],
    summary: "网页端当前提供 MCP 能力概览入口，后续继续补插件发现与启动承接。",
    sampleItems: ["browser", "codex-supervisor"],
    nextStep: "下一步优先补插件扫描结果、激活方式和受控启动预览。",
    contextLine: "当前聚焦：网页端先把 MCP 插件状态和启动边界说明清楚。"
  }
};

export function loadWebCapabilityOverview(
  capabilityId: OpenClawCapabilityOverview["capability_id"]
): WebCapabilityDetail {
  return CAPABILITY_OVERVIEWS[capabilityId];
}
