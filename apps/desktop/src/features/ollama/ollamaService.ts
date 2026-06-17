import { invoke } from "@tauri-apps/api/core";
import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";

const ollamaEndpoint = "http://127.0.0.1:11434";
const ollamaTagsPath = `${ollamaEndpoint}/api/tags`;
const ollamaChatPath = `${ollamaEndpoint}/api/chat`;
const MAX_OLLAMA_LENGTH_LIMIT_CALLS = 3;
const MAX_MISSING_QUIZ_REPAIR_ATTEMPTS = 2;
const NUMBERED_RANGE_SPLIT_SIZE = 8;
const MIN_NUMBERED_RANGE_SPLIT_COUNT = 10;
const DEFAULT_OLLAMA_CHAT_NUM_PREDICT = 512;
const LONG_OLLAMA_CHAT_NUM_PREDICT = 4096;
const DEFAULT_OLLAMA_CHAT_TIMEOUT_MS = 480_000;
const LONG_OLLAMA_CHAT_TIMEOUT_MS = 480_000;
const OLLAMA_OVERVIEW_TIMEOUT_MS = 15_000;
const PREFERRED_DEFAULT_CHAT_MODELS = ["gemma:26b", "gemma4:26b"];

export type OllamaModelSummary = {
  name: string;
  sizeLabel: string;
  capabilities?: string[];
};

export type OllamaOverview = {
  reachable: boolean;
  endpoint: string;
  selectedModel: string;
  diagnostic: string;
  models: OllamaModelSummary[];
};

export type OllamaChatRequest = {
  model: string;
  message: string;
  requestId?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
};

export type OllamaChatResult = {
  model: string;
  message: string;
  doneReason?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    size?: number;
    details?: {
      capabilities?: string[];
    };
  }>;
};

type OllamaChatResponse = {
  model?: string;
  done_reason?: string;
  error?: string;
  message?: {
    content?: string;
  };
};

type OllamaChatChunkEventPayload = {
  requestId?: string;
  chunk?: string;
};

type QuizSectionRequest = {
  sectionLabel: string;
  count: number;
  prompt: string;
};

type NumberedRangeRequest = {
  start: number;
  end: number;
  prompt: string;
};

export async function loadOllamaOverview(): Promise<OllamaOverview> {
  if (hasTauriInvoke()) {
    return Promise.race([
      invoke<OllamaOverview>("ollama_overview"),
      createOllamaOverviewTimeout()
    ]);
  }

  return loadFromBrowserPreview();
}

export function getOllamaConnectionLabel(overview: OllamaOverview): string {
  return overview.reachable ? "Ollama 已连接" : "等待 Ollama";
}

export async function chatWithOllamaModel(request: OllamaChatRequest): Promise<OllamaChatResult> {
  assertUsableOllamaChatModel(request.model);
  assertOllamaChatNotAborted(request.signal);

  const splitRequests = createQuizSectionRequests(request.message);

  if (splitRequests.length > 0) {
    const sectionResults: OllamaChatResult[] = [];

    for (const splitRequest of splitRequests) {
      assertOllamaChatNotAborted(request.signal);
      let sectionResult = await sendOllamaChatRequest({
        model: request.model,
        message: splitRequest.prompt,
        requestId: request.requestId,
        signal: request.signal,
        onChunk: request.onChunk
      });
      sectionResult = await continueOllamaChatResultIfNeeded({
        model: request.model,
        originalMessage: splitRequest.prompt,
        initialResult: sectionResult,
        requestId: request.requestId,
        signal: request.signal,
        onChunk: request.onChunk,
        lengthLimitOnly: true
      });
      assertOllamaChatNotAborted(request.signal);
      for (
        let repairAttempt = 0, missingQuestionNumbers = getMissingQuestionNumbers(
          sectionResult.message,
          splitRequest.sectionLabel,
          splitRequest.count
        );
        missingQuestionNumbers.length > 0 && repairAttempt < MAX_MISSING_QUIZ_REPAIR_ATTEMPTS;
        repairAttempt += 1, missingQuestionNumbers = getMissingQuestionNumbers(
          sectionResult.message,
          splitRequest.sectionLabel,
          splitRequest.count
        )
      ) {
        assertOllamaChatNotAborted(request.signal);
        let repairResult = await sendOllamaChatRequest({
          model: request.model,
          message: createMissingQuizQuestionsPrompt(
            request.message,
            splitRequest.sectionLabel,
            missingQuestionNumbers,
            sectionResult.message
          ),
          requestId: request.requestId,
          signal: request.signal,
          onChunk: request.onChunk
        });
        repairResult = await continueOllamaChatResultIfNeeded({
          model: request.model,
          originalMessage: createMissingQuizQuestionsPrompt(
            request.message,
            splitRequest.sectionLabel,
            missingQuestionNumbers,
            sectionResult.message
          ),
          initialResult: repairResult,
          requestId: request.requestId,
          signal: request.signal,
          onChunk: request.onChunk,
          lengthLimitOnly: true
        });
        assertOllamaChatNotAborted(request.signal);

        sectionResult = {
          model: repairResult.model || sectionResult.model,
          message: mergeAssistantContinuation(sectionResult.message, repairResult.message),
          doneReason: getMergedDoneReason([sectionResult, repairResult])
        };
      }
      if (getMissingQuestionNumbers(sectionResult.message, splitRequest.sectionLabel, splitRequest.count).length > 0) {
        sectionResult = {
          ...sectionResult,
          doneReason: "length"
        };
      }

      sectionResults.push(sectionResult);
    }

    return {
      model: sectionResults.at(-1)?.model ?? request.model,
      message: sectionResults.map((result) => result.message.trim()).filter(Boolean).join("\n\n"),
      doneReason: getMergedDoneReason(sectionResults)
    };
  }

  const numberedRangeRequests = createNumberedRangeRequests(request.message);

  if (numberedRangeRequests.length > 0) {
    const rangeResults: OllamaChatResult[] = [];

    for (const rangeRequest of numberedRangeRequests) {
      assertOllamaChatNotAborted(request.signal);
      let rangeResult = await sendOllamaChatRequest({
        model: request.model,
        message: rangeRequest.prompt,
        requestId: request.requestId,
        signal: request.signal,
        onChunk: request.onChunk
      });
      rangeResult = await continueOllamaChatResultIfNeeded({
        model: request.model,
        originalMessage: rangeRequest.prompt,
        initialResult: rangeResult,
        requestId: request.requestId,
        signal: request.signal,
        onChunk: request.onChunk,
        lengthLimitOnly: true
      });
      assertOllamaChatNotAborted(request.signal);
      for (
        let repairAttempt = 0, missingQuestionNumbers = getMissingNumberedRangeQuestions(
          rangeResult.message,
          rangeRequest.start,
          rangeRequest.end
        );
        missingQuestionNumbers.length > 0 && repairAttempt < MAX_MISSING_QUIZ_REPAIR_ATTEMPTS;
        repairAttempt += 1, missingQuestionNumbers = getMissingNumberedRangeQuestions(
          rangeResult.message,
          rangeRequest.start,
          rangeRequest.end
        )
      ) {
        assertOllamaChatNotAborted(request.signal);
        let repairResult = await sendOllamaChatRequest({
          model: request.model,
          message: createMissingNumberedRangePrompt(
            request.message,
            missingQuestionNumbers,
            rangeResult.message
          ),
          requestId: request.requestId,
          signal: request.signal,
          onChunk: request.onChunk
        });
        repairResult = await continueOllamaChatResultIfNeeded({
          model: request.model,
          originalMessage: createMissingNumberedRangePrompt(
            request.message,
            missingQuestionNumbers,
            rangeResult.message
          ),
          initialResult: repairResult,
          requestId: request.requestId,
          signal: request.signal,
          onChunk: request.onChunk,
          lengthLimitOnly: true
        });
        assertOllamaChatNotAborted(request.signal);

        rangeResult = {
          model: repairResult.model || rangeResult.model,
          message: mergeAssistantContinuation(rangeResult.message, repairResult.message),
          doneReason: getMergedDoneReason([rangeResult, repairResult])
        };
      }
      if (getMissingNumberedRangeQuestions(rangeResult.message, rangeRequest.start, rangeRequest.end).length > 0) {
        rangeResult = {
          ...rangeResult,
          doneReason: "length"
        };
      }

      rangeResults.push(rangeResult);
    }

    return {
      model: rangeResults.at(-1)?.model ?? request.model,
      message: rangeResults.map((result) => result.message.trim()).filter(Boolean).join("\n\n"),
      doneReason: getMergedDoneReason(rangeResults)
    };
  }

  assertOllamaChatNotAborted(request.signal);
  const firstResult = await sendOllamaChatRequest(request);
  return continueOllamaChatResultIfNeeded({
    model: request.model,
    originalMessage: request.message,
    initialResult: firstResult,
    requestId: request.requestId,
    signal: request.signal,
    onChunk: request.onChunk
  });
}

async function continueOllamaChatResultIfNeeded(payload: {
  model: string;
  originalMessage: string;
  initialResult: OllamaChatResult;
  requestId?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  lengthLimitOnly?: boolean;
}): Promise<OllamaChatResult> {
  assertOllamaChatNotAborted(payload.signal);
  if (payload.lengthLimitOnly && payload.initialResult.doneReason !== "length") {
    return payload.initialResult;
  }

  let continuationPrompt = createContinuationPromptIfNeeded(
    payload.originalMessage,
    payload.initialResult.message,
    payload.initialResult.doneReason
  );

  if (!continuationPrompt) {
    return payload.initialResult;
  }

  let mergedMessage = payload.initialResult.message;
  let latestModel = payload.initialResult.model;
  let latestDoneReason = payload.initialResult.doneReason;

  for (let callCount = 1; continuationPrompt && callCount < MAX_OLLAMA_LENGTH_LIMIT_CALLS; callCount += 1) {
    assertOllamaChatNotAborted(payload.signal);
    const continuationResult = await sendOllamaChatRequest({
      model: payload.model,
      message: continuationPrompt,
      requestId: payload.requestId,
      signal: payload.signal,
      onChunk: payload.onChunk
    });
    assertOllamaChatNotAborted(payload.signal);
    latestModel = continuationResult.model;
    mergedMessage = mergeAssistantContinuation(mergedMessage, continuationResult.message);
    latestDoneReason = continuationResult.doneReason;
    continuationPrompt = createContinuationPromptIfNeeded(payload.originalMessage, mergedMessage, latestDoneReason);
  }

  return {
    model: latestModel || payload.initialResult.model,
    message: mergedMessage,
    doneReason: latestDoneReason
  };
}

export async function cancelOllamaChat(requestId: string): Promise<void> {
  const normalizedRequestId = requestId.trim();

  if (!normalizedRequestId) {
    return;
  }

  if (hasTauriInvoke()) {
    await invoke("ollama_cancel_chat", { requestId: normalizedRequestId });
  }
}

async function sendOllamaChatRequest(request: OllamaChatRequest): Promise<OllamaChatResult> {
  if (hasTauriInvoke()) {
    let unlisten: UnlistenFn | null = null;

    if (request.onChunk && request.requestId?.trim()) {
      unlisten = await listen<OllamaChatChunkEventPayload>("ollama_chat_chunk", (event) => {
        forwardMatchingDesktopChunk(event, request.requestId, request.onChunk);
      });
    }

    try {
      return await invoke<OllamaChatResult>("ollama_chat", {
        request: {
          model: request.model,
          message: request.message,
          requestId: request.requestId,
          numPredict: getOllamaChatNumPredict(request.message),
          timeoutMs: getOllamaChatTimeoutMs(request.message),
          think: false
        }
      });
    } finally {
      unlisten?.();
    }
  }

  return chatFromBrowserPreview(request);
}

function forwardMatchingDesktopChunk(
  event: Event<OllamaChatChunkEventPayload>,
  requestId: string | undefined,
  onChunk: ((chunk: string) => void) | undefined
): void {
  const normalizedRequestId = requestId?.trim();
  const payloadRequestId = event.payload.requestId?.trim();
  const chunk = event.payload.chunk ?? "";

  if (!normalizedRequestId || payloadRequestId !== normalizedRequestId || !chunk.trim()) {
    return;
  }

  onChunk?.(chunk);
}

function createOllamaChatMessages(message: string): Array<{ role: "user"; content: string }> {
  return [
    {
      role: "user",
      content: [
        "中文优先。除非用户明确要求其它语言，默认用中文回答。",
        "严格按用户当前问题回答，不要把术语误解成无关主题；例如不要把 MIT 开源协议误解为 MIT 学校介绍。",
        "",
        "用户问题：",
        message
      ].join("\n")
    }
  ];
}

function assertUsableOllamaChatModel(model: string): void {
  const normalizedModel = model.trim();

  if (!normalizedModel || normalizedModel === "未选择模型") {
    throw new Error(
      "No usable local Ollama model is selected. Start Ollama, pull a local model, and select it before retrying."
    );
  }
}

function assertOllamaChatNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Ollama chat request was cancelled before the next local-model call.");
  }
}

function createOllamaOverviewTimeout(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Ollama overview request timed out after ${Math.floor(OLLAMA_OVERVIEW_TIMEOUT_MS / 1000)} seconds.`));
    }, OLLAMA_OVERVIEW_TIMEOUT_MS);
  });
}

function isOllamaOverviewTimeoutError(error: unknown): boolean {
  return error instanceof Error && /overview request timed out/i.test(error.message);
}

async function loadFromBrowserPreview(): Promise<OllamaOverview> {
  try {
    const response = await Promise.race([
      fetch(ollamaTagsPath),
      createOllamaOverviewTimeout()
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OllamaTagsResponse;
    const models = normalizeModels(payload);
    const diagnostic =
      models.length === 0
        ? "No local Ollama models were found. Pull a model before starting chat."
        : "";

    return {
      reachable: true,
      endpoint: ollamaEndpoint,
      selectedModel: selectDefaultChatModel(models),
      diagnostic,
      models
    };
  } catch (error) {
    return {
      reachable: false,
      endpoint: ollamaEndpoint,
      selectedModel: "",
      diagnostic: isOllamaOverviewTimeoutError(error)
        ? `Ollama 概览请求超时（${Math.floor(OLLAMA_OVERVIEW_TIMEOUT_MS / 1000)} 秒），请确认本地服务响应正常。`
        : "Ollama 未启动，请确认本地服务已运行。",
      models: []
    };
  }
}

async function chatFromBrowserPreview(request: OllamaChatRequest): Promise<OllamaChatResult> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: request.model,
      messages: createOllamaChatMessages(request.message),
      options: {
        num_predict: getOllamaChatNumPredict(request.message)
      },
      think: false,
      stream: true
    })
  };

  if (request.signal) {
    requestInit.signal = request.signal;
  }

  const response = await fetch(ollamaChatPath, requestInit);

  if (!response.ok) {
    throw new Error(formatOllamaHttpError(response.status, await response.text()));
  }

  if (response.body) {
    return readOllamaChatStream(response.body, request.model, request.onChunk);
  }

  const payload = (await response.json()) as OllamaChatResponse;
  const responseError = payload.error?.trim();

  if (responseError) {
    throw new Error(`Ollama stream returned an error: ${responseError}`);
  }

  const content = payload.message?.content?.trim();

  if (!content) {
    throw new Error("Ollama chat returned an empty assistant message.");
  }

  return {
    model: payload.model ?? request.model,
    message: content,
    doneReason: payload.done_reason
  };
}

async function readOllamaChatStream(
  body: ReadableStream<Uint8Array>,
  fallbackModel: string,
  onChunk?: (chunk: string) => void
): Promise<OllamaChatResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let model = "";
  let message = "";
  let doneReason: string | undefined;
  let streamError: string | undefined;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      const chunk = parseOllamaChatStreamLine(line);

      if (!chunk) {
        continue;
      }

      if (chunk.error?.trim()) {
        streamError = chunk.error;
        continue;
      }

      if (chunk.model?.trim()) {
        model = chunk.model;
      }

      if (chunk.done_reason) {
        doneReason = chunk.done_reason;
      }

      if (chunk.message?.content) {
        message += chunk.message.content;
        onChunk?.(chunk.message.content);
      }
    }
  }

  buffered += decoder.decode();
  const finalChunk = parseOllamaChatStreamLine(buffered);

  if (finalChunk) {
    if (finalChunk.error?.trim()) {
      streamError = finalChunk.error;
    }

    if (finalChunk.model?.trim()) {
      model = finalChunk.model;
    }

    if (finalChunk.done_reason) {
      doneReason = finalChunk.done_reason;
    }

    if (finalChunk.message?.content) {
      message += finalChunk.message.content;
      onChunk?.(finalChunk.message.content);
    }
  }

  if (streamError) {
    throw new Error(`Ollama stream returned an error: ${streamError}`);
  }

  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new Error("Ollama chat returned an empty assistant message.");
  }

  return {
    model: model || fallbackModel,
    message: trimmedMessage,
    doneReason
  };
}

function parseOllamaChatStreamLine(line: string): OllamaChatResponse | null {
  const normalizedLine = line.trim();

  if (!normalizedLine) {
    return null;
  }

  try {
    return JSON.parse(normalizedLine) as OllamaChatResponse;
  } catch {
    return null;
  }
}

function formatOllamaHttpError(status: number, body: string): string {
  const trimmedBody = body.trim();
  let detail = "";

  if (trimmedBody) {
    try {
      const payload = JSON.parse(trimmedBody) as OllamaChatResponse;
      detail = payload.error?.trim() ?? "";
    } catch {
      detail = trimmedBody;
    }
  }

  return detail
    ? `Ollama chat failed with HTTP ${status}: ${detail}`
    : `Ollama chat failed with HTTP ${status}`;
}

function getOllamaChatNumPredict(message: string): number {
  return shouldUseLongOllamaOutputBudget(message)
    ? LONG_OLLAMA_CHAT_NUM_PREDICT
    : DEFAULT_OLLAMA_CHAT_NUM_PREDICT;
}

function getOllamaChatTimeoutMs(message: string): number {
  return shouldUseLongOllamaOutputBudget(message)
    ? LONG_OLLAMA_CHAT_TIMEOUT_MS
    : DEFAULT_OLLAMA_CHAT_TIMEOUT_MS;
}

function shouldUseLongOllamaOutputBudget(message: string): boolean {
  const normalized = message.trim();
  const questionMarkers = [
    ...(normalized.match(/(?:^|\n|\s)\d{1,3}\s*[.、．]/g) ?? []),
    ...(normalized.match(/第\s*\d{1,3}\s*题/g) ?? [])
  ].length;

  return normalized.length > 1800
    || questionMarkers >= 8
    || /单选题|多选题|共\s*\d+\s*(?:小题|题)|逐题|长文本|长文档|完整总结|完整分析/.test(normalized);
}

function createContinuationPromptIfNeeded(
  originalMessage: string,
  assistantMessage: string,
  doneReason?: string
): string | null {
  if (doneReason === "length") {
    return [
      "上一条回答因为输出长度限制中断。",
      "请从中断处继续，不要重写已经完成的内容。",
      "保持同样格式，补完整体回答。",
      "",
      "原始用户请求：",
      originalMessage,
      "",
      "上一条回答末尾：",
      assistantMessage.slice(-1200)
    ].join("\n");
  }

  const expectedMultipleChoiceCount = readExpectedQuestionCount(originalMessage, "多选题");

  if (expectedMultipleChoiceCount === null) {
    return null;
  }

  const answeredMultipleChoiceCount = readAnsweredQuestionCountAfterSection(assistantMessage, "多选题");

  if (answeredMultipleChoiceCount >= expectedMultipleChoiceCount) {
    return null;
  }

  return [
    "从上一条回答中断处继续，不要重写已经完成的题目。",
    `原始任务要求多选题共 ${expectedMultipleChoiceCount} 小题；你上一条最多只完成到第 ${answeredMultipleChoiceCount} 小题。`,
    `请从多选题第 ${answeredMultipleChoiceCount + 1} 题继续，补完到第 ${expectedMultipleChoiceCount} 题。`,
    "保持同样格式，只输出缺失部分和必要的简要解释。",
    "",
    "原始用户请求：",
    originalMessage,
    "",
    "上一条回答末尾：",
    assistantMessage.slice(-1200)
  ].join("\n");
}

function createQuizSectionRequests(originalMessage: string): QuizSectionRequest[] {
  const sections = readDeclaredQuizSections(originalMessage);

  if (sections.length < 2) {
    return [];
  }

  return sections.map((section) => ({
    ...section,
    prompt: createQuizSectionPrompt(originalMessage, section.sectionLabel, section.count)
  }));
}

function createQuizSectionPrompt(originalMessage: string, sectionLabel: string, count: number): string {
  return [
    `只回答${sectionLabel}，共 ${count} 小题。`,
    "请逐题给出题号、答案和简要解释。",
    "不要回答其它题型，不要输出总表之外的额外寒暄。",
    "如果题目原文较长，也必须覆盖本题型所有题号。",
    "",
    "完整原始用户请求：",
    originalMessage
  ].join("\n");
}

function createMissingQuizQuestionsPrompt(
  originalMessage: string,
  sectionLabel: string,
  missingQuestionNumbers: number[],
  previousSectionAnswer: string
): string {
  const missingLabel = missingQuestionNumbers.join("、");

  return [
    `只补全${sectionLabel}缺失题号：${missingLabel}。`,
    "不要重写已经回答过的题号。",
    "请逐题给出题号、答案和简要解释。",
    "",
    "原始用户请求：",
    originalMessage,
    "",
    "上一段已有回答：",
    previousSectionAnswer.slice(-1200)
  ].join("\n");
}

function createNumberedRangeRequests(originalMessage: string): NumberedRangeRequest[] {
  const questionNumbers = readTopLevelQuestionNumbers(originalMessage);

  if (questionNumbers.length < MIN_NUMBERED_RANGE_SPLIT_COUNT || !isConsecutiveFromOne(questionNumbers)) {
    return [];
  }

  const requests: NumberedRangeRequest[] = [];
  const total = questionNumbers.at(-1) ?? 0;

  for (let start = 1; start <= total; start += NUMBERED_RANGE_SPLIT_SIZE) {
    const end = Math.min(start + NUMBERED_RANGE_SPLIT_SIZE - 1, total);
    requests.push({
      start,
      end,
      prompt: createNumberedRangePrompt(originalMessage, start, end)
    });
  }

  return requests;
}

function createNumberedRangePrompt(originalMessage: string, start: number, end: number): string {
  return [
    `只回答编号 ${start} 到 ${end}。`,
    "请逐题给出题号、答案和简要解释。",
    "不要回答这个编号范围之外的题目，不要输出额外寒暄。",
    "如果题目原文较长，也必须覆盖本范围内所有题号。",
    "",
    "完整原始用户请求：",
    originalMessage
  ].join("\n");
}

function createMissingNumberedRangePrompt(
  originalMessage: string,
  missingQuestionNumbers: number[],
  previousRangeAnswer: string
): string {
  const missingLabel = missingQuestionNumbers.join("、");

  return [
    `只补全编号 ${missingLabel}。`,
    "不要重写已经回答过的编号。",
    "请逐题给出题号、答案和简要解释。",
    "",
    "原始用户请求：",
    originalMessage,
    "",
    "上一段已有回答：",
    previousRangeAnswer.slice(-1200)
  ].join("\n");
}

function getMissingNumberedRangeQuestions(answer: string, start: number, end: number): number[] {
  const answered = new Set(readTopLevelQuestionNumbers(answer));
  const missing = [];

  for (let questionNumber = start; questionNumber <= end; questionNumber += 1) {
    if (!answered.has(questionNumber)) {
      missing.push(questionNumber);
    }
  }

  return missing;
}

function readTopLevelQuestionNumbers(text: string): number[] {
  const normalized = normalizeForContinuationDetection(text);
  const questionNumbers = Array.from(normalized.matchAll(/(?:^|\n)\s*(\d{1,3})\s*[.、．]\s+/g))
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((value) => Number.isFinite(value));

  return Array.from(new Set(questionNumbers));
}

function isConsecutiveFromOne(questionNumbers: number[]): boolean {
  return questionNumbers.every((questionNumber, index) => questionNumber === index + 1);
}

function getMissingQuestionNumbers(answer: string, sectionLabel: string, count: number): number[] {
  const answered = new Set(readAnsweredQuestionNumbersAfterSection(answer, sectionLabel));
  const missing = [];

  for (let questionNumber = 1; questionNumber <= count; questionNumber += 1) {
    if (!answered.has(questionNumber)) {
      missing.push(questionNumber);
    }
  }

  return missing;
}

function readDeclaredQuizSections(text: string): Array<{ sectionLabel: string; count: number }> {
  const normalized = normalizeForContinuationDetection(text);
  const sections = [
    ...Array.from(
    normalized.matchAll(/(?:^|[；;\n\s])(?:[一二三四五六七八九十]+[、.．]\s*)?([\u4e00-\u9fa5A-Za-z]{1,18}题)\s*(?:\(|（)?\s*共\s*(\d+)\s*(?:小题|题)/g)
    ).map((match) => ({
      sectionLabel: (match[1] ?? "").trim(),
      count: Number.parseInt(match[2] ?? "", 10)
    })),
    ...Array.from(
      normalized.matchAll(/(?:^|[；;，,、\n\s])(?:共|一共|总共)?\s*(\d+)\s*(?:小题|题)\s*([\u4e00-\u9fa5A-Za-z]{1,18})(?:题)?/g)
    ).map((match) => ({
      sectionLabel: normalizeQuizSectionLabel(match[2] ?? ""),
      count: Number.parseInt(match[1] ?? "", 10)
    }))
  ].filter((section) => section.sectionLabel.length > 0 && Number.isFinite(section.count) && section.count > 0);
  const uniqueSections = new Map<string, { sectionLabel: string; count: number }>();

  for (const section of sections) {
    if (!uniqueSections.has(section.sectionLabel)) {
      uniqueSections.set(section.sectionLabel, section);
    }
  }

  return Array.from(uniqueSections.values());
}

function normalizeQuizSectionLabel(label: string): string {
  const normalizedLabel = label.trim();

  if (!normalizedLabel) {
    return "";
  }

  return normalizedLabel.endsWith("题") ? normalizedLabel : `${normalizedLabel}题`;
}

function readExpectedQuestionCount(text: string, sectionLabel: string): number | null {
  const normalized = normalizeForContinuationDetection(text);
  const escapedLabel = sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escapedLabel}\\s*(?:\\(|（)?\\s*共\\s*(\\d+)\\s*(?:小题|题)`, "i"),
    new RegExp(`${escapedLabel}[^\\d]{0,20}(\\d+)\\s*(?:小题|题)`, "i")
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const count = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;

    if (Number.isFinite(count) && count > 0) {
      return count;
    }
  }

  return null;
}

function readAnsweredQuestionCountAfterSection(text: string, sectionLabel: string): number {
  const questionNumbers = readAnsweredQuestionNumbersAfterSection(text, sectionLabel);

  return questionNumbers.length > 0 ? Math.max(...questionNumbers) : 0;
}

function readAnsweredQuestionNumbersAfterSection(text: string, sectionLabel: string): number[] {
  const normalized = normalizeForContinuationDetection(text);
  const sectionIndex = normalized.indexOf(sectionLabel);
  const scopedText = sectionIndex >= 0 ? normalized.slice(sectionIndex) : normalized;
  return Array.from(scopedText.matchAll(/(?:^|\n|\s)(\d{1,2})\s*[.、．]/g))
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((value) => Number.isFinite(value));
}

function normalizeForContinuationDetection(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[：:]/g, " ");
}

function mergeAssistantContinuation(firstMessage: string, continuationMessage: string): string {
  const normalizedContinuation = continuationMessage.trim();

  if (!normalizedContinuation) {
    return firstMessage.trim();
  }

  return `${firstMessage.trim()}\n\n${normalizedContinuation}`;
}

function getMergedDoneReason(results: OllamaChatResult[]): string | undefined {
  if (results.some((result) => result.doneReason === "length")) {
    return "length";
  }

  return results.at(-1)?.doneReason;
}

function hasTauriInvoke(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function normalizeModels(payload: OllamaTagsResponse): OllamaModelSummary[] {
  return (payload.models ?? [])
    .filter((model): model is { name: string; size?: number } => typeof model.name === "string" && model.name.length > 0)
    .map((model) => ({
      name: model.name,
      sizeLabel: formatModelSize(model.size ?? 0),
      capabilities: model.details?.capabilities
    }));
}

function selectDefaultChatModel(models: OllamaModelSummary[]): string {
  const chatModels = models.filter((model) => !isEmbeddingOnlyModel(model));

  return chatModels.find((model) => PREFERRED_DEFAULT_CHAT_MODELS.includes(model.name))?.name
    ?? chatModels[0]?.name
    ?? "";
}

function isEmbeddingOnlyModel(model: OllamaModelSummary): boolean {
  const capabilities = model.capabilities ?? [];
  const normalizedName = model.name.trim().toLowerCase();
  const capabilityBasedEmbedding = capabilities.some((capability) => capability.toLowerCase() === "embedding");
  const nameBasedEmbedding = normalizedName.includes("embedding")
    || normalizedName.includes("embed")
    || normalizedName.includes("bge")
    || normalizedName.includes("mxbai")
    || normalizedName.includes("nomic-embed")
    || normalizedName.includes("all-minilm");

  return capabilityBasedEmbedding || nameBasedEmbedding;
}

function formatModelSize(size: number): string {
  if (size <= 0) {
    return "未知大小";
  }

  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
