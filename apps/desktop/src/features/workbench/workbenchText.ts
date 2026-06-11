const exactTextMap: Record<string, string> = {
  "opencow 瀹搞儰缍旈崣?": "opencow 工作台",
  "Ollama 閺堫剙婀存导妯哄帥": "Ollama 本地优先",
  "缁涘绶?Ollama": "等待 Ollama",
  "閺堫亪鈧瀚ㄥΟ鈥崇€?": "未选择模型",
  "閸欘亣顕?": "只读",
  "閺冪姵纭舵潻鐐村复閺堫剙婀?Ollama": "无法连接本地 Ollama",
  "Ollama 閸濆秴绨茬搾鍛閿涘矁顕Λ鈧弻銉︽拱閸︾増膩閸ㄥ濮搁幀浣碘偓?": "Ollama 响应超时，请检查本地模型状态。",
  "濡偓閺?Ollama 閺堝秴濮熼獮鍫曞櫢鐠?": "检查 Ollama 服务并重试",
  "濡剝瀚欓張顒€婀存禒璇插婢惰精瑙?": "模拟本地任务失败",
  "妯℃嫙鏈湴浠诲姟澶辫触": "模拟本地任务失败",
  "閺堫剙婀存禒璇插閹笛嗩攽婢惰精瑙?": "本地任务执行失败",
  "鏈湴浠诲姟鎵ц澶辫触": "本地任务执行失败",
  "閺堫剙婀存禒璇插閹笛嗩攽鐎瑰本鍨?": "本地任务执行完成",
  "閺堫剙婀存禒璇插瀹告彃浠犲?": "本地任务已停止",
  "閸嬫粍顒涙禒璇插": "停止任务",
  "鍋滄浠诲姟": "停止任务",
  "闁插秷鐦張顒€婀存禒璇插": "重试本地任务",
  "瑜版挸澧犳禒璇插瀹歌弓鑵戦弬?": "当前任务已中断",
  "宸叉洿鏂拌仈缃戞悳绱㈡彁渚涙柟": "已更新联网搜索提供方",
  "鑱旂綉鎼滅储 provider 鏇存柊": "联网搜索 provider 更新"
};

const fragmentTextMap: Array<[string, string]> = [
  ["濡€虫健:", "模块:"],
  ["閺夈儲绨?", "来源:"],
  ["閺冨爼妫?", "时间:"],
  ["瀵ら缚顔?", "建议:"],
  ["閺夊啴妾?", "权限:"],
  ["閸ョ偤鈧偓", "回退"],
  ["鑱旂綉鎼滅储灏嗕紭鍏堜娇鐢?", "联网搜索将优先使用 "],
  ["锛屼粛浼氫繚鐣欐潵婧愯褰曚笌瀹¤杩借釜銆?", "，仍会保留来源记录与审计追踪。"],
  ["棰勮鍥為€€鍒?鍚姩鍩虹嚎", "预览回退到 启动基线"]
];

export function normalizeWorkbenchText(value: string): string {
  if (!value) {
    return value;
  }

  let normalized = exactTextMap[value] ?? value;

  for (const [from, to] of fragmentTextMap) {
    normalized = normalized.split(from).join(to);
  }

  return normalized.replace(/\?+/g, "").trim();
}

function isReadonlyShellFailure(value: string): boolean {
  const normalized = value.toLowerCase();

  return normalized.includes("readonly-shell") || normalized.includes("required permission: readonly");
}

function isWorkspaceWriteShellFailure(value: string): boolean {
  const normalized = value.toLowerCase();

  return normalized.includes("workspace-write")
    || normalized.includes("workspace_write")
    || normalized.includes("required permission: workspace-write");
}

function isControlledFullShellFailure(value: string): boolean {
  const normalized = value.toLowerCase();

  return normalized.includes("controlled-full")
    || normalized.includes("controlled_full")
    || normalized.includes("required permission: controlled-full");
}

function isLocalRagFailure(value: string): boolean {
  const normalized = value.toLowerCase();

  return normalized.includes("local rag search failed")
    || normalized.includes("rag retry self-check")
    || normalized.includes("local knowledge index")
    || normalized.includes("document parsers for pptx/docx/md")
    || normalized.includes("pptx/docx/md");
}

function isLocalExecutionMappingFailure(value: string): boolean {
  const normalized = value.toLowerCase();

  return normalized.includes("invalid local assistant execution result")
    || normalized.includes("inspect assistanttaskservice result mapping");
}

function isUnknownLocalExecutionFailure(value: string): boolean {
  return value.toLowerCase().includes("unknown local assistant execution error");
}

export function isLocalAssistantPlannerFailureSource(source?: string): boolean {
  return source === "local_assistant_planner"
    || source === "local_assistant_self_check_planner"
    || source === "local_task_retry_self_check_planner";
}

export function getVisibleLocalTaskFailureTitle(summary: string, source?: string, detail = ""): string {
  if (isLocalAssistantPlannerFailureSource(source) || summary === "Local assistant planning failed") {
    return "\u672c\u5730\u52a9\u624b\u89c4\u5212\u5931\u8d25";
  }

  if (source === "local_task_attempt_guard") {
    return "本地任务已达到重试上限";
  }

  if (source === "local_task_timeout" || summary === "Local task execution timed out") {
    return summary;
  }

  if (
    summary === "Local task execution failed"
    && (isReadonlyShellFailure(detail) || isWorkspaceWriteShellFailure(detail) || isControlledFullShellFailure(detail))
  ) {
    return "本地任务执行失败";
  }

  if (isLocalRagFailure(detail) || isLocalRagFailure(summary)) {
    return "本地 RAG 检索失败";
  }

  if (isLocalExecutionMappingFailure(detail) || isLocalExecutionMappingFailure(summary)) {
    return "本地任务执行失败";
  }

  if (summary === "Local task execution failed" && isUnknownLocalExecutionFailure(detail)) {
    return "本地任务执行失败";
  }

  return normalizeWorkbenchText(summary);
}

export function getVisibleLocalTaskFailureActionLabel(actionLabel: string): string {
  const normalized = actionLabel.trim();

  if (
    normalized.includes("Review planner routing, rewrite the request, or restart from a readonly preview before retrying.")
    || normalized.includes("Review RAG self-check routing before retrying the failed document query.")
    || normalized.includes("Review shell self-check routing before retrying the failed write or destructive command.")
    || normalized.includes("请改写请求后重新提交")
    || normalized.includes("从只读预览重新开始")
  ) {
    return "\u8bf7\u6539\u5199\u8bf7\u6c42\uff0c\u6216\u4ece\u53ea\u8bfb\u9884\u89c8\u91cd\u65b0\u5f00\u59cb\u3002";
  }

  if (
    normalized.includes("verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying")
    || normalized.includes("只读 shell 桥接")
  ) {
    return "请先检查只读 shell 桥接、工作区根目录、命令白名单和审计记录，再重试。";
  }

  if (
    normalized.includes("verify the permission approval, workspace root, command whitelist, and audit trail before retrying")
    || normalized.includes("权限审批")
  ) {
    return "请先检查权限审批、工作区根目录、命令白名单和审计记录，再重试。";
  }

  if (
    normalized.includes("verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying")
    || normalized.includes("高风险确认")
  ) {
    return "请先检查高风险确认、回退快照、工作区根目录、命令白名单和审计记录，再重试。";
  }

  if (normalized === "restore snapshot capability or run a readonly preview before retrying destructive execution.") {
    return "请先恢复回退快照能力，或先运行只读预览再重试高风险执行。";
  }

  if (isLocalRagFailure(normalized)) {
    return "请先检查本地 RAG 索引、pptx/docx/md 解析器和工作区根目录，再缩小文档范围重试。";
  }

  if (isLocalExecutionMappingFailure(normalized)) {
    return "请先检查本地助手执行结果映射，再重试。";
  }

  if (normalized === "Check the local execution chain and try again.") {
    return "请检查本地执行链和日志，再重试。";
  }

  return normalizeWorkbenchText(actionLabel);
}

export function getVisibleLocalTaskFailureDetail(detail: string, source?: string): string {
  if (isLocalAssistantPlannerFailureSource(source)) {
    return "\u672c\u5730\u52a9\u624b\u6682\u65f6\u65e0\u6cd5\u7406\u89e3\u8fd9\u6b21\u8bf7\u6c42\uff0c\u672a\u6392\u961f\u3001\u672a\u6267\u884c\u4efb\u4f55\u547d\u4ee4\u3002";
  }

  if (source === "local_model_chat_runner") {
    const actionableDetail = getActionableOllamaFailureDetail(detail);

    if (actionableDetail) {
      return actionableDetail;
    }

    return "本地模型本轮没有按时返回完整结果，详细诊断已保留在本地任务失败细节和日志中。";
  }

  if (isReadonlyShellFailure(detail)) {
    return "本地 shell 执行没有完成。完整命令、权限和底层错误已保留在日志、回退记录和展开详情中。";
  }

  if (isWorkspaceWriteShellFailure(detail)) {
    return "本地写入命令没有完成。完整命令、权限审批和底层错误已保留在日志、回退记录和展开详情中。";
  }

  if (isControlledFullShellFailure(detail)) {
    return "本地高风险命令没有完成。完整命令、高风险确认、回退快照和底层错误已保留在日志、回退记录和展开详情中。";
  }

  if (isLocalRagFailure(detail)) {
    return "本地 RAG 没有完成。完整索引、解析器、文件路径和重试诊断已保留在日志、回退记录和展开详情中。";
  }

  if (isLocalExecutionMappingFailure(detail)) {
    return "本地助手返回了无法识别的执行结果。完整结果映射诊断已保留在日志、回退记录和展开详情中。";
  }

  if (isUnknownLocalExecutionFailure(detail)) {
    return "本地助手返回了空错误或未知错误。完整原始诊断已保留在日志、回退记录和展开详情中。";
  }

  return normalizeWorkbenchText(detail);
}

function getActionableOllamaFailureDetail(detail: string): string | null {
  const conciseDetail = stripLocalModelDiagnostics(detail);
  const normalized = conciseDetail.toLowerCase();
  const isActionableOllamaError =
    normalized.includes("ollama chat failed")
    || normalized.includes("ollama stream returned an error")
    || normalized.includes("no usable local ollama model")
    || (normalized.includes("model ") && normalized.includes("not found"));

  if (!isActionableOllamaError) {
    return null;
  }

  return `Ollama error: ${conciseDetail}`;
}

function stripLocalModelDiagnostics(detail: string): string {
  const diagnosticIndex = detail.indexOf("Local model chat diagnostics:");
  const conciseDetail = diagnosticIndex >= 0 ? detail.slice(0, diagnosticIndex) : detail;

  return conciseDetail.trim().replace(/[.\s]+$/, "");
}
