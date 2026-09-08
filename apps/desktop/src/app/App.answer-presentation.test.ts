import { describe, expect, it } from "vitest";
import { normalizeSearchGroundedAnswer } from "../features/assistant/answerPresentation";

describe("search-grounded answer presentation", () => {
  it("keeps the answer text clean when a model emits a duplicate citation block", () => {
    const normalized = normalizeSearchGroundedAnswer([
      "深圳今天多云，气温约 24–30°C。",
      "",
      "**3 条信息引用**",
      "**联网搜索来源**",
      "QWeather Shenzhen",
      "https://example.test/weather",
      "查询：今天深圳天气怎么样"
    ].join("\n"));

    expect(normalized).toBe("深圳今天多云，气温约 24–30°C。");
    expect(normalized).not.toMatch(/https?:\/\//i);
    expect(normalized).not.toContain("信息引用");
  });

  it("removes inline generated links without dropping the surrounding conclusion", () => {
    const normalized = normalizeSearchGroundedAnswer(
      "天气结论已更新，详情见 [天气数据](https://example.test/weather)。"
    );

    expect(normalized).toBe("天气结论已更新，详情见 天气数据。");
    expect(normalized).not.toMatch(/https?:\/\//i);
  });

  it("keeps text after an inline URL when the model omits whitespace before punctuation", () => {
    const normalized = normalizeSearchGroundedAnswer(
      "项目状态是 running，预期地址是 http://127.0.0.1:1420；这里只读取状态，没有启动或停止进程。"
    );

    expect(normalized).toBe("项目状态是 running，预期地址是 ；这里只读取状态，没有启动或停止进程。");
  });
});
