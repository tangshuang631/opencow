import { describe, expect, it } from "vitest";
import { normalizeWorkbenchText } from "./workbenchText";

describe("normalizeWorkbenchText", () => {
  it("repairs common mojibake labels for the desktop workbench", () => {
    expect(normalizeWorkbenchText("妯℃嫙鏈湴浠诲姟澶辫触")).toBe("模拟本地任务失败");
    expect(normalizeWorkbenchText("鍋滄浠诲姟")).toBe("停止任务");
    expect(normalizeWorkbenchText("鏈湴浠诲姟鎵ц澶辫触")).toBe("本地任务执行失败");
  });
});
