const exactTextMap: Record<string, string> = {
  "opencow 宸ヤ綔鍙?": "opencow 工作台",
  "Ollama 鏈湴浼樺厛": "Ollama 本地优先",
  "绛夊緟 Ollama": "等待 Ollama",
  "鏈€夋嫨妯″瀷": "未选择模型",
  "鍙": "只读",
  "鏃犳硶杩炴帴鏈湴 Ollama": "无法连接本地 Ollama",
  "Ollama 鍝嶅簲瓒呮椂锛岃妫€鏌ユ湰鍦版ā鍨嬬姸鎬併€?": "Ollama 响应超时，请检查本地模型状态。",
  "妫€鏌?Ollama 鏈嶅姟骞堕噸璇?": "检查 Ollama 服务并重试",
  "妯℃嫙鏈湴浠诲姟澶辫触": "模拟本地任务失败",
  "鏈湴浠诲姟鎵ц澶辫触": "本地任务执行失败",
  "鏈湴浠诲姟鎵ц瀹屾垚": "本地任务执行完成",
  "鏈湴浠诲姟宸插仠姝?": "本地任务已停止",
  "鍋滄浠诲姟": "停止任务",
  "閲嶈瘯鏈湴浠诲姟": "重试本地任务",
  "褰撳墠浠诲姟宸蹭腑鏂?": "当前任务已中断"
};

const fragmentTextMap: Array<[string, string]> = [
  ["妯″潡:", "模块:"],
  ["鏉ユ簮:", "来源:"],
  ["鏃堕棿:", "时间:"],
  ["寤鸿:", "建议:"],
  ["鏉冮檺:", "权限:"],
  ["鍥為€€", "回退"]
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
