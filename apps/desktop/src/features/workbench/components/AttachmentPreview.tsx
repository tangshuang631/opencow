import type { ChatAttachment } from "../workbenchState";

type AttachmentPreviewProps = {
  attachment: ChatAttachment;
  classNamePrefix: "composer" | "message";
  onRemove?: (attachmentId: string) => void;
  onOpen?: (attachment: ChatAttachment) => void;
};

function formatAttachmentSize(sizeBytes: number) {
  const sizeKb = Math.max(1, Math.round(sizeBytes / 1024));
  return `${sizeKb} KB`;
}

function getFileExtension(attachment: ChatAttachment) {
  const nameExtension = attachment.name.split(".").pop()?.trim();

  if (nameExtension && nameExtension !== attachment.name) {
    return nameExtension.toUpperCase().slice(0, 4);
  }

  const mimeExtension = attachment.mimeType.split("/").pop()?.trim();
  return mimeExtension ? mimeExtension.toUpperCase().slice(0, 4) : "";
}

function getRecognizedFileLabel(attachment: ChatAttachment) {
  const extension = getFileExtension(attachment);
  const knownLabels = new Set([
    "PDF",
    "DOC",
    "DOCX",
    "XLS",
    "XLSX",
    "PPT",
    "PPTX",
    "TXT",
    "MD",
    "CSV",
    "JSON",
    "ZIP"
  ]);

  return knownLabels.has(extension) ? extension : "";
}

function getPreviewUrl(attachment: ChatAttachment) {
  if (attachment.previewUrl) {
    return attachment.previewUrl;
  }

  if (attachment.base64Data && attachment.mimeType.startsWith("image/")) {
    return `data:${attachment.mimeType};base64,${attachment.base64Data}`;
  }

  return "";
}

export function AttachmentPreview({ attachment, classNamePrefix, onRemove, onOpen }: AttachmentPreviewProps) {
  const previewUrl = getPreviewUrl(attachment);
  const isImage = attachment.kind === "image" && Boolean(previewUrl);
  const fileLabel = getRecognizedFileLabel(attachment);
  const Root = onOpen ? "button" : "div";
  const rootProps = onOpen
    ? {
        type: "button" as const,
        "aria-label": `打开附件：${attachment.name}`,
        onDoubleClick: () => onOpen(attachment)
      }
    : {};

  return (
    <Root
      className={`${classNamePrefix}-attachment-chip attachment-chip ${isImage ? "attachment-chip-image" : "attachment-chip-file"}`}
      {...rootProps}
    >
      {onRemove ? (
        <button
          aria-label={`移除附件：${attachment.name}`}
          className={`${classNamePrefix}-attachment-remove attachment-remove`}
          type="button"
          onClick={() => onRemove(attachment.id)}
        >
          ×
        </button>
      ) : null}
      {isImage ? (
        <>
          <img alt={`附件缩略图：${attachment.name}`} className="attachment-thumbnail" src={previewUrl} />
          <div className="attachment-image-overlay">
            <p>{attachment.name}</p>
          </div>
        </>
      ) : (
        <>
          <span className={`attachment-file-icon ${fileLabel ? "attachment-file-icon-known" : "attachment-file-icon-unknown"}`}>
            {fileLabel || "?"}
          </span>
          <div className="attachment-copy">
            <p>{attachment.name}</p>
            <span>{fileLabel || "未知文件"} · {formatAttachmentSize(attachment.sizeBytes)}</span>
          </div>
        </>
      )}
    </Root>
  );
}
