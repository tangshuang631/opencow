import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  cancelOllamaChat,
  chatWithOllamaModel,
  getOllamaConnectionLabel,
  loadOllamaOverview,
  type OllamaOverview
} from "./ollamaService";

const tauriInternals = "__TAURI_INTERNALS__" as const;
const { listenMock, unlistenMock, desktopChunkListeners } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  unlistenMock: vi.fn(),
  desktopChunkListeners: [] as Array<(event: { payload: unknown }) => void>
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock
}));

describe("ollamaService", () => {
  afterEach(() => {
    clearMocks();
    vi.restoreAllMocks();
    listenMock.mockReset();
    unlistenMock.mockReset();
    desktopChunkListeners.length = 0;
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals];
  });

  async function runWithDesktopIpcOnly<T>(callback: () => Promise<T>): Promise<T> {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", undefined);

    try {
      return await callback();
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  }

  it("loads models through the Tauri command when desktop IPC is available", async () => {
    const overview = await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd) => {
        if (cmd === "ollama_overview") {
          return {
            reachable: true,
            endpoint: "http://127.0.0.1:11434",
            selectedModel: "qwen2.5-coder:7b",
            diagnostic: "",
            models: [
              { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
              { name: "bge-m3:latest", sizeLabel: "1.2 GB" }
            ]
          } satisfies OllamaOverview;
        }

        return null;
      });

      return loadOllamaOverview();
    });

    expect(overview.reachable).toBe(true);
    expect(overview.selectedModel).toBe("qwen2.5-coder:7b");
    expect(overview.models).toHaveLength(2);
  });

  it("prefers the local HTTP Ollama API over desktop IPC when fetch is available", async () => {
    mockIPC((cmd) => {
      if (cmd === "ollama_overview" || cmd === "ollama_chat") {
        throw new Error("desktop IPC should not be used when direct Ollama HTTP is available");
      }

      return null;
    });
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "qwen3.5:9b",
              size: 6_594_474_711,
              details: {
                capabilities: ["completion", "chat"]
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(
              '{"model":"qwen3.5:9b","message":{"content":"第一段，"}}\n'
            ));
            controller.enqueue(encoder.encode(
              '{"model":"qwen3.5:9b","message":{"content":"第二段。"},"done_reason":"stop"}\n'
            ));
            controller.close();
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const overview = await loadOllamaOverview();
    const chatResult = await chatWithOllamaModel({
      model: "qwen3.5:9b",
      message: "解释一下 MCP"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:11434/api/tags");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:11434/api/chat", expect.any(Object));
    expect(overview.selectedModel).toBe("qwen3.5:9b");
    expect(chatResult).toEqual({
      model: "qwen3.5:9b",
      message: "第一段，第二段。",
      doneReason: "stop"
    });
  });

  it("falls back to the local HTTP API during browser preview", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "qwen2.5-coder:7b",
              size: 4_402_345_123,
              details: {
                capabilities: ["completion", "chat"]
              }
            }
          ]
        })
      })
    );

    const overview = await loadOllamaOverview();

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:11434/api/tags");
    expect(overview.reachable).toBe(true);
    expect(overview.models[0]).toMatchObject({ name: "qwen2.5-coder:7b" });
  });

  it("prefers Ollama metadata capabilities over model-name heuristics when filtering chat models", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "custom-general-model",
              size: 4_402_345_123,
              details: {
                capabilities: ["completion", "chat"]
              }
            },
            {
              name: "general-embeddings",
              size: 1_200_000_000,
              details: {
                capabilities: ["embedding"]
              }
            }
          ]
        })
      })
    );

    const overview = await loadOllamaOverview();

    expect(overview.selectedModel).toBe("custom-general-model");
    expect(overview.models.map((model) => model.name)).toEqual(["custom-general-model", "general-embeddings"]);
  });

  it("prefers gemma 26b over other detected models by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "qwen3.6:35b",
              size: 22_000_000_000
            },
            {
              name: "gemma:26b",
              size: 16_000_000_000
            },
            {
              name: "gemma4:26b",
              size: 16_000_000_000
            },
            {
              name: "qwen3.5:9b",
              size: 6_000_000_000
            }
          ]
        })
      })
    );

    const overview = await loadOllamaOverview();

    expect(overview.selectedModel).toBe("gemma:26b");
    expect(overview.models.map((model) => model.name)).toEqual([
      "qwen3.6:35b",
      "gemma:26b",
      "gemma4:26b",
      "qwen3.5:9b"
    ]);
  });

  it("falls back to gemma4 26b when gemma 26b is not installed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "qwen3.6:35b",
              size: 22_000_000_000
            },
            {
              name: "gemma4:26b",
              size: 16_000_000_000
            }
          ]
        })
      })
    );

    const overview = await loadOllamaOverview();

    expect(overview.selectedModel).toBe("gemma4:26b");
  });

  it("returns a repair-friendly diagnostic when Ollama is reachable but no models are installed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: []
        })
      })
    );

    const overview = await loadOllamaOverview();

    expect(overview.reachable).toBe(true);
    expect(overview.models).toHaveLength(0);
    expect(overview.selectedModel).toBe("");
    expect(overview.diagnostic).toContain("No local Ollama models");
  });

  it("returns a repair-friendly offline state when Ollama is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

    const overview = await loadOllamaOverview();

    expect(overview.reachable).toBe(false);
    expect(overview.models).toHaveLength(0);
    expect(overview.diagnostic).toContain("Ollama");
  });

  it("falls back to an offline overview when browser-preview Ollama discovery times out", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    const overviewPromise = loadOllamaOverview();

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(overviewPromise).resolves.toMatchObject({
      reachable: false,
      diagnostic: expect.stringMatching(/超时/)
    });
  });

  it("maps reachability to a short UI label", () => {
    expect(getOllamaConnectionLabel({ reachable: true } as OllamaOverview)).toBe("Ollama 已连接");
    expect(getOllamaConnectionLabel({ reachable: false } as OllamaOverview)).toBe("等待 Ollama");
  });

  it("wraps desktop chat args under request for the Tauri command", async () => {
    let chatPayload: unknown;
    const result = await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd, payload) => {
        if (cmd === "ollama_chat") {
          chatPayload = payload;
          return {
            model: "qwen3.6:35b",
            message: "享元模式通过共享内部状态来减少对象数量。"
          };
        }

        return null;
      });

      return chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "解释享元模式"
      });
    });

    expect(chatPayload).toEqual({
      request: {
        model: "qwen3.6:35b",
        message: "解释享元模式",
        requestId: undefined,
        numPredict: 512,
        timeoutMs: 480_000,
        think: false
      }
    });
    expect(result).toEqual({
      model: "qwen3.6:35b",
      message: "享元模式通过共享内部状态来减少对象数量。"
    });
  });

  it("uses a compact output budget for short ordinary desktop chat questions", async () => {
    let chatPayload: unknown;
    await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd, payload) => {
        if (cmd === "ollama_chat") {
          chatPayload = payload;
          return {
            model: "qwen3.6:35b",
            message: "常见开源协议包括 MIT、Apache-2.0、BSD、GPL、LGPL、AGPL 和 MPL。"
          };
        }

        return null;
      });

      await chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "开源协议有哪些"
      });
    });

    expect(chatPayload).toEqual({
      request: expect.objectContaining({
        model: "qwen3.6:35b",
        message: "开源协议有哪些",
        numPredict: 512,
        timeoutMs: 480_000,
        think: false
      })
    });
  });

  it("uses the configured long-answer output budget for long desktop chat questions", async () => {
    let chatPayload: unknown;
    await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd, payload) => {
        if (cmd === "ollama_chat") {
          chatPayload = payload;
          return {
            model: "qwen3.6:35b",
            message: "这是一个较长回答。"
          };
        }

        return null;
      });

      await chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "请完整总结这份很长的文档，并给出详细分析、分点结论和完整建议。",
        longAnswerNumPredict: 12288
      });
    });

    expect(chatPayload).toEqual({
      request: expect.objectContaining({
        model: "qwen3.6:35b",
        numPredict: 12288,
        think: false
      })
    });
  });

  it("passes request ids to desktop Ollama chat and cancellation commands", async () => {
    const seenPayloads: Array<{ cmd: string; payload: unknown }> = [];
    await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd, payload) => {
        seenPayloads.push({ cmd, payload });

        if (cmd === "ollama_chat") {
          return {
            model: "qwen3.6:35b",
            message: "正在回答。"
          };
        }

        if (cmd === "ollama_cancel_chat") {
          return null;
        }

        return null;
      });

      await chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "解释 MIT 协议",
        requestId: "local-model-chat-task-1"
      });
      await cancelOllamaChat("local-model-chat-task-1");
    });

    expect(seenPayloads).toContainEqual({
      cmd: "ollama_chat",
      payload: {
        request: {
          model: "qwen3.6:35b",
          message: "解释 MIT 协议",
          requestId: "local-model-chat-task-1",
          numPredict: 512,
          timeoutMs: 480_000,
          think: false
        }
      }
    });
    expect(seenPayloads).toContainEqual({
      cmd: "ollama_cancel_chat",
      payload: {
        requestId: "local-model-chat-task-1"
      }
    });
  });

  it("forwards matching desktop Ollama chunk events and releases the listener after completion", async () => {
    let resolveChat: (value: { model: string; message: string }) => void = () => {};
    const onChunk = vi.fn();
    const resultPromise = runWithDesktopIpcOnly(async () => {
      listenMock.mockImplementation((_eventName: string, listener: (event: { payload: unknown }) => void) => {
        desktopChunkListeners.push(listener);
        return Promise.resolve(unlistenMock);
      });
      mockIPC((cmd) => {
        if (cmd === "ollama_chat") {
          return new Promise((resolve) => {
            resolveChat = resolve;
          });
        }

        return null;
      });

      return chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "解释享元模式",
        requestId: "local-model-chat-task-1",
        onChunk
      });
    });

    await vi.waitFor(() => {
      expect(listenMock).toHaveBeenCalledWith("ollama_chat_chunk", expect.any(Function));
    });

    desktopChunkListeners[0]?.({
      payload: {
        requestId: "other-request",
        chunk: "不应该显示"
      }
    });
    desktopChunkListeners[0]?.({
      payload: {
        requestId: "local-model-chat-task-1",
        chunk: "第一段，"
      }
    });
    desktopChunkListeners[0]?.({
      payload: {
        requestId: "local-model-chat-task-1",
        chunk: "第二段。"
      }
    });
    desktopChunkListeners[0]?.({
      payload: {
        requestId: "local-model-chat-task-1",
        chunk: "   "
      }
    });
    resolveChat({
      model: "qwen3.6:35b",
      message: "第一段，第二段。"
    });

    const result = await resultPromise;

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "第一段，");
    expect(onChunk).toHaveBeenNthCalledWith(2, "第二段。");
    expect(result.message).toBe("第一段，第二段。");
    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });

  it("keeps request ids on every desktop Ollama call created by long-answer splitting", async () => {
    const seenChatPayloads: unknown[] = [];
    await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd, payload) => {
        if (cmd === "ollama_chat") {
          seenChatPayloads.push(payload);

          return {
            model: "qwen3.6:35b",
            message: seenChatPayloads.length === 1
              ? "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C"
              : "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B\n7. C,D\n8. A,C"
          };
        }

        return null;
      });

      await chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。",
        requestId: "local-model-chat-long-1"
      });
    });

    expect(seenChatPayloads).toHaveLength(2);
    expect(seenChatPayloads).toEqual([
      expect.objectContaining({
        request: expect.objectContaining({ requestId: "local-model-chat-long-1" })
      }),
      expect.objectContaining({
        request: expect.objectContaining({ requestId: "local-model-chat-long-1" })
      })
    ]);
  });

  it("preserves desktop split answer length-limit status after bounded continuations", async () => {
    const seenChatPayloads: unknown[] = [];
    const result = await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd, payload) => {
        if (cmd === "ollama_chat") {
          seenChatPayloads.push(payload);

          if (seenChatPayloads.length === 1) {
            return {
              model: "qwen3.6:35b",
              message: "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C"
            };
          }

          return {
            model: "qwen3.6:35b",
            message: `二、多选题续写片段 ${seenChatPayloads.length}`,
            doneReason: "length"
          };
        }

        return null;
      });

      return chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。",
        requestId: "local-model-chat-long-length-limit"
      });
    });

    expect(seenChatPayloads.length).toBeGreaterThan(2);
    expect(result.message).toContain("二、多选题续写片段");
    expect(result.doneReason).toBe("length");
  });

  it("preserves desktop split answer length-limit status when an earlier section remains truncated", async () => {
    const seenChatPayloads: unknown[] = [];
    const result = await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd, payload) => {
        if (cmd === "ollama_chat") {
          seenChatPayloads.push(payload);

          if (seenChatPayloads.length <= 3) {
            return {
              model: "qwen3.6:35b",
              message: `一、单选题续写片段 ${seenChatPayloads.length}`,
              doneReason: "length"
            };
          }

          return {
            model: "qwen3.6:35b",
            message: "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B\n7. C,D\n8. A,C"
          };
        }

        return null;
      });

      return chatWithOllamaModel({
        model: "qwen3.6:35b",
        message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。",
        requestId: "local-model-chat-earlier-section-length-limit"
      });
    });

    expect(seenChatPayloads.length).toBeGreaterThan(3);
    expect(result.message).toContain("一、单选题续写片段");
    expect(result.message).toContain("二、多选题");
    expect(result.doneReason).toBe("length");
  });

  it("does not send another desktop Ollama split call after the request signal is aborted", async () => {
    const abortController = new AbortController();
    let chatCallCount = 0;
    await runWithDesktopIpcOnly(async () => {
      mockIPC((cmd) => {
        if (cmd === "ollama_chat") {
          chatCallCount += 1;
          abortController.abort();

          return {
            model: "qwen3.6:35b",
            message: "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C"
          };
        }

        return null;
      });

      await expect(
        chatWithOllamaModel({
          model: "qwen3.6:35b",
          message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。",
          requestId: "local-model-chat-long-2",
          signal: abortController.signal
        })
      ).rejects.toThrow(/aborted|cancelled/i);
    });

    expect(chatCallCount).toBe(1);
  });

  it("sends ordinary chat to the selected local Ollama model in browser preview", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: "享元模式通过共享内部状态来减少对象数量。"
          }
        })
      })
    );

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "解释享元模式"
    });

    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string);

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: expect.any(String)
    });
    expect(body).toMatchObject({
      model: "qwen3.6:35b",
      options: {
        num_predict: 512
      },
      think: false,
      stream: true
    });
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain("中文优先");
    expect(body.messages[0].content).toContain("解释享元模式");
    expect(result).toEqual({
      model: "qwen3.6:35b",
      message: "享元模式通过共享内部状态来减少对象数量。"
    });
  });

  it("adds a Chinese-first ordinary chat instruction before the user question", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "gemma4:26b",
        message: {
          role: "assistant",
          content: "MIT 协议是一种宽松开源许可证。"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await chatWithOllamaModel({
      model: "gemma4:26b",
      message: "用一句中文解释 MIT 开源协议。"
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);

    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain("中文优先");
    expect(body.messages[0].content).toContain("不要把 MIT 开源协议误解为 MIT 学校介绍");
    expect(body.messages[0].content).toContain("用一句中文解释 MIT 开源协议。");
  });

  it("merges browser-preview Ollama streaming chunks into one answer", async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(
          '{"model":"qwen3.6:35b","message":{"content":"第一段，"}}\n'
        ));
        controller.enqueue(encoder.encode(
          '{"model":"qwen3.6:35b","message":{"content":"第二段。"},"done_reason":"stop"}\n'
        ));
        controller.close();
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream
      })
    );

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "解释享元模式"
    });

    expect(JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string).stream).toBe(true);
    expect(result).toEqual({
      model: "qwen3.6:35b",
      message: "第一段，第二段。",
      doneReason: "stop"
    });
  });

  it("reports browser-preview streaming chunks to the caller as they arrive", async () => {
    const onChunk = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(
          '{"model":"qwen3.6:35b","message":{"content":"第一段，"}}\n'
        ));
        controller.enqueue(encoder.encode(
          '{"model":"qwen3.6:35b","message":{"content":"第二段。"},"done_reason":"stop"}\n'
        ));
        controller.close();
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream
      })
    );

    await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "解释享元模式",
      onChunk
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "第一段，");
    expect(onChunk).toHaveBeenNthCalledWith(2, "第二段。");
  });

  it("preserves browser-preview Ollama streaming errors", async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('{"error":"model missing:latest not found"}\n'));
        controller.close();
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream
      })
    );

    await expect(
      chatWithOllamaModel({
        model: "missing:latest",
        message: "hello"
      })
    ).rejects.toThrow(/model missing:latest not found/);
  });

  it("skips malformed browser-preview Ollama streaming noise when valid content arrives", async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('{"model":"qwen3.6:35b","message":{"content":"first "}}\n'));
        controller.enqueue(encoder.encode("not-json-progress-noise\n"));
        controller.enqueue(encoder.encode('{"model":"qwen3.6:35b","message":{"content":"second"},"done_reason":"stop"}\n'));
        controller.close();
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream
      })
    );

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "hello"
    });

    expect(result.message).toBe("first second");
    expect(result.doneReason).toBe("stop");
  });

  it("preserves browser-preview Ollama HTTP error body detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => '{"error":"model missing:latest not found"}'
      })
    );

    await expect(
      chatWithOllamaModel({
        model: "missing:latest",
        message: "hello"
      })
    ).rejects.toThrow(/model missing:latest not found/);
  });

  it("keeps the long-answer output budget for explicit quiz requests in browser preview", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "qwen3.6:35b",
        message: {
          role: "assistant",
          content: "1. A\n2. B\n3. C\n4. D\n5. A\n6. B\n7. C\n8. D"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "单选题 共 8 小题，请逐题给出答案和简要解释。"
    });

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).options.num_predict).toBe(4096);
  });

  it("passes abort signals to browser-preview Ollama chat fetches", async () => {
    const abortController = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "qwen3.6:35b",
        message: {
          role: "assistant",
          content: "MIT 协议允许使用、复制、修改和分发。"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "简单解释 MIT 协议",
      signal: abortController.signal
    });

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      signal: abortController.signal
    }));
  });

  it("continues and merges likely truncated long quiz answers in browser preview", async () => {
    const firstAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C\n\n二、多选题\n1. A,B,D\n2. C,D\n3. D";
    const continuationAnswer = "4. A,C\n5. B,D\n6. A,B\n7. C,D\n8. A,C\n\n以上为完整答案。";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: firstAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: continuationAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "回答这份磁特性综合实验试卷的二、多选题 共 8 小题。每题给出答案和简要解释。"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      model: "qwen3.6:35b",
      stream: true
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string).messages[0].content).toContain("从上一条回答中断处继续");
    expect(result.message).toContain(firstAnswer);
    expect(result.message).toContain(continuationAnswer);
  });

  it("continues once when Ollama reports the answer stopped because of the output length limit", async () => {
    const firstAnswer = "第一部分：长文本分析已经完成前半段。";
    const continuationAnswer = "第二部分：继续补完整体结论和建议。";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          done_reason: "length",
          message: {
            role: "assistant",
            content: firstAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: continuationAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "请完整总结这份很长的 Markdown 文档，并给出结构化建议。"
    });
    const continuationBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(continuationBody.messages[0].content).toContain("上一条回答因为输出长度限制中断");
    expect(result.message).toContain(firstAnswer);
    expect(result.message).toContain(continuationAnswer);
  });

  it("keeps long output budget on automatic length-limit continuation prompts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          done_reason: "length",
          message: {
            role: "assistant",
            content: "第一部分：长文本分析已经完成前半段。"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: "第二部分：继续补完整体结论和建议。"
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "请完整总结这份很长的 Markdown 文档，并给出结构化建议。"
    });

    const continuationBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(continuationBody.messages[0].content).toContain("上一条回答因为输出长度限制中断");
    expect(continuationBody.options.num_predict).toBe(4096);
  });

  it("continues bounded repeated Ollama length-limit answers without looping forever", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          done_reason: "length",
          message: { role: "assistant", content: "第一段。" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          done_reason: "length",
          message: { role: "assistant", content: "第二段。" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          done_reason: "length",
          message: { role: "assistant", content: "第三段。" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: { role: "assistant", content: "不应该请求到这一段。" }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "请完整总结这份很长的 Markdown 文档。"
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.message).toContain("第一段。");
    expect(result.message).toContain("第二段。");
    expect(result.message).toContain("第三段。");
    expect(result.message).not.toContain("不应该请求到这一段。");
  });

  it("splits long quiz requests by section before calling Ollama in browser preview", async () => {
    const singleChoiceAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C";
    const multipleChoiceAnswer = "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B\n7. C,D\n8. A,C";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: singleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: multipleChoiceAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。"
    });
    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstBody.messages[0].content).toContain("只回答单选题");
    expect(firstBody.messages[0].content).toContain("共 8 小题");
    expect(secondBody.messages[0].content).toContain("只回答多选题");
    expect(secondBody.messages[0].content).toContain("共 8 小题");
    expect(result.message).toContain(singleChoiceAnswer);
    expect(result.message).toContain(multipleChoiceAnswer);
  });

  it("splits compact quiz count requests like 8 single-choice and 8 multiple-choice", async () => {
    const singleChoiceAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C";
    const multipleChoiceAnswer = "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B\n7. C,D\n8. A,C";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: singleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: multipleChoiceAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "这份试卷一共 8 题单选、8 题多选，请逐题给出答案和简要解释。"
    });
    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstBody.messages[0].content).toContain("只回答单选题");
    expect(firstBody.messages[0].content).toContain("共 8 小题");
    expect(secondBody.messages[0].content).toContain("只回答多选题");
    expect(secondBody.messages[0].content).toContain("共 8 小题");
    expect(result.message).toContain(singleChoiceAnswer);
    expect(result.message).toContain(multipleChoiceAnswer);
  });

  it("repairs missing quiz question numbers after section splitting", async () => {
    const singleChoiceAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C";
    const incompleteMultipleChoiceAnswer = "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B";
    const missingMultipleChoiceAnswer = "7. C,D\n8. A,C";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: singleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: incompleteMultipleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: missingMultipleChoiceAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。"
    });
    const repairBody = JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(repairBody.messages[0].content).toContain("只补全多选题缺失题号");
    expect(repairBody.messages[0].content).toContain("7、8");
    expect(result.message).toContain(incompleteMultipleChoiceAnswer);
    expect(result.message).toContain(missingMultipleChoiceAnswer);
  });

  it("keeps repairing a split quiz section when the first missing-question repair is still incomplete", async () => {
    const singleChoiceAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C";
    const incompleteMultipleChoiceAnswer = "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B";
    const partialRepairAnswer = "7. C,D";
    const finalRepairAnswer = "8. A,C";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: singleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: incompleteMultipleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: partialRepairAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: finalRepairAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。"
    });
    const secondRepairBody = JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(secondRepairBody.messages[0].content).toContain("只补全多选题缺失题号");
    expect(secondRepairBody.messages[0].content).toContain("8");
    expect(result.message).toContain(incompleteMultipleChoiceAnswer);
    expect(result.message).toContain(partialRepairAnswer);
    expect(result.message).toContain(finalRepairAnswer);
  });

  it("marks split quiz answers as length-limited when bounded missing-question repair still cannot finish", async () => {
    const singleChoiceAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C";
    const incompleteMultipleChoiceAnswer = "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B";
    const firstRepairAnswer = "7. C,D";
    const secondRepairAnswer = "仍然没有补到第 8 题。";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: singleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: incompleteMultipleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: firstRepairAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: secondRepairAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。"
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.message).toContain(firstRepairAnswer);
    expect(result.message).toContain(secondRepairAnswer);
    expect(result.doneReason).toBe("length");
  });

  it("continues a split quiz section before checking for missing question numbers", async () => {
    const singleChoiceAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C";
    const truncatedMultipleChoiceAnswer = "二、多选题\n1. A,B,D\n2. C,D\n3. D";
    const continuedMultipleChoiceAnswer = "4. A,C\n5. B,D\n6. A,B\n7. C,D\n8. A,C";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: singleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          done_reason: "length",
          message: {
            role: "assistant",
            content: truncatedMultipleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: continuedMultipleChoiceAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。"
    });
    const continuationBody = JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(continuationBody.messages[0].content).toContain("上一条回答因为输出长度限制中断");
    expect(continuationBody.messages[0].content).toContain("只回答多选题");
    expect(result.message).toContain(singleChoiceAnswer);
    expect(result.message).toContain(truncatedMultipleChoiceAnswer);
    expect(result.message).toContain(continuedMultipleChoiceAnswer);
  });

  it("continues a length-limited missing-question repair answer", async () => {
    const singleChoiceAnswer = "一、单选题\n1. A\n2. B\n3. C\n4. D\n5. B\n6. D\n7. A\n8. C";
    const incompleteMultipleChoiceAnswer = "二、多选题\n1. A,B,D\n2. C,D\n3. D\n4. A,C\n5. B,D\n6. A,B";
    const truncatedRepairAnswer = "7. C,D";
    const repairContinuationAnswer = "8. A,C";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: singleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: incompleteMultipleChoiceAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          done_reason: "length",
          message: {
            role: "assistant",
            content: truncatedRepairAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: repairContinuationAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "磁特性综合实验：一、单选题 共 8 小题；二、多选题 共 8 小题。请每题给出题号、答案和简要解释。"
    });
    const repairContinuationBody = JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(repairContinuationBody.messages[0].content).toContain("上一条回答因为输出长度限制中断");
    expect(repairContinuationBody.messages[0].content).toContain("只补全多选题缺失题号");
    expect(result.message).toContain(incompleteMultipleChoiceAnswer);
    expect(result.message).toContain(truncatedRepairAnswer);
    expect(result.message).toContain(repairContinuationAnswer);
  });

  it("splits arbitrary named quiz sections that declare question counts", async () => {
    const trueFalseAnswer = "一、判断题\n1. 对\n2. 错\n3. 对";
    const shortAnswer = "二、简答题\n1. 磁滞回线表示磁化过程中的滞后现象。\n2. 剩磁是外场撤去后仍保留的磁感应强度。";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: trueFalseAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: shortAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: "磁特性综合实验：一、判断题 共 3 小题；二、简答题 共 2 小题。请每题给出题号、答案和简要解释。"
    });
    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstBody.messages[0].content).toContain("只回答判断题");
    expect(firstBody.messages[0].content).toContain("共 3 小题");
    expect(secondBody.messages[0].content).toContain("只回答简答题");
    expect(secondBody.messages[0].content).toContain("共 2 小题");
    expect(result.message).toContain(trueFalseAnswer);
    expect(result.message).toContain(shortAnswer);
  });

  it("splits long numbered-list requests into bounded ranges when no section counts are declared", async () => {
    const firstRangeAnswer = "1. A\n2. B\n3. C\n4. D\n5. A\n6. B\n7. C\n8. D";
    const secondRangeAnswer = "9. A\n10. B\n11. C\n12. D\n13. A\n14. B\n15. C\n16. D";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: firstRangeAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: secondRangeAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);
    const numberedPrompt = Array.from(
      { length: 16 },
      (_, index) => `${index + 1}. 这是一道需要回答和简要解释的题目。`
    ).join("\n");

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: `${numberedPrompt}\n请逐题给出答案和简要解释。`
    });
    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstBody.messages[0].content).toContain("只回答编号 1 到 8");
    expect(secondBody.messages[0].content).toContain("只回答编号 9 到 16");
    expect(result.message).toContain(firstRangeAnswer);
    expect(result.message).toContain(secondRangeAnswer);
  });

  it("repairs missing question numbers after numbered range splitting", async () => {
    const firstRangeAnswer = "1. A\n2. B\n3. C\n4. D\n5. A\n6. B\n7. C\n8. D";
    const incompleteSecondRangeAnswer = "9. A\n10. B\n11. C\n12. D\n13. A\n14. B";
    const repairedSecondRangeAnswer = "15. C\n16. D";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: firstRangeAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: incompleteSecondRangeAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: repairedSecondRangeAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);
    const numberedPrompt = Array.from(
      { length: 16 },
      (_, index) => `${index + 1}. 这是一道需要回答和简要解释的题目。`
    ).join("\n");

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: `${numberedPrompt}\n请逐题给出答案和简要解释。`
    });
    const repairBody = JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(repairBody.messages[0].content).toContain("只补全编号 15、16");
    expect(repairBody.messages[0].content).toContain("不要重写已经回答过的编号");
    expect(result.message).toContain(incompleteSecondRangeAnswer);
    expect(result.message).toContain(repairedSecondRangeAnswer);
  });

  it("keeps repairing a numbered range when the first missing-number repair is still incomplete", async () => {
    const firstRangeAnswer = "1. A\n2. B\n3. C\n4. D\n5. A\n6. B\n7. C\n8. D";
    const incompleteSecondRangeAnswer = "9. A\n10. B\n11. C\n12. D\n13. A\n14. B";
    const partialRepairAnswer = "15. C";
    const finalRepairAnswer = "16. D";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: firstRangeAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: incompleteSecondRangeAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: partialRepairAnswer
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "qwen3.6:35b",
          message: {
            role: "assistant",
            content: finalRepairAnswer
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);
    const numberedPrompt = Array.from(
      { length: 16 },
      (_, index) => `${index + 1}. 这是一道需要回答和简要解释的题目。`
    ).join("\n");

    const result = await chatWithOllamaModel({
      model: "qwen3.6:35b",
      message: `${numberedPrompt}\n请逐题给出答案和简要解释。`
    });
    const secondRepairBody = JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(secondRepairBody.messages[0].content).toContain("只补全编号 16");
    expect(result.message).toContain(incompleteSecondRangeAnswer);
    expect(result.message).toContain(partialRepairAnswer);
    expect(result.message).toContain(finalRepairAnswer);
  });

  it("blocks browser-preview chat before HTTP when no usable local model is selected", async () => {
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      chatWithOllamaModel({
        model: "未选择模型",
        message: "解释享元模式"
      })
    ).rejects.toThrow(/No usable local Ollama model is selected/i);

    expect(fetch).not.toHaveBeenCalled();
  });
});
