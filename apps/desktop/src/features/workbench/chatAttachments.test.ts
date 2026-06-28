import { describe, expect, it, vi } from "vitest";
import {
  createBrowserFileInputPicker,
  createChatAttachmentFromFile,
  extractClipboardAttachments,
  extractDroppedAttachments,
  pickChatAttachments,
  openChatAttachment
} from "./chatAttachments";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn()
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock
}));

describe("chatAttachments", () => {
  it("keeps native picked image base64 data for vision context", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {}
    });
    invokeMock.mockResolvedValueOnce([
      {
        id: "native-image",
        name: "capture.png",
        mime_type: "image/png",
        size_bytes: 4096,
        kind: "image",
        file_path: "/tmp/capture.png",
        base64_data: "aW1hZ2U="
      }
    ]);

    const attachments = await pickChatAttachments();

    expect(attachments[0]).toEqual(expect.objectContaining({
      id: "native-image",
      name: "capture.png",
      base64Data: "aW1hZ2U="
    }));

    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("creates a previewable attachment from a browser File", async () => {
    const attachment = await createChatAttachmentFromFile(
      new File(["hello"], "notes.txt", { type: "text/plain" }),
      "drop"
    );

    expect(attachment.name).toBe("notes.txt");
    expect(attachment.kind).toBe("file");
    expect(attachment.source).toBe("drop");
  });

  it("opens preview URLs in browser fallback mode", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    await openChatAttachment({
      id: "attachment-1",
      name: "capture.png",
      mimeType: "image/png",
      sizeBytes: 4096,
      kind: "image",
      previewUrl: "blob:capture-preview",
      source: "paste"
    });

    expect(openSpy).toHaveBeenCalledWith("blob:capture-preview", "_blank", "noopener,noreferrer");
  });

  it("invokes native desktop open when a historical attachment has a file path", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {}
    });
    invokeMock.mockResolvedValueOnce(undefined);

    await openChatAttachment({
      id: "attachment-1",
      name: "capture.png",
      mimeType: "image/png",
      sizeBytes: 4096,
      kind: "image",
      filePath: "/tmp/capture.png",
      source: "picker"
    });

    expect(invokeMock).toHaveBeenCalledWith("chat_attachment_open", {
      filePath: "/tmp/capture.png"
    });

    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("keeps source metadata for dropped and pasted attachments", async () => {
    const dropped = await extractDroppedAttachments([
      new File(["drop"], "drop.txt", { type: "text/plain" })
    ]);
    const pasted = await extractClipboardAttachments([
      new File(["paste"], "paste.txt", { type: "text/plain" })
    ]);

    expect(dropped[0]?.source).toBe("drop");
    expect(pasted[0]?.source).toBe("paste");
  });

  it("creates a hidden input picker that accepts multiple files", () => {
    const picker = createBrowserFileInputPicker();

    expect(picker.type).toBe("file");
    expect(picker.multiple).toBe(true);
  });
});
