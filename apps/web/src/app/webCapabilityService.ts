import type { OpenClawCapabilityOverview } from "../../../desktop/src/features/assistant/localAssistantService";

const CAPABILITY_OVERVIEWS: Record<OpenClawCapabilityOverview["capability_id"], OpenClawCapabilityOverview> = {
  rag: {
    capability_id: "rag",
    title: "RAG",
    status: "ready-foundation",
    required_package_count: 3,
    available_package_count: 3,
    available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/model-catalog-core"],
    missing_packages: [],
    summary: "网页端当前提供本地知识检索 MVP，后续继续接完整 RAG 执行链路。"
  },
  skills: {
    capability_id: "skills",
    title: "Skills",
    status: "partial-foundation",
    required_package_count: 2,
    available_package_count: 1,
    available_packages: ["@openclaw/plugin-sdk"],
    missing_packages: ["workspace skill runtime bridge"],
    summary: "网页端当前提供 Skills 只读入口，后续继续补启用、匹配和执行承接。"
  },
  npc: {
    capability_id: "npc",
    title: "NPC",
    status: "partial-foundation",
    required_package_count: 2,
    available_package_count: 1,
    available_packages: ["@openclaw/llm-runtime"],
    missing_packages: ["web npc execution bridge"],
    summary: "网页端当前提供 NPC 只读预览入口，后续继续补协作与执行链路。"
  },
  mcp: {
    capability_id: "mcp",
    title: "MCP",
    status: "partial-foundation",
    required_package_count: 2,
    available_package_count: 1,
    available_packages: ["@openclaw/plugin-sdk"],
    missing_packages: ["web plugin runtime bridge"],
    summary: "网页端当前提供 MCP 能力概览入口，后续继续补插件发现与启动承接。"
  }
};

export function loadWebCapabilityOverview(
  capabilityId: OpenClawCapabilityOverview["capability_id"]
): OpenClawCapabilityOverview {
  return CAPABILITY_OVERVIEWS[capabilityId];
}
