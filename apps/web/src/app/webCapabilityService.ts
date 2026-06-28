import {
  loadOpenClawCapabilityOverview,
  type OpenClawCapabilityOverview
} from "../../../desktop/src/features/assistant/localAssistantService";

export type WebCapabilityDetail = OpenClawCapabilityOverview & {
  sampleItems: string[];
  nextStep: string;
  contextLine: string;
};

type WebCapabilityEnhancement = Pick<WebCapabilityDetail, "sampleItems" | "nextStep" | "contextLine">;

const CAPABILITY_ENHANCEMENTS: Record<OpenClawCapabilityOverview["capability_id"], WebCapabilityEnhancement> = {
  rag: {
    sampleItems: ["web-history-mvp.md", "npc-notes.txt"],
    nextStep: "下一步优先补结果筛选、片段展开和更长文档解析。",
    contextLine: "本地知识库：网页端已支持 md/txt 导入和检索。"
  },
  skills: {
    sampleItems: ["coding-agent", "docs-helper"],
    nextStep: "下一步优先补启用列表、匹配结果和安全确认前置展示。",
    contextLine: "当前聚焦：先把网页端 Skills 结果页做成可读、可追踪、可继续。"
  },
  npc: {
    sampleItems: ["课程助手 NPC", "文档处理 NPC"],
    nextStep: "下一步优先补只读草案、协作预览和执行前权限链路说明。",
    contextLine: "当前聚焦：网页端先给出 NPC 的状态、样例角色和协作入口。"
  },
  mcp: {
    sampleItems: ["browser", "codex-supervisor"],
    nextStep: "下一步优先补插件扫描结果、激活方式和受控启动预览。",
    contextLine: "当前聚焦：网页端先把 MCP 插件状态和启动边界说明清楚。"
  }
};

export async function loadWebCapabilityOverview(
  capabilityId: OpenClawCapabilityOverview["capability_id"]
): Promise<WebCapabilityDetail> {
  const [overview, enhancement] = await Promise.all([
    loadOpenClawCapabilityOverview(capabilityId),
    Promise.resolve(CAPABILITY_ENHANCEMENTS[capabilityId])
  ]);

  return {
    ...overview,
    sampleItems: enhancement.sampleItems,
    nextStep: enhancement.nextStep,
    contextLine: enhancement.contextLine
  };
}
