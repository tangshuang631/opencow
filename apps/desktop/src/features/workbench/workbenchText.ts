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
