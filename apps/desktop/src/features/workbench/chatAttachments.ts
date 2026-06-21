import { invoke } from "@tauri-apps/api/core";
import type { ChatAttachment, ChatAttachmentSource } from "./workbenchState";

const TAURI_INTERNALS_KEY = "__TAURI_INTERNALS__";

type NativePickedChatAttachment = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  kind: "image" | "file";
  file_path: string;
  base64_data?: string;
};

function isTauriDesktopAvailable() {
  return typeof window !== "undefined" && TAURI_INTERNALS_KEY in window;
}

function createAttachmentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAttachmentKind(mimeType: string) {
  return mimeType.startsWith("image/") ? "image" : "file";
}

function readFileAsBase64(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/") || typeof FileReader === "undefined") {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",").pop() : result);
    }, { once: true });
    reader.addEventListener("error", () => resolve(undefined), { once: true });
    reader.readAsDataURL(file);
  });
}

export async function createChatAttachmentFromFile(
  file: File,
  source: ChatAttachmentSource
): Promise<ChatAttachment> {
  const previewUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : undefined;
  const base64Data = await readFileAsBase64(file);

  return {
    id: createAttachmentId(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    kind: getAttachmentKind(file.type || ""),
    previewUrl,
    base64Data,
    source
  };
}

export function createBrowserFileInputPicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.style.position = "absolute";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  return input;
}

export async function pickChatAttachments(): Promise<ChatAttachment[]> {
  if (isTauriDesktopAvailable()) {
    const result = await invoke<NativePickedChatAttachment[]>("chat_attachments_pick");
    return result.map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.mime_type,
      sizeBytes: item.size_bytes,
      kind: item.kind,
      filePath: item.file_path,
      base64Data: item.base64_data,
      source: "picker"
    }));
  }

  return new Promise<ChatAttachment[]>((resolve) => {
    const input = createBrowserFileInputPicker();

    input.addEventListener("change", async () => {
      const files = Array.from(input.files ?? []);
      const attachments = await Promise.all(files.map((file) => createChatAttachmentFromFile(file, "picker")));
      input.remove();
      resolve(attachments);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

export async function extractDroppedAttachments(files: Iterable<File>): Promise<ChatAttachment[]> {
  return Promise.all(Array.from(files).map((file) => createChatAttachmentFromFile(file, "drop")));
}

export async function extractClipboardAttachments(files: Iterable<File>): Promise<ChatAttachment[]> {
  return Promise.all(Array.from(files).map((file) => createChatAttachmentFromFile(file, "paste")));
}

export function extractFilesFromTransferItems(items: Iterable<DataTransferItem>): File[] {
  return Array.from(items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File);
}

export async function openChatAttachment(attachment: ChatAttachment): Promise<void> {
  if (isTauriDesktopAvailable() && attachment.filePath) {
    await invoke("chat_attachment_open", { filePath: attachment.filePath });
    return;
  }

  if (attachment.previewUrl) {
    window.open(attachment.previewUrl, "_blank", "noopener,noreferrer");
  }
}
