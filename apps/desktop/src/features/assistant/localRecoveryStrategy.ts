export type LocalRecoveryContext = {
  timeoutMs: number;
  model: string;
  inputLength: number;
};

export function createLocalModelTimeoutRecoveryHint(): string {
  return `本地模型响应超时：长回答保护已启用，OpenCow 会优先使用自动分段、缺题补写和显式重试；如果模型仍超时，请确认 Ollama 进程仍在运行，切换更快模型，或减少单次输入长度后重试。`;
}

export function createLocalModelLengthRecoveryHint(): string {
  return `已自动续写到安全上限，但本地模型仍报告输出长度限制；如仍缺少后续内容，可以发送“继续”或缩小范围后重试。`;
}

export function createLocalModelFailureDiagnostics(context: LocalRecoveryContext): string {
  return `Local model chat diagnostics: model=${context.model.trim() || "unselected"}; timeout=${Math.floor(context.timeoutMs / 1000)}s; inputLength=${context.inputLength}; longAnswerProtection=enabled.`;
}
